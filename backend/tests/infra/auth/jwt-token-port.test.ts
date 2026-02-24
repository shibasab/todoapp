import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { createAccessToken, verifyAccessToken } from "../../../src/infra/auth/jwt-token-port";
import type { AuthConfig } from "../../../src/domain/auth/types";

const authConfig: AuthConfig = {
  jwtSecret: "jwt-token-port-test-secret",
  jwtAccessTokenExpireMinutes: 30,
};

const encodeSecret = (secret: string): Uint8Array => new TextEncoder().encode(secret);

describe("jwt token port", () => {
  it("createAccessToken / verifyAccessToken でsubクレームを往復できる", async () => {
    const token = await createAccessToken({ sub: "123" }, authConfig);

    const verified = await verifyAccessToken(token, authConfig);

    expect(verified).toEqual({
      ok: true,
      data: "123",
    });
  });

  it("verifyAccessToken はsubクレーム欠落トークンをTokenSubClaimMissingで返す", async () => {
    const tokenWithoutSub = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime("30m")
      .sign(encodeSecret(authConfig.jwtSecret));

    const verified = await verifyAccessToken(tokenWithoutSub, authConfig);

    expect(verified).toEqual({
      ok: false,
      error: {
        type: "TokenSubClaimMissing",
      },
    });
  });

  it("verifyAccessToken は不正トークンをTokenVerifyFailedで返す", async () => {
    const verified = await verifyAccessToken("invalid.token.value", authConfig);

    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.type).toBe("TokenVerifyFailed");
      if (verified.error.type === "TokenVerifyFailed") {
        expect(verified.error.detail.length).toBeGreaterThan(0);
      }
    }
  });
});
