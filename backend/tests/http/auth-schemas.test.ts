import { describe, expect, it } from "vitest";
import { loginBodySchema, registerBodySchema } from "../../src/http/auth/schemas";

describe("auth schemas", () => {
  it("registerBodySchema は前後空白をtrimし、email未指定/nullを空文字へ正規化する", () => {
    const withoutEmail = registerBodySchema.parse({
      username: "  user-name  ",
      password: "  password  ",
    });
    const nullEmail = registerBodySchema.parse({
      username: "user-name",
      password: "password",
      email: null,
    });

    expect(withoutEmail).toEqual({
      username: "user-name",
      password: "password",
      email: "",
    });
    expect(nullEmail.email).toBe("");
  });

  it("registerBodySchema は不正形式を弾く", () => {
    const invalidEmail = registerBodySchema.safeParse({
      username: "user-name",
      password: "password",
      email: 123,
    });
    const emptyUsername = registerBodySchema.safeParse({
      username: "   ",
      password: "password",
      email: "user@example.com",
    });

    expect(invalidEmail.success).toBe(false);
    expect(emptyUsername.success).toBe(false);
  });

  it("loginBodySchema は前後空白をtrimし、空文字を拒否する", () => {
    const parsed = loginBodySchema.parse({
      username: "  user-name  ",
      password: "  password  ",
    });
    const invalid = loginBodySchema.safeParse({
      username: "user-name",
      password: "   ",
    });

    expect(parsed).toEqual({
      username: "user-name",
      password: "password",
    });
    expect(invalid.success).toBe(false);
  });
});
