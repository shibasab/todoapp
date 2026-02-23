import { describe, expect, it } from "vitest";

import { HealthResponseSchema } from "../src/contracts/health";

describe("HealthResponseSchema", () => {
  it("status=ok を受け入れる", () => {
    const result = HealthResponseSchema.safeParse({ status: "ok" });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error.message);
    }

    expect(result.data).toEqual({ status: "ok" });
  });

  it("未知のstatusを拒否する", () => {
    const result = HealthResponseSchema.safeParse({ status: "down" });

    expect(result.success).toBe(false);
  });
});
