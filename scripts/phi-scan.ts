#!/usr/bin/env tsx
/**
 * `@cosyte/synth` PHI scanner — the CI / pre-commit half of the PHI commit-gate.
 *
 * Pure Node. Zero runtime deps. `git` is the only subprocess, always via
 * `execFileSync` with array args (never shell-form). Walks the synthetic test
 * fixtures (and a conservative text pass over `src/`) and REFUSES anything that
 * looks like real PHI, so a developer cannot commit a real-looking fixture by
 * accident.
 *
 * ===========================================================================
 * ██  STARTER — READ BEFORE YOU RELY ON THIS  ███████████████████████████████
 * ===========================================================================
 *
 *   This file is the SHARED MACHINERY only. As shipped it detects EXACTLY TWO
 *   cross-cutting PHI shapes that apply to ANY format:
 *
 *       (1) a dashed Social Security Number   (\d{3}-\d{2}-\d{4})
 *       (2) an email at a non-test domain
 *
 *   That is a FLOOR, not a gate. It does NOT understand Synthetic Data. It will NOT
 *   catch a patient name, a date of birth, an MRN / member id, an address, or a
 *   phone number sitting in a structured Synthetic Data field — the PHI that a real
 *   Synthetic Data message actually carries.
 *
 *   ⚠  A scanner that silently ships SSN/email-only detection is a FALSE-
 *      CONFIDENCE RISK: it reports green on fixtures stuffed with real names and
 *      DOBs. Before you trust `pnpm phi-scan` as a safety gate for Synthetic Data,
 *      YOU MUST add structured, field-level detection for THIS standard's PHI
 *      (names, DOB, MRN / member id, address, phone) in the clearly-fenced
 *      TODO section inside `scanTarget` below.
 *
 *   Worked examples of structured, format-aware detection live in the sibling
 *   parsers — read one before you start:
 *       ../hl7/scripts/phi-scan.ts     (segment → field → component aware)
 *       ../x12/scripts/phi-scan.ts     (ISA-delimited NM1 / DMG / PER aware)
 *       ../dicom/scripts/phi-scan.ts   (binary tag-aware)
 *       ../ccda/scripts/phi-scan.ts    (XML element aware)
 *       ../ncpdp/scripts/phi-scan.ts   (fixed-field aware)
 *
 *   The mechanism for declaring genuinely-synthetic identifiers is the
 *   allow-list (`scripts/phi-allow-list.txt`) — a positive declaration that a
 *   fixture's identifiers are fake. Byte-strict formats cannot carry an inline
 *   `# synthetic: true` header, so the allow-list is the proven substitute
 *   (same approach every sibling uses). A whole-file bypass needs
 *   `--allow-fixture <path>` AND a logged entry in `phi-scan-overrides.md`.
 * ===========================================================================
 *
 * Modes:
 *   --staged                 - scan only files staged in `git diff --cached`
 *   --allow-fixture <path>   - bypass one path; rejected unless logged in
 *                              phi-scan-overrides.md
 *   <path> [<path>...]       - scan specific paths
 *   (no args)                - scan all in-scope working-tree files
 *
 * Exit codes: 0 (clean), 1 (hits found), 2 (invocation error).
 */

import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, relative, sep, isAbsolute } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REPO_ROOT = process.cwd();
const ALLOW_LIST_PATH = join(REPO_ROOT, "scripts", "phi-allow-list.txt");
const OVERRIDE_LOG_PATH = join(REPO_ROOT, "phi-scan-overrides.md");

// Roots walked in "all" mode. test/fixtures gets the full scan; src gets the
// same conservative shape pass because it is hand-written code, not data —
// JSDoc `@example` snippets must not carry real PHI either.
const FIXTURE_ROOT = join(REPO_ROOT, "test", "fixtures");
const SRC_ROOT = join(REPO_ROOT, "src");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Hit {
  path: string;
  segment: string; // locator (e.g. "(ssn)" / "(email)" or your field id)
  value: string;
  reason: string;
}

interface AllowList {
  /**
   * Uppercase synthetic person-name tokens. UNUSED by the starter floor — the
   * structured name detector you add in the TODO section consumes these.
   */
  names: Set<string>;
  /**
   * Synthetic dates of birth (raw, format-normalized as you choose). UNUSED by
   * the starter floor — your structured DOB detector consumes these.
   */
  dobs: Set<string>;
  /**
   * Synthetic id values (SSN / MRN / member-id shapes). UNUSED by the starter
   * floor — your structured id detector consumes these.
   */
  ids: Set<string>;
  /** Allowed email domains (anything else is a hit). Used by the starter floor. */
  emailDomains: Set<string>;
}

