import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createRuntimePrismaClient } from "./runtime-prisma";

type RuntimePrismaClient = ReturnType<typeof createRuntimePrismaClient>;
const DEFAULT_CONNECT_MAX_ATTEMPTS = 12;
const DEFAULT_CONNECT_RETRY_MS = 5_000;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client!: RuntimePrismaClient;
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }

        return target.client?.[prop as keyof RuntimePrismaClient];
      },
    }) as PrismaService;
  }

  async onModuleInit() {
    this.client = createRuntimePrismaClient();
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.client?.$disconnect();
  }

  private async connectWithRetry() {
    const maxAttempts = resolvePositiveInteger(
      process.env.DATABASE_CONNECT_MAX_ATTEMPTS,
      DEFAULT_CONNECT_MAX_ATTEMPTS,
    );
    const retryDelayMs = resolvePositiveInteger(
      process.env.DATABASE_CONNECT_RETRY_MS,
      DEFAULT_CONNECT_RETRY_MS,
    );

    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt += 1;

      try {
        await this.client.$connect();
        if (attempt > 1) {
          this.logger.log(`Connected to PostgreSQL after ${attempt} attempts`);
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt >= maxAttempts) {
          this.logger.error(
            `Unable to connect to PostgreSQL after ${attempt} attempts: ${message}`,
            error instanceof Error ? error.stack : undefined,
          );
          throw error;
        }

        this.logger.warn(
          `PostgreSQL connection attempt ${attempt}/${maxAttempts} failed: ${message}. Retrying in ${retryDelayMs}ms.`,
        );
        await sleep(retryDelayMs);
      }
    }
  }
}

export interface PrismaService extends RuntimePrismaClient {}

function resolvePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
