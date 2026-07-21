/**
 * Unit tests for scripts/phi-scan.ts — the STARTER PHI commit-gate.
 *
 * These exercise the SHARED MACHINERY and the cross-cutting SSN/email FLOOR that
 * ships with the template. They deliberately do NOT test structured, field-level
 * PHI detection — that is format-specific and is the author's obligation to add
 * (see the STARTER banner in scripts/phi-scan.ts). When you add structured
 * detectors, add positive tests here proving they CATCH real-looking names /
 * DOBs / ids for this standard — a weak scanner is worse than none.
 *
 * The scanner is invoked via spawnSync (array args, no shell) so the full CLI
 * path (argv parse, exit code, stderr) is exercised. Violator/clean files are
 * written to a throwaway temp dir so they never pollute the committed corpus.
 *
 * SECURITY: every subprocess call here uses spawnSync with array args. No exec,
 * no shell-form.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const REPO_ROOT = process.cwd();
const SCANNER_PATH = join(REPO_ROOT, "scripts", "phi-scan.ts");
const TSX_BIN = join(REPO_ROOT, "node_modules", ".bin", "tsx");

let dir: string;

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runScanner(args: string[]): RunResult {
  const r = spawnSync(TSX_BIN, [SCANNER_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
  });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
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

describe("phi-scan starter: the cross-cutting floor catches SSN + email", () => {
  it("catches a dashed SSN (exit 1)", () => {
    const r = scan("ssn.txt", "patient ssn 123-45-6789 on file\n");
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/123-45-6789/);
    expect(r.stderr).toMatch(/dashed SSN/);
  });

  it("catches an email at a non-test domain (exit 1)", () => {
    const r = scan("email.txt", "contact jane.doe@hospital.org for records\n");
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/jane\.doe@hospital\.org/);
    expect(r.stderr).toMatch(/non-test domain/);
  });
});

describe("phi-scan starter: clean + allow-listed content passes", () => {
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

describe("phi-scan starter: the override-log gate", () => {
  it("rejects --allow-fixture without a matching override entry (exit 2)", () => {
    const clean = join(dir, "override-me.txt");
    writeFileSync(clean, "nothing to see\n");
    const r = runScanner(["--allow-fixture", clean]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/phi-scan-overrides\.md/);
  });
});
