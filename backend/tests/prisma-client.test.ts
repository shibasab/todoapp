import { describe, expect, it } from "vitest";

import { resolveDatabaseUrl } from "../src/infra/prisma/client";

describe("resolveDatabaseUrl", () => {
  it("未指定時はローカルSQLiteを返す", () => {
    expect(resolveDatabaseUrl(undefined)).toBe("file:./todo.db");
  });

  it("指定値があればそのまま返す", () => {
    expect(resolveDatabaseUrl("file:/tmp/test.db")).toBe("file:/tmp/test.db");
  });
});
