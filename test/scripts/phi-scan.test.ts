/**
 * Unit tests for scripts/phi-scan.ts — the PHI commit-gate.
 *
 * This docblock previously said the suite "deliberately does NOT test structured,
 * field-level PHI detection". That was false when it was written and stayed false:
 * the HL7, FHIR, X12, NCPDP, ASTM and quirk suites below have been exercising
 * exactly that, and the seeded-violator suites added since drive the C-CDA arm. It
 * is deleted rather than reworded, because the dangerous half of a wrong assertion
 * is not the code around it — it is the next reader trusting it and not looking.
 *
 * What the suite covers:
 *   - the cross-cutting floor (dashed SSN outside the never-issued space, email
 *     at a non-declared domain) and the generator-aware exemptions;
 *   - structured detection for every format this package generates, driven where
 *     possible by real generator output rather than a hand-written sample;
 *   - the argument-driven collapse routes. Note they do NOT all end the same way:
 *     `--allow-fixture` being purely subtractive is a `parseArgs` change and shows
 *     up as a FULL scan (exit 0 over a large denominator), while the two
 *     `enforceObservation` refusals — an override that subtracts nothing, and a
 *     target set emptied by overrides — exit 2;
 *   - the scan roots, seeded in-repo (below), and two of the exclusions that are
 *     real limits of the enumerator rather than oversights: markdown, and anything
 *     outside `src/` / `test/` / `scripts/` (repo-root files included). Those two
 *     are the ones exercised here, not the whole set — the scanner's header lists
 *     the limits known at the time of writing, and does not claim to be complete;
 *   - CONTENT-GATED ADMISSION: the same bytes get the same verdict as `.ts` and as
 *     `.xml`, for all three arms that used to gate on the extension. This block
 *     REPLACES a characterization test that asserted the opposite; see the comment
 *     above it for why the old assertion is gone rather than quietly relaxed. It
 *     also pins the limits the widening did NOT close — file-scoped admission,
 *     placeholders, namespace prefixes — so they stay known;
 *   - `--staged` enumeration, against a throwaway git repo — including the `R` and
 *     `T` statuses the superseded `--diff-filter=AM` allow-list dropped, with the
 *     old flags run alongside so the gap is measured rather than asserted;
 *   - the GIT-IGNORE DISAGREEMENT between all-mode and `--staged`, both directions,
 *     which the scanner header disclosed and nothing exercised;
 *   - the ENUMERATION TOCTOU WINDOW: what a file that vanishes between the walk and
 *     its read is allowed to do to a sweep, and five of the six ways it still
 *     refuses. The sixth — a tolerated file written BACK before the post-sweep
 *     re-check — is not reachable from a deterministic harness; that block's own
 *     note says why it is left unpinned rather than guarded by a sleep.
 *
 * Three different sandboxes, because the questions differ:
 *
 *   1. A throwaway TEMP DIR scanned in paths mode, for everything about detection.
 *      Violators never pollute the committed corpus that `pnpm phi-scan` sweeps.
 *   2. Seeds INSIDE THIS REPO, for anything about all-mode enumeration. A violator
 *      in an OS temp dir is never enumerated by an all-mode scan, so overriding it
 *      proves nothing: the run comes back clean because the file was never in the
 *      target set, not because the override subtracted it. That is precisely how
 *      `ncpdp`'s equivalent suite certified a bug it could not observe. These tests
 *      also append to `phi-scan-overrides.md` and restore it in a `finally`.
 *   3. A throwaway REPO ROOT (`makeRoot`), for the collapse cases that need a corpus
 *      small enough to exclude in its entirety, and for `--staged` (which needs a
 *      git index that is emphatically not this checkout's).
 *
 * The scanner takes its repo root from `process.cwd()`, which is what makes (3)
 * possible: a temp directory holding an allow-list and an override log is a repo
 * as far as it is concerned.
 *
 * SEED LOCATIONS ARE RE-DERIVED FOR THIS REPO, not ported. Vitest runs test files
 * in parallel, so a seed landing in a directory another module `readdirSync`s at
 * collection time appears and vanishes mid-collection and errors that file
 * outright. In THIS repo the enumerated directories are `test/fixtures/x12`,
 * `test/fixtures/astm` and `test/fixtures/ncpdp` (the three `round-trip.test.ts`
 * modules) and all of `src/` (walked recursively by
 * `test/phi/diagnostic-surface.test.ts`). The seeds below therefore land in
 * `test/fixtures/` itself, `test/scripts/`, and `scripts/` — none of which any
 * module enumerates. Three consequences worth knowing: a hard kill mid-run leaves a
 * `zz-phi-scan-seed-*` file behind, which reds the next scan loudly rather than
 * silently; this file is not safe to run concurrently against the same checkout
 * (CI gives each job its own); and the seeds must NOT be added to `.gitignore` to
 * quiet that leftover, because the all-mode enumerator drops git-ignored files —
 * ignoring them would make every seeded test below pass over a scan that never saw
 * the violator, which is the exact failure this suite exists to catch.
 *
 * Staged-mode tests never touch THIS repo's git index. They build a throwaway git
 * repo in a temp dir and run the scanner with its cwd pointed there.
 *
 * The scanner is invoked via spawnSync (array args, no shell) so the full CLI
 * path (argv parse, exit code, stderr) is exercised.
 *
 * SECURITY: every subprocess call here uses spawnSync with array args. No exec,
 * no shell-form.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import {
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  appendFileSync,
  copyFileSync,
  symlinkSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

import { generate837P, roundTrip } from "../../src/x12/index.js";
import { generateNewRx, generateB1 } from "../../src/ncpdp/index.js";
import {
  generateAstmResult,
  generateAstmResultFramed,
  generateAstmQuirk,
} from "../../src/astm/index.js";
import { generateHl7Quirk } from "../../src/hl7/index.js";
import { generateCcdaQuirk } from "../../src/ccda/index.js";

const REPO_ROOT = process.cwd();
const SCANNER_PATH = join(REPO_ROOT, "scripts", "phi-scan.ts");
const ALLOW_LIST_PATH = join(REPO_ROOT, "scripts", "phi-allow-list.txt");
const OVERRIDES_PATH = join(REPO_ROOT, "phi-scan-overrides.md");
const TSX_BIN = join(REPO_ROOT, "node_modules", ".bin", "tsx");

/**
 * WHY THE SWEEP SPAWNS `node` AND NOT `tsx`, THOUGH `pnpm phi-scan` USES `tsx`.
 *
 * Every test below runs the scanner in a real subprocess, on purpose — that is what
 * exercises the full CLI path (argv parse, exit code, stderr). The cost is a fixed
 * per-spawn startup, paid ~65 times, and it dominated this file: measured on this
 * box, warmed medians were **2.1 s** for a `tsx` cold start against **0.6 s** for
 * `node` running the same TypeScript through its native type stripping. That fixed cost, not any
 * assertion, is what put a dozen tests here within 3x of the 10 s global timeout —
 * i.e. the suite was measuring interpreter startup on a loaded machine rather than
 * the scanner. Cutting the cost is a better answer than a bigger ceiling: a ceiling
 * would hide the startup time, this removes it, and every test in the file gains the
 * headroom without any timeout being relaxed.
 *
 * THE NODE FLOOR THIS ASSUMES IS 22.18, WHICH IS HIGHER THAN THE ONE THE PACKAGE
 * DECLARES. Type stripping landed flagged in 22.6 and unflagged only in **22.18**,
 * while `engines.node` here is `>=22.0.0` — so on 22.0-22.17 the package itself is
 * fine and only THIS FILE breaks. `engines` is deliberately not raised for a
 * dev-only harness detail: nothing a consumer installs is affected. The failure is
 * loud rather than silent (the scanner fails to load, so every test in the file
 * reds, the clean-file legs included) and the CI matrix runs 22 and 24, so a box
 * below 22.18 is a red build and not a quiet gap in the gate.
 *
 * Nothing under test changes: `node` and `tsx` both hand the scanner the same argv,
 * the same cwd and the same stdio, and node's stripping emits no warning to pollute
 * the stderr these tests assert on. Two things this trades away, both handled:
 *   - the `tsx` entry point itself is no longer exercised by the sweep, so ONE test
 *     below still spawns `tsx` explicitly to pin the real `pnpm phi-scan` path;
 *   - type stripping cannot erase `enum`, `namespace`, or parameter properties. The
 *     scanner uses none, and the tsx-pinned test reds if that ever stops being true.
 */
const NODE_BIN = process.execPath;

/**
 * A PHI-shaped digit string built from parts, and a non-declared email built the
 * same way. The scanner now walks all of `test/`, so this suite sits inside the
 * corpus it guards: a literal violator here would be a correct hit on every run.
 * Assembling keeps the value the scanner sees identical while keeping the literal
 * out of the file — allow-listing instead would defeat the very tests using it.
 */
const digits = (...parts: string[]): string => parts.join("");
const addr = (user: string, ...domain: string[]): string => `${user}@${domain.join(".")}`;

/**
 * The same trick for a real-looking person NAME, and it is now LOAD-BEARING — which
 * is the clearest single measure of what this change did.
 *
 * It was written as insurance while the C-CDA and FHIR arms still gated on `.xml` /
 * `.json`: a bare real surname in this `.ts` file scanned green for a reason that had
 * nothing to do with it being safe, and assembling it meant the file did not quietly
 * depend on that gate. The arms are content-gated now, this file is a `.ts` inside the
 * corpus `pnpm phi-scan` sweeps, and it builds C-CDA documents and FHIR literals out of
 * these tokens. Spell either one out and the gate correctly reds on this very file.
 */
