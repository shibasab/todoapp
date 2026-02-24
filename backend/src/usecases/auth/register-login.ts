import { err, fromPromise, ok } from "@todoapp/shared";
import { toPublicUser } from "../../domain/auth/types";
import type { AuthUserRepoCreateError, AuthUserRepoPort } from "../../ports/auth-user-repo-port";
import type { PasswordPort } from "../../ports/password-port";
import type { TokenPort } from "../../ports/token-port";
import { assertNever } from "../../shared/error";
import {
  toAuthConflictError,
  toAuthInternalError,
  toAuthInvalidCredentialsError,
  type AuthUseCaseError,
} from "./errors";
import type { AuthUseCaseCommonDependencies, LoginUseCase, RegisterUseCase } from "./types";

type RegisterAndLoginDependencies = Readonly<{
  authUserRepo: AuthUserRepoPort;
  passwordPort: PasswordPort;
  tokenPort: TokenPort;
}> &
  AuthUseCaseCommonDependencies;

const mapCreateErrorToUseCaseError = (errorValue: AuthUserRepoCreateError): AuthUseCaseError => {
  switch (errorValue.type) {
    case "DuplicateUsername":
      return toAuthConflictError("Username already registered");
    case "Unexpected":
      return toAuthInternalError();
    default:
      return assertNever(errorValue, "AuthUserRepoCreateError.type");
  }
};

export const createRegisterUseCase = (
  dependencies: RegisterAndLoginDependencies,
): RegisterUseCase => {
  return async (input) => {
    const hashedPassword = await fromPromise(dependencies.passwordPort.hash(input.password), () =>
      toAuthInternalError(),
    );
    if (!hashedPassword.ok) {
      return err(hashedPassword.error);
    }

    const createdUser = await dependencies.authUserRepo.create({
      username: input.username,
      email: input.email,
      hashedPassword: hashedPassword.data,
    });
    if (!createdUser.ok) {
      return err(mapCreateErrorToUseCaseError(createdUser.error));
    }

    const token = await fromPromise(
      dependencies.tokenPort.createAccessToken(
        { sub: String(createdUser.data.id) },
        dependencies.authConfig,
      ),
      () => toAuthInternalError(),
    );
    if (!token.ok) {
      return err(token.error);
    }

    return ok({
      user: toPublicUser(createdUser.data),
      token: token.data,
    });
  };
};

export const createLoginUseCase = (dependencies: RegisterAndLoginDependencies): LoginUseCase => {
  return async (input) => {
    const user = await fromPromise(dependencies.authUserRepo.findByUsername(input.username), () =>
      toAuthInternalError(),
    );
    if (!user.ok) {
      return err(user.error);
    }
    if (user.data == null) {
      return err(toAuthInvalidCredentialsError());
    }

    const passwordMatches = await fromPromise(
      dependencies.passwordPort.verify(input.password, user.data.hashedPassword),
      () => toAuthInternalError(),
    );
    if (!passwordMatches.ok) {
      return err(passwordMatches.error);
    }
    if (!passwordMatches.data) {
      return err(toAuthInvalidCredentialsError());
    }

    const token = await fromPromise(
      dependencies.tokenPort.createAccessToken(
        { sub: String(user.data.id) },
        dependencies.authConfig,
      ),
      () => toAuthInternalError(),
    );
    if (!token.ok) {
      return err(token.error);
    }

    return ok({
      user: toPublicUser(user.data),
      token: token.data,
    });
  };
};
