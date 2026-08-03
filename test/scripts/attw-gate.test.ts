/**
 * Tests for scripts/attw.mjs — the wrapper that makes the `attw` publish gate
 * report its own failure.
 *
 * WHAT THESE PIN, AND WHY EACH ONE IS HERE:
 *
 *  1. THE UPSTREAM BEHAVIOUR THE WRAPPER EXISTS FOR. `attw` prints "This package
 *     does not contain types." and exits **0**. If a future `attw` upgrade fixes
 *     that exit code or rewords the sentence, this test reds — which is the point.
 *     A guard that silently stops matching is worse than no guard, and this is the
 *     one net in `attw.mjs` that depends on a string.
 *  2. That the wrapper turns that exit 0 into a failure.
 *  3. That the preflight catches a declared-but-missing artifact, which is the
 *     shape the false green takes here (a `dist/` removed, or not yet written,
 *     underneath the gate).
 *  4. THAT THE PREFLIGHT DESCENDS INTO SUBPATH EXPORTS — and, in the same test,
 *     THE LIMIT OF WHAT THAT BUYS. This package publishes EIGHT subpaths; the repo
 *     the wrapper was ported from publishes one, so the subpath case is pinned
 *     rather than assumed from the root case. But bare attw is NOT silent on a
 *     partly-untyped package: measured here, it reports UntypedResolution and
 *     exits 1. The false green needs EVERY entry point untyped at once. That
 *     distinction is asserted rather than described, because the first draft of
 *     this file asserted the opposite and was red inside a minute.
 *  5. A NEGATIVE CONTROL. On a package whose tarball really does carry types, the
 *     wrapper is transparent: same exit status as `attw` itself, and green. A gate
 *     that only ever fails is not a gate, and a false red here would cost every
 *     later run an hour.
 *  6. THE GATE'S MOST BASIC OBLIGATION — that a real `attw` failure still fails.
 *     Without this, every other test here would pass on a wrapper that swallowed
 *     attw's own exit status, because net 2 reds the untyped fixture regardless.
 *  7. THAT `--profile node16` SURVIVES THE PORT. It is this package's graded
 *     resolution profile, it is passed through the wrapper rather than baked into
 *     it, and a wrapper that dropped its arguments would look green everywhere
 *     else in this file. Pinned by an observable difference in attw's own output.
 *  8. THAT THE PACKAGE SCRIPT ACTUALLY INVOKES THE WRAPPER. Every case above runs
 *     `scripts/attw.mjs` by path, so all of them stay green on a repo whose `attw`
 *     script was reverted to the bare CLI — a gate that is present, tested, and not
 *     in the loop. `verify.sh` and the CI ladder check that an `attw` script
 *     EXISTS, not what it runs.
 *  9. The refusals that keep net 2 readable. Each of these argument and config
 *     routes was measured against this repo's pinned binary, WITH `--profile
 *     node16` present, to make the untyped sentence unreadable and hand back exit
 *     0 — the exact false green this file exists to close.
 *
 * The fixtures are minimal throwaway packages in a temp dir — nothing about this
 * repo's own build, so the test does not need one and cannot race one. `attw` is
 * invoked with `--no-definitely-typed` so the runs stay offline; the wrapper
 * forwards arguments, which is what makes that possible.
 *
 * SECURITY: every subprocess call uses spawnSync with array args. No exec, no
 * shell-form.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const WRAPPER = join(REPO_ROOT, "scripts", "attw.mjs");
const ATTW_BIN = join(REPO_ROOT, "node_modules", ".bin", "attw");
const UNTYPED = "This package does not contain types.";
/** This repo's real invocation, plus the flag that keeps the runs offline. */
const ARGS = ["--profile", "node16", "--no-definitely-typed"];
// Each case shells out to `attw --pack`, which runs a real `npm pack`; two of those
// in one test comfortably exceeds this suite's 10s default.
const SPAWN_TIMEOUT = 60_000;

interface RunResult {
  code: number;
  out: string;
}

