import { describe, expect, it } from "vitest";

import {
  createPrismaClient,
  createTemporarySqliteDatabase,
  ensureSqliteSchema,
} from "../src/infra/prisma/testing";

describe("Prisma SQLite harness", () => {
  it("一時SQLiteでユーザーを作成できる", async () => {
    const testDatabase = await createTemporarySqliteDatabase();

    try {
      const schemaResult = await ensureSqliteSchema(testDatabase.databaseUrl);
      expect(schemaResult.ok).toBe(true);
      if (!schemaResult.ok) {
        return;
      }

      const prisma = createPrismaClient(testDatabase.databaseUrl);
      try {
        const createdUser = await prisma.user.create({
          data: {
            username: "harness-user",
            email: "harness@example.com",
            hashedPassword: "hashed",
            isActive: true,
          },
        });

        expect(createdUser.username).toBe("harness-user");

        const userCount = await prisma.user.count();
        expect(userCount).toBe(1);
      } finally {
        await prisma.$disconnect();
      }
    } finally {
      await testDatabase.cleanup();
    }
  });
});
