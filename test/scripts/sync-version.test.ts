/**
 * Tests for `cosyte-process sync-version`, the step that binds the public `VERSION` export to
 * `package.json#version` at release time. It replaced this repo's own `scripts/sync-version.mjs`
 * with the same behaviour, and these cases are the ones that guarded the local script, kept so the
 * shared one is held to them here too.
 *
 * WHY THIS FILE EXISTS AT ALL. The step runs only from the `version` script, i.e. only inside a
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
 * The command works on the package in its working directory, so each case builds a throwaway package
 * and runs the installed `@cosyte/process` bin there: the same file the `version` script runs, not a
 * reimplementation of its regex.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** The `cosyte-process` bin this repo's `version` script runs, from the installed package. */
const binPath = join(
  import.meta.dirname,
  "..",
  "..",
  "node_modules",
  "@cosyte",
  "process",
  "dist",
  "cli.mjs",
);

/** Build a throwaway package, and return where it landed. */
function stagePackage(manifestVersion: string, indexSource: string): string {
  const dir = mkdtempSync(join(tmpdir(), "synth-sync-version-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: manifestVersion }));
  writeFileSync(join(dir, "src", "index.ts"), indexSource);
  return dir;
}

interface RunResult {
  readonly status: number;
  readonly output: string;
}

/**
 * Run the command in `dir`. Its reports and refusals go to stderr and stdout stays empty, so both
 * streams are read on every exit, a clean one included.
 */
function run(dir: string): RunResult {
  const r = spawnSync(process.execPath, [binPath, "sync-version"], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  // A run that did not exit (a signal, a spawn error) has no status, and must not read as exit 0.
  return { status: r.status ?? -1, output: `${r.stdout}${r.stderr}` };
}

function indexWith(declaration: string): string {
  return `/** Library version string. */\n${declaration}\n\nexport const OTHER = 1;\n`;
}

const readIndex = (dir: string): string => readFileSync(join(dir, "src", "index.ts"), "utf8");

describe("cosyte-process sync-version", () => {
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
    expect(output).toContain("already at 0.0.9");
    expect(readIndex(dir)).toBe(before);
  });

  it("refuses when the declaration has been renamed or reformatted, rather than no-opping", () => {
    // A silent no-op here is the whole failure mode: the release would carry on and publish the
    // stale constant, exactly as it has five times. Dropping the `: string` annotation is the
    // realistic version of this, since that annotation is what the script matches on.
    const dir = stagePackage("0.0.9", indexWith('export const VERSION = "0.0.0";'));

    const { status, output } = run(dir);

    expect(status).toBe(1);
    expect(output).toContain("carries no exported VERSION declaration");
    expect(readIndex(dir)).toContain('export const VERSION = "0.0.0";');
  });

  it("refuses an ambiguous file rather than rewriting the first match", () => {
    const dir = stagePackage(
      "0.0.9",
      `export const VERSION: string = "0.0.0";\nexport const VERSION: string = "0.0.1";\n`,
    );

    const { status, output } = run(dir);

    expect(status).toBe(1);
    expect(output).toContain("exactly one must match");
  });

  it("refuses a manifest with no usable version rather than writing an empty constant", () => {
    const dir = mkdtempSync(join(tmpdir(), "synth-sync-version-"));
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "no-version" }));
    writeFileSync(
      join(dir, "src", "index.ts"),
      indexWith('export const VERSION: string = "0.0.0";'),
    );

    const { status, output } = run(dir);

    expect(status).toBe(1);
    expect(output).toContain('no usable "version"');
  });

  it("inserts a version containing replacement-pattern characters literally", () => {
    // `String.prototype.replace` expands `$&` in a replacement STRING, and process states it splices
    // the manifest string in literally (its condition 3). A prerelease tag is the reachable route to
    // such a version.
    const dir = stagePackage("0.0.9-rc.$&1", indexWith('export const VERSION: string = "0.0.0";'));

    const { status } = run(dir);

    expect(status).toBe(0);
    expect(readIndex(dir)).toContain('export const VERSION: string = "0.0.9-rc.$&1";');
  });
});
