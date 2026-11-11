/**
 * The `verify` option of every corpus generator: on by default, and off it builds the same
 * artifacts without reading them back, so each one's `warnings` is empty.
 */

import { parseCcda } from "@cosyte/ccda";
import { parseResource } from "@cosyte/fhir";
import { parseHL7 } from "@cosyte/hl7";
import { parseX12 } from "@cosyte/x12";
import { describe, expect, it } from "vitest";

import type { Corpus } from "../src/index.js";
import { astmCorpus, generateAstmQuirk } from "../src/astm/index.js";
import { astmCorpusArtifact } from "../src/astm/round-trip.js";
import { ccdaCorpus, generateCcdaQuirk } from "../src/ccda/index.js";
import { ccdaCorpusArtifact } from "../src/ccda/round-trip.js";
import { fhirCorpus } from "../src/fhir/index.js";
import { fhirCorpusArtifact } from "../src/fhir/round-trip.js";
import { generateHl7Quirk, hl7Corpus } from "../src/hl7/index.js";
import { hl7CorpusArtifact } from "../src/hl7/round-trip.js";
import { generateB1, generateNewRx, ncpdpCorpus } from "../src/ncpdp/index.js";
import { scriptCorpusArtifact, telecomCorpusArtifact } from "../src/ncpdp/round-trip.js";
import { generate835, roundTrip, x12Corpus } from "../src/x12/index.js";
import { x12CorpusArtifact } from "../src/x12/round-trip.js";

type CorpusOf = (options: { seed: number; count: number; verify?: boolean }) => Corpus;

const CORPORA: readonly [string, CorpusOf, number][] = [
  ["hl7Corpus", hl7Corpus, 7],
  ["fhirCorpus", fhirCorpus, 13],
  ["ccdaCorpus", ccdaCorpus, 2],
  ["x12Corpus", x12Corpus, 5],
  ["ncpdpCorpus", ncpdpCorpus, 6],
  ["astmCorpus", astmCorpus, 2],
];

describe("a corpus with verify off", () => {
  for (const [name, corpusOf, count] of CORPORA) {
    it(`${name} builds the same artifacts, each with no warnings`, () => {
      const checked = corpusOf({ seed: 42, count });
      const unchecked = corpusOf({ seed: 42, count, verify: false });
      expect(corpusOf({ seed: 42, count, verify: true })).toEqual(checked);
      expect(unchecked.seed).toBe(checked.seed);
      expect(unchecked.manifest).toEqual(checked.manifest);
      expect(unchecked.artifacts.map((a) => [a.format, a.kind, a.content])).toEqual(
        checked.artifacts.map((a) => [a.format, a.kind, a.content]),
      );
      expect(unchecked.artifacts.every((a) => a.warnings.length === 0)).toBe(true);
      expect(Object.isFrozen(unchecked.artifacts[0]?.warnings)).toBe(true);
    });
  }
});

describe("a corpus with verify on records what the parser finds reading an artifact back", () => {
  it("for every format, given an artifact the parser warns on", () => {
    const hl7Quirk = generateHl7Quirk({ seed: 1, quirk: "unknown-zsegment" }).content;
    expect(hl7CorpusArtifact(parseHL7(hl7Quirk), true).warnings).toContain("UNKNOWN_SEGMENT");

    const ccdaQuirk = generateCcdaQuirk({ seed: 1, quirk: "template-extension-absent" }).content;
    expect(ccdaCorpusArtifact(parseCcda(ccdaQuirk), true).warnings).toContain(
      "TEMPLATE_EXTENSION_ABSENT",
    );

    const astmQuirk = generateAstmQuirk({ seed: 1, quirk: "unknown-escape" }).content;
    expect(astmCorpusArtifact(astmQuirk, true).warnings).toContain("ASTM_UNKNOWN_ESCAPE_SEQUENCE");

    const x12Text = roundTrip(generate835({ seed: 1 })).content.replace("~IEA*1*", "~IEA*2*");
    expect(x12CorpusArtifact(parseX12(x12Text), true).warnings).toContain(
      "X12_GROUP_COUNT_MISMATCH",
    );

    const { resource } = parseResource('{"resourceType":"Patient","gender":"bogus"}');
    expect(fhirCorpusArtifact(resource, true).warnings).toContain("CODE_INVALID");

    const script = generateNewRx({ seed: 1 }).replaceAll("2017071", "1999999");
    expect(scriptCorpusArtifact(script, true).warnings).toContain(
      "NCPDP_SCRIPT_UNSUPPORTED_VERSION_TOLERATED",
    );

    const telecom = generateB1({ seed: 1 }).replace("AM07", "AM99");
    expect(telecomCorpusArtifact(telecom, true).warnings).toContain(
      "NCPDP_TELECOM_UNKNOWN_SEGMENT",
    );
  });
});
