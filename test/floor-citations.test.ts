import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

/**
 * THE FLOOR TABLE'S CITATION AUDIT.
 *
 * WHAT THIS GUARDS, AND WHY NOTHING ELSE COVERS IT. The synthetic-safety floor table in
 * `docs-content/limitations.md` is the page an auditor reads to find out WHY each PHI-bearing locus
 * cannot denote a real person. The property suite and the union PHI scan prove the floors HOLD; they
 * say nothing at all about whether the stated REASON for a floor survives contact with the authority
 * named. A row can name a bare hostname, name nothing, or name an attribution its source does not
 * make, and every existing gate in this repo stays green: none of them reads that table.
 *
 * So this file reads it. Every row must either
 *
 *   (a) cite an authority by that authority's own published identifier, with the supporting text
 *       named in the same row, or
 *   (b) say plainly that NO authority reserves the locus, and then name what the floor rests on
 *       instead, and name no authority as reserving it.
 *
 * THE SUBJECT IS DERIVED FROM THE FILE, NOT LISTED HERE. There is no allow-list of loci and no
 * per-row exemption to qualify for: the rows are parsed out of the published markdown, so a row
 * ADDED tomorrow is in the subject the moment it exists, uncited, and reds. A list of known-good
 * rows in this file would be a second, hand-editable lever on the gate's own scope, deletable in the
 * same commit that adds an uncited row.
 *
 * WHAT "AN AUTHORITY IDENTIFIER" MEANS HERE, precisely, because a vague rule is a vacuous one. It is
 * the label of a markdown link whose target is an absolute `https` URL, and it must not be a bare
 * hostname (`ssa.gov`, `nanpa.com`) and must not be a single bare token. That is what separates
 * "SSA POMS RM 10201.035" and "RFC 2606" from "ssa.gov": a reader can carry the first two to a
 * catalogue and the third only to a home page. A published page TITLE counts (`USPS Postal Facts,
 * Lowest ZIP Code number`) because not every authority numbers its documents.
 *
 * WHAT "SUPPORTING TEXT" MEANS, equally precisely: a quoted passage of at least 24 characters in the
 * same row. A citation with no quotation is an assertion about a document rather than a report of
 * what it says, and the difference is exactly the defect this file exists to catch. The floor is a
 * length, not a semantic check: this gate cannot read the cited document and does not pretend to.
 *
 * THE GATE DEMONSTRATES ITS OWN REDNESS RATHER THAN ASSERTING IT. A guard over prose is easy to make
 * vacuous by accident (a parser that finds no rows reports no violations), so the row count is
 * asserted, and the same validator that judges the real table is run over seeded bad rows and
 * required to catch every one. Do not delete those; a validator nobody has watched fail is a
 * validator nobody knows works.
 *
 * WHAT THIS DOES NOT COVER, stated rather than left to be discovered.
 *
 *   * WHETHER THE CITED DOCUMENT SAYS WHAT THE ROW CLAIMS. This gate has no network and reads no
 *     external text. It checks that a row cites something checkable and quotes it; a reviewer checks
 *     that the quote is real. That is the half no test in this repo can take over.
 *   * A ROW OUTSIDE THE FLOOR TABLE. The subject is the first markdown table under the floor
 *     heading. Prose elsewhere on the page that justifies a locus is a reviewer's catch.
 *   * A LINK THAT ROTS. A URL that stops resolving is invisible here and stays green.
 */

const ROOT = process.cwd();
const LIMITATIONS = join(ROOT, "docs-content", "limitations.md");
const RESERVED = join(ROOT, "src", "safe", "reserved.ts");

/** The heading the floor table lives under. Missing heading is a hard failure, never a skip. */
const FLOOR_HEADING = "## The synthetic-safety posture (the floors)";

/**
 * The sentence a row uses to say no external authority reserves its locus. Fixed wording on purpose:
 * a row either says this or cites something, and there is no third state a reviewer has to judge.
 */
const NO_AUTHORITY = "no authority reserves this locus";

