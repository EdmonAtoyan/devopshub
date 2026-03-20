type RuntimePrismaOptions = {
  datasources?: {
    db?: {
      url: string;
    };
  };
  [key: string]: unknown;
};

function loadGeneratedPrismaClient() {
  try {
    return require("../../../node_modules/@prisma/client/.prisma/client") as {
      PrismaClient: new (options?: Record<string, unknown>) => any;
    };
  } catch (error) {
    const cause = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(
      `Prisma client is unavailable. Run "npm run db:generate" before starting the API.${cause}`,
    );
  }
}

export function createRuntimePrismaClient(options: RuntimePrismaOptions = {}) {
  const { PrismaClient } = loadGeneratedPrismaClient();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl && process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL must be configured in production");
  }

  if (!databaseUrl) {
    return new PrismaClient(options as any);
  }

  return new PrismaClient({
    ...(options as any),
    datasources: {
      ...options.datasources,
      db: { url: databaseUrl },
    },
  });
}
