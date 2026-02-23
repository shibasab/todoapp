import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type LintRunResult = Readonly<{
  status: number;
  output: string;
}>;

const getRepoRoot = (): string => {
  const testFilePath = fileURLToPath(import.meta.url);
  return resolve(testFilePath, "../../..");
};

const runSharedLintForCode = (sourceCode: string): LintRunResult => {
  const repoRoot = getRepoRoot();
  const tempParentDir = join(repoRoot, "shared/tests/.tmp-fp-guardrails");
  mkdirSync(tempParentDir, { recursive: true });
  const tempDir = mkdtempSync(join(tempParentDir, "case-"));
  const tempFilePath = join(tempDir, "sample.ts");

  writeFileSync(tempFilePath, sourceCode, "utf8");

  const oxlintBinPath = resolve(repoRoot, "node_modules/.bin/oxlint");
  const configPath = resolve(repoRoot, "shared/.oxlintrc.json");
  const result = spawnSync(oxlintBinPath, ["--type-aware", "-c", configPath, tempFilePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  rmSync(tempDir, { recursive: true, force: true });

  return {
    status: result.status ?? 1,
    output: `${result.stdout}\n${result.stderr}`,
  };
};

describe("FPガードレール", () => {
  it("空のclassを禁止する", () => {
    const result = runSharedLintForCode("class Sample {}");

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("no-extraneous-class");
  });

  it("throw literalを禁止する", () => {
    const result = runSharedLintForCode("throw 'boom'");

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("no-throw-literal");
  });

  it("throw new Errorは許可される", () => {
    const result = runSharedLintForCode("throw new Error('boom')");

    expect(result.status).toBe(0);
  });

  it("理由付きdisableコメントで禁止ルールを明示的に回避できる", () => {
    const result = runSharedLintForCode(
      [
        "// oxlint-disable-next-line no-throw-literal,typescript/only-throw-error -- 境界でHTTP例外へ変換するため",
        "throw 'boom'",
      ].join("\n"),
    );

    expect(result.status).toBe(0);
  });
});
