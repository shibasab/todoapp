import { describe, expect, it } from "vitest";

import { createTemporarySqliteDatabase, ensureSqliteSchema } from "../src/infra/prisma/testing";

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
});