const token = (...parts: string[]): string => parts.join("");
const GIVEN = token("Ali", "ce");
const FAMILY = token("Ander", "son");

let dir: string;

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run the scanner with its cwd set to `cwd` (the scanner treats cwd as the repo root). */
function runScannerIn(cwd: string, args: string[]): RunResult {
  const r = spawnSync(NODE_BIN, [SCANNER_PATH, ...args], { cwd, encoding: "utf8", shell: false });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** The `tsx` invocation `pnpm phi-scan` actually uses — kept for the one test that pins it. */
function runScannerViaTsx(args: string[]): RunResult {
  const r = spawnSync(TSX_BIN, [SCANNER_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
  });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function runScanner(args: string[]): RunResult {
  return runScannerIn(REPO_ROOT, args);
}

/** The denominator the scanner prints on every report line, or -1 if absent. */
function scannedCount(r: RunResult): number {
  const m = /\((\d+) file\(s\) scanned\)/.exec(`${r.stdout}${r.stderr}`);
  const raw = m?.[1];
  return raw === undefined ? -1 : Number(raw);
}

// ---------------------------------------------------------------------------
// In-repo seeding, for the questions an all-mode scan of THIS checkout is the
// honest way to ask: does enumeration reach this directory, and does an override
// subtract a file that was genuinely in the target set.
//
// See the module docblock for why the four seed paths below are safe ones IN THIS
// REPO. Re-derive them, do not port them, if the suite's `readdirSync` sites move.
// ---------------------------------------------------------------------------

/**
 * Build `<tag>value</tag>` at run time so this FILE never contains a name element with content.
 *
 * THIS IS WHY THE SCANNER NEEDS NO PLACEHOLDER RULE. Once the C-CDA / SCRIPT / FHIR arms stopped
 * gating on the file extension, this suite became one of their targets, and every fixture below that
 * spelled out a `given` element with content was a hit against the gate itself. (Note this sentence
 * does not write one either — with no skip rule in the scanner, prose that forges a name element reds
 * the gate, and that discipline is the trade for a detector with nothing to audit.) The first three
 * attempts at fixing
 * that taught the SCANNER to skip template placeholders — a subtraction that has to be exactly right
 * on a PHI detector, and twice was not: it silenced `Anderson ...`, then `${"Anderson"}`, then spliced
 * `{{Anderson ${s}}` across two constructs. Each fix bought one more evasion shape.
 *
 * The gate does not have that problem. THIS FILE does. Assembling the element at run time keeps the
 * bytes the scanner sees identical while leaving no `<given>` with content in the source, so the
 * detector can stay maximally literal and the widening stays purely additive.
 */
const el = (tag: string, value: string): string => `<${tag}>${value}</${tag}>`;

/** A genuine violator: a real-looking C-CDA `recordTarget` name (`.xml` → the C-CDA arm). */
const VIOLATOR = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <recordTarget><patientRole><patient>
    <name>${el("given", GIVEN)}${el("family", FAMILY)}</name>
  </patient></patientRole></recordTarget>
</ClinicalDocument>`;

/** Seeded under `test/fixtures/` (the historical root), but not in an enumerated subdir. */
const SEED_IN_FIXTURES = "test/fixtures/zz-phi-scan-seed-fixtures.xml";
/** Seeded under `test/` but OUTSIDE `fixtures/` — the root the scan used to miss. */
const SEED_OUTSIDE_FIXTURES = "test/scripts/zz-phi-scan-seed-outside.xml";
/** Seeded under `scripts/` — the other root the scan used to miss. */
const SEED_IN_SCRIPTS = "scripts/zz-phi-scan-seed-scripts.xml";
/** The same violator as markdown: out of scope in every mode, because docs quote violator values. */
const SEED_MARKDOWN = "test/scripts/zz-phi-scan-seed-doc.md";

/**
 * The same document with every name drawn from the shipped fake-name pool. Used as
 * the pre-edit blob in the staged-mode rename case, where git's similarity index
 * has to stay high enough that it really reports `R` — the status the old
 * `--diff-filter=AM` allow-list dropped.
 */
// MEASURED MARGIN: git scores this pair `R065` against its 50% rename-detection
// default, so the `R` case below is real but the headroom is 15 points, not the
// comfortable gap it looks like. Widen the edit between VIOLATOR and CLEAN_DOC and
// git stops calling it a rename, which turns the staged `R` test red — the safe
// direction, but red for a reason that has nothing to do with the scanner.
const CLEAN_DOC = VIOLATOR.replace(GIVEN, "Exampla").replace(FAMILY, "Mockridge");

/** Write violators at repo-relative paths, run `fn`, then always remove them. */
function withSeeded<T>(relPaths: readonly string[], fn: () => T): T {
  try {
    for (const rel of relPaths) writeFileSync(join(REPO_ROOT, rel), VIOLATOR);
    return fn();
  } finally {
    for (const rel of relPaths) rmSync(join(REPO_ROOT, rel), { force: true });
  }
}

/** Append override-log entries for `rels`, run `fn`, then always restore the log. */
function withOverrides<T>(rels: readonly string[], fn: () => T): T {
  const original = readFileSync(OVERRIDES_PATH, "utf8");
  try {
    for (const rel of rels) {
      appendFileSync(
        OVERRIDES_PATH,
        `\n### ${rel}\n\n- **Date:** 2026-08-01\n- **Reason:** unit test\n` +
          `- **Approved by:** vitest\n- **Expires:** end of test run\n`,
      );
    }
    return fn();
  } finally {
    writeFileSync(OVERRIDES_PATH, original);
  }
}

// ---------------------------------------------------------------------------
// Throwaway repo roots. The scanner treats its cwd as the repo root, so a temp
// directory holding an allow-list and an override log IS a repo as far as it is
// concerned. This is what lets the collapse invariants be tested against a corpus
// small enough to exclude entirely, without touching this checkout.
// ---------------------------------------------------------------------------

/** Run `git` in `cwd` (array args, no shell). Throws on a non-zero exit. */
function git(cwd: string, args: readonly string[]): void {
  const r = spawnSync("git", [...args], { cwd, encoding: "utf8", shell: false });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr ?? ""}`);
}

/**
 * The staged file list git reports under an arbitrary flag set. Used to MEASURE
 * what the superseded `--diff-filter=AM` allow-list dropped, rather than asserting
 * it from memory.
 */
function stagedUnder(cwd: string, flags: readonly string[]): string[] {
  const r = spawnSync("git", ["diff", "--cached", "--name-only", ...flags], {
    cwd,
    encoding: "utf8",
    shell: false,
  });
  return (r.stdout ?? "").split("\n").filter((p) => p.length > 0);
}

/**
 * Create a directory the scanner accepts as a repo root: a copy of the committed
 * allow-list (so detection behaves identically to the real thing) plus an override
 * log carrying `entries` under `## Entries`.
 *
 * Note that the allow-list necessarily lands at `scripts/phi-allow-list.txt`, which
 * is itself inside a scan root — so a well-formed root always enumerates at least
 * one file.
 */
function makeRoot(entries: readonly string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "phi-scan-root-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(ALLOW_LIST_PATH, join(root, "scripts", "phi-allow-list.txt"));
  writeFileSync(
    join(root, "phi-scan-overrides.md"),
    `# throwaway log\n\n## Entries\n\n${entries.map((p) => `### ${p}\n`).join("\n")}`,
  );
  return root;
}

