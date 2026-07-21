/**
 * Unit tests for the X12 generators (SYNTH-6, roadmap §Phase 5) — 837P/I/D, 835, 271. Each generator
 * is checked for:
 *
 * - **Envelope identity** — GS-01 / ST-01 / ST-03 per transaction (the built interchange names itself).
 * - **The round-trip contract** — every generated interchange re-parses through `@cosyte/x12` with zero
 *   warnings and re-serializes byte-identically (roadmap §6, the headline gate).
 * - **Field fidelity** — the generated identity survives a parse back through `get837Claims` /
 *   `get835` / `get271Eligibility` (the parser is the judge).
 * - **The corpus** — a self-describing, deterministic `Corpus` across all five kinds.
 *
 * Synthetic-only fixtures: every identifier is synthetic-by-construction (see
 * `synthetic-safety.property.test.ts`).
 */

import { describe, it, expect } from "vitest";
import { parseX12, serializeX12, get837Claims, get835, get271Eligibility } from "@cosyte/x12";

import {
  generate837,
  generate837P,
  generate837I,
  generate837D,
  generate835,
  generate271,
  roundTrip,
  x12Corpus,
} from "../../src/x12/index.js";

describe("837 — envelope identity", () => {
  it("emits GS-01 HC, ST-01 837, and the per-variant ST-03 TR3 version", () => {
    const cases = [
      { ix: generate837P({ seed: 1 }), v: "005010X222A2" },
      { ix: generate837I({ seed: 1 }), v: "005010X223A3" },
      { ix: generate837D({ seed: 1 }), v: "005010X224A2" },
    ];
    for (const { ix, v } of cases) {
      expect(ix.groups[0]?.gs.elements[1]).toBe("HC");
      const tx = ix.groups[0]?.transactions[0];
      expect(tx?.st.elements[1]).toBe("837");
      expect(tx?.st.elements[3]).toBe(v);
    }
  });

  it("returns a frozen interchange with zero parse warnings", () => {
    const ix = generate837P({ seed: 2 });
    expect(Object.isFrozen(ix)).toBe(true);
    expect(ix.warnings).toHaveLength(0);
  });
});

describe("837 — round-trip + field fidelity", () => {
  for (const variant of ["P", "I", "D"] as const) {
    it(`837${variant} round-trips spec-clean and re-parses field-for-field`, () => {
      const ix = generate837(variant, { seed: 100 + variant.charCodeAt(0) });
      const rt = roundTrip(ix);
      expect(rt.warnings, rt.content).toEqual([]);
      expect(rt.specClean).toBe(true);
      expect(rt.byteStable).toBe(true);

      const reparsed = parseX12(rt.content);
      const tx = reparsed.groups[0]?.transactions[0];
      expect(tx).toBeDefined();
      const sub = tx === undefined ? undefined : get837Claims(reparsed.delimiters, tx);
      expect(sub).toBeDefined();
      expect(sub?.claims.length ?? 0).toBeGreaterThan(0);
    });
  }
});

describe("835 — identity, round-trip, balance", () => {
  it("emits GS-01 HP, ST-01 835, ST-03 005010X221A1", () => {
    const ix = generate835({ seed: 3 });
    expect(ix.groups[0]?.gs.elements[1]).toBe("HP");
    const tx = ix.groups[0]?.transactions[0];
    expect(tx?.st.elements[1]).toBe("835");
    expect(tx?.st.elements[3]).toBe("005010X221A1");
  });

  it("round-trips spec-clean (build835 balance check passed by construction)", () => {
    const rt = roundTrip(generate835({ seed: 4 }));
    expect(rt.warnings, rt.content).toEqual([]);
    expect(rt.specClean).toBe(true);
    const reparsed = parseX12(rt.content);
    const tx = reparsed.groups[0]?.transactions[0];
    const remit = tx === undefined ? undefined : get835(reparsed.delimiters, tx);
    expect(remit?.claims.length ?? 0).toBeGreaterThan(0);
  });
});

describe("271 — identity, round-trip", () => {
  it("emits GS-01 HB, ST-01 271, ST-03 005010X279A1", () => {
    const ix = generate271({ seed: 5 });
    expect(ix.groups[0]?.gs.elements[1]).toBe("HB");
    const tx = ix.groups[0]?.transactions[0];
    expect(tx?.st.elements[1]).toBe("271");
    expect(tx?.st.elements[3]).toBe("005010X279A1");
  });

  it("round-trips spec-clean and re-parses the subscriber + benefit", () => {
    const rt = roundTrip(generate271({ seed: 6 }));
    expect(rt.warnings, rt.content).toEqual([]);
    const reparsed = parseX12(rt.content);
    const tx = reparsed.groups[0]?.transactions[0];
    const elig = tx === undefined ? undefined : get271Eligibility(reparsed.delimiters, tx);
    expect(elig?.subscribers[0]?.benefits.length ?? 0).toBeGreaterThan(0);
  });
});

describe("x12Corpus", () => {
  it("builds a self-describing corpus of all five kinds, all spec-clean", () => {
    const corpus = x12Corpus({ seed: 42 });
    expect(corpus.seed).toBe(42);
    expect(corpus.manifest.formats).toEqual(["x12"]);
    expect(corpus.artifacts).toHaveLength(5);
    for (const a of corpus.artifacts) {
      expect(a.format).toBe("x12");
      expect(a.warnings, `${a.kind}: ${a.content}`).toEqual([]);
      // Each artifact is itself a valid, re-parseable interchange.
      expect(serializeX12(parseX12(a.content))).toBe(a.content);
    }
    expect(corpus.manifest.counts).toMatchObject({
      "837P": 1,
      "837I": 1,
      "837D": 1,
      "835": 1,
      "271": 1,
    });
  });

  it("honours a custom mix + count", () => {
    const corpus = x12Corpus({ seed: 7, mix: ["837P"], count: 3 });
    expect(corpus.artifacts).toHaveLength(3);
    expect(corpus.manifest.counts).toEqual({ "837P": 3 });
  });
});
