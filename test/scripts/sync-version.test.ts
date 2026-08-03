/**
 * Tests for scripts/sync-version.mjs, the step that binds the public `VERSION` export to
 * `package.json#version` at release time.
 *
 * WHY THIS FILE EXISTS AT ALL. The script runs only from the `version` script, i.e. only inside a
 * "Version Packages" commit, so nothing in ordinary CI ever executes it. A defect in it would
 * surface for the first time during a release, which is precisely the moment this whole mechanism
 * exists to protect: every one of this package's five published versions shipped `VERSION` reading
 * "0.0.0" while `package.json` said otherwise, because the bump and the constant were never bound.
 *
 * `test/sanity.test.ts` is the guard against the *drift*; this file is the guard against the
 * *remedy*, and the two fail in different directions. Sanity reds when the constant and the manifest
 * disagree in the tree. These red when the script that reconciles them stops working, including the
 * two ways it is designed to refuse rather than silently no-op, which sanity cannot see because a
 * refusing script and a working script leave an already-synced tree byte-identical.
 *
 * The script resolves its own paths from `import.meta.url`, so each case builds a throwaway package
 * around a copy of it rather than pointing it at a fixture directory. That runs the real file, not a
 * reimplementation of its regex.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const scriptPath = join(import.meta.dirname, "..", "..", "scripts", "sync-version.mjs");

/** Build a throwaway package around a copy of the real script, and return where it landed. */
function stagePackage(manifestVersion: string, indexSource: string): string {
  const dir = mkdtempSync(join(tmpdir(), "synth-sync-version-"));
  mkdirSync(join(dir, "scripts"));
  mkdirSync(join(dir, "src"));
  copyFileSync(scriptPath, join(dir, "scripts", "sync-version.mjs"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: manifestVersion }));
  writeFileSync(join(dir, "src", "index.ts"), indexSource);
  return dir;
}

interface RunResult {
  readonly status: number;
  readonly output: string;
}

/** Read one property off an unknown thrown value without asserting a shape it may not have. */
function pick(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined;
  return Reflect.get(value, key);
}

function run(dir: string): RunResult {
  try {
    const output = execFileSync(process.execPath, [join(dir, "scripts", "sync-version.mjs")], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output };
  } catch (error: unknown) {
    // `execFileSync` throws on a non-zero exit, carrying the status and the captured streams. Narrow
    // rather than cast: a thrown value that is not that shape must not be read as a clean exit 0.
    const status = pick(error, "status");
    const stdout = pick(error, "stdout");
    const stderr = pick(error, "stderr");
    return {
      status: typeof status === "number" ? status : -1,
      output: `${typeof stdout === "string" ? stdout : ""}${typeof stderr === "string" ? stderr : ""}`,
    };
  }
}

function indexWith(declaration: string): string {
  return `/** Library version string. */\n${declaration}\n\nexport const OTHER = 1;\n`;
}

const readIndex = (dir: string): string => readFileSync(join(dir, "src", "index.ts"), "utf8");

describe("scripts/sync-version.mjs", () => {
  it("rewrites a stale constant to the manifest version", () => {
    // The exact shape of the defect being closed: manifest ahead, constant left at "0.0.0".
    const dir = stagePackage("0.0.9", indexWith('export const VERSION: string = "0.0.0";'));

    const { status } = run(dir);

    expect(status).toBe(0);
    expect(readIndex(dir)).toContain('export const VERSION: string = "0.0.9";');
  });

  it("is idempotent and leaves an already-synced file byte-identical", () => {
    const dir = stagePackage("0.0.9", indexWith('export const VERSION: string = "0.0.9";'));
    const before = readIndex(dir);

    const { status, output } = run(dir);

    expect(status).toBe(0);
    expect(output).toContain("already 0.0.9");
    expect(readIndex(dir)).toBe(before);
  });

  it("refuses when the declaration has been renamed or reformatted, rather than no-opping", () => {
    // A silent no-op here is the whole failure mode: the release would carry on and publish the
    // stale constant, exactly as it has five times. Dropping the `: string` annotation is the
    // realistic version of this, since that annotation is what the script matches on.
    const dir = stagePackage("0.0.9", indexWith('export const VERSION = "0.0.0";'));

    const { status, output } = run(dir);

    expect(status).toBe(1);
    expect(output).toContain("could not find");
    expect(readIndex(dir)).toContain('export const VERSION = "0.0.0";');
  });

  it("refuses an ambiguous file rather than rewriting the first match", () => {
    const dir = stagePackage(
      "0.0.9",
      `export const VERSION: string = "0.0.0";\nexport const VERSION: string = "0.0.1";\n`,
    );

    const { status, output } = run(dir);

    expect(status).toBe(1);
    expect(output).toContain("expected exactly one");
  });

  it("refuses a manifest with no usable version rather than writing an empty constant", () => {
    const dir = mkdtempSync(join(tmpdir(), "synth-sync-version-"));
    mkdirSync(join(dir, "scripts"));
    mkdirSync(join(dir, "src"));
    copyFileSync(scriptPath, join(dir, "scripts", "sync-version.mjs"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "no-version" }));
    writeFileSync(
      join(dir, "src", "index.ts"),
      indexWith('export const VERSION: string = "0.0.0";'),
    );

    const { status, output } = run(dir);

    expect(status).toBe(1);
    expect(output).toContain("no usable `version`");
  });

  it("inserts a version containing replacement-pattern characters literally", () => {
    // `String.prototype.replace` expands `$&` in a replacement STRING, so the script passes a
    // replacer function. A prerelease tag is the reachable route to such a version.
    const dir = stagePackage("0.0.9-rc.$&1", indexWith('export const VERSION: string = "0.0.0";'));

    const { status } = run(dir);

    expect(status).toBe(0);
    expect(readIndex(dir)).toContain('export const VERSION: string = "0.0.9-rc.$&1";');
  });
});
