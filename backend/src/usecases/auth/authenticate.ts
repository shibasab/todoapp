import { err, fromPromise, ok } from "@todoapp/shared";
import { toPublicUser } from "../../domain/auth/types";
import type { AuthUserRepoPort } from "../../ports/auth-user-repo-port";
import type { TokenPort } from "../../ports/token-port";
import { toAuthUnauthorizedError } from "./errors";
import type { AuthenticateUseCase, AuthUseCaseCommonDependencies } from "./types";

type AuthenticateDependencies = Readonly<{
  authUserRepo: AuthUserRepoPort;
  tokenPort: TokenPort;
}> &
  AuthUseCaseCommonDependencies;

const readAccessToken = (authorizationHeaderOrToken: string | undefined): string | null => {
  if (authorizationHeaderOrToken == null || authorizationHeaderOrToken === "") {
    return null;
  }

  if (authorizationHeaderOrToken.startsWith("Bearer ")) {
    const bearerToken = authorizationHeaderOrToken.slice("Bearer ".length).trim();
    return bearerToken === "" ? null : bearerToken;
  }

  return authorizationHeaderOrToken.includes(" ") ? null : authorizationHeaderOrToken;
};

const toUserId = (subject: string): number | null => {
  const userId = Number(subject);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

export const createAuthenticateUseCase = (
  dependencies: AuthenticateDependencies,
): AuthenticateUseCase => {
  return async (authorizationHeaderOrToken) => {
    const token = readAccessToken(authorizationHeaderOrToken);
    if (token == null) {
      return err(toAuthUnauthorizedError());
    }

    const verified = await dependencies.tokenPort.verifyAccessToken(token, dependencies.authConfig);
    if (!verified.ok) {
      return err(toAuthUnauthorizedError());
    }

    const userId = toUserId(verified.data);
    if (userId == null) {
      return err(toAuthUnauthorizedError());
    }

    const user = await fromPromise(dependencies.authUserRepo.findById(userId), () =>
      toAuthUnauthorizedError(),
    );
    if (!user.ok) {
      return err(user.error);
    }
    if (user.data == null || !user.data.isActive) {
      return err(toAuthUnauthorizedError());
    }

    return ok(toPublicUser(user.data));
  };
};
