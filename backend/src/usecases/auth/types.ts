import type { TaskResult } from "@todoapp/shared";
import type { AuthTokenResponse, AuthConfig, PublicUser } from "../../domain/auth/types";
import type { AuthUseCaseError } from "./errors";

export type RegisterInput = Readonly<{
  username: string;
  email: string;
  password: string;
}>;

export type LoginInput = Readonly<{
  username: string;
  password: string;
}>;

export type RegisterUseCase = (
  input: RegisterInput,
) => TaskResult<AuthTokenResponse, AuthUseCaseError>;

export type LoginUseCase = (input: LoginInput) => TaskResult<AuthTokenResponse, AuthUseCaseError>;

export type AuthenticateUseCase = (
  authorizationHeaderOrToken: string | undefined,
) => TaskResult<PublicUser, AuthUseCaseError>;

export type AuthUseCases = Readonly<{
  register: RegisterUseCase;
  login: LoginUseCase;
  authenticate: AuthenticateUseCase;
}>;

export type AuthUseCaseCommonDependencies = Readonly<{
  authConfig: AuthConfig;
}>;