interface Args {
  mode: "all" | "staged" | "paths";
  paths: string[];
  allowFixtures: string[];
}

class InvocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvocationError";
  }
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Args {
  let staged = false;
  const paths: string[] = [];
  const allowFixtures: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--") {
      for (let j = i + 1; j < argv.length; j += 1) {
        const v = argv[j];
        if (v !== undefined) paths.push(v);
      }
      break;
    } else if (a === "--staged") {
      staged = true;
      i += 1;
    } else if (a === "--allow-fixture") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new InvocationError("--allow-fixture requires a path argument");
      }
      allowFixtures.push(next);
      i += 2;
    } else if (a !== undefined && a.startsWith("--")) {
      throw new InvocationError(`Unknown flag: ${a}`);
    } else if (a !== undefined) {
      paths.push(a);
      i += 1;
    } else {
      i += 1;
    }
  }

  if (staged && paths.length > 0) {
    throw new InvocationError("--staged cannot be combined with positional paths");
  }

  // An `--allow-fixture` path is a *subtractive* acknowledgement on a broader
  // scan, never a scan target on its own — so it also seeds the positional path
  // set. That makes `--allow-fixture X` mean "scan X, but allow it" (proving the
  // override gate actually subtracts a scanned target) instead of a silent no-op.
  const scanPaths = paths.length > 0 ? paths : [...allowFixtures];

  let mode: Args["mode"];
  if (staged) {
    mode = "staged";
  } else if (scanPaths.length > 0) {
    mode = "paths";
  } else {
    mode = "all";
  }
  return { mode, paths: scanPaths, allowFixtures };
}

// ---------------------------------------------------------------------------
// Allow-list + override log
// ---------------------------------------------------------------------------

function loadAllowList(): AllowList {
  if (!existsSync(ALLOW_LIST_PATH)) {
    throw new InvocationError(`allow-list not found at ${ALLOW_LIST_PATH}`);
  }
  const raw = readFileSync(ALLOW_LIST_PATH, "utf8");
  const names = new Set<string>();
  const dobs = new Set<string>();
  const ids = new Set<string>();
  const emailDomains = new Set<string>();
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const sp = line.indexOf(" ");
    if (sp < 0) continue;
    const tag = line.slice(0, sp);
    const value = line.slice(sp + 1).trim();
    if (value.length === 0) continue;
    switch (tag) {
      case "NAME":
        names.add(value.toUpperCase());
        break;
      case "DOB":
        dobs.add(value);
        break;
      case "ID":
        ids.add(value.toUpperCase());
        break;
      case "EMAILDOMAIN":
        emailDomains.add(value.toLowerCase());
        break;
      default:
        break;
    }
  }
  return { names, dobs, ids, emailDomains };
}

function normalizePath(p: string): string {
  const abs = isAbsolute(p) ? p : resolve(REPO_ROOT, p);
  const rel = relative(REPO_ROOT, abs);
  return rel.split(sep).join("/");
}

function loadOverrideLog(): Set<string> {
  if (!existsSync(OVERRIDE_LOG_PATH)) return new Set();
  const raw = readFileSync(OVERRIDE_LOG_PATH, "utf8");
  const out = new Set<string>();
  for (const lineRaw of raw.split(/\r?\n/)) {
    const m = /^###\s+(.+?)\s*$/.exec(lineRaw);
    if (m && m[1] !== undefined) out.add(normalizePath(m[1]));
  }
  return out;
}

