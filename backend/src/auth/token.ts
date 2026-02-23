import { SignJWT, jwtVerify } from "jose";
import { err, ok, type TaskResult } from "@todoapp/shared";
import type { AuthConfig } from "./types";

export type TokenError =
  | Readonly<{
      type: "TokenVerifyFailed";
      detail: string;
    }>
  | Readonly<{
      type: "TokenSubClaimMissing";
    }>;

const stringifyError = (errorValue: unknown): string =>
  errorValue instanceof Error ? errorValue.message : String(errorValue);

const encodeSecret = (secret: string): Uint8Array => new TextEncoder().encode(secret);

export const createAccessToken = async (
  payload: Readonly<Record<string, unknown>>,
  authConfig: AuthConfig,
): Promise<string> =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(`${authConfig.jwtAccessTokenExpireMinutes}m`)
    .sign(encodeSecret(authConfig.jwtSecret));

export const verifyAccessToken = async (
  token: string,
  authConfig: AuthConfig,
): TaskResult<string, TokenError> => {
  try {
    const verified = await jwtVerify(token, encodeSecret(authConfig.jwtSecret), {
      algorithms: ["HS256"],
    });
    const userId = verified.payload.sub;
    if (typeof userId !== "string" || userId === "") {
      return err({
        type: "TokenSubClaimMissing",
      });
    }

    return ok(userId);
  } catch (errorValue) {
    return err({
      type: "TokenVerifyFailed",
      detail: stringifyError(errorValue),
    });
  }
};