/** Write `content` at repo-relative `rel` under `root`, creating parent directories. */
function put(root: string, rel: string, content: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

/** Run `fn` against a fresh throwaway root, then always remove it. */
function withRoot<T>(entries: readonly string[], fn: (root: string) => T): T {
  const root = makeRoot(entries);
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Write a file to the temp dir and scan it by path (paths mode — no git needed). */
function scan(name: string, content: string): RunResult {
  const path = join(dir, name);
  writeFileSync(path, content);
  return runScanner([path]);
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "phi-scan-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("phi-scan: the `tsx` entry point `pnpm phi-scan` uses is the same scanner", () => {
  // THE ONE TEST THAT STILL PAYS THE tsx COLD START, and it is the backstop for every
  // other test in this file. The sweep spawns `node` (see NODE_BIN above) because a tsx
  // start costs ~3x a node one and that fixed cost, multiplied by ~65 spawns, was what
  // pushed this file's tests toward the 10 s global. That substitution is only sound
  // while the two runners agree, so this asserts they do — on a hit AND on a pass, since
  // a runner that failed to start would exit non-zero and read as a "hit" on both.
  //
  // It also covers what `node` alone cannot: that `scripts/phi-scan.ts` still LOADS under
  // tsx, which is the invocation the pre-commit gate and `pnpm phi-scan` actually run.
  // If a future edit introduces a construct node's type stripping cannot erase (`enum`,
  // `namespace`, a parameter property), the sweep breaks loudly and this test stays green,
  // which is the pair of signals that names the cause.
  it("agrees with the `node` invocation on a hit and on a pass", () => {
    // The cross-cutting floor, assembled not spelled (this file is inside the corpus
    // `pnpm phi-scan` sweeps). Deliberately the FLOOR rather than a name: a name in a
    // `.ts` is subject to the file-scoped-admission limit the docblock lists, so it
    // scans clean and would have made the "hit" leg assert the wrong thing.
    const ssn = digits("123", "-45-", "6789");

    for (const [label, content, expected] of [
      ["hit", `patient ssn ${ssn} on file\n`, 1],
      ["pass", "just some ordinary text, no identifiers here\n", 0],
    ] as const) {
      const path = join(dir, `tsx-parity-${label}.txt`);
      writeFileSync(path, content);
      const viaNode = runScanner([path]);
      const viaTsx = runScannerViaTsx([path]);
      expect(viaNode.code, `${label}: node, stderr: ${viaNode.stderr}`).toBe(expected);
      expect(viaTsx.code, `${label}: tsx disagrees with node`).toBe(viaNode.code);
      expect(viaTsx.stderr, `${label}: tsx stderr differs`).toBe(viaNode.stderr);
      // stdout too, and it is not redundant: the scanner writes HITS to stderr but the
      // summary line to stdout, and that line carries the file-count denominator its own
      // header insists an `OK` is never read without. Compare only `code` and `stderr`
      // and the clean leg asserts little more than `0 === 0`.
      expect(viaTsx.stdout, `${label}: tsx stdout differs`).toBe(viaNode.stdout);
    }
  }, 60_000);
});

describe("phi-scan: the cross-cutting floor catches SSN + email", () => {
  it("catches a dashed SSN (exit 1)", () => {
    // Assembled, not literal: this file is inside the scanned corpus (see the
    // module docblock), so a spelled-out issuable SSN here is a correct hit on
    // every `pnpm phi-scan` run. The value the scanner sees is unchanged.
    const ssn = digits("123", "-45-", "6789");
    const r = scan("ssn.txt", `patient ssn ${ssn} on file\n`);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toContain(ssn);
    expect(r.stderr).toMatch(/dashed SSN/);
  });

  it("catches an email at a non-test domain (exit 1)", () => {
    const email = addr("jane.doe", "hospital", "org");
    const r = scan("email.txt", `contact ${email} for records\n`);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toContain(email);
    expect(r.stderr).toMatch(/non-test domain/);
  });
});

describe("phi-scan: clean + allow-listed content passes", () => {
  it("a clean file with no PHI shapes exits 0", () => {
    const r = scan("clean.txt", "just some ordinary text, no identifiers here\n");
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });

  it("honors the allow-list: an email at a reserved test domain passes (exit 0)", () => {
    const r = scan("allowed-email.txt", "reach the team at hello@example.com anytime\n");
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });
});

describe("phi-scan: synthetic-area SSNs are NOT flagged (generator-aware floor)", () => {
  it("a never-issued 900-area dashed SSN passes (exit 0)", () => {
    const r = scan("synth-ssn.txt", "generated id 900-12-3456 is never issued\n");
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });

  it("the 987-65-432x advertising block passes (exit 0)", () => {
    const r = scan("advert-ssn.txt", "advertising ssn 987-65-4321 reserved\n");
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });
});

describe("phi-scan: HL7 v2 structured PID detection catches real-looking PHI", () => {
  const MSH =
    "MSH|^~\\&|COSYTE-SYNTH|SYNTH-FAC|RECEIVER|RECV-FAC|20250101000000||ADT^A01|CID|P|2.5";
  const pid = (name: string, phone: string, ssn: string): string =>
    `PID|1||65413620^^^COSYTE-SYNTH^MR||${name}||19801020|F|||9764 Placeholder Avenue^^Testford^ID^00000||${phone}||||||${ssn}`;
  const msg = (name: string, phone: string, ssn: string): string =>
    `${MSH}\r${pid(name, phone, ssn)}\rPV1|1|I|SYNTHWARD^815^01\r`;

  it("a fully-synthetic generated message passes (exit 0)", () => {
    const r = scan("hl7-clean.hl7", msg("Mockridge^Exampla", "(476) 555-0161", "951140760"));
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });

  it("catches a real PID-5 name not on the allow-list (exit 1)", () => {
    const r = scan("hl7-name.hl7", msg("Smith^John", "(476) 555-0161", "951140760"));
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/PID-5/);
    expect(r.stderr).toMatch(/not declared synthetic/);
  });

  it("catches a real-area PID-19 SSN (exit 1)", () => {
    const r = scan("hl7-ssn.hl7", msg("Mockridge^Exampla", "(476) 555-0161", "123456789"));
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/PID-19/);
    expect(r.stderr).toMatch(/not in synthetic range/);
  });

  it("catches a real PID-13 phone outside the 555-01xx block (exit 1)", () => {
    const r = scan("hl7-phone.hl7", msg("Mockridge^Exampla", "(212) 867-5309", "951140760"));
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/PID-13/);
    expect(r.stderr).toMatch(/555-01xx/);
  });
});

describe("phi-scan: FHIR structured detection catches real-looking PHI", () => {
  const patient = (family: string, given: string, phone: string): string =>
    JSON.stringify({
      resourceType: "Patient",
      name: [{ use: "official", family, given: [given] }],
      telecom: [{ system: "phone", value: phone }],
      gender: "female",
      birthDate: "1980-10-20",
    });

  it("a fully-synthetic generated Patient passes (exit 0)", () => {
    const r = scan("fhir-clean.json", patient("Mockridge", "Exampla", "(476) 555-0161"));
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });

  it("catches a HumanName not on the allow-list (exit 1)", () => {
    const r = scan("fhir-name.json", patient("Smith", "John", "(476) 555-0161"));
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/Patient\.name/);
    expect(r.stderr).toMatch(/not declared synthetic/);
  });

  it("catches a phone ContactPoint outside the 555-01xx block (exit 1)", () => {
    const r = scan("fhir-phone.json", patient("Mockridge", "Exampla", "(212) 867-5309"));
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/Patient\.telecom/);
    expect(r.stderr).toMatch(/555-01xx/);
  });

  it("catches real-looking names inside a Bundle entry (exit 1)", () => {
    const bundle = JSON.stringify({
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ family: token("John", "son"), given: [GIVEN] }],
          },
        },
      ],
    });
    const r = scan("fhir-bundle.json", bundle);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/Patient\.name/);
  });
});

