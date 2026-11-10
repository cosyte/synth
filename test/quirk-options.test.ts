/**
 * The quirk generators' optional inputs and the round trip's honesty about a caller-built artifact. An
 * omitted `seed` is seed `0`, an empty quirk list means every quirk (the same as omitting it), and a
 * round trip of an artifact the matching profile does not cover reports `tolerated: false` with the
 * warning the profile left standing.
 */

import { describe, expect, it } from "vitest";

import {
  generateHl7Quirk,
  hl7QuirkRoundTrip,
  hl7QuirkCorpus,
  HL7_QUIRKS,
} from "../src/hl7/index.js";
import {
  generateAstmQuirk,
  astmQuirkCorpus,
  astmQuirkRoundTrip,
  ASTM_QUIRKS,
} from "../src/astm/index.js";
import { generateCcdaQuirk } from "../src/ccda/index.js";
import type { QuirkArtifact } from "../src/index.js";

describe("an omitted seed is seed 0", () => {
  it("HL7 v2", () => {
    expect(generateHl7Quirk({ quirk: "unknown-escape" })).toEqual(
      generateHl7Quirk({ seed: 0, quirk: "unknown-escape" }),
    );
  });

  it("ASTM", () => {
    expect(generateAstmQuirk({ quirk: "unknown-record-type" })).toEqual(
      generateAstmQuirk({ seed: 0, quirk: "unknown-record-type" }),
    );
  });

  it("C-CDA", () => {
    expect(generateCcdaQuirk({ quirk: "deprecated-loinc" })).toEqual(
      generateCcdaQuirk({ seed: 0, quirk: "deprecated-loinc" }),
    );
  });
});

describe("ASTM quirk kind", () => {
  it('accepts the explicit "Result" kind and gives the same artifact as the default', () => {
    const explicit = generateAstmQuirk({ seed: 3, quirk: "unknown-escape", kind: "Result" });
    expect(explicit.kind).toBe("Result");
    expect(explicit).toEqual(generateAstmQuirk({ seed: 3, quirk: "unknown-escape" }));
  });
});

describe("an empty quirk list selects every quirk", () => {
  it("HL7 v2", () => {
    const corpus = hl7QuirkCorpus({ seed: 5, quirks: [] });
    expect(corpus.manifest.quirks).toEqual(Object.keys(HL7_QUIRKS));
    expect(corpus).toEqual(hl7QuirkCorpus({ seed: 5 }));
  });

  it("ASTM", () => {
    const corpus = astmQuirkCorpus({ seed: 5, quirks: [] });
    expect(corpus.manifest.quirks).toEqual(Object.keys(ASTM_QUIRKS));
    expect(corpus).toEqual(astmQuirkCorpus({ seed: 5 }));
  });
});

describe("a caller-built quirk artifact", () => {
  it("HL7 v2: a Z-segment the visage profile does not declare is not tolerated", () => {
    // Built by hand, as a JavaScript caller can: labelled `unknown-zsegment`, but carrying a ZXX
    // segment instead of the ZDS segment the visage profile declares.
    const generated = generateHl7Quirk({ seed: 2, quirk: "unknown-zsegment" });
    const artifact: QuirkArtifact = {
      ...generated,
      content: generated.content.replace("\rZDS|", "\rZXX|"),
    };
    expect(artifact.content).not.toBe(generated.content);
    const rt = hl7QuirkRoundTrip(artifact);
    expect(rt.warnings).toEqual(["UNKNOWN_SEGMENT"]);
    expect(rt.intendedWarningHeld).toBe(true);
    expect(rt.withProfile?.profileName).toBe("visage");
    expect(rt.withProfile?.warnings).toEqual(["UNKNOWN_SEGMENT"]);
    expect(rt.withProfile?.tolerated).toBe(false);
  });

  it("ASTM: an artifact without the quirk it names does not hold its intended warning", () => {
    const generated = generateAstmQuirk({ seed: 4, quirk: "unknown-escape" });
    const artifact: QuirkArtifact = { ...generated, content: generated.content.replace("&Z&", "") };
    const rt = astmQuirkRoundTrip(artifact);
    expect(rt.warnings).toEqual([]);
    expect(rt.intendedWarningHeld).toBe(false);
    expect(rt.withProfile?.tolerated).toBe(false);
  });
});
