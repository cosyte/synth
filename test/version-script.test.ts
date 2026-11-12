import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

describe("version script", () => {
  it("regenerates the docs reference after syncing the VERSION constant", () => {
    const steps = (pkg.scripts["version"] ?? "").split("&&").map((s) => s.trim());
    const sync = steps.findIndex((s) => s.startsWith("cosyte-process sync-version"));
    const docs = steps.findIndex((s) => s === "pnpm docs:reference");
    expect(sync).toBeGreaterThan(-1);
    expect(docs).toBeGreaterThan(sync);
  });
});
