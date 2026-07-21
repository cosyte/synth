/**
 * Generator behaviour for ASTM (SYNTH-8) — every generator produces a spec-clean artifact (zero
 * warnings, byte-stable) via the round-trip harness, the framed (E1381) twin round-trips clean with
 * computed checksums/frame-numbers, and the corpus is well-formed under the `astm` format.
 */

import { describe, it, expect } from "vitest";

import {
  generateAstmResult,
  generateAstmOrder,
  generateAstmResultFramed,
  astmRoundTrip,
  astmFramedRoundTrip,
  astmCorpus,
} from "../../src/astm/index.js";

describe("ASTM record generators", () => {
  it("generateAstmResult is spec-clean and carries H/P/O/R/C/L records", () => {
    const raw = generateAstmResult({ seed: 101 });
    const rt = astmRoundTrip(raw);
    expect(rt.specClean).toBe(true);
    expect(rt.warnings).toEqual([]);
    // The canonical delimiter declaration + every record type the report carries.
    expect(raw.startsWith("H|\\^&")).toBe(true);
    for (const type of ["P|", "O|", "R|", "C|", "L|"]) {
      expect(raw.includes(`\r${type}`) || raw.startsWith(type), `has ${type}`).toBe(true);
    }
  });

  it("honours an explicit result count", () => {
    const raw = generateAstmResult({ seed: 55, resultCount: 3, comment: false });
    const rCount = raw.split("\r").filter((l) => l.startsWith("R|")).length;
    expect(rCount).toBe(3);
    expect(raw.includes("\rC|")).toBe(false);
    expect(astmRoundTrip(raw).specClean).toBe(true);
  });

  it("generateAstmOrder is spec-clean and carries no result records", () => {
    const raw = generateAstmOrder({ seed: 7 });
    expect(astmRoundTrip(raw).specClean).toBe(true);
    expect(raw.split("\r").some((l) => l.startsWith("R|"))).toBe(false);
    expect(raw.includes("\rO|")).toBe(true);
  });
});

describe("ASTM framed (E1381) generation", () => {
  it("generateAstmResultFramed round-trips clean through the frame + record layers", () => {
    const bytes = generateAstmResultFramed({ seed: 202 });
    const frt = astmFramedRoundTrip(bytes);
    expect(frt.specClean).toBe(true);
    expect(frt.warnings).toEqual([]);
    // The frame envelope: STX (0x02) opens and CR/LF (0x0d 0x0a) closes each frame.
    expect(bytes[0]).toBe(0x02);
    expect(bytes[bytes.length - 1]).toBe(0x0a);
  });

  it("the framed twin carries the same records as the bare stream", () => {
    const raw = generateAstmResult({ seed: 303 });
    const recordCount = raw.split("\r").filter((l) => l.length > 0).length;
    const bytes = generateAstmResultFramed({ seed: 303 });
    // One STX-opened frame run per record (records here are all < 240 bytes).
    const stxCount = [...bytes].filter((b) => b === 0x02).length;
    expect(stxCount).toBe(recordCount);
  });
});

describe("ASTM corpus", () => {
  it("generates one of each shipped message kind, all spec-clean, under the astm format", () => {
    const corpus = astmCorpus({ seed: 777 });
    expect(corpus.artifacts).toHaveLength(2);
    expect(corpus.artifacts.every((a) => a.format === "astm")).toBe(true);
    expect(corpus.artifacts.every((a) => a.warnings.length === 0)).toBe(true);
    expect(corpus.manifest.counts).toMatchObject({ Result: 1, Order: 1 });
    expect(corpus.manifest.formats).toEqual(["astm"]);
  });

  it("honours a custom mix and count", () => {
    const corpus = astmCorpus({ seed: 1, mix: ["Result"], count: 3 });
    expect(corpus.artifacts.map((a) => a.kind)).toEqual(["Result", "Result", "Result"]);
    expect(corpus.artifacts.every((a) => a.warnings.length === 0)).toBe(true);
  });
});
