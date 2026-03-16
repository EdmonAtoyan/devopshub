"use strict";

const { execFileSync } = require("child_process");

const BROKEN_MIGRATION = "20260317120000_add_mentions_support";
const SCHEMA_PATH = "../../prisma/schema.prisma";

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
  execFileSync("npm", ["exec", "--", "prisma", ...args, "--schema", SCHEMA_PATH], {
    stdio: "inherit",
  });
}

async function main() {
  const prisma = createRuntimePrismaClient();

  try {
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
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }

  runPrisma(["migrate", "deploy"]);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
