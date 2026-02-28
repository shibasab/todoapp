import { describe, expect, it } from "vitest";
import { toAuthResponseDto, toUserDto } from "../../src/http/auth/mappers";

describe("auth mappers", () => {
  it("toUserDto は domain user を shared User DTO へ変換する", () => {
    expect(
      toUserDto({
        id: 10,
        username: "alice",
        email: "alice@example.com",
      }),
    ).toEqual({
      id: 10,
      username: "alice",
      email: "alice@example.com",
    });
  });

  it("toAuthResponseDto は domain auth response を shared AuthResponse DTO へ変換する", () => {
    expect(
      toAuthResponseDto({
        user: {
          id: 3,
          username: "bob",
          email: "",
        },
        token: "jwt-token",
      }),
    ).toEqual({
      user: {
        id: 3,
        username: "bob",
        email: "",
      },
      token: "jwt-token",
    });
  });
});
