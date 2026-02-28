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
