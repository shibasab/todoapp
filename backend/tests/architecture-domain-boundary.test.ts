import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const collectTypeScriptFiles = (dir: string): readonly string[] => {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return collectTypeScriptFiles(fullPath);
    }
    return fullPath.endsWith(".ts") ? [fullPath] : [];
  });
};

describe("architecture: domain layer boundary", () => {
  it("domain層は@todoapp/sharedへ依存しない", () => {
    const domainDir = join(process.cwd(), "src", "domain");
    const domainFiles = collectTypeScriptFiles(domainDir);

    const violatedFiles = domainFiles.filter((filePath) => {
      const sourceCode = readFileSync(filePath, "utf-8");
      return sourceCode.includes('from "@todoapp/shared"');
    });

    expect(violatedFiles).toEqual([]);
  });
});
