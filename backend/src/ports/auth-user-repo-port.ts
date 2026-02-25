import type { TaskResult } from "@todoapp/shared";
import type { AuthUserRecord } from "../domain/auth/types";

export type CreateAuthUserInput = Readonly<{
  username: string;
  email: string;
  hashedPassword: string;
}>;

export type AuthUserRepoCreateError =
  | Readonly<{
      type: "DuplicateUsername";
      detail: string;
    }>
  | Readonly<{
      type: "Unexpected";
      detail: string;
    }>;

export type AuthUserRepoPort = Readonly<{
  findById: (id: number) => Promise<AuthUserRecord | null>;
  findByUsername: (username: string) => Promise<AuthUserRecord | null>;
  create: (input: CreateAuthUserInput) => TaskResult<AuthUserRecord, AuthUserRepoCreateError>;
}>;
