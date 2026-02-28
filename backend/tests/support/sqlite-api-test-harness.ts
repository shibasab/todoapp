import { createApp, type AppDependencies } from "../../src/app";
import {
  cloneTemporarySqliteDatabase,
  createPrismaClient,
  createTemporarySqliteDatabase,
  ensureSqliteSchema,
  type TemporarySqliteDatabase,
} from "../../src/infra/prisma/testing";

type ApiTestDependencies = Pick<AppDependencies, "authConfig">;

type ApiTestApp = Readonly<{
  app: ReturnType<typeof createApp>;
  prisma: ReturnType<typeof createPrismaClient>;
  cleanup: () => Promise<void>;
}>;

// APIテスト高速化のため、スキーマ適用済みSQLiteをテンプレートとして1回だけ作成する。
// 各テストはこのテンプレートを複製した専用DBを使い、テスト間の状態リークを防ぐ。
export const createSqliteApiTestAppFactory = () => {
  let templateDatabasePromise: Promise<TemporarySqliteDatabase> | null = null;

  const getTemplateDatabase = async (): Promise<TemporarySqliteDatabase> => {
    if (templateDatabasePromise == null) {
      templateDatabasePromise = (async () => {
        const templateDatabase = await createTemporarySqliteDatabase();
        const schemaResult = await ensureSqliteSchema(templateDatabase.databaseUrl);
        if (!schemaResult.ok) {
          await templateDatabase.cleanup();
          throw new Error(JSON.stringify(schemaResult.error));
        }

        return templateDatabase;
      })();
    }

    return templateDatabasePromise;
  };

  // `prisma db push` を各テストで毎回実行すると遅いため、
  // テンプレートDBのファイル複製で初期化コストを下げる。
  const setupApiTestApp = async (dependencies: ApiTestDependencies): Promise<ApiTestApp> => {
    const templateDatabase = await getTemplateDatabase();
    const temporaryDatabase = await cloneTemporarySqliteDatabase(templateDatabase.databaseUrl);
    const prisma = createPrismaClient(temporaryDatabase.databaseUrl);
    const app = createApp({
      prisma,
      ...dependencies,
    });

    return {
      app,
      prisma,
      cleanup: async () => {
        await prisma.$disconnect();
        await temporaryDatabase.cleanup();
      },
    };
  };

  const cleanupTemplateDatabase = async (): Promise<void> => {
    if (templateDatabasePromise == null) {
      return;
    }

    const pendingTemplateDatabase = templateDatabasePromise;
    templateDatabasePromise = null;
    const templateDatabase = await pendingTemplateDatabase;
    await templateDatabase.cleanup();
  };

  return {
    setupApiTestApp,
    cleanupTemplateDatabase,
  };
};
