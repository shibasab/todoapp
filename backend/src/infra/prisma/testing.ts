import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";
import { err, ok, type TaskResult } from "@todoapp/shared";

export type TemporarySqliteDatabase = Readonly<{
  databaseUrl: string;
  cleanup: () => Promise<void>;
}>;

export type PrismaSchemaApplyError =
  | Readonly<{
      type: "PrismaBinaryNotFound";
      attemptedCommands: readonly string[];
    }>
  | Readonly<{
      type: "PrismaSchemaApplyFailed";
      command: string;
      exitCode: number | null;
      stdout: string;
      stderr: string;
    }>;

export type EnsureSqliteSchemaOptions = Readonly<{
  prismaCommandOverride?: string;
}>;

const getBackendRoot = (): string => {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDirectory = dirname(currentFilePath);
  return resolve(currentDirectory, "../../../");
};

const resolvePrismaCommandCandidates = (options: EnsureSqliteSchemaOptions): readonly string[] => {
  const envOverride = options.prismaCommandOverride ?? process.env.PRISMA_CLI_PATH;
  if (envOverride != null && envOverride !== "") {
    return [envOverride];
  }

  return ["prisma"];
};

const resolveSchemaPath = (): string => resolve(getBackendRoot(), "prisma/schema.prisma");

const runPrismaDbPush = (
  prismaCommand: string,
  databaseUrl: string,
  schemaPath: string,
): SpawnSyncReturns<string> =>
  spawnSync(prismaCommand, ["db", "push", "--skip-generate", "--schema", schemaPath], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    encoding: "utf8",
    timeout: 30_000,
  });

const isExecutableNotFound = (result: SpawnSyncReturns<string>): boolean =>
  (result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";

export const createTemporarySqliteDatabase = async (): Promise<TemporarySqliteDatabase> => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "todoapp-prisma-"));
  const databasePath = join(tempDirectory, "test.db");
  const databaseUrl = `file:${databasePath}`;

  return {
    databaseUrl,
    cleanup: async () => {
      await rm(tempDirectory, { recursive: true, force: true });
    },
  };
};

export const ensureSqliteSchema = async (
  databaseUrl: string,
  options: EnsureSqliteSchemaOptions = {},
): TaskResult<void, PrismaSchemaApplyError> => {
  const prismaCommands = resolvePrismaCommandCandidates(options);
  const schemaPath = resolveSchemaPath();

  for (const prismaCommand of prismaCommands) {
    const result = runPrismaDbPush(prismaCommand, databaseUrl, schemaPath);

    if (isExecutableNotFound(result)) {
      continue;
    }

    if (result.status === 0) {
      return ok(undefined);
    }

    return err({
      type: "PrismaSchemaApplyFailed",
      command: prismaCommand,
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  return err({
    type: "PrismaBinaryNotFound",
    attemptedCommands: prismaCommands,
  });
};

export const createPrismaClient = (databaseUrl: string): PrismaClient => {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
};
