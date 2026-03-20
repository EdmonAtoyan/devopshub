"use strict";

const { execFileSync } = require("child_process");
const { existsSync, readdirSync } = require("fs");
const path = require("path");

const BROKEN_MIGRATION = "20260317120000_add_mentions_support";
const SCHEMA_PATH = path.resolve(__dirname, "../../../prisma/schema.prisma");
const MIGRATIONS_DIR = path.resolve(__dirname, "../../../prisma/migrations");
const DB_STARTUP_TIMEOUT_MS = resolvePositiveInteger(process.env.DB_STARTUP_TIMEOUT_MS, 180_000);
const DB_STARTUP_RETRY_MS = resolvePositiveInteger(process.env.DB_STARTUP_RETRY_MS, 5_000);

function loadGeneratedPrismaClient() {
  try {
    return require("../../../node_modules/@prisma/client/.prisma/client");
  } catch (error) {
    const cause = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`Prisma client is unavailable during startup.${cause}`);
  }
}

function createRuntimePrismaClient() {
  const { PrismaClient } = loadGeneratedPrismaClient();
  const databaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();

  if (!databaseUrl) {
    return new PrismaClient();
  }

  return new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });
}

function runPrisma(args) {
  console.log(`Running prisma ${args.join(" ")}...`);
  execFileSync("npm", ["exec", "--", "prisma", ...args, "--schema", SCHEMA_PATH], {
    stdio: "inherit",
  });
}

function resolvePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function listMigrationDirectories() {
  if (!existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function hasMigrationFiles() {
  return listMigrationDirectories().length > 0;
}

async function waitForDatabase(prisma) {
  const startedAt = Date.now();
  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      await prisma.$queryRaw`SELECT 1`;
      if (attempt > 1) {
        console.log(`Database became reachable after ${attempt} attempts.`);
      }
      return;
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      if (elapsed >= DB_STARTUP_TIMEOUT_MS) {
        throw new Error(
          `Database did not become reachable within ${DB_STARTUP_TIMEOUT_MS}ms. Last error: ${message}`,
        );
      }

      console.log(
        `Database is not reachable yet (attempt ${attempt}). Retrying in ${DB_STARTUP_RETRY_MS}ms...`,
      );
      await sleep(DB_STARTUP_RETRY_MS);
    }
  }
}

async function resolveCurrentSchema(prisma) {
  const [row] = await prisma.$queryRaw`
    SELECT current_schema() AS schema_name
  `;

  return row?.schema_name || "public";
}

async function listTables(prisma, schemaName) {
  const rows = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ${schemaName}
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `;

  return Array.isArray(rows)
    ? rows
        .map((row) => row?.table_name)
        .filter((tableName) => typeof tableName === "string")
    : [];
}

function hasApplicationTables(tableNames) {
  return tableNames.some((tableName) => tableName !== "_prisma_migrations");
}

async function resolveBrokenMigrationIfNeeded(prisma) {
  const pendingBrokenMigration = await prisma.$queryRaw`
    SELECT "migration_name"
    FROM "_prisma_migrations"
    WHERE "migration_name" = ${BROKEN_MIGRATION}
      AND "finished_at" IS NULL
      AND "rolled_back_at" IS NULL
    LIMIT 1
  `;

  if (Array.isArray(pendingBrokenMigration) && pendingBrokenMigration.length > 0) {
    console.log(`Detected failed migration ${BROKEN_MIGRATION}; marking it rolled back before redeploy.`);
    runPrisma(["migrate", "resolve", "--rolled-back", BROKEN_MIGRATION]);
  }
}

function synchronizeSchema(tableNames) {
  const migrationFilesPresent = hasMigrationFiles();
  const migrationTablePresent = tableNames.includes("_prisma_migrations");
  const databaseHasApplicationTables = hasApplicationTables(tableNames);

  if (migrationTablePresent) {
    if (migrationFilesPresent) {
      console.log("Prisma migration history found; applying pending migrations.");
      runPrisma(["migrate", "deploy"]);
      return;
    }

    console.log("Migration table exists but no migration files were found; syncing schema with db push.");
    runPrisma(["db", "push"]);
    return;
  }

  if (!databaseHasApplicationTables) {
    if (migrationFilesPresent) {
      console.log("Database is empty; bootstrapping schema with prisma migrate deploy.");
      runPrisma(["migrate", "deploy"]);
      return;
    }

    console.log("Database is empty and no migration files were found; bootstrapping schema with prisma db push.");
    runPrisma(["db", "push"]);
    return;
  }

  console.log(
    "Database contains tables but Prisma migration history is missing; syncing schema with prisma db push as a safe fallback.",
  );
  runPrisma(["db", "push"]);
}

async function main() {
  const inspectionPrisma = createRuntimePrismaClient();

  try {
    await waitForDatabase(inspectionPrisma);

    const schemaName = await resolveCurrentSchema(inspectionPrisma);
    const tableNames = await listTables(inspectionPrisma, schemaName);
    const migrationTablePresent = tableNames.includes("_prisma_migrations");

    console.log(
      `Startup schema inspection for ${schemaName}: ${tableNames.length > 0 ? tableNames.join(", ") : "[empty]"}`,
    );

    if (migrationTablePresent) {
      await resolveBrokenMigrationIfNeeded(inspectionPrisma);
    }
  } finally {
    await inspectionPrisma.$disconnect().catch(() => undefined);
  }

  const syncPrisma = createRuntimePrismaClient();

  try {
    await waitForDatabase(syncPrisma);
    const schemaName = await resolveCurrentSchema(syncPrisma);
    const tableNames = await listTables(syncPrisma, schemaName);
    synchronizeSchema(tableNames);
  } finally {
    await syncPrisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
