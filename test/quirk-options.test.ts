/**
 * The quirk generators' optional inputs and the round trip's honesty about a caller-built artifact. An
 * omitted `seed` is seed `0`, an empty quirk list is refused (an omitted one means every quirk), and a
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
import { ccdaQuirkCorpus, generateCcdaQuirk } from "../src/ccda/index.js";
import {
  defineSynthProfile,
  SYNTH_FATAL_CODES,
  SynthError,
  type QuirkArtifact,
} from "../src/index.js";

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

describe("an empty quirk list is refused", () => {
  // An empty `quirks` list, or a profile that names no quirk, selects nothing. Each quirk corpus
  // throws `SYNTH_EMPTY_POOL` before it generates anything, whatever the count, and never reads the
  // empty list as every quirk.
  const empty = defineSynthProfile({ name: "no-quirks", quirks: [] });
  const counts = { omitted: {}, "0": { count: 0 }, "2": { count: 2 } } as const;
  const cases: ReadonlyArray<readonly [string, (count: { readonly count?: number }) => unknown]> = [
    ["HL7 v2 quirks", (c) => hl7QuirkCorpus({ seed: 5, quirks: [], ...c })],
    ["HL7 v2 profile", (c) => hl7QuirkCorpus({ seed: 5, profile: empty, ...c })],
    ["C-CDA quirks", (c) => ccdaQuirkCorpus({ seed: 5, quirks: [], ...c })],
    ["C-CDA profile", (c) => ccdaQuirkCorpus({ seed: 5, profile: empty, ...c })],
    ["ASTM quirks", (c) => astmQuirkCorpus({ seed: 5, quirks: [], ...c })],
    ["ASTM profile", (c) => astmQuirkCorpus({ seed: 5, profile: empty, ...c })],
  ];
  for (const [label, make] of cases) {
    for (const [countLabel, count] of Object.entries(counts)) {
      it(`${label}: throws SYNTH_EMPTY_POOL with the count ${countLabel}`, () => {
        let thrown: unknown;
        try {
          make(count);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(SynthError);
        expect((thrown as SynthError).code).toBe(SYNTH_FATAL_CODES.SYNTH_EMPTY_POOL);
      });
    }
  }

  it("an omitted quirk list still selects every quirk", () => {
    expect(hl7QuirkCorpus({ seed: 5 }).manifest.quirks).toEqual(Object.keys(HL7_QUIRKS));
    expect(astmQuirkCorpus({ seed: 5 }).manifest.quirks).toEqual(Object.keys(ASTM_QUIRKS));
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
