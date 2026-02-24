import type { TaskResult } from "@todoapp/shared";
import type { AuthConfig } from "../domain/auth/types";

export type TokenVerifyError =
  | Readonly<{
      type: "TokenVerifyFailed";
      detail: string;
    }>
  | Readonly<{
      type: "TokenSubClaimMissing";
    }>;

export type TokenPort = Readonly<{
  createAccessToken: (
    payload: Readonly<Record<string, unknown>>,
    authConfig: AuthConfig,
  ) => Promise<string>;
  verifyAccessToken: (
    token: string,
    authConfig: AuthConfig,
  ) => TaskResult<string, TokenVerifyError>;
}>;
