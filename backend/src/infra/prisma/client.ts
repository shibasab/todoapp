import { PrismaClient } from "@prisma/client";

export const createPrismaClient = (databaseUrl: string): PrismaClient =>
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

export const resolveDatabaseUrl = (databaseUrl: string | undefined): string =>
  databaseUrl == null || databaseUrl === "" ? "file:./todo.db" : databaseUrl;