/** What such a row must go on to name, so a retraction never leaves a floor unexplained. */
const RESTS_ON = "what the floor rests on instead is";

/** The marker a locus whose algorithm has no normative publisher must carry. */
const NON_NORMATIVE = "non-normatively sourced";

/**
 * Emphasis markers and line wrapping carry no meaning for these checks, so matching is done on the
 * flattened text. THE WHITESPACE COLLAPSE IS LOAD-BEARING, not tidiness: a doc comment wraps at 100
 * columns, so a required sentence is routinely split across two lines, and a line-by-line matcher
 * would report a missing statement that is right there. That is the same wrap blindness a sweep in
 * a sibling repo shipped a false "complete" over.
 */
const plain = (s: string): string => s.replace(/[*_]/g, " ").replace(/\s+/g, " ").trim();

/** A markdown inline link: `[label](target)`. */
const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

/** A double-quoted passage. The length floor is applied by the caller. */
const QUOTED = /"([^"]+)"/g;

/** A label that is only a host name, which is what this audit exists to stop a row citing. */
const BARE_HOST = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

interface FloorRow {
  readonly locus: string;
  readonly source: string;
  readonly why: string;
}

/** Split a markdown table row into its cells, dropping the leading and trailing pipe. */
function cells(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

/**
 * The floor table, parsed out of the published page. Refuses loudly rather than returning an empty
 * list: a parser that silently finds nothing would report a clean audit over a table it never read.
 */
function floorRows(markdown: string): FloorRow[] {
  const at = markdown.indexOf(FLOOR_HEADING);
  if (at < 0) {
    throw new Error(
      `the floor heading ${FLOOR_HEADING} is not in docs-content/limitations.md, so this audit ` +
        "cannot find its subject. Refusing to report a clean audit over a table it did not read.",
    );
  }
  const after = markdown.slice(at + FLOOR_HEADING.length);
  const lines = after.split("\n");
  const start = lines.findIndex((l) => l.trimStart().startsWith("|"));
  if (start < 0) throw new Error("no markdown table follows the floor heading");

  const rows: FloorRow[] = [];
  for (const line of lines.slice(start)) {
    if (!line.trimStart().startsWith("|")) break;
    const parts = cells(line);
    const first = parts[0] ?? "";
    if (/^-+$/.test(first.replace(/[\s:]/g, ""))) continue; // the header separator
    if (plain(first).toLowerCase() === "locus") continue; // the header itself
    rows.push({ locus: plain(first), source: parts[1] ?? "", why: parts[2] ?? "" });
  }
  return rows;
}

/**
 * Every way one row can fail the audit, as a list of messages. A pure function of the row so the
 * self-test below can run the REAL rule over seeded rows rather than over a mock of it.
 */
function violationsFor(row: FloorRow): string[] {
  const found: string[] = [];
  const why = row.why;
  const text = plain(why).toLowerCase();

  const links = [...why.matchAll(LINK)].map((m) => ({
    label: (m[1] ?? "").trim(),
    target: (m[2] ?? "").trim(),
  }));

  if (text.includes(NO_AUTHORITY)) {
    // The locus rests on this package's own construction. It must say what that is, and it must not
    // quietly name an authority anyway: an uncited row that still links one is the worse defect.
    if (!text.includes(RESTS_ON)) {
      found.push(
        "declares that no authority reserves the locus but never names what the floor rests on " +
          "instead, which leaves a floor an auditor cannot check",
      );
    }
    if (links.length > 0) {
      found.push(
        `declares that no authority reserves the locus yet cites ${String(links.length)} ` +
          `authority link(s): ${links.map((l) => l.label).join(", ")}`,
      );
    }
    return found;
  }

  if (links.length === 0) {
    found.push(
      "carries no authority identifier: no cited authority and no statement that none reserves " +
        "this locus. Every floor is one or the other.",
    );
  }

  for (const link of links) {
    if (!/^https:\/\//.test(link.target)) {
      found.push(`cites "${link.label}" with a target that is not an absolute https URL`);
    }
    if (BARE_HOST.test(link.label)) {
      found.push(
        `cites the bare hostname "${link.label}" rather than the authority's own published ` +
          "identifier (a document, section, rule or RFC designation)",
      );
    } else if (!link.label.includes(" ")) {
      found.push(
        `cites "${link.label}", a single bare token rather than a published identifier a reader ` +
          "can carry to a catalogue",
      );
    }
  }

  const supporting = [...why.matchAll(QUOTED)].map((m) => (m[1] ?? "").trim());
  if (links.length > 0 && !supporting.some((q) => q.length >= 24)) {
    found.push(
      "names an authority but quotes no supporting text from it, so the row asserts what the " +
        "document says instead of reporting it",
    );
  }

  return found;
}

const markdown = readFileSync(LIMITATIONS, "utf8");
const reserved = readFileSync(RESERVED, "utf8");
const rows = floorRows(markdown);

/**
 * The doc comment immediately above a declaration, or `""` when there is none adjacent to it. The
 * adjacency test matters: a block separated from the declaration by other code documents something
 * else, and treating it as this symbol's would let an assertion pass on the wrong text.
 */
function docBlockFor(source: string, declaration: string): string {
  const at = source.indexOf(declaration);
  if (at < 0) return "";
  const before = source.slice(0, at);
  const close = before.lastIndexOf("*/");
  if (close < 0) return "";
  const open = before.lastIndexOf("/**", close);
  if (open < 0) return "";
  if (before.slice(close + 2).trim().length > 0) return "";
  return before.slice(open, close + 2);
}

describe("the synthetic-safety floor table", () => {
  it("was parsed, so the audit below is not vacuous", () => {
    expect(rows.length).toBeGreaterThanOrEqual(9);
    for (const row of rows) expect(row.locus.length).toBeGreaterThan(0);
  });

  it.each(rows.map((row) => [row.locus, row] as const))(
    "%s: cites an authority with its supporting text, or says none reserves the locus",
    (_locus, row) => {
      expect(violationsFor(row)).toEqual([]);
    },
  );

  it("retracts only the half of the NPI attribution its source refutes, and names the replacement", () => {
    // This is a FIXED-STRING PIN, not a check of the cited document: nothing here can read 69 FR
    // 3434. What it stops is the specific defect that reached this row once. The old attribution
    // was "CMS NPI check-digit rule, ISO 7812"; the cited rule carries no ISO document number, so
    // that half is retracted and the row must name what took its place, while the rule DOES record
    // CMS as its issuing agency, so a retraction of that half would be a new false claim about the
    // same document. A reviewer still owns whether the quoted agency line is really in the text.
    const npi = rows.find((r) => r.locus.toLowerCase().includes("npi"));
    expect(npi).toBeDefined();
    const text = plain(npi?.why ?? "");
    expect(text).toContain("ISO standard Luhn check digit algorithm");
    expect(text).toContain("Centers for Medicare & Medicaid Services");
    expect(text).not.toMatch(/names? neither/i);
  });

  it("marks the locus whose algorithm has no normative publisher, in the table", () => {
    const dea = rows.find((r) => r.locus.toLowerCase().includes("dea"));
    expect(dea).toBeDefined();
    const text = plain(dea?.why ?? "").toLowerCase();
    expect(text).toContain(NON_NORMATIVE);
    expect(text).toContain("not the dea");
  });
});

describe("the audit itself reds on a bad row", () => {
  // Every case is a shape this file exists to catch. The validator is the REAL one; only the rows
  // are seeded. A validator nobody has watched fail is a validator nobody knows works.
  const seeded: readonly (readonly [string, FloorRow, string])[] = [
    [
      "no citation at all",
      { locus: "Seeded", source: "`00000`", why: "not an assignable value" },
      "carries no authority identifier",
    ],
    [
      "a bare hostname",
      {
        locus: "Seeded",
        source: "`00000`",
        why: '[ssa.gov](https://ssa.gov) says "this is a long enough supporting quotation here"',
      },
      "bare hostname",
    ],
    [
      "a citation with no supporting text",
      {
        locus: "Seeded",
        source: "`00000`",
        why: "[SSA POMS RM 10201.035](https://secure.ssa.gov/poms.nsf/lnx/0110201035) covers it",
      },
      "quotes no supporting text",
    ],
    [
      "a quotation too short to support anything",
      {
        locus: "Seeded",
        source: "`00000`",
        why: '[RFC 2606](https://datatracker.ietf.org/doc/html/rfc2606) says "reserved"',
      },
      "quotes no supporting text",
    ],
    [
      "an uncited locus that never says what it rests on",
      { locus: "Seeded", source: "a pool", why: "**No authority reserves this locus.**" },
      "never names what the floor rests on instead",
    ],
    [
      "an uncited locus that cites one anyway",
      {
        locus: "Seeded",
        source: "a pool",
        why:
          "**No authority reserves this locus.** What the floor rests on instead is the pool, per " +
          "[RFC 2606](https://datatracker.ietf.org/doc/html/rfc2606).",
      },
      "yet cites 1 authority link",
    ],
    [
      "a citation that is not an https URL",
      {
        locus: "Seeded",
        source: "`00000`",
        why: '[RFC 2606](rfc2606.txt) says "a long enough supporting quotation lives right here"',
      },
      "not an absolute https URL",
    ],
  ];

  it.each(seeded.map(([name, row, expected]) => [name, row, expected] as const))(
    "catches %s",
    (_name, row, expected) => {
      const found = violationsFor(row);
      expect(found.length).toBeGreaterThan(0);
      expect(found.join(" ")).toContain(expected);
    },
  );

  it("passes a well-formed row, so it is not a rule that only ever fails", () => {
    expect(
      violationsFor({
        locus: "Seeded",
        source: "`192.0.2.0/24`",
        why:
          "[RFC 5737](https://datatracker.ietf.org/doc/html/rfc5737): " +
          '"The blocks 192.0.2.0/24 (TEST-NET-1) are provided for use in documentation."',
      }),
    ).toEqual([]);
  });
});

describe("the check-digit predicates document what they rest on", () => {
  it("cites the rule the NPI check inverts", () => {
    for (const decl of ["export function npiCheckDigit", "export function isSyntheticNpi"]) {
      const block = docBlockFor(reserved, decl);
      expect(block, `${decl} has no adjacent doc comment`).not.toBe("");
      expect(block).toContain("69 FR 3434");
    }
  });

  it("marks the DEA check as non-normatively sourced in both the helper and the predicate", () => {
    for (const decl of ["export function deaCheckDigit", "export function isSyntheticDea"]) {
      const block = docBlockFor(reserved, decl);
      expect(block, `${decl} has no adjacent doc comment`).not.toBe("");
      const text = plain(block).toLowerCase();
      expect(text, `${decl} does not mark the source non-normative`).toContain(NON_NORMATIVE);
      expect(text, `${decl} does not name the source it does rest on`).toContain("pmc3847977");
      expect(text, `${decl} does not say what the source is not`).toContain("the dea");
    }
  });

  it("claims no designation it cannot show for the assigning-authority OID root", () => {
    const block = docBlockFor(reserved, "export const SYNTHETIC_ASSIGNING_AUTHORITY");
    expect(block).not.toBe("");
    const text = plain(block).toLowerCase();
    expect(text).toContain(NO_AUTHORITY);
    expect(text).toContain(RESTS_ON);
    expect(text).not.toContain("designated example root");
  });

  it("carries none of the attributions its sources do not make", () => {
    // `ISO 7812` rather than `CMS NPI check-digit rule`: the rule this module cites carries no ISO
    // document number at all, while it does record CMS as its issuing agency, so only the first of
    // the two halves of that old attribution is a claim the source refuses.
    expect(reserved).not.toContain("ISO 7812");
    expect(reserved).not.toContain("NPPES-issued");
    expect(reserved).not.toContain("designated example root");
  });
});
