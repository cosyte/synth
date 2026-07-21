/**
 * The **round-trip-through-the-parser gate** for C-CDA (roadmap §6). Every generated document, fed back
 * into `@cosyte/ccda` (serialize → parse → serialize), re-parses with **zero warnings** and
 * re-serializes **byte-identically** — spec-clean by the parser's own judgment, not `@cosyte/synth`'s
 * opinion. Also a golden-fixture regression: the committed fixtures under `test/fixtures/ccda/` must
 * regenerate byte-for-byte from their seeds (the reproducibility contract, roadmap §5).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serializeCcda, type CcdaDocument } from "@cosyte/ccda";

import { ccdaCorpus, generateCcd, generateReferralNote, roundTrip } from "../../src/ccda/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX_DIR = join(HERE, "..", "fixtures", "ccda");

/** Every C-CDA generator, by label, as a nullary factory. */
const GENERATORS: Record<string, () => CcdaDocument> = {
  ccd: () => generateCcd({ seed: 5001 }),
  "referral-note": () => generateReferralNote({ seed: 5002 }),
};

describe("C-CDA round-trip — spec-clean by construction (zero warnings, byte-stable)", () => {
  for (const [label, make] of Object.entries(GENERATORS)) {
    it(`${label} round-trips through @cosyte/ccda with zero warnings and byte-stable`, () => {
      const rt = roundTrip(make());
      expect(rt.warnings, `${label} warnings`).toEqual([]);
      expect(rt.byteStable).toBe(true);
      expect(rt.specClean).toBe(true);
    });
  }

  it("a CCD and a Referral Note carry the right document template + code", () => {
    const ccd = serializeCcda(generateCcd({ seed: 1 }));
    const rn = serializeCcda(generateReferralNote({ seed: 1 }));
    // CCD document templateId …22.1.2 + LOINC 34133-9; Referral Note …22.1.14 + LOINC 57133-1.
    expect(ccd).toContain("2.16.840.1.113883.10.20.22.1.2");
    expect(ccd).toContain('code="34133-9"');
    expect(rn).toContain("2.16.840.1.113883.10.20.22.1.14");
    expect(rn).toContain('code="57133-1"');
    // Same seed, different document type ⇒ different bytes.
    expect(ccd).not.toBe(rn);
  });

  it("the ccdaCorpus is spec-clean and self-describing across both document types", () => {
    const corpus = ccdaCorpus({ seed: 42, count: 4 });
    expect(corpus.artifacts).toHaveLength(4);
    expect(corpus.artifacts.every((a) => a.warnings.length === 0)).toBe(true);
    expect(corpus.manifest.formats).toEqual(["ccda"]);
    expect(corpus.manifest.counts["ccd"]).toBe(2);
    expect(corpus.manifest.counts["referralNote"]).toBe(2);
    expect(corpus.seed).toBe(42);
  });
});

describe("C-CDA golden fixtures regenerate byte-for-byte (reproducibility contract)", () => {
  const FIXTURES: Record<string, () => CcdaDocument> = {
    "ccd-seed5001.xml": () => generateCcd({ seed: 5001 }),
    "ccd-seed5003.xml": () => generateCcd({ seed: 5003 }),
    "referral-note-seed5002.xml": () => generateReferralNote({ seed: 5002 }),
  };

  for (const [file, make] of Object.entries(FIXTURES)) {
    it(`${file} matches its committed golden output`, () => {
      const expected = readFileSync(join(FIX_DIR, file), "utf8");
      expect(`${serializeCcda(make())}\n`).toBe(expected);
    });
  }
});