function validateAllowFixtures(allowFixtures: string[]): void {
  if (allowFixtures.length === 0) return;
  const overrides = loadOverrideLog();
  const missing = allowFixtures.map(normalizePath).filter((p) => !overrides.has(p));
  if (missing.length > 0) {
    const lines = missing.map((p) => `  - ${p}`).join("\n");
    throw new InvocationError(
      `--allow-fixture rejected: no matching entry in phi-scan-overrides.md for:\n${lines}\n` +
        `Add a "### <path>" subsection to phi-scan-overrides.md and commit it.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Target enumeration
// ---------------------------------------------------------------------------

interface Target {
  path: string; // forward-slash repo-relative path for reporting
  read: () => Buffer;
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out);
    } else if (e.isFile()) {
      // README/markdown docs may legitimately describe violator values; they
      // are documentation, not fixtures.
      if (e.name.toLowerCase().endsWith(".md")) continue;
      out.push(full);
    }
  }
}

function gitIgnored(paths: string[]): Set<string> {
  const ignored = new Set<string>();
  if (paths.length === 0) return ignored;
  try {
    // SECURITY: array-form execFileSync, no shell. Default (Buffer) encoding —
    // `encoding: "buffer"` with `input` is rejected by Node.
    const out = execFileSync("git", ["check-ignore", "--stdin", "-z"], {
      input: paths.map(normalizePath).join("\0"),
      stdio: ["pipe", "pipe", "ignore"],
    });
    for (const p of out.toString("utf8").split("\0")) {
      if (p.length > 0) ignored.add(p);
    }
  } catch {
    // `git check-ignore` exits 1 when nothing matches — treat as none ignored.
  }
  return ignored;
}

function buildTargetsForAll(): Target[] {
  const files: string[] = [];
  walk(FIXTURE_ROOT, files);
  walk(SRC_ROOT, files);
  const ignored = gitIgnored(files);
  return files
    .filter((abs) => !ignored.has(normalizePath(abs)))
    .map((abs) => ({ path: normalizePath(abs), read: () => readFileSync(abs) }));
}

function buildTargetsForPaths(paths: string[]): Target[] {
  return paths.map((p) => {
    const abs = isAbsolute(p) ? p : resolve(REPO_ROOT, p);
    if (!existsSync(abs)) throw new InvocationError(`File not found: ${p}`);
    if (!statSync(abs).isFile()) throw new InvocationError(`Not a regular file: ${p}`);
    return { path: normalizePath(abs), read: () => readFileSync(abs) };
  });
}

function buildTargetsForStaged(): Target[] {
  let listBuf: Buffer;
  try {
    // SECURITY: array-form execFileSync, no shell.
    listBuf = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=AM", "-z"], {
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    throw new InvocationError(
      `git diff --cached failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const list = listBuf
    .toString("utf8")
    .split("\0")
    .filter((p) => p.length > 0)
    .filter((p) => p.startsWith("test/fixtures/") || (p.startsWith("src/") && p.endsWith(".ts")));
  return list.map((relPath) => ({
    path: relPath,
    // SECURITY: array-form execFileSync, no shell. `:<path>` is a git pathspec.
    read: (): Buffer =>
      execFileSync("git", ["show", `:${relPath}`], {
        encoding: "buffer",
        stdio: ["ignore", "pipe", "pipe"],
      }),
  }));
}

// ---------------------------------------------------------------------------
// Cross-cutting shape checks — the format-agnostic FLOOR
// ---------------------------------------------------------------------------

/**
 * Whether a 9-digit SSN (dashes optional) is drawn from an SSA never-issued / reserved space — area
 * `000`, `666`, or `900–999`. This is the one place a *synthetic-data generator's* PHI gate must
 * differ from a parser's: `synth` legitimately emits `900-xx-xxxx` never-issued SSNs and the
 * `987-65-432x` advertising block, and those are *proof of synthetic*, not PHI. A real, issuable SSN
 * (area `001–899`, excluding `666`) is still a hard hit (roadmap §4.1, §4.4).
 */
function isSyntheticSsn(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return false;
  const area = Number(digits.slice(0, 3));
  return area === 0 || area === 666 || area >= 900;
}

function scanCommonShapes(path: string, content: string, allow: AllowList, hits: Hit[]): void {
  // Dashed SSN anywhere — a hit UNLESS it is a provably-synthetic never-issued/reserved SSN.
  for (const m of content.matchAll(/\b\d{3}-\d{2}-\d{4}\b/g)) {
    if (isSyntheticSsn(m[0])) continue;
    hits.push({ path, segment: "(ssn)", value: m[0], reason: "dashed SSN pattern" });
  }
  // Emails whose domain is not an allow-listed reserved / test domain.
  for (const m of content.matchAll(/\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g)) {
    const domain = (m[1] ?? "").toLowerCase();
    if (!allow.emailDomains.has(domain)) {
      hits.push({ path, segment: "(email)", value: m[0], reason: "email with non-test domain" });
    }
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function scanTarget(target: Target, allow: AllowList, hits: Hit[]): void {
  let buf: Buffer;
  try {
    buf = target.read();
  } catch (err) {
    throw new InvocationError(
      `could not read ${target.path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const text = buf.toString("utf8");

  // The format-agnostic floor: dashed SSN (synthetic-area-aware) + non-test email.
  scanCommonShapes(target.path, text, allow, hits);

  // Structured, field-level detection for the format synth actually generates in Phase 1: HL7 v2.
  // A generated fixture is swept at its real PHI loci (PID name / SSN / phone) and every value must be
  // provably synthetic — the executable, format-aware half of the synthetic-safety gate (roadmap §4.4).
  scanHl7(target.path, text, allow, hits);

  // FHIR R4 / US Core (Phase 3). A generated resource (or Bundle) is swept at its real PHI loci —
  // HumanName (`family`/`given`) and ContactPoint (`telecom` phone) — against the synthetic sources.
  scanFhir(target.path, text, allow, hits);

  // C-CDA R2.1 (Phase 4 / SYNTH-5). A generated document is swept at its real PHI loci — the
  // recordTarget patient `name` (`given` / `family`) and any `telecom` phone — against the synthetic
  // sources (roadmap §4.4). Non-XML targets fall straight through.
  scanCcda(target.path, text, allow, hits);

  // X12 EDI (Phase 5 / SYNTH-6). A generated 837 / 835 / 271 is swept at its real PHI loci — NM1 person
  // names + member ids + provider NPIs, PER contact names + phones, and REF*SY provider SSNs — against
  // the synthetic sources (roadmap §4.4). The X12 identity invariant is the hardest-attacked: a member
  // id must be synthetic-AA-scoped, an XX-qualified NPI must fail the NPI Luhn check (so it can never be
  // a real NPI), and a REF*SY SSN must be in the SSA never-issued range. Non-X12 targets (no ISA header)
  // fall straight through.
  scanX12(target.path, text, allow, hits);

  // NCPDP (Phase 6 / SYNTH-7). Two structurally unrelated standards under one brand, each swept at its
  // real PHI loci against the synthetic sources (roadmap §4.4):
  //   - SCRIPT (XML): patient + prescriber <FirstName>/<LastName>/<MiddleName> must be declared
  //     synthetic; a <NPI> must fail the NPI Luhn check; a <DEANumber> must fail the DEA checksum — so
  //     neither prescriber id can denote a real provider.
  //   - Telecom (FS/GS/RS-framed): keyed off the 2-char field ids — CA/CB/CC/CD (name), CQ (phone),
  //     CY (patient id) / C2 (cardholder id) — plus the prescriber DB (NPI) Luhn check. Keying off the
  //     globally-unique field id (not the enclosing segment) is bypass-resistant.
  // Non-NCPDP targets fall straight through.
  scanNcpdpScript(target.path, text, allow, hits);
  scanNcpdpTelecom(target.path, text, allow, hits);
}

/**
 * Whether a DEA number (`XX` + 7 digits) is **provably synthetic** — its 7th digit fails the published
 * DEA checksum `(d1+d3+d5) + 2·(d2+d4+d6)`, so it can never be a validly-issued DEA registration. A
 * checksum-valid DEA (which *could* be a real prescriber) is a hit. Mirrors
 * `src/safe/reserved.ts#isSyntheticDea` — kept inline because the scanner is a zero-import Node script.
 */
function isSyntheticDea(value: string): boolean {
  const compact = value.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{7}$/.test(compact)) return false;
  const d = compact
    .slice(2)
    .split("")
    .map((c) => c.charCodeAt(0) - 48);
  const odd = (d[0] ?? 0) + (d[2] ?? 0) + (d[4] ?? 0);
  const even = (d[1] ?? 0) + (d[3] ?? 0) + (d[5] ?? 0);
  return (odd + 2 * even) % 10 !== (d[6] ?? -1);
}

/**
 * Whether an NCPDP member / cardholder / patient id is a recognized synthetic shape: minted under the
 * synthetic assigning authority (the `MBR`-prefixed form `synth` emits — roadmap §4.1, there is no
 * reserved id range so the *namespace* is the guarantee). A 9-digit SSN-shaped value must instead be in
 * the SSA never-issued range.
 */
function isSyntheticNcpdpId(id: string): boolean {
  const v = id.trim().toUpperCase();
  if (/^MBR[-_]?[0-9A-Z]*$/.test(v)) return true;
  const digits = v.replace(/\D/g, "");
  if (digits.length === 9 && v.length === digits.length) return isSyntheticSsn(v);
  // A short all-digit id under the synthetic AA is acceptable; a long bare id is not distinguishable.
  return /^[0-9]{1,8}$/.test(v);
}

/**
 * SCRIPT (XML) structured PHI detection. Over a SCRIPT message, checks the patient + prescriber identity
 * loci: every `<FirstName>` / `<LastName>` / `<MiddleName>` name token must be declared synthetic, every
 * `<NPI>` must fail the NPI Luhn check, and every `<DEANumber>` must fail the DEA checksum. A non-SCRIPT
 * target (no `<Message`/SCRIPT markers) falls straight through; C-CDA `<given>`/`<family>` is handled by
 * {@link scanCcda}, so the two XML arms never collide.
 */
function scanNcpdpScript(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  if (!path.endsWith(".xml")) return;
  // SCRIPT markers — a <Message> root and a SCRIPT transaction/party element. Avoids running on C-CDA.
  if (
    !/<Message\b/.test(text) ||
    !/<(NewRx|RxRenewalRequest|RxChangeRequest|Prescriber|Patient)\b/.test(text)
  ) {
    return;
  }
  for (const m of text.matchAll(/<(LastName|FirstName|MiddleName)(?:\s[^>]*)?>([^<]+)<\/\1>/g)) {
    const token = (m[2] ?? "").trim();
    if (token.length === 0) continue;
    if (!allow.names.has(token.toUpperCase())) {
      hits.push({
        path,
        segment: `<${m[1] ?? "Name"}>`,
        value: token,
        reason: "name not declared synthetic",
      });
    }
  }
  for (const m of text.matchAll(/<NPI(?:\s[^>]*)?>([^<]+)<\/NPI>/g)) {
    const value = (m[1] ?? "").trim();
    if (/^\d{10}$/.test(value) && !isSyntheticNpi(value)) {
      hits.push({
        path,
        segment: "<NPI>",
        value,
        reason: "NPI passes the Luhn check — could be a real NPI",
      });
    }
  }
  for (const m of text.matchAll(/<DEANumber(?:\s[^>]*)?>([^<]+)<\/DEANumber>/g)) {
    const value = (m[1] ?? "").trim();
    if (/^[A-Za-z]{2}\d{7}$/.test(value) && !isSyntheticDea(value)) {
      hits.push({
        path,
        segment: "<DEANumber>",
        value,
        reason: "DEA passes the checksum — could be a real DEA registration",
      });
    }
  }
}

/** Telecom 2-char field ids that carry patient / cardholder PHI, keyed to the category to check. */
const TELECOM_PHI_FIELDS: Readonly<Record<string, "name" | "phone" | "id">> = {
  CA: "name", // Patient First Name
  CB: "name", // Patient Last Name
  CC: "name", // Cardholder First Name
  CD: "name", // Cardholder Last Name
  CQ: "phone", // Patient Phone
  CY: "id", // Patient ID
  C2: "id", // Cardholder ID
};

/**
 * Telecom (FS/GS/RS-framed) structured PHI detection. Tokenizes on the union of the three NCPDP
 * separators — each token is a `<2-char field id><value>` pair — and checks the identity-bearing field
 * ids against the synthetic sources: names (CA/CB/CC/CD) must be declared synthetic, phones (CQ) must
 * carry the reserved 555-01xx tail, ids (CY/C2) must be synthetic-AA-scoped, and any prescriber id (DB)
 * that is a 10-digit NPI must fail the Luhn check. A non-Telecom target (no control chars) falls
 * straight through. DOB (C4) is not value-gated — a synthetic DOB is seeded and indistinguishable from
 * a real one, and there is no reserved DOB range (roadmap §4.3), matching every other synth arm.
 */
function scanNcpdpTelecom(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  if (!/[\x1c\x1d\x1e]/.test(text)) return;
  for (const token of text.split(/[\x1c\x1d\x1e]/)) {
    if (token.length < 2) continue;
    const id = token.slice(0, 2);
    const value = token.slice(2);
    if (id === "DB") {
      if (/^\d{10}$/.test(value) && !isSyntheticNpi(value)) {
        hits.push({
          path,
          segment: "DB",
          value,
          reason: "prescriber NPI passes the Luhn check — could be real",
        });
      }
      continue;
    }
    const category = TELECOM_PHI_FIELDS[id];
    if (category === undefined) continue;
    if (category === "name") {
      const t = value.trim();
      if (t.length > 0 && !allow.names.has(t.toUpperCase())) {
        hits.push({ path, segment: id, value: t, reason: "name not declared synthetic" });
      }
    } else if (category === "phone") {
      if (/\d{7,}/.test(value.replace(/\D/g, "")) && !isSyntheticPhone(value)) {
        hits.push({ path, segment: id, value, reason: "phone not in 555-01xx block" });
      }
    } else {
      const t = value.trim();
      if (t.length > 0 && !isSyntheticNcpdpId(t)) {
        hits.push({
          path,
          segment: id,
          value: t,
          reason: "id not recognized as synthetic-AA-scoped",
        });
      }
    }
  }
}

/** Whether a byte string is an X12 interchange — starts with `ISA` and is at least a full ISA wide. */
function isX12(text: string): boolean {
  const t = text.replace(/^\uFEFF/, "");
  return t.startsWith("ISA") && t.length >= 106;
}

/** Split raw X12 into segments → elements using the ISA-declared delimiters (byte 3 / byte 105). */
function splitX12Segments(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, "");
  const elementSep = t.charAt(3);
  const segmentTerm = t.charAt(105);
  return t
    .split(segmentTerm)
    .map((s) => s.replace(/[\r\n]+/g, "").trim())
    .filter((s) => s.length > 0)
    .map((s) => s.split(elementSep));
}

/** Word tokens (len >= 2, alphabetic) inside an X12 name element. */
function x12NameTokens(value: string): string[] {
  return value
    .split(/[\s,.'-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && /[A-Za-z]/.test(t));
}

/**
 * Whether a 10-digit NPI is **provably synthetic** — its check digit fails the CMS NPI Luhn check
 * (`80840` prefix), so it can never be a NPPES-issued NPI. A Luhn-valid NPI (which *could* be a real
 * registered provider) is a hit. Mirrors `src/safe/reserved.ts#isSyntheticNpi` — kept inline because
 * the scanner is a standalone, zero-import Node script.
 */
function isSyntheticNpi(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  const s = `80840${digits}`;
  let sum = 0;
  let double = false; // rightmost digit is never doubled.
  for (let i = s.length - 1; i >= 0; i -= 1) {
    let d = s.charCodeAt(i) - 48;
    if (d < 0 || d > 9) continue;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 !== 0; // non-zero ⇒ invalid check digit ⇒ never a real NPI.
}

/**
 * Whether an X12 member/cardholder id is a recognized synthetic shape: minted under the synthetic
 * assigning authority (the `MBR`-prefixed or all-digit forms `synth` emits — roadmap §4.1, there is no
 * reserved member-id range so the *namespace* is the guarantee).
 */
function isSyntheticMemberId(id: string): boolean {
  const v = id.toUpperCase();
  if (/^MBR[-_]?[0-9A-Z]*$/.test(v)) return true;
  if (/^[0-9]+$/.test(v)) return true;
  return false;
}

/**
 * X12 structured PHI detection. Over an X12 interchange, checks the identity-bearing loci against the
 * synthetic sources:
 *
 * - **NM1** — a person entity (`NM1-02 = 1`): every name token (NM1-03/04/05) must be declared
 *   synthetic; a member id (`NM1-08 = MI`) must be a synthetic shape; an SSN qualifier (`NM1-08 = 34`)
 *   must never appear. Any entity: a 10-digit NPI (`NM1-08 = XX`) must fail the NPI Luhn check.
 * - **PER** — contact name (PER-02) tokens must be declared synthetic; comm numbers (PER-04/06/08) must
 *   carry the reserved `555` fake-exchange convention.
 * - **REF** — a provider SSN (`REF-01 = SY`, 9 digits) must be in the SSA never-issued range.
 *
 * A non-X12 target falls straight through. Dates of birth (DMG) are intentionally NOT value-gated —
 * a synthetic DOB is seeded and structurally indistinguishable from a real one, and (like the HL7 /
 * FHIR / C-CDA arms) there is no reserved DOB range to check against; the synthetic guarantee for a DOB
 * is that it is drawn from the seeded generator, not a value pattern (roadmap §4.3).
 */
function scanX12(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  if (!isX12(text)) return;
  for (const elems of splitX12Segments(text)) {
    const id = elems[0] ?? "";
    if (id === "NM1") {
      const entityType = elems[2] ?? "";
      const qualifier = elems[8] ?? "";
      const idValue = elems[9] ?? "";
      if (qualifier === "34" && idValue.length > 0) {
        hits.push({
          path,
          segment: "NM1",
          value: idValue,
          reason: "SSN (NM1 qualifier 34) in fixture",
        });
      }
      if (entityType === "1") {
        for (const el of [elems[3], elems[4], elems[5]]) {
          if (el === undefined || el.length === 0) continue;
          for (const tok of x12NameTokens(el)) {
            if (!allow.names.has(tok.toUpperCase())) {
              hits.push({
                path,
                segment: "NM1",
                value: tok,
                reason: "name not declared synthetic",
              });
            }
          }
        }
        if (qualifier === "MI" && idValue.length > 0 && !isSyntheticMemberId(idValue)) {
          hits.push({
            path,
            segment: "NM1",
            value: idValue,
            reason: "member-id shape not recognized as synthetic",
          });
        }
      }
      if (qualifier === "XX" && /^[0-9]{10}$/.test(idValue) && !isSyntheticNpi(idValue)) {
        hits.push({
          path,
          segment: "NM1",
          value: idValue,
          reason: "NPI passes the Luhn check — could be a real NPI",
        });
      }
    } else if (id === "PER") {
      const perName = elems[2];
      if (perName !== undefined) {
        for (const tok of x12NameTokens(perName)) {
          if (!allow.names.has(tok.toUpperCase())) {
            hits.push({
              path,
              segment: "PER",
              value: tok,
              reason: "contact-name not declared synthetic",
            });
          }
        }
      }
      for (const idx of [4, 6, 8]) {
        const comm = elems[idx];
        if (comm === undefined) continue;
        const digits = comm.replace(/[^0-9]/g, "");
        if (digits.length >= 10 && !digits.includes("555")) {
          hits.push({
            path,
            segment: "PER",
            value: comm,
            reason: "phone without the 555 fake-exchange convention",
          });
        }
      }
    } else if (id === "REF") {
      const qualifier = elems[1] ?? "";
      const value = elems[2] ?? "";
      if (
        qualifier === "SY" &&
        /^\d{9}$/.test(value.replace(/\D/g, "")) &&
        !isSyntheticSsn(value)
      ) {
        hits.push({
          path,
          segment: "REF*SY",
          value,
          reason: "provider SSN not in synthetic range",
        });
      }
    }
  }
}

/**
 * C-CDA structured PHI detection. Over a C-CDA XML fixture, checks the recordTarget patient identity
 * loci: every `<given>` / `<family>` name token must be a declared-synthetic name, and every
 * `<telecom value="tel:…">` phone must carry the reserved `555-01xx` tail. A non-XML target (no such
 * elements) falls straight through. Dashed SSNs and non-test emails are already covered by
 * {@link scanCommonShapes}.
 */
function scanCcda(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  if (!path.endsWith(".xml")) return;

  // Patient name tokens — <given>…</given> and <family>…</family>. Each must be declared synthetic.
  for (const m of text.matchAll(/<(given|family)(?:\s[^>]*)?>([^<]+)<\/\1>/g)) {
    const token = (m[2] ?? "").trim();
    if (token.length === 0) continue;
    if (!allow.names.has(token.toUpperCase())) {
      hits.push({
        path,
        segment: `recordTarget/${m[1] ?? "name"}`,
        value: token,
        reason: "name not declared synthetic",
      });
    }
  }

  // Telecom phone — <telecom value="tel:+1..."/>. A phone-shaped value must be reserved 555-01xx.
  for (const m of text.matchAll(/<telecom\b[^>]*\bvalue="tel:([^"]+)"/g)) {
    const value = m[1] ?? "";
    if (/\d{7,}/.test(value.replace(/\D/g, "")) && !isSyntheticPhone(value)) {
      hits.push({
        path,
        segment: "recordTarget/telecom",
        value,
        reason: "phone not in 555-01xx block",
      });
    }
  }
}

/**
 * FHIR structured PHI detection. Parses a JSON fixture and recursively visits every object, checking the
 * two identity-bearing shapes wherever they sit (a standalone resource or a Bundle entry): a `HumanName`
 * (`family` / `given` tokens must be declared-synthetic names) and a phone `ContactPoint`
 * (`{ system: "phone", value }` must carry the reserved `555-01xx` tail). A non-JSON target (or one with
 * no such shapes) falls straight through. Emails and SSNs are already covered by {@link scanCommonShapes}.
 */
function scanFhir(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  if (!path.endsWith(".json")) return;
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return; // not JSON — nothing to do.
  }

  const checkName = (obj: Record<string, unknown>): void => {
    const tokens: string[] = [];
    if (typeof obj["family"] === "string") tokens.push(obj["family"]);
    if (Array.isArray(obj["given"])) {
      for (const g of obj["given"]) if (typeof g === "string") tokens.push(g);
    }
    for (const t of tokens) {
      const token = t.trim();
      if (token.length > 0 && !allow.names.has(token.toUpperCase())) {
        hits.push({
          path,
          segment: "Patient.name",
          value: token,
          reason: "name not declared synthetic",
        });
      }
    }
  };

  const checkTelecom = (obj: Record<string, unknown>): void => {
    if (obj["system"] === "phone" && typeof obj["value"] === "string") {
      const digits = obj["value"].replace(/\D/g, "");
      if (/\d{7,}/.test(digits) && !isSyntheticPhone(obj["value"])) {
        hits.push({
          path,
          segment: "Patient.telecom",
          value: obj["value"],
          reason: "phone not in 555-01xx block",
        });
      }
    }
  };

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    // A HumanName has `family` and/or `given`; a phone ContactPoint has `system: "phone"` + `value`.
    if ("family" in obj || "given" in obj) checkName(obj);
    if ("system" in obj && "value" in obj) checkTelecom(obj);
    for (const value of Object.values(obj)) visit(value);
  };

  visit(root);
}

/** Whether a phone-shaped value carries the NANP reserved `555-01xx` fictional tail. */
function isSyntheticPhone(value: string): boolean {
  const tail = value.replace(/\D/g, "").slice(-7);
  return /^55501\d\d$/.test(tail);
}

/**
 * HL7 v2 structured PID detection. Locates each `PID` segment, derives the field/component delimiters
 * from the message's own `MSH`, and checks the PHI-bearing loci — PID-5 (name), PID-13 (phone), PID-19
 * (SSN) — against the synthetic sources. A name token not on the allow-list, a real-area SSN, or a
 * non-reserved phone is a hard hit. Non-HL7 targets fall straight through (no `MSH`).
 */
function scanHl7(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  const segments = text.split(/\r\n|\r|\n/);
  const msh = segments.find((s) => s.startsWith("MSH"));
  if (msh === undefined || msh.length < 5) return;
  const fieldSep = msh.charAt(3); // MSH-1
  const compSep = msh.charAt(4); // MSH-2, first char (component separator)

  for (const seg of segments) {
    if (!seg.startsWith(`PID${fieldSep}`)) continue;
    const fields = seg.split(fieldSep);
    const at = (n: number): string => fields[n] ?? ""; // fields[n] is HL7 field n (0 = "PID").

    // PID-5 — patient name (XPN). Each component token must be a declared-synthetic name.
    for (const token of at(5).split(compSep)) {
      const t = token.trim();
      if (t.length === 0) continue;
      if (!allow.names.has(t.toUpperCase())) {
        hits.push({ path, segment: "PID-5", value: t, reason: "name not declared synthetic" });
      }
    }

    // PID-19 — SSN. Any SSN-shaped value must be from a never-issued/reserved area.
    const ssnValue = at(19).trim();
    if (/^\d{9}$/.test(ssnValue.replace(/\D/g, "")) && !isSyntheticSsn(ssnValue)) {
      hits.push({ path, segment: "PID-19", value: ssnValue, reason: "SSN not in synthetic range" });
    }

    // PID-13 — phone (XTN). A phone-shaped value must carry the reserved 555-01xx tail.
    const phoneValue = at(13).trim();
    if (/\d{7,}/.test(phoneValue.replace(/\D/g, "")) && !isSyntheticPhone(phoneValue)) {
      hits.push({
        path,
        segment: "PID-13",
        value: phoneValue,
        reason: "phone not in 555-01xx block",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function report(hits: Hit[]): void {
  if (hits.length === 0) {
    process.stdout.write("[phi-scan] OK — no hits\n");
    return;
  }
  const byPath = new Map<string, Hit[]>();
  for (const h of hits) {
    const arr = byPath.get(h.path);
    if (arr) arr.push(h);
    else byPath.set(h.path, [h]);
  }
  for (const [path, group] of byPath) {
    process.stderr.write(`[phi-scan] HIT: ${path}\n`);
    for (const h of group) {
      process.stderr.write(
        `  segment=${h.segment} value=${JSON.stringify(h.value)} (${h.reason})\n`,
      );
    }
  }
  process.stderr.write(
    `[phi-scan] ${String(hits.length)} hit(s) across ${String(byPath.size)} file(s). ` +
      `If a value is genuinely synthetic, declare it in scripts/phi-allow-list.txt OR ` +
      `run with --allow-fixture <path> AND log it in phi-scan-overrides.md.\n`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
    validateAllowFixtures(args.allowFixtures);
  } catch (err) {
    if (err instanceof InvocationError) {
      process.stderr.write(`[phi-scan] ${err.message}\n`);
      return 2;
    }
    throw err;
  }

  const allow = loadAllowList();
  const allowed = new Set<string>(args.allowFixtures.map(normalizePath));

  let targets: Target[];
  try {
    if (args.mode === "staged") targets = buildTargetsForStaged();
    else if (args.mode === "paths") targets = buildTargetsForPaths(args.paths);
    else targets = buildTargetsForAll();
  } catch (err) {
    if (err instanceof InvocationError) {
      process.stderr.write(`[phi-scan] ${err.message}\n`);
      return 2;
    }
    throw err;
  }

  targets = targets.filter((t) => !allowed.has(t.path));

  const hits: Hit[] = [];
  for (const t of targets) {
    try {
      scanTarget(t, allow, hits);
    } catch (err) {
      if (err instanceof InvocationError) {
        process.stderr.write(`[phi-scan] ${err.message}\n`);
        return 2;
      }
      throw err;
    }
  }

  report(hits);
  return hits.length === 0 ? 0 : 1;
}

process.exit(main());