interface PackageManifest {
  scripts?: { attw?: string };
}

function run(bin: string, args: string[], cwd: string): RunResult {
  const r = spawnSync(bin, args, { cwd, encoding: "utf8", timeout: 120_000 });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const runAttw = (cwd: string): RunResult => run(ATTW_BIN, ["--pack", ".", ...ARGS], cwd);
const runWrapper = (cwd: string, args: string[] = ARGS): RunResult =>
  run(process.execPath, [WRAPPER, ...args], cwd);

let root: string;

/** A package whose declaration file exists on disk but is left out of `files`. */
let typesNotPacked: string;
/** A package whose `package.json` points at a `dist/` that was never built. */
let noBuild: string;
/** A well-formed dual ESM/CJS package — the negative control. */
let wellFormed: string;
/** A package with a real attw problem: `require` resolves to ESM. */
let attwFails: string;
/** Declarations present, JS entry point missing — attw itself is green on this. */
let jsMissing: string;
/** Root entry complete; a SUBPATH export's declaration is the only thing missing. */
let subpathMissing: string;

function writePkg(dir: string, pkg: Record<string, unknown>, files: Record<string, string>): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "attw-gate-"));

  typesNotPacked = join(root, "types-not-packed");
  writePkg(
    typesNotPacked,
    {
      name: "attw-gate-fixture-unpacked",
      version: "1.0.0",
      main: "./index.js",
      types: "./index.d.ts",
      files: ["index.js"],
    },
    { "index.js": "module.exports = {};\n", "index.d.ts": "export declare const a: number;\n" },
  );

  noBuild = join(root, "no-build");
  writePkg(
    noBuild,
    {
      name: "attw-gate-fixture-nobuild",
      version: "1.0.0",
      type: "module",
      exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
      files: ["dist"],
    },
    {},
  );

  wellFormed = join(root, "well-formed");
  writePkg(
    wellFormed,
    {
      name: "attw-gate-fixture-wellformed",
      version: "1.0.0",
      type: "module",
      exports: {
        ".": {
          import: { types: "./index.d.ts", default: "./index.js" },
          require: { types: "./index.d.cts", default: "./index.cjs" },
        },
      },
      files: ["index.js", "index.d.ts", "index.cjs", "index.d.cts"],
    },
    {
      "index.js": "export const a = 1;\n",
      "index.d.ts": "export declare const a: number;\n",
      "index.cjs": "module.exports.a = 1;\n",
      "index.d.cts": "export declare const a: number;\n",
    },
  );

  // ESM-only, with no `require` condition: attw's node16 profile reports
  // CJSResolvesToESM and exits non-zero of its own accord.
  attwFails = join(root, "attw-fails");
  writePkg(
    attwFails,
    {
      name: "attw-gate-fixture-problem",
      version: "1.0.0",
      type: "module",
      exports: { ".": { types: "./index.d.ts", default: "./index.js" } },
      files: ["index.js", "index.d.ts"],
    },
    { "index.js": "export const a = 1;\n", "index.d.ts": "export declare const a: number;\n" },
  );

  jsMissing = join(root, "js-missing");
  writePkg(
    jsMissing,
    {
      name: "attw-gate-fixture-jsmissing",
      version: "1.0.0",
      main: "./dist/index.js",
      types: "./index.d.ts",
      files: ["index.d.ts"],
    },
    { "index.d.ts": "export declare const a: number;\n" },
  );

  // The shape of THIS package's manifest: a complete root entry plus subpaths.
  // Everything the root promises is on disk; only the subpath's declarations are
  // absent, so nothing but a walk into `exports` can notice.
  subpathMissing = join(root, "subpath-missing");
  writePkg(
    subpathMissing,
    {
      name: "attw-gate-fixture-subpath",
      version: "1.0.0",
      type: "module",
      exports: {
        ".": {
          import: { types: "./index.d.ts", default: "./index.js" },
          require: { types: "./index.d.cts", default: "./index.cjs" },
        },
        "./hl7": {
          import: { types: "./hl7/index.d.ts", default: "./hl7/index.js" },
          require: { types: "./hl7/index.d.cts", default: "./hl7/index.cjs" },
        },
        "./package.json": "./package.json",
      },
      files: ["index.js", "index.d.ts", "index.cjs", "index.d.cts", "hl7"],
    },
    {
      "index.js": "export const a = 1;\n",
      "index.d.ts": "export declare const a: number;\n",
      "index.cjs": "module.exports.a = 1;\n",
      "index.d.cts": "export declare const a: number;\n",
    },
  );
  mkdirSync(join(subpathMissing, "hl7"));
  writeFileSync(join(subpathMissing, "hl7", "index.js"), "export const b = 1;\n");
  writeFileSync(join(subpathMissing, "hl7", "index.cjs"), "module.exports.b = 1;\n");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("attw's own exit code (the reason this wrapper exists)", () => {
  it(
    "reports an untyped pack and still exits 0",
    () => {
      const r = runAttw(typesNotPacked);
      expect(r.out).toContain(UNTYPED);
      // If this ever fails because the status is now non-zero, attw has fixed the
      // early return in getExitCode() and net 2 of scripts/attw.mjs is redundant.
      // Read that file's header before deleting anything.
      expect(r.code).toBe(0);
    },
    SPAWN_TIMEOUT,
  );
});

