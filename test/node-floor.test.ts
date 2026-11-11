/**
 * The oldest Node.js this package allows is one where a generated value is an instance of the
 * parser classes the caller imports.
 *
 * A generator loads its parser on first use, synchronously, through `require`. The ES module build
 * `require`s the parser's ES module entry, the module an `import` of the parser gives, and Node.js
 * can do that by default only from 22.12. Before 22.12 the build has to fall back to the parser's
 * CommonJS entry, a second copy of every parser class, so `instanceof` fails for a caller who
 * imports the parser as an ES module. So the floor in `engines.node` is 22.12.0, and the smoke
 * workflow runs the built package's dual smoke, which checks `instanceof` under both module
 * systems, on exactly that floor.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { generateCcd } from "../src/ccda/index.js";

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

/** The first Node.js 22 release that loads an ES module through `require` by default. */
const REQUIRE_ESM_FLOOR = [22, 12, 0] as const;

/** The `X.Y.Z` floor of an `engines.node` range written as `>=X.Y.Z`. */
function floorOf(range: string): readonly number[] {
  const match = /^>=(\d+)\.(\d+)\.(\d+)$/.exec(range.trim());
  if (match === null) throw new Error(`engines.node "${range}" is not a single >=X.Y.Z floor`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Whether version `a` is at or above version `b`. */
function atLeast(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}

/** The lines of one top-level job in a workflow, from its key to the next job's. */
function jobBlock(workflow: string, job: string): string | undefined {
  const lines = workflow.split("\n");
  const start = lines.indexOf(`  ${job}:`);
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}[\w-]+:/.test(line));
  return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join("\n");
}

const engines = (JSON.parse(read("../package.json")) as { engines: { node: string } }).engines;
const floor = floorOf(engines.node);

describe("the oldest allowed Node.js", () => {
  it("is one that loads a parser's ES module entry through require", () => {
    expect(atLeast(floor, REQUIRE_ESM_FLOOR)).toBe(true);
  });

  it("is the version the smoke workflow runs the built package's smoke on", () => {
    const block = jobBlock(read("../.github/workflows/smoke.yml"), "smoke-floor");
    expect(block, "smoke.yml has no smoke-floor job").toBeDefined();
    expect(block).toContain(`node-version: "${floor.join(".")}"`);
    expect(block).toContain("node scripts/smoke.mjs");
  });

  it("is the floor the README badge and the docs name", () => {
    const text = floor.join(".");
    expect(read("../README.md")).toContain(`node-%3E%3D${text}-`);
    expect(read("../README.md")).toContain(`Node.js ${floor[0]}.${floor[1]} or later`);
    expect(read("../docs-content/installation.md")).toContain(
      `Node.js ${floor[0]}.${floor[1]} or later`,
    );
  });
});

describe("a generated value", () => {
  it("is an instance of the class the caller imports from the parser", async () => {
    const { CcdaDocument } = await import("@cosyte/ccda");
    expect(generateCcd({ seed: 1 })).toBeInstanceOf(CcdaDocument);
  });
});
