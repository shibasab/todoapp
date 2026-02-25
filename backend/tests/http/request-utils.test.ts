import { describe, expect, it } from "vitest";
import { readJsonBody, readValidationField } from "../../src/http/shared/request-utils";

describe("http request utils", () => {
  it("readValidationField は先頭issueのpath文字列を返す", () => {
    const field = readValidationField({
      issues: [
        {
          path: ["email"],
        },
      ],
    });

    expect(field).toBe("email");
  });

  it("readValidationField はpathが読めない場合fallbackを返す", () => {
    const defaultField = readValidationField({
      issues: [
        {
          path: [1],
        },
      ],
    });
    const queryField = readValidationField(
      {
        issues: [
          {
            path: [],
          },
        ],
      },
      "query",
    );

    expect(defaultField).toBe("body");
    expect(queryField).toBe("query");
  });

  it("readJsonBody はJSON読込成功時にokを返す", async () => {
    const result = await readJsonBody({
      req: {
        json: async () => ({
          name: "todo",
        }),
      },
    });

    expect(result).toEqual({
      ok: true,
      data: {
        name: "todo",
      },
    });
  });

  it("readJsonBody はJSON読込失敗時にinvalid_bodyを返す", async () => {
    const result = await readJsonBody({
      req: {
        json: async () => {
          throw new Error("invalid json");
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      error: "invalid_body",
    });
  });
});
