import { describe, expect, it } from "vitest";

import { all, err, flatMap, fromPromise, map, mapError, match, ok } from "../src/fp/result";

describe("Result", () => {
  it("ok値をmapで変換できる", () => {
    const result = map(ok(10), (value) => value * 2);

    expect(result).toEqual(ok(20));
  });

  it("err値はmapで変換されない", () => {
    const result = map(err("failed"), (value: number) => value * 2);

    expect(result).toEqual(err("failed"));
  });

  it("flatMapでok連鎖できる", () => {
    const result = flatMap(ok("todo"), (value) => ok(`${value}-app`));

    expect(result).toEqual(ok("todo-app"));
  });

  it("mapErrorでerrを変換できる", () => {
    const result = mapError(err("missing"), (value) => ({ code: value }));

    expect(result).toEqual(err({ code: "missing" }));
  });

  it("matchで分岐できる", () => {
    const success = match(ok(1), {
      ok: (value) => `ok:${value}`,
      err: () => "err:unexpected",
    });

    const failure = match(err("x"), {
      ok: (value: number) => `ok:${value}`,
      err: (error) => `err:${error}`,
    });

    expect(success).toBe("ok:1");
    expect(failure).toBe("err:x");
  });

  it("fromPromiseで成功をokに変換する", async () => {
    const result = await fromPromise(Promise.resolve(42), (error) => String(error));

    expect(result).toEqual(ok(42));
  });

  it("fromPromiseで失敗をerrに変換する", async () => {
    const result = await fromPromise(Promise.reject(new Error("boom")), (error) =>
      error instanceof Error ? error.message : String(error),
    );

    expect(result).toEqual(err("boom"));
  });

  it("allでok配列をまとめる", () => {
    const result = all([ok(1), ok(2), ok(3)] as const);

    expect(result).toEqual(ok([1, 2, 3]));
  });

  it("allで最初のerrを返す", () => {
    const result = all([ok(1), err("e1"), err("e2")] as const);

    expect(result).toEqual(err("e1"));
  });
});