describe("phi-scan: X12 structured detection (SYNTH-6)", () => {
  it("passes a clean, generated 837P (all identity synthetic-by-construction)", () => {
    const content = roundTrip(generate837P({ seed: 6001 })).content;
    const r = scan("clean-837p.edi", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });

  it("flags a Luhn-VALID NPI (NM1*XX) — it could be a real provider", () => {
    // Take a clean 837P and swap the invalid-Luhn NPI for a Luhn-valid one (1234567893).
    const content = roundTrip(generate837P({ seed: 6001 })).content.replace(
      /(NM1\*85\*2\*[^~]*XX\*)\d{10}/,
      "$11234567893",
    );
    const r = scan("valid-npi-837p.edi", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/Luhn/);
  });

  it("flags a REF*SY provider SSN in a real (issuable) area", () => {
    const content = roundTrip(generate837P({ seed: 6001 })).content.replace(
      /REF\*SY\*\d{9}/,
      "REF*SY*123456789",
    );
    const r = scan("real-ssn-837p.edi", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/SSN not in synthetic range/);
  });

  it("flags an SSN qualifier (NM1*34) — a raw SSN must never appear in a synthetic fixture", () => {
    // Append a segment carrying an SSN (NM1-08 = 34). The scanner splits on the ISA-declared
    // terminator, so an appended NM1 is scanned like any other segment.
    const content = `${roundTrip(generate837P({ seed: 6001 })).content}NM1*IL*1*TESTINA*FIXTURA****34*900112222~`;
    const r = scan("ssn-qual-837p.edi", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/qualifier 34/);
  });
});

describe("phi-scan: NCPDP structured detection (SYNTH-7)", () => {
  it("passes a clean, generated SCRIPT NewRx (all identity synthetic-by-construction)", () => {
    const r = scan("clean-newrx.xml", generateNewRx({ seed: 7001 }));
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });

  it("passes a clean, generated Telecom B1 (all identity synthetic-by-construction)", () => {
    const r = scan("clean-b1.ncpdp", generateB1({ seed: 7004 }));
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });

  it("flags a real prescriber name in a SCRIPT message (exit 1)", () => {
    // Assembled, like the floor values above. Once the SCRIPT arm stopped needing an
    // `.xml` path, this `.ts` file became a target for it — and this file carries a
    // `<Message>` marker, so a spelled-out `<LastName>` here is a correct hit on every
    // `pnpm phi-scan`. The value the scanner sees at run time is unchanged; only the
    // literal leaves the source.
    //
    const content = generateNewRx({ seed: 7001 }).replace(
      /<LastName>[^<]+<\/LastName>/,
      el("LastName", token("Smi", "th")),
    );
    const r = scan("real-name.xml", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/not declared synthetic/);
  });

  it("flags a Luhn-VALID <NPI> in a SCRIPT message — it could be a real provider", () => {
    const content = generateNewRx({ seed: 7001 }).replace(
      /<NPI>\d{10}<\/NPI>/,
      `<NPI>${digits("123456", "7893")}</NPI>`,
    );
    const r = scan("valid-npi.xml", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/Luhn/);
  });

  it("flags a checksum-VALID <DEANumber> in a SCRIPT message — it could be a real DEA", () => {
    const content = generateNewRx({ seed: 7001 }).replace(
      /<DEANumber>[^<]+<\/DEANumber>/,
      `<DEANumber>${token("AB", "3512349")}</DEANumber>`,
    );
    const r = scan("valid-dea.xml", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/DEA passes the checksum/);
  });

  it("flags a Luhn-VALID prescriber NPI (DB) in a Telecom claim (exit 1)", () => {
    const content = generateB1({ seed: 7004 }).replace(/\x1cDB\d{10}/, "\x1cDB1234567893");
    const r = scan("valid-db-npi.ncpdp", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/Luhn/);
  });

  it("flags a real phone (CQ) outside the 555-01xx block in a Telecom claim (exit 1)", () => {
    const content = generateB1({ seed: 7004 }).replace(/\x1cCQ\d+/, "\x1cCQ2028675309");
    const r = scan("real-phone.ncpdp", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/555-01xx/);
  });
});

describe("phi-scan: ASTM structured detection (SYNTH-8)", () => {
  it("passes a clean, generated ASTM result message (all P-record identity synthetic)", () => {
    const r = scan("clean-result.astm", generateAstmResult({ seed: 8001 }));
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });

  it("passes a clean, generated framed (E1381) ASTM message", () => {
    const bytes = generateAstmResultFramed({ seed: 8004 });
    let content = "";
    for (const b of bytes) content += String.fromCharCode(b);
    const r = scan("clean-framed.frame", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });

  it("flags a real patient name in the P record (exit 1)", () => {
    const content = generateAstmResult({ seed: 8001 }).replace(
      /\rP\|([^\r]*)/,
      (_m, body: string) => {
        // Swap the name field (field 6, index 5) for a real-looking name.
        const fields = `P|${body}`.split("|");
        fields[5] = "Smith^Robert^J";
        return `\r${fields.join("|")}`;
      },
    );
    const r = scan("real-name.astm", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/not declared synthetic/);
  });

  it("flags a non-synthetic-AA practice id in the P record (exit 1)", () => {
    const content = generateAstmResult({ seed: 8001 }).replace(
      /\rP\|([^\r]*)/,
      (_m, body: string) => {
        const fields = `P|${body}`.split("|");
        fields[2] = "123456789"; // a bare 9-digit id, area 123 — not a synthetic shape.
        return `\r${fields.join("|")}`;
      },
    );
    const r = scan("real-id.astm", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/synthetic-AA-scoped/);
  });
});

describe("phi-scan: synthetic-safety holds in QUIRK mode (SYNTH-9)", () => {
  it("passes every HL7 v2 quirk artifact — a quirk deviates structure, never provenance", () => {
    for (const quirk of ["unknown-zsegment", "unknown-escape"] as const) {
      const r = scan(`quirk-${quirk}.hl7`, generateHl7Quirk({ seed: 9101, quirk }).content);
      expect(r.code, `${quirk} stderr: ${r.stderr}`).toBe(0);
    }
  });
  it("passes every C-CDA quirk artifact", () => {
    for (const quirk of [
      "template-extension-absent",
      "deprecated-loinc",
      "deprecated-code-system",
    ] as const) {
      const r = scan(`quirk-${quirk}.xml`, generateCcdaQuirk({ seed: 9201, quirk }).content);
      expect(r.code, `${quirk} stderr: ${r.stderr}`).toBe(0);
    }
  });
  it("passes every ASTM quirk artifact", () => {
    for (const quirk of ["unknown-escape", "unknown-record-type"] as const) {
      const r = scan(`quirk-${quirk}.astm`, generateAstmQuirk({ seed: 9301, quirk }).content);
      expect(r.code, `${quirk} stderr: ${r.stderr}`).toBe(0);
    }
  });
});

describe("phi-scan: the override-log gate", () => {
  it("rejects --allow-fixture without a matching override entry (exit 2)", () => {
    const clean = join(dir, "override-me.txt");
    writeFileSync(clean, "nothing to see\n");
    const r = runScanner(["--allow-fixture", clean]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/phi-scan-overrides\.md/);
  });

  it("reads entries only from under `## Entries`, so a doc heading is not a bypass (exit 2)", () => {
    // `phi-scan-overrides.md` documents its own format with a literal `### <path>`
    // heading above the entries section. Parsing headings file-wide would let a
    // fixture named to collide with the template be silently waved through.
    const r = runScanner(["--allow-fixture", "<path>"]);
    expect(r.code, `stdout: ${r.stdout}`).toBe(2);
    expect(r.stderr).toMatch(/no matching entry in phi-scan-overrides\.md/);
  });
});

// ---------------------------------------------------------------------------
// The scan roots
// ---------------------------------------------------------------------------

describe("phi-scan: the scan roots cover src/, test/ and scripts/", () => {
  it("the committed corpus is clean, over a denominator the report states", () => {
    const r = runScanner([]);
    expect(r.code, `stdout: ${r.stdout}\nstderr: ${r.stderr}`).toBe(0);
    // The number is the point. An `OK` over an empty target set is the failure
    // mode this whole suite exists for, so assert the corpus is actually large.
    expect(scannedCount(r)).toBeGreaterThan(100);
  });

  it("catches a violator under test/ but OUTSIDE test/fixtures/", () => {
    const r = withSeeded([SEED_OUTSIDE_FIXTURES], () => runScanner([]));
    expect(r.code, `stdout: ${r.stdout}`).toBe(1);
    expect(r.stderr).toContain(SEED_OUTSIDE_FIXTURES);
  });

  it("catches a violator under scripts/", () => {
    const r = withSeeded([SEED_IN_SCRIPTS], () => runScanner([]));
    expect(r.code, `stdout: ${r.stdout}`).toBe(1);
    expect(r.stderr).toContain(SEED_IN_SCRIPTS);
  });

  it("still catches a violator under test/fixtures/, the historical root", () => {
    const r = withSeeded([SEED_IN_FIXTURES], () => runScanner([]));
    expect(r.code, `stdout: ${r.stdout}`).toBe(1);
    expect(r.stderr).toContain(SEED_IN_FIXTURES);
  });

  it("leaves markdown out of scope — documentation quotes violator values on purpose", () => {
    const r = withSeeded([SEED_MARKDOWN], () => runScanner([]));
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });

  it("leaves paths outside the roots out of scope, in a throwaway root", () => {
    // Repo-root files (`vitest.config.ts`, `tsup.config.ts`, …) are NOT scanned.
    // That is a real limit of the enumerator, so it is asserted rather than implied.
    const r = withRoot([], (root) => {
      put(root, "outside.xml", VIOLATOR);
      return runScannerIn(root, []);
    });
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The extension gate — CLOSED. Every structured arm now keys off the bytes.
//
// THIS BLOCK REPLACES A CHARACTERIZATION TEST, DELIBERATELY AND IN THE OPEN. The
// version it replaces asserted the OPPOSITE of the first test below: that the same
// bytes exited 0 as `.ts` and 1 as `.xml`, because `scanCcda` and `scanNcpdpScript`
// returned early unless the path ended `.xml` and `scanFhir` unless it ended
// `.json`. That test was right to exist — it made a known gap executable instead of
// a sentence in a header, and it was written so that narrowing the gate would red
// it and force a reviewer into the loop.
//
// This is that reviewer moment, arriving as designed. The gate was WIDENED rather
// than narrowed, the old assertion is now false, and it is rewritten rather than
// deleted: the same probe bytes, the same two paths, the opposite expectation, plus
// the residual limits the widening did NOT close. If you are here because one of
// these reds, the same rule applies — update it visibly or fix the gate, never
// quietly drop it to get green.
// ---------------------------------------------------------------------------

describe("phi-scan: every structured arm keys off content, not the file extension", () => {
  it("catches a C-CDA name as `.ts` AND as `.xml` — same bytes, same verdict", () => {
    const asTs = scan("gate-probe.ts", VIOLATOR);
    const asXml = scan("gate-probe.xml", VIOLATOR);
    expect(asTs.code, `stdout: ${asTs.stdout}`).toBe(1);
    expect(asXml.code, `stdout: ${asXml.stdout}`).toBe(1);
    // The point of the whole change: the verdict is a function of the bytes alone.
    expect(asTs.stderr.replace(/gate-probe\.ts/g, "P")).toBe(
      asXml.stderr.replace(/gate-probe\.xml/g, "P"),
    );
    expect(asTs.stderr).toMatch(/name\/given/);
  });

  it("catches an NCPDP SCRIPT name as `.ts` — the arm was already content-gated underneath", () => {
    // `scanNcpdpScript`'s `.xml` check sat ABOVE a `<Message>` + transaction-element
    // check that was strictly narrower, so removing it could only ever admit SCRIPT
    // messages in files not named `.xml`. Asserted rather than argued.
    const script =
      `<Message><Body><NewRx><Patient>` +
      el("LastName", FAMILY) +
      el("FirstName", GIVEN) +
      `</Patient></NewRx></Body></Message>`;
    const r = scan("script-probe.ts", script);
    expect(r.code, `stdout: ${r.stdout}`).toBe(1);
    expect(r.stderr).toMatch(/<LastName>/);
  });

  it("catches a FHIR HumanName in a TYPESCRIPT object literal, which is not JSON", () => {
    // The hard half. A `.json` gate plus `JSON.parse` could never reach this shape:
    // unquoted keys make it invalid JSON, so widening the extension check alone
    // would have bought nothing. The textual pass is what reaches it.
    const literal =
      `export const p = { resourceType: "Patient",\n` +
      `  name: [${JSON.stringify({ family: FAMILY, given: [GIVEN] })}],\n` +
      `  telecom: [{ system: "phone", value: ${JSON.stringify(digits("212-", "555-", "1234"))} }] };\n`;
    const r = scan("fhir-literal.ts", literal);
    expect(r.code, `stdout: ${r.stdout}`).toBe(1);
    expect(r.stderr).toMatch(/Patient\.name/);
    expect(r.stderr).toMatch(/Patient\.telecom/);
  });

  it("reads a FHIR resource whose file is JSON under any extension", () => {
    const json = JSON.stringify({
      resourceType: "Patient",
      name: [{ family: FAMILY, given: [GIVEN] }],
    });
    // `.json` was the old gate; `.txt` proves the gate is now `JSON.parse` succeeding.
    expect(scan("res.json", json).code).toBe(1);
    expect(scan("res.txt", json).code).toBe(1);
  });

  it("matches an extension case-insensitively, so `.XML` is an XML file too", () => {
    expect(scan("shouty.XML", VIOLATOR).code).toBe(1);
  });

  // -- the limits the widening did NOT close, pinned for the same reason --------

  it("does NOT read a FHIR name in a file that never declares a resourceType", () => {
    // Admission is the entire false-positive defence: a file must CLAIM to be FHIR
    // before its `family:` keys are read. Ordinary source must stay green, and this
    // is the test that reds if that admission marker is ever dropped "to catch more".
    const shape = JSON.stringify({ family: FAMILY, given: [GIVEN] });
    const r = scan("ordinary.ts", `const x = ${shape};\n`);
    expect(r.code, `stdout: ${r.stdout}`).toBe(0);
  });

  it("reads EVERY name shape it reaches — the scanner skips no token at all", () => {
    // THE STRONGEST FORM OF THIS SLICE'S CLAIM, and the reason the scanner carries no
    // placeholder rule. Three earlier drafts taught the detector to skip tokens that
    // looked like template syntax, and a refuter broke each one on a shape that put a
    // real surname in the bytes: `Anderson ...` (a containment test), then
    // `${"Anderson"}` (any interpolation body elided), then `{{Anderson ${s}}` (one
    // regex pass matching straight across two constructs the source never nested).
    //
    // Every entry below was silenced by at least one of those drafts. All are read now,
    // because nothing is skipped: the only question the gate asks of a name token is
    // whether the allow-list declares it. A skip rule on a PHI detector has to be
    // exactly right, and the way to be exactly right here was not to have one — the
    // suite assembles its own fixtures instead (see `el`).
    //
    // If a later change reintroduces a skip rule, this test is what reds.
    const shapes = [
      `${FAMILY} ...`,
      `${FAMILY} \${suffix}`,
      `\${"${FAMILY}"}`,
      `{\${x}{${FAMILY}}}`,
      `\${${FAMILY}}`,
      `{{${FAMILY}}}`,
    ];
    for (const shape of shapes) {
      const doc = VIOLATOR.replace(FAMILY, shape);
      expect(scan("shape.xml", doc).code, `silenced: ${shape}`).toBe(1);
    }
    // AN EXPLICIT CEILING ON THIS ONE TEST, not a change to the global `testTimeout`.
    // Six shapes x one scanner subprocess each is the slowest case in this file, and the
    // 10s global is a wall-clock assertion about the MACHINE: it reds this correct test
    // on a loaded box. Raising the global would trade a false red for a false green
    // everywhere else, so the ceiling stays local to the slow test.
  }, 60_000);

  it("does NOT reach a phone whose system and value are separated by another key", () => {
    // The textual FHIR route is a regex, not an object graph. `{ system, use, value }`
    // is valid, common FHIR and is missed; the structural route catches it. Pinned so
    // the docblock's narrower claim stays honest.
    const sep =
      `export const p = { resourceType: "Patient",\n` +
      `  telecom: [{ system: "phone", use: "home", value: "${digits("212-", "555-", "1234")}" }] };\n`;
    expect(scan("split-telecom.ts", sep).code, "adjacency limit closed?").toBe(0);
    // Same bytes as JSON: the structural route DOES read it.
    const asJson = JSON.stringify({
      resourceType: "Patient",
      telecom: [{ system: "phone", use: "home", value: digits("212-", "555-", "1234") }],
    });
    expect(scan("split-telecom.json", asJson).code).toBe(1);
  });

  it("does NOT read a namespace-prefixed C-CDA name element", () => {
    // `hasCdaMarker` tolerates a prefix when deciding whether to LOOK; the name loci
    // do not. Pre-existing, deliberately not widened here, and executable so it stays
    // a known gap rather than a forgotten one.
    const prefixed = VIOLATOR.replace(/<given>/g, "<hl7:given>").replace(
      /<\/given>/g,
      "</hl7:given>",
    );
    const r = scan("prefixed.xml", prefixed);
    expect(r.stderr).not.toMatch(new RegExp(GIVEN));
  });
});

// ---------------------------------------------------------------------------
// A scan that observes nothing must not report OK
// ---------------------------------------------------------------------------

describe("phi-scan: a scan that observes nothing must not report OK", () => {
  it("--allow-fixture SUBTRACTS from the full scan; it never becomes the scan", () => {
    // The collapse: `--allow-fixture X` used to also SEED the target set, so the
    // run became "scan [X], then subtract X" — zero targets, `OK — no hits`,
    // exit 0, over a scan that never happened. The mode now stays `all`.
    const r = withSeeded([SEED_IN_FIXTURES], () =>
      withOverrides([SEED_IN_FIXTURES], () => runScanner(["--allow-fixture", SEED_IN_FIXTURES])),
    );
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(scannedCount(r)).toBeGreaterThan(100);
  });

  it("refuses an --allow-fixture that subtracts nothing, for a path that does not exist", () => {
    // Logged, therefore past the override gate — but it matches no enumerated
    // target, so the operator believes a bypass is live when it is inert.
    const ghost = "test/fixtures/zz-phi-scan-seed-absent.xml";
    const r = withOverrides([ghost], () => runScanner(["--allow-fixture", ghost]));
    expect(r.code, `stdout: ${r.stdout}`).toBe(2);
    expect(r.stderr).toMatch(/matched no scanned file/);
  });

  it("refuses an --allow-fixture that subtracts nothing, for a file that is out of scope", () => {
    // `README.md` exists and is tracked, but markdown is never enumerated — the
    // same inert-override failure, reached by a different route.
    const r = withOverrides(["README.md"], () => runScanner(["--allow-fixture", "README.md"]));
    expect(r.code, `stdout: ${r.stdout}`).toBe(2);
    expect(r.stderr).toMatch(/matched no scanned file/);
  });

  it("refuses when every enumerated file is excluded by --allow-fixture (exit 2)", () => {
    // A throwaway root whose only in-scope file is the allow-list itself, then
    // overridden away: the target set empties and the gate must refuse, not report OK.
    const rel = "scripts/phi-allow-list.txt";
    const r = withRoot([rel], (root) => runScannerIn(root, ["--allow-fixture", rel]));
    expect(r.code, `stdout: ${r.stdout}`).toBe(2);
    expect(r.stderr).toMatch(/would observe nothing/);
  });

  it("treats a missing allow-list as an invocation error (exit 2), not as hits (exit 1)", () => {
    const root = mkdtempSync(join(tmpdir(), "phi-scan-bare-"));
    try {
      put(root, "src/clean.txt", "nothing here\n");
      const r = runScannerIn(root, []);
      expect(r.code, `stdout: ${r.stdout}`).toBe(2);
      expect(r.stderr).toMatch(/allow-list not found/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// --staged enumeration
// ---------------------------------------------------------------------------

/** A throwaway git repo with the scanner's two support files committed. */
function gitRoot(): string {
  const root = makeRoot();
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "fixture@example.com"]);
  git(root, ["config", "user.name", "fixture"]);
  git(root, ["add", "--", "scripts/phi-allow-list.txt", "phi-scan-overrides.md"]);
  git(root, ["commit", "-q", "-m", "base"]);
  return root;
}

function withGitRoot<T>(fn: (root: string) => T): T {
  const root = gitRoot();
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("phi-scan --staged: the enumerator excludes status letters rather than listing them", () => {
  it("catches PHI in a plainly ADDED file", () => {
    const r = withGitRoot((root) => {
      put(root, "src/added.xml", VIOLATOR);
      git(root, ["add", "--", "src/added.xml"]);
      return runScannerIn(root, ["--staged"]);
    });
    expect(r.code, `stdout: ${r.stdout}`).toBe(1);
    expect(r.stderr).toContain("src/added.xml");
  });

  it("catches PHI in a file that was RENAMED and edited in the same commit", () => {
    // git reports this as a single `R` entry. `--diff-filter=AM` named A and M and
    // therefore dropped it silently — the whole reason the filter is now an
    // exclusion list. The old flags are run here too, so the gap is measured.
    const { scanned, oldFlags } = withGitRoot((root) => {
      put(root, "src/doc.xml", CLEAN_DOC);
      git(root, ["add", "--", "src/doc.xml"]);
      git(root, ["commit", "-q", "-m", "clean fixture"]);
      git(root, ["mv", "src/doc.xml", "src/moved.xml"]);
      put(root, "src/moved.xml", VIOLATOR);
      git(root, ["add", "--", "src/moved.xml"]);
      return {
        scanned: runScannerIn(root, ["--staged"]),
        oldFlags: stagedUnder(root, ["--diff-filter=AM"]),
      };
    });
    expect(scanned.code, `stdout: ${scanned.stdout}`).toBe(1);
    expect(scanned.stderr).toContain("src/moved.xml");
    // The measurement: the superseded allow-list saw nothing to scan at all.
    expect(oldFlags).not.toContain("src/moved.xml");
  });

  it("catches PHI in a file whose TYPE changed from a symlink to a regular file", () => {
    // git reports `T`. `AM` dropped this one too, found by a separate refuter pass
    // in a sibling repo — which is the argument for excluding letters, not naming them.
    const { scanned, oldFlags } = withGitRoot((root) => {
      put(root, "src/target.xml", CLEAN_DOC);
      symlinkSync("target.xml", join(root, "src", "link.xml"));
      git(root, ["add", "--", "src/target.xml", "src/link.xml"]);
      git(root, ["commit", "-q", "-m", "symlinked fixture"]);
      rmSync(join(root, "src", "link.xml"));
      put(root, "src/link.xml", VIOLATOR);
      git(root, ["add", "--", "src/link.xml"]);
      return {
        scanned: runScannerIn(root, ["--staged"]),
        oldFlags: stagedUnder(root, ["--diff-filter=AM"]),
      };
    });
    expect(scanned.code, `stdout: ${scanned.stdout}`).toBe(1);
    expect(scanned.stderr).toContain("src/link.xml");
    expect(oldFlags).not.toContain("src/link.xml");
  });

  it("scans a staged clean file and reports the denominator", () => {
    const r = withGitRoot((root) => {
      put(root, "src/clean.xml", CLEAN_DOC);
      git(root, ["add", "--", "src/clean.xml"]);
      return runScannerIn(root, ["--staged"]);
    });
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(scannedCount(r)).toBe(1);
  });

  it("allows an empty staged set — the one mode where observing nothing is legitimate", () => {
    const r = withGitRoot((root) => runScannerIn(root, ["--staged"]));
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(scannedCount(r)).toBe(0);
  });

  it("skips a staged file outside the scan roots", () => {
    const r = withGitRoot((root) => {
      put(root, "outside.xml", VIOLATOR);
      git(root, ["add", "--", "outside.xml"]);
      return runScannerIn(root, ["--staged"]);
    });
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(scannedCount(r)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// NON-REGULAR ENTRIES — a symlink under a scan root read CLEAN on BOTH routes.
//
// The rule and its evidence live in ONE place, `scripts/phi-scan.ts` under
// "NON-REGULAR ENTRIES"; this block does not restate the argument, it executes it.
//
// Every case here uses a throwaway git root. A link seeded into THIS checkout would
// (correctly) refuse the real `pnpm phi-scan`, and a parallel worker sweeping the
// same tree would see it.
// ---------------------------------------------------------------------------

/**
 * The link TARGET is a path built out of the same name tokens the rest of this suite
 * assembles, and it lives outside the scan roots. That makes two assertions possible
 * at once: the scan must refuse over the link, and the refusal must never echo the
 * target — a target path of this shape is itself PHI.
 */
const SECRET_REL = `secret/${FAMILY}-${GIVEN}.xml`;

/** Seed the out-of-roots PHI document and return its ABSOLUTE path, for linking at. */
function seedSecret(root: string): string {
  put(root, SECRET_REL, VIOLATOR);
  return join(root, SECRET_REL);
}

/** Create a symlink at repo-relative `rel` under `root`, creating parent directories. */
function linkAt(root: string, rel: string, target: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  symlinkSync(target, abs);
}

/** Whether the whole run — stdout and stderr — is free of the target's name tokens. */
function mentionsTarget(r: RunResult): boolean {
  const all = `${r.stdout}${r.stderr}`;
  return all.includes(FAMILY) || all.includes(GIVEN) || all.includes("secret/");
}

describe("phi-scan: a non-regular in-scope entry refuses the scan, on both routes", () => {
  it("all-mode REFUSES a symlink under a scan root, and never names its target", () => {
    const { linked, control } = withGitRoot((root) => {
      const secret = seedSecret(root);
      linkAt(root, "src/link.xml", secret);
      const linked = runScannerIn(root, []);
      // NOT VACUOUS BY FIXTURE: the same bytes as a regular file are a real hit, so
      // the clean-over-the-link reading was about the LINK and not about the payload.
      rmSync(join(root, "src", "link.xml"));
      copyFileSync(secret, join(root, "src", "regular.xml"));
      return { linked, control: runScannerIn(root, []) };
    });
    expect(linked.code, `stdout: ${linked.stdout}`).toBe(2);
    expect(linked.stderr).toContain("src/link.xml (a symbolic link)");
    expect(linked.stderr).toMatch(/refusing the scan: 1 entry is not a regular file/);
    expect(mentionsTarget(linked)).toBe(false);

    expect(control.code, `stderr: ${control.stderr}`).toBe(1);
    expect(control.stderr).toContain("src/regular.xml");
  });

  it("all-mode REFUSES a linked DIRECTORY — it takes a whole subtree with it", () => {
    const r = withGitRoot((root) => {
      seedSecret(root);
      linkAt(root, "src/linkdir", join(root, "secret"));
      return runScannerIn(root, []);
    });
    expect(r.code, `stdout: ${r.stdout}`).toBe(2);
    expect(r.stderr).toContain("src/linkdir (a symbolic link)");
    expect(mentionsTarget(r)).toBe(false);
  });

  it("names EVERY offender, not just the first", () => {
    const r = withGitRoot((root) => {
      const secret = seedSecret(root);
      linkAt(root, "src/a.xml", secret);
      linkAt(root, "test/b", join(root, "secret"));
      linkAt(root, "scripts/c.xml", secret);
      return runScannerIn(root, []);
    });
    expect(r.code, `stdout: ${r.stdout}`).toBe(2);
    expect(r.stderr).toMatch(/refusing the scan: 3 entries are not regular files/);
    for (const p of ["src/a.xml", "test/b", "scripts/c.xml"]) expect(r.stderr).toContain(p);
  });

  it("keeps ONE boundary: a git-ignored link is out of scope, exactly like an ignored file", () => {
    const r = withGitRoot((root) => {
      const secret = seedSecret(root);
      linkAt(root, "src/link.xml", secret);
      put(root, ".gitignore", "src/link.xml\n");
      return runScannerIn(root, []);
    });
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(scannedCount(r)).toBeGreaterThan(0);
  });

  it("does NOT extend the `.md` exemption to a link — on BOTH routes, not one", () => {
    // A markdown FILE is out of scope because documentation quotes violator values.
    // A link merely NAMED `.md` says nothing about what is on the other side.
    //
    // BOTH ROUTES, DELIBERATELY. The first version of this slice ran the staged route's
    // non-regular check AFTER the `.md` filter, so this exact link refused in all-mode
    // and returned `OK — no hits (0 file(s) scanned)` exit 0 when staged, with `.md`
    // the sole discriminator — while the scanner's own authoritative note claimed the
    // exemption did not extend to a link. An all-mode-only test let that survive green.
    const { all, staged, mdFile } = withGitRoot((root) => {
      const secret = seedSecret(root);
      linkAt(root, "src/notes.md", secret);
      const all = runScannerIn(root, []);
      git(root, ["add", "--", "src/notes.md"]);
      const staged = runScannerIn(root, ["--staged"]);
      // The CONTROL that keeps the pair honest: a markdown FILE at the same path is
      // still out of scope in both modes, so `.md` really is the only thing that moved.
      git(root, ["rm", "-q", "--cached", "--", "src/notes.md"]);
      rmSync(join(root, "src", "notes.md"));
      put(root, "src/notes.md", VIOLATOR);
      git(root, ["add", "--", "src/notes.md"]);
      return { all, staged, mdFile: runScannerIn(root, ["--staged"]) };
    });
    expect(all.code, `stdout: ${all.stdout}`).toBe(2);
    expect(all.stderr).toContain("src/notes.md (a symbolic link)");
    expect(staged.code, `stdout: ${staged.stdout}`).toBe(2);
    expect(staged.stderr).toContain("src/notes.md (a symbolic link)");
    expect(mdFile.code, `stderr: ${mdFile.stderr}`).toBe(0);
    expect(scannedCount(mdFile)).toBe(0);
  });

  it("--staged describes an unmerged path accurately, not as a link", () => {
    // The refusal text is shared across every non-regular mode, so it must be true of
    // all of them: an unmerged path has no regular blob at stage 0 and no target path,
    // and a first draft told the reader `git show` had handed back a target path.
    const r = withGitRoot((root) => {
      put(root, "src/conflict.xml", CLEAN_DOC);
      git(root, ["add", "--", "src/conflict.xml"]);
      git(root, ["commit", "-q", "-m", "base fixture"]);
      git(root, ["checkout", "-q", "-b", "other"]);
      put(root, "src/conflict.xml", VIOLATOR);
      git(root, ["commit", "-q", "-a", "-m", "theirs"]);
      git(root, ["checkout", "-q", "main"]);
      put(root, "src/conflict.xml", CLEAN_DOC.replace("Exampla", "Testibald"));
      git(root, ["commit", "-q", "-a", "-m", "ours"]);
      const merged = spawnSync("git", ["merge", "other"], { cwd: root, encoding: "utf8" });
      // A clean merge would leave nothing unmerged and this case would assert nothing,
      // so it fails rather than passing over an empty index.
      if (merged.status === 0) throw new Error("the fixture merged cleanly: no unmerged path");
      return runScannerIn(root, ["--staged"]);
    });
    expect(r.code, `stdout: ${r.stdout}`).toBe(2);
    expect(r.stderr).toContain("(a git mode-000000 entry)");
    expect(r.stderr).toContain("src/conflict.xml");
    expect(r.stderr).toMatch(/no regular blob at stage 0/);
    // It must NOT claim a target path was handed back — there is none.
    expect(r.stderr).not.toMatch(/hands back the target path[^—]*$/);
  });

  it("refuses a FIFO with its own kind token — the rule is not keyed on symlinks", () => {
    // A FIFO is the case that would BLOCK the gate forever if anything followed it.
    const r = withGitRoot((root) => {
      mkdirSync(join(root, "src"), { recursive: true });
      const made = spawnSync("mkfifo", [join(root, "src", "pipe.xml")], { shell: false });
      // NO SILENT SKIP. A case that quietly no-ops when its setup fails is a green
      // test over nothing, which is the shape this whole slice exists to refuse.
      if (made.status !== 0) throw new Error(`mkfifo failed: ${String(made.stderr)}`);
      return runScannerIn(root, []);
    });
    expect(r.code, `stdout: ${r.stdout}`).toBe(2);
    expect(r.stderr).toContain("src/pipe.xml (a FIFO)");
  });

  it("--staged REFUSES a staged symlink, whose blob is the target PATH and not content", () => {
    const { scanned, blob } = withGitRoot((root) => {
      const secret = seedSecret(root);
      linkAt(root, "src/link.xml", secret);
      git(root, ["add", "--", "src/link.xml"]);
      return {
        scanned: runScannerIn(root, ["--staged"]),
        // The measurement behind the rule: git stores the TARGET STRING under mode
        // 120000, so `git show :<path>` never hands back the target's bytes.
        blob: spawnSync("git", ["show", ":src/link.xml"], { cwd: root, encoding: "utf8" }).stdout,
      };
    });
    expect(scanned.code, `stdout: ${scanned.stdout}`).toBe(2);
    expect(scanned.stderr).toContain("src/link.xml (a symbolic link)");
    expect(mentionsTarget(scanned)).toBe(false);
    expect(blob).toContain(SECRET_REL);
    expect(blob).not.toContain("<ClinicalDocument");
  });

  it("--staged REFUSES the REVERSE typechange: a tracked regular file replaced by a link", () => {
    // THE FLAG THIS SLICE CHANGED IS `--name-only` -> `--raw`, NOT the status filter.
    // `--diff-filter=d` is an exclusion, so `T` was ALREADY enumerated here — what was
    // missing was the MODE, which `--name-only` does not carry. Both halves measured.
    const { scanned, nameOnly } = withGitRoot((root) => {
      const secret = seedSecret(root);
      put(root, "src/doc.xml", CLEAN_DOC);
      git(root, ["add", "--", "src/doc.xml"]);
      git(root, ["commit", "-q", "-m", "regular fixture"]);
      rmSync(join(root, "src", "doc.xml"));
      symlinkSync(secret, join(root, "src", "doc.xml"));
      git(root, ["add", "--", "src/doc.xml"]);
      return {
        scanned: runScannerIn(root, ["--staged"]),
        nameOnly: stagedUnder(root, ["--no-renames", "--diff-filter=d"]),
      };
    });
    expect(scanned.code, `stdout: ${scanned.stdout}`).toBe(2);
    expect(scanned.stderr).toContain("src/doc.xml (a symbolic link)");
    // The record was never missing: the superseded flags listed the path, with no mode.
    expect(nameOnly).toContain("src/doc.xml");
  });

  it("--staged REFUSES a staged gitlink, naming its own engine-owned token", () => {
    const r = withGitRoot((root) => {
      const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
      const head = (sha.stdout ?? "").trim();
      const added = spawnSync(
        "git",
        ["update-index", "--add", "--cacheinfo", `160000,${head},src/nested`],
        { cwd: root, encoding: "utf8", shell: false },
      );
      if (added.status !== 0) throw new Error(`update-index failed: ${String(added.stderr)}`);
      return runScannerIn(root, ["--staged"]);
    });
    expect(r.code, `stdout: ${r.stdout}`).toBe(2);
    expect(r.stderr).toContain("src/nested (a gitlink (a nested repository))");
  });

  it("--staged still scans an EXECUTABLE regular blob — mode 100755 is a file", () => {
    // The mode check is an allow-list of the two regular blob modes, so the
    // executable one has to be in it or every `chmod +x` fixture would refuse.
    const r = withGitRoot((root) => {
      put(root, "src/gen.xml", VIOLATOR);
      spawnSync("chmod", ["+x", join(root, "src", "gen.xml")], { shell: false });
      git(root, ["add", "--", "src/gen.xml"]);
      return runScannerIn(root, ["--staged"]);
    });
    expect(r.code, `stdout: ${r.stdout}`).toBe(1);
    expect(r.stderr).toContain("src/gen.xml");
  });

  it("is THIS package's scanner, and refuses over a sibling's name appearing anywhere", () => {
    // Negative control against a cross-repo mix-up: the binary under test is resolved
    // from this checkout, and nothing it prints names another `@cosyte` package.
    const r = withGitRoot((root) => {
      linkAt(root, "src/link.txt", join(root, "scripts", "phi-allow-list.txt"));
      return runScannerIn(root, []);
    });
    expect(SCANNER_PATH.startsWith(REPO_ROOT)).toBe(true);
    expect(readFileSync(SCANNER_PATH, "utf8")).toContain("`@cosyte/synth` PHI scanner");
    expect(r.code, `stdout: ${r.stdout}`).toBe(2);
    expect(`${r.stdout}${r.stderr}`).not.toMatch(/@cosyte\/(ncpdp|terminology|ccda|hl7)/);
  });
});

// ---------------------------------------------------------------------------
// The two modes DISAGREE about a git-ignored file, and neither direction was
// exercised. The scanner header has disclosed the disagreement since the roots
// widening; a disclosed behaviour with no test is one refactor away from becoming
// an undisclosed one, so both directions are pinned here.
//
// NEITHER DIRECTION IS CHANGED BY THESE TESTS, because on inspection both are the
// right answer for their mode and the disagreement is not a defect:
//   - all-mode SKIPS ignored files. It walks the working tree, where an ignored
//     path is build output or a local scratch file — never something a commit will
//     carry. Scanning them would red the gate on artifacts nobody is committing.
//   - --staged does NOT skip them, because it enumerates the INDEX. A file reaches
//     the index only by `git add -f`, which is an explicit override of the ignore
//     rule, and it WILL be in the commit. Refusing to read it is the shipping
//     direction, and the shipping direction is the one that must never be lenient.
// ---------------------------------------------------------------------------

describe("phi-scan: the two modes disagree about a git-ignored file, on purpose", () => {
  it("all-mode SKIPS a git-ignored violator in the working tree", () => {
    const r = withGitRoot((root) => {
      put(root, ".gitignore", "src/ignored.xml\n");
      put(root, "src/ignored.xml", VIOLATOR);
      put(root, "src/tracked.xml", CLEAN_DOC);
      return runScannerIn(root, []);
    });
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stderr).not.toContain("src/ignored.xml");
    // The denominator proves the run was not empty: it observed the clean file and
    // the allow-list, and simply did not observe the ignored one.
    expect(scannedCount(r)).toBeGreaterThan(0);
  });

  it("--staged CATCHES the same file once it is force-added to the index", () => {
    const r = withGitRoot((root) => {
      put(root, ".gitignore", "src/ignored.xml\n");
      put(root, "src/ignored.xml", VIOLATOR);
      // `-f` is the whole point: the developer has overridden the ignore rule and
      // this content is going into the commit.
      git(root, ["add", "-f", "--", "src/ignored.xml"]);
      return runScannerIn(root, ["--staged"]);
    });
    expect(r.code, `stdout: ${r.stdout}`).toBe(1);
    expect(r.stderr).toContain("src/ignored.xml");
  });
});

// ---------------------------------------------------------------------------
// The allow-list's EMAIL tag
// ---------------------------------------------------------------------------

describe("phi-scan: EMAIL clears one exact address, not a whole domain", () => {
  it("passes the declared address", () => {
    const r = scan("declared-email.txt", "publisher contact cgp@lists.HL7.org\n");
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });

  it("still flags a DIFFERENT address at the same live organizational domain", () => {
    const r = scan("sibling-email.txt", `roster ${addr("someone", "lists", "hl7", "org")}\n`);
    expect(r.code, `stdout: ${r.stdout}`).toBe(1);
    expect(r.stderr).toMatch(/non-test domain/);
  });
});

// ---------------------------------------------------------------------------
// The enumeration TOCTOU window (PHI-SCAN-ENUMERATE-THEN-READ-CLASS)
// ---------------------------------------------------------------------------

/**
 * All-mode lists `src/`, `test/` and `scripts/` first and reads each file
 * afterwards. A file created and deleted inside that window makes the read throw
 * `ENOENT`, and the scanner used to refuse the whole sweep with exit 2.
 *
 * THAT IS REACHABLE IN THIS REPO, AND IT WAS MEASURED BEFORE IT WAS FIXED. The
 * sibling that got caught (`ccda`) was caught by a repo-root `tsup` transient; this
 * package's roots stop short of the repo root, so that particular file is never
 * enumerated here. THIS suite is the reachable writer: `withSeeded` puts untracked
 * violators at `scripts/zz-phi-scan-seed-scripts.xml`,
 * `test/scripts/zz-phi-scan-seed-outside.xml` and
 * `test/fixtures/zz-phi-scan-seed-fixtures.xml` — all three inside `SCAN_ROOTS` —
 * and removes them in a `finally`. Sweeping this checkout in all-mode while the
 * seeded tests ran refused 8 of 165 sweeps with exit 2 naming those paths.
 *
 * The tests below hit the window WITHOUT a sleep and WITHOUT a real build. The
 * scanner runs `git` (`check-ignore`, then `ls-files`) after the walk and before
 * the first read, so a `git` shim placed first on `PATH` is a deterministic hook
 * into exactly that gap: it removes the decoy, then execs the real git. The shim is
 * a file the SCANNER execs through `PATH`, not a shell-form spawn from this suite,
 * so the module docblock's no-shell rule still holds here.
 *
 * Everything runs against a throwaway repo used as the scanner's `REPO_ROOT`, so no
 * decoy is ever written into this checkout and a parallel worker cannot see one.
 *
 * THE ONE BRANCH NOT PINNED, named rather than implied: a tolerated file written
 * BACK before the post-sweep re-check. Nothing in the scanner calls `git` after the
 * reads, so there is no second deterministic hook, and reaching it needs a timed
 * re-create against a deliberately slowed sweep. A load-sensitive sleep in the
 * suite guarding a load-dependent race is the exact failure this defect teaches, so
 * it is left unpinned deliberately. The branch can only turn a tolerated skip back
 * into the refusal these tests already pin, so an unnoticed regression in it costs
 * the re-check, never the tolerance's bounds.
 */

/** Absolute path of the real `git`, resolved from `PATH` without a subprocess. */
function realGit(): string {
  for (const entry of (process.env["PATH"] ?? "").split(":")) {
    if (entry.length === 0) continue;
    const candidate = join(entry, "git");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("git not found on PATH");
}

/**
 * A directory holding a `git` that runs `pre` (one line of `sh`) before delegating
 * to the real git. Put first on the scanner's `PATH`, this fires between the walk
 * and the first read — the window under test.
 */
function shimDirRunning(pre: string): string {
  const d = mkdtempSync(join(tmpdir(), "phi-scan-shim-"));
  writeFileSync(join(d, "git"), `#!/bin/sh\n${pre}\nexec '${realGit()}' "$@"\n`, { mode: 0o755 });
  return d;
}

/** Run the scanner in `cwd` with `shim` first on `PATH` (or none when `null`). */
function runScannerShimmed(
  cwd: string,
  shim: string | null,
  extraEnv: NodeJS.ProcessEnv = {},
): RunResult {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv };
  if (shim !== null) env["PATH"] = `${shim}:${process.env["PATH"] ?? ""}`;
  const r = spawnSync(NODE_BIN, [SCANNER_PATH], { cwd, encoding: "utf8", shell: false, env });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/**
 * Run `fn(root, shim)` against a throwaway root and a shim dir, removing both after.
 * `git` decides whether the root is a git repo at all; `track` whether its
 * allow-list is committed (the tracked file every sweep here observes).
 */
function withToctouRoot<T>(
  opts: { git: boolean; track?: boolean },
  pre: (root: string) => string,
  fn: (root: string, shim: string) => T,
): T {
  const root = makeRoot();
  const shims: string[] = [];
  try {
    if (opts.git) {
      git(root, ["init", "-q", "-b", "main"]);
      git(root, ["config", "user.email", "fixture@example.com"]);
      git(root, ["config", "user.name", "fixture"]);
      if (opts.track !== false) git(root, ["add", "--", "scripts/phi-allow-list.txt"]);
    }
    const shim = shimDirRunning(pre(root));
    shims.push(shim);
    return fn(root, shim);
  } finally {
    rmSync(root, { recursive: true, force: true });
    for (const s of shims) rmSync(s, { recursive: true, force: true });
  }
}

/** A build-tool transient, seeded INSIDE a scan root (`scripts/`), never at the root. */
const DECOY = "scripts/zz-toctou-transient.mjs";

describe("phi-scan: the enumeration TOCTOU window", () => {
  it("tolerates an UNTRACKED file gone between enumeration and read, and says so", () => {
    const r = withToctouRoot(
      { git: true },
      (root) => `rm -f '${join(root, DECOY)}'`,
      (root, shim) => {
        put(root, DECOY, 'export default { entry: ["src/index.ts"] };\n');
        return runScannerShimmed(root, shim);
      },
    );
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
    // Never silent: the skip is named, with the path that went away.
    expect(r.stderr).toMatch(/skipped 1 untracked file\(s\) gone between enumeration and read/);
    expect(r.stderr).toContain(DECOY);
    // And the denominator does not count it. The allow-list is the one file this
    // root observes, so a tolerated skip must leave the count at 1, not 2.
    expect(scannedCount(r)).toBe(1);
  });

  it("still REFUSES when a TRACKED file vanishes in the same window", () => {
    // The committed corpus is what the gate promises to have observed, so a tracked
    // file that cannot be read is an incomplete scan, not a transient.
    const r = withToctouRoot(
      { git: true },
      (root) => `rm -f '${join(root, "src/committed.xml")}'`,
      (root, shim) => {
        put(root, "src/committed.xml", CLEAN_DOC);
        git(root, ["add", "--", "src/committed.xml"]);
        return runScannerShimmed(root, shim);
      },
    );
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toMatch(/could not read src\/committed\.xml/);
    expect(r.stderr).toMatch(/ENOENT/);
  });

  it("still REFUSES a non-ENOENT read failure on an untracked file", () => {
    // Replaced by a directory rather than deleted: EISDIR is a scan that failed, not
    // a file that went away, so the tolerance must not swallow it.
    const r = withToctouRoot(
      { git: true },
      (root) => `rm -f '${join(root, DECOY)}'\nmkdir -p '${join(root, DECOY)}'`,
      (root, shim) => {
        put(root, DECOY, "export default {};\n");
        return runScannerShimmed(root, shim);
      },
    );
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toMatch(/could not read/);
    expect(r.stderr).toMatch(/EISDIR/);
  });

  it("REFUSES the tolerance outright when git cannot say what is tracked", () => {
    // Fail closed: with no tracked set there is no way to tell a transient from
    // committed content, so nothing is tolerated.
    const r = withToctouRoot(
      { git: false },
      (root) => `rm -f '${join(root, DECOY)}'`,
      (root, shim) => {
        put(root, DECOY, "export default {};\n");
        // The ceiling stops git walking out of the temp dir into some enclosing repo.
        return runScannerShimmed(root, shim, { GIT_CEILING_DIRECTORIES: tmpdir() });
      },
    );
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toMatch(/could not read/);
  });

  it("REFUSES the tolerance when git answers with an EMPTY tracked set", () => {
    // A REMOVED index exits 0 with no output (a corrupt one exits 128 and was
    // already caught). An empty set would make every file untracked, which is the
    // one state in which the tracked-file bound silently stops existing.
    const r = withToctouRoot(
      { git: true, track: false },
      (root) => `rm -f '${join(root, DECOY)}'`,
      (root, shim) => {
        put(root, DECOY, "export default {};\n");
        return runScannerShimmed(root, shim);
      },
    );
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toMatch(/could not read/);
  });

  it("REFUSES an all-mode sweep that ENUMERATED files but OBSERVED none", () => {
    // The refuse-a-scan-that-observes-nothing rule, one step later than
    // `enforceObservation`: tolerating a vanished file must never be able to decay
    // into a clean report of a tree nothing was read from. The only in-scope file
    // here is the UNTRACKED allow-list, which the shim removes after the walk has
    // listed it; a tracked out-of-scope file keeps `git ls-files` non-empty so the
    // tolerance stays switched on and this branch is the one that fires.
    const r = withToctouRoot(
      { git: true, track: false },
      (root) => `rm -f '${join(root, "scripts/phi-allow-list.txt")}'`,
      (root, shim) => {
        put(root, "README.md", "# throwaway\n");
        git(root, ["add", "--", "README.md"]);
        return runScannerShimmed(root, shim);
      },
    );
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toMatch(/observed no files/);
  });

  it("still CATCHES a violator in an untracked file that does NOT vanish", () => {
    // The tolerance is about a file that is gone. It is not about untracked files,
    // and an untracked violator is exactly what this gate exists to refuse.
    const r = withToctouRoot(
      { git: true },
      () => ":",
      (root, shim) => {
        put(root, "src/leak.xml", VIOLATOR);
        return runScannerShimmed(root, shim);
      },
    );
    expect(r.code, `stdout: ${r.stdout}`).toBe(1);
    expect(r.stderr).toContain("src/leak.xml");
  });
}, 60_000);
