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
 *   - the EXTENSION GATE, characterized rather than endorsed: the same bytes are
 *     caught as `.xml` and missed as `.ts`, because three structured arms gate on
 *     the file extension. The seeded-violator tests above are all `.xml`, so they
 *     prove the ENUMERATOR reaches the new roots — they do not prove structured
 *     detection reaches an inline literal in a TypeScript test, and it does not;
 *   - `--staged` enumeration, against a throwaway git repo — including the `R` and
 *     `T` statuses the superseded `--diff-filter=AM` allow-list dropped, with the
 *     old flags run alongside so the gap is measured rather than asserted.
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
 * A PHI-shaped digit string built from parts, and a non-declared email built the
 * same way. The scanner now walks all of `test/`, so this suite sits inside the
 * corpus it guards: a literal violator here would be a correct hit on every run.
 * Assembling keeps the value the scanner sees identical while keeping the literal
 * out of the file — allow-listing instead would defeat the very tests using it.
 */
const digits = (...parts: string[]): string => parts.join("");
const addr = (user: string, ...domain: string[]): string => `${user}@${domain.join(".")}`;

/**
 * The same trick for a real-looking person NAME. This one is not currently load-
 * bearing and is applied anyway, deliberately: the structured C-CDA and FHIR arms
 * return early unless the path ends `.xml` / `.json`, so a bare real surname in
 * this `.ts` file scans green today for a reason that has nothing to do with it
 * being safe. Assembling it means this file does not quietly depend on that extension
 * gate, and does not turn red the day the gate is narrowed. `digits` and `addr`
 * above guard values the floor DOES catch here; this guards one it would catch if
 * the arm ever became content-gated.
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
  const r = spawnSync(TSX_BIN, [SCANNER_PATH, ...args], { cwd, encoding: "utf8", shell: false });
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

/** A genuine violator: a real-looking C-CDA `recordTarget` name (`.xml` → the C-CDA arm). */
const VIOLATOR = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <recordTarget><patientRole><patient>
    <name><given>${GIVEN}</given><family>${FAMILY}</family></name>
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
    const content = generateNewRx({ seed: 7001 }).replace(
      /<LastName>[^<]+<\/LastName>/,
      "<LastName>Smith</LastName>",
    );
    const r = scan("real-name.xml", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/not declared synthetic/);
  });

  it("flags a Luhn-VALID <NPI> in a SCRIPT message — it could be a real provider", () => {
    const content = generateNewRx({ seed: 7001 }).replace(
      /<NPI>\d{10}<\/NPI>/,
      "<NPI>1234567893</NPI>",
    );
    const r = scan("valid-npi.xml", content);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/Luhn/);
  });

  it("flags a checksum-VALID <DEANumber> in a SCRIPT message — it could be a real DEA", () => {
    const content = generateNewRx({ seed: 7001 }).replace(
      /<DEANumber>[^<]+<\/DEANumber>/,
      "<DEANumber>AB3512349</DEANumber>",
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
// The extension gate — a KNOWN GAP, pinned so it cannot be mistaken for coverage
// ---------------------------------------------------------------------------

describe("phi-scan: three structured arms are gated on a file extension", () => {
  it("misses a C-CDA recordTarget name as `.ts` and catches it as `.xml` — same bytes", () => {
    // This is characterization, NOT endorsement. `scanCcda` and `scanNcpdpScript`
    // return early unless the path ends `.xml`, and `scanFhir` unless it ends
    // `.json`. So widening the roots to all of `test/` did NOT bring structured
    // C-CDA / FHIR / NCPDP-SCRIPT detection to the inline string literals that live
    // in TypeScript tests — only the format-agnostic floor and the content-gated
    // arms (HL7 v2, X12, ASTM, NCPDP Telecom) reach those.
    //
    // Pinned here so the gap is executable rather than a sentence in a header, and
    // so narrowing the gate later REDS this test — making it a deliberate act with a
    // reviewer, rather than a silent change in what the commit gate refuses.
    const asTs = scan("gate-probe.ts", VIOLATOR);
    const asXml = scan("gate-probe.xml", VIOLATOR);
    expect(asTs.code, `stderr: ${asTs.stderr}`).toBe(0);
    expect(asXml.code, `stdout: ${asXml.stdout}`).toBe(1);
    expect(asXml.stderr).toMatch(/recordTarget/);
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

describe("phi-scan --staged: the enumerator excludes status letters rather than listing them", () => {
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
