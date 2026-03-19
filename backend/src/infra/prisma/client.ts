import { PrismaLibSql } from '@prisma/adapter-libsql'

import { PrismaClient as GeneratedPrismaClient } from '../../../generated/prisma/client'
import type {
  Prisma as PrismaNamespace,
  PrismaClient as PrismaClientType,
  Todo,
  User,
} from '../../../generated/prisma/client'

const SQLITE_TIMESTAMP_FORMAT = 'unixepoch-ms'

export type { PrismaNamespace as Prisma, PrismaClientType as PrismaClient, Todo, User }

const createPrismaAdapter = (databaseUrl: string): PrismaLibSql =>
  new PrismaLibSql(
    {
      url: databaseUrl,
    },
    {
      timestampFormat: SQLITE_TIMESTAMP_FORMAT,
    },
  )

export const createPrismaClient = (databaseUrl: string): PrismaClientType =>
  new GeneratedPrismaClient({
    adapter: createPrismaAdapter(databaseUrl),
  })

export const resolveDatabaseUrl = (databaseUrl: string | undefined): string =>
  databaseUrl == null || databaseUrl === '' ? 'file:./todo.db' : databaseUrl
