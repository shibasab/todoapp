import { describe, expect, it } from "vitest";

import {
  cloneTemporarySqliteDatabase,
  createPrismaClient,
  createTemporarySqliteDatabase,
  ensureSqliteSchema,
} from "../src/infra/prisma/testing";

describe("Prisma testing utilities", () => {
  it("不正なDATABASE_URLではスキーマ適用で失敗する", async () => {
    const result = await ensureSqliteSchema("not-a-valid-sqlite-url");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.type).toBe("PrismaSchemaApplyFailed");
    if (result.error.type === "PrismaSchemaApplyFailed") {
      expect(result.error.command).toMatch(/prisma/);
    }
  });

  it("PRISMA_CLI_PATH上書き時にCLI実行失敗を検出する", async () => {
    const testDatabase = await createTemporarySqliteDatabase();

    try {
      const result = await ensureSqliteSchema(testDatabase.databaseUrl, {
        prismaCommandOverride: "/not-found/prisma",
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }

      expect(result.error.type).toBe("PrismaBinaryNotFound");
      if (result.error.type === "PrismaBinaryNotFound") {
        expect(result.error.attemptedCommands).toEqual(["/not-found/prisma"]);
      }
    } finally {
      await testDatabase.cleanup();
    }
  });

  it("スキーマ適用済みDBをクローンでき、クローン側の更新が元DBに影響しない", async () => {
    const sourceDatabase = await createTemporarySqliteDatabase();

    try {
      const schemaResult = await ensureSqliteSchema(sourceDatabase.databaseUrl);
      if (!schemaResult.ok) {
        throw new Error(JSON.stringify(schemaResult.error));
      }

      const sourcePrisma = createPrismaClient(sourceDatabase.databaseUrl);

      try {
        await sourcePrisma.user.create({
          data: {
            username: "source-user",
            email: "source@example.com",
            hashedPassword: "hashed",
            isActive: true,
          },
        });

        const clonedDatabase = await cloneTemporarySqliteDatabase(sourceDatabase.databaseUrl);
        const clonedPrisma = createPrismaClient(clonedDatabase.databaseUrl);

        try {
          const sourceCountBefore = await sourcePrisma.user.count();
          const cloneCountBefore = await clonedPrisma.user.count();

          expect(sourceCountBefore).toBe(1);
          expect(cloneCountBefore).toBe(1);

          await clonedPrisma.user.create({
            data: {
              username: "clone-user",
              email: "clone@example.com",
              hashedPassword: "hashed",
              isActive: true,
            },
          });

          const sourceCountAfter = await sourcePrisma.user.count();
          const cloneCountAfter = await clonedPrisma.user.count();

          expect(sourceCountAfter).toBe(1);
          expect(cloneCountAfter).toBe(2);
        } finally {
          await clonedPrisma.$disconnect();
          await clonedDatabase.cleanup();
        }
      } finally {
        await sourcePrisma.$disconnect();
      }
    } finally {
      await sourceDatabase.cleanup();
    }
  });
});