describe("scripts/attw.mjs", () => {
  it(
    "fails when the tarball carries no types, where attw exits 0",
    () => {
      const r = runWrapper(typesNotPacked);
      expect(r.out).toContain(UNTYPED);
      expect(r.code).not.toBe(0);
    },
    SPAWN_TIMEOUT,
  );

  it(
    "fails, naming the file, when a declared artifact was never built",
    () => {
      const r = runWrapper(noBuild);
      expect(r.code).not.toBe(0);
      expect(r.out).toContain("./dist/index.d.ts");
      expect(r.out).toContain("missing");
    },
    SPAWN_TIMEOUT,
  );

  it(
    "reaches a SUBPATH export's declarations, and does not overclaim about them",
    () => {
      // MEASURED, AND IT REFUTED THE FIRST DRAFT OF THIS TEST, WHICH ASSERTED bare
      // attw was green here. It is NOT. With the root entry's declarations intact,
      // `analysis.types` is truthy, getExitCode() runs past its early return, and
      // the subpath's absent declarations ARE enumerated — as UntypedResolution,
      // exit 1. So a PARTIAL loss of declarations is attw's own catch, not ours.
      //
      // That scopes the false green precisely: it needs EVERY entry point to be
      // untyped at once, which is exactly what `rm -rf dist`, `pnpm clean`, and
      // tsup's JS-before-declarations window produce. Keep this asserted, because
      // "attw misses subpaths" is the plausible, wrong story about this defect.
      const bare = runAttw(subpathMissing);
      expect(bare.out).not.toContain(UNTYPED);
      expect(bare.code).not.toBe(0);

      // What the preflight adds here is not a caught false green — it is an earlier
      // and specific failure that NAMES the missing files. attw's own message says
      // a resolution was untyped; it does not tell you which artifact to rebuild.
      const r = runWrapper(subpathMissing);
      expect(r.code).not.toBe(0);
      expect(r.out).toContain("./hl7/index.d.ts");
      expect(r.out).toContain("./hl7/index.d.cts");
      // Proof the walk descended rather than the whole manifest being flagged: the
      // intact root entry is not reported as broken, and attw was never reached.
      expect(r.out).not.toContain("./index.d.ts (missing)");
      expect(r.out).not.toContain("UntypedResolution");
    },
    SPAWN_TIMEOUT,
  );

  it(
    "does not claim attw would have said 'untyped' when only JS is missing",
    () => {
      // Measured: with the declarations intact, bare attw reports no problems and
      // exits 0 on this fixture. The preflight still reds it, but must not tell the
      // reader something about attw's behaviour that is false for this case.
      const bare = runAttw(jsMissing);
      expect(bare.out).toContain("No problems found");
      expect(bare.code).toBe(0);
      const r = runWrapper(jsMissing);
      expect(r.code).not.toBe(0);
      expect(r.out).toContain("./dist/index.js");
      expect(r.out).not.toContain(UNTYPED);
    },
    SPAWN_TIMEOUT,
  );

  it(
    "still fails when attw itself fails, with attw's own status",
    () => {
      const bare = runAttw(attwFails);
      expect(bare.code).not.toBe(0);
      expect(bare.out).not.toContain(UNTYPED);
      const wrapped = runWrapper(attwFails);
      expect(wrapped.code).toBe(bare.code);
    },
    SPAWN_TIMEOUT,
  );

  it(
    "is transparent on a package that really does ship types",
    () => {
      const bare = runAttw(wellFormed);
      const wrapped = runWrapper(wellFormed);
      expect(bare.out).not.toContain(UNTYPED);
      expect(wrapped.code).toBe(bare.code);
      expect(wrapped.code).toBe(0);
    },
    SPAWN_TIMEOUT,
  );

  it(
    "forwards --profile node16 rather than swallowing its arguments",
    () => {
      // The node16 profile makes attw ignore the node10 resolution and say so. A
      // wrapper that dropped its arguments would print no such line, and every
      // other assertion in this file would still pass.
      const withProfile = runWrapper(wellFormed);
      const withoutProfile = runWrapper(wellFormed, ["--no-definitely-typed"]);
      expect(withProfile.out).toContain("ignoring resolutions");
      expect(withoutProfile.out).not.toContain("ignoring resolutions");
    },
    SPAWN_TIMEOUT,
  );
});

