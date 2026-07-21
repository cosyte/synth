/**
 * Generator behaviour for NCPDP (SYNTH-7) — every generator produces a spec-clean artifact (zero
 * warnings, byte-stable) via the round-trip harness, the corpus is well-formed, and the SCRIPT
 * lifecycle requests carry the transaction element they claim.
 */

import { describe, it, expect } from "vitest";

import {
  generateNewRx,
  generateRxRenewalRequest,
  generateRxChangeRequest,
  generateB1,
  generateB2,
  generateB3,
  generateTelecom,
  scriptRoundTrip,
  telecomRoundTrip,
  ncpdpCorpus,
} from "../../src/ncpdp/index.js";

describe("NCPDP SCRIPT generators", () => {
  it("generateNewRx is spec-clean and carries a <NewRx> with a medication description", () => {
    const xml = generateNewRx({ seed: 101 });
    const rt = scriptRoundTrip(xml);
    expect(rt.specClean).toBe(true);
    expect(xml).toContain("<NewRx>");
    expect(xml).toContain("<DrugDescription>");
    expect(xml).toContain("<DEANumber>");
  });

  it("generateRxRenewalRequest is spec-clean and carries a <RxRenewalRequest>", () => {
    const xml = generateRxRenewalRequest({ seed: 102 });
    expect(scriptRoundTrip(xml).specClean).toBe(true);
    expect(xml).toContain("<RxRenewalRequest>");
    expect(xml).toContain("<RequestReferenceNumber>");
  });

  it("generateRxChangeRequest is spec-clean and carries a <RxChangeRequest>", () => {
    const xml = generateRxChangeRequest({ seed: 103 });
    expect(scriptRoundTrip(xml).specClean).toBe(true);
    expect(xml).toContain("<RxChangeRequest>");
  });
});

describe("NCPDP Telecom generators", () => {
  it("B1 / B2 / B3 are each spec-clean and carry their transaction code in the header", () => {
    for (const [code, wire] of [
      ["B1", generateB1({ seed: 201 })],
      ["B2", generateB2({ seed: 202 })],
      ["B3", generateB3({ seed: 203 })],
    ] as const) {
      const rt = telecomRoundTrip(wire);
      expect(rt.specClean, `${code} should be spec-clean`).toBe(true);
      // The transaction code sits at offset 8-10 of the fixed D.0 header.
      expect(wire.slice(8, 10)).toBe(code);
    }
  });

  it("generateTelecom dispatches on the transaction code", () => {
    expect(generateTelecom("B1", { seed: 5 })).toBe(generateB1({ seed: 5 }));
    expect(generateTelecom("B2", { seed: 5 })).toBe(generateB2({ seed: 5 }));
    expect(generateTelecom("B3", { seed: 5 })).toBe(generateB3({ seed: 5 }));
  });
});

describe("NCPDP corpus", () => {
  it("generates one of each shipped transaction, all spec-clean, under the ncpdp format", () => {
    const corpus = ncpdpCorpus({ seed: 777 });
    expect(corpus.artifacts).toHaveLength(6);
    expect(corpus.artifacts.every((a) => a.format === "ncpdp")).toBe(true);
    expect(corpus.artifacts.every((a) => a.warnings.length === 0)).toBe(true);
    expect(corpus.manifest.counts).toMatchObject({
      NewRx: 1,
      RxRenewalRequest: 1,
      RxChangeRequest: 1,
      B1: 1,
      B2: 1,
      B3: 1,
    });
  });

  it("honours a custom mix and count", () => {
    const corpus = ncpdpCorpus({ seed: 1, mix: ["B1"], count: 3 });
    expect(corpus.artifacts.map((a) => a.kind)).toEqual(["B1", "B1", "B1"]);
  });
});
