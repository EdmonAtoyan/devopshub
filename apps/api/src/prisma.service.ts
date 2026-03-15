import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createRuntimePrismaClient } from "./runtime-prisma";

type RuntimePrismaClient = ReturnType<typeof createRuntimePrismaClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client!: RuntimePrismaClient;

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
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client?.$disconnect();
  }
}

export interface PrismaService extends RuntimePrismaClient {}