describe("the gate is actually wired to the wrapper", () => {
  // Everything above invokes scripts/attw.mjs by path, so all of it stays green on
  // a repo whose `attw` script was reverted to the bare CLI — the gate would be
  // present, tested, and not in the loop. verify.sh and the CI ladder check that an
  // `attw` script EXISTS, not what it runs. This is the assertion that closes that.
  it("runs scripts/attw.mjs from the package script, with the node16 profile", () => {
    const pkg = JSON.parse(
      readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
    ) as PackageManifest;
    const script = pkg.scripts?.attw ?? "";
    expect(script).toContain("scripts/attw.mjs");
    expect(script).toContain("--profile node16");
    // The wrapper supplies `--pack .` itself; passing it again would double the flag.
    expect(script).not.toContain("--pack");
  });
});

describe("the refusals that keep the post-check readable", () => {
  // Each of these was measured to make bare attw exit 0 with the untyped sentence
  // unreadable, on the very fixture whose tarball carries no types.
  it.each([
    ["--quiet", ["--quiet"]],
    ["-q", ["-q"]],
    ["--format json", ["--format", "json"]],
    ["-f json", ["-f", "json"]],
    ["--format=json", ["--format=json"]],
    ["--config-path", ["--config-path", "other.json"]],
  ])("refuses %s", (_name, extra) => {
    const r = runWrapper(typesNotPacked, [...ARGS, ...extra]);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("attw gate");
    expect(r.out).not.toContain("🌟");
  });

  it(
    "refuses a .attw.json that sets quiet or format",
    () => {
      const dir = join(root, "config-blinded");
      writePkg(
        dir,
        {
          name: "attw-gate-fixture-configblind",
          version: "1.0.0",
          main: "./index.js",
          types: "./index.d.ts",
          files: ["index.js"],
        },
        {
          "index.js": "module.exports = {};\n",
          "index.d.ts": "export declare const a: number;\n",
          ".attw.json": JSON.stringify({ quiet: true }),
        },
      );
      // Bare attw takes the config and goes silent — exit 0 over an untyped pack.
      const bare = runAttw(dir);
      expect(bare.code).toBe(0);
      expect(bare.out).not.toContain(UNTYPED);

      const r = runWrapper(dir);
      expect(r.code).not.toBe(0);
      expect(r.out).toContain(".attw.json");
    },
    SPAWN_TIMEOUT,
  );
});
