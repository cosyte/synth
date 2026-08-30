/**
 * **The adopted-set contract.** A consumer building to `45 CFR 170.315(g)(10)` addresses this package
 * by US Core 6.1.0 profile name and must get one of exactly two answers: an artifact claiming that
 * profile, or a refusal raised *before* anything is generated, with the uncovered set readable as
 * data. This suite is the executable form of that contract.
 *
 * Three things are asserted here and nowhere else:
 *
 * 1. **The adopted set is exactly the 49 resource profiles the guide publishes**, transcribed below
 *    from the IG's own artifact index ("Structures: Resource Profiles" at `hl7.org/fhir/us/core/STU6.1`)
 *    and compared member by member, so the set cannot gain, lose or rename a member quietly.
 *
 *    **The list below is a SECOND transcription, on purpose, not a re-export.** Comparing
 *    `US_CORE_ADOPTED_PROFILES` against itself would pass whatever it said. It is also NOT the count
 *    of `StructureDefinition-us-core-*.json` files in the guide's source tree (54): that directory
 *    carries the guide's 10 extension definitions and omits `us-core-patient` and
 *    `us-core-servicerequest`, both of which the guide publishes. The published artifact index is the
 *    authority for the set; the source-tree count measures the gap, not the set.
 *
 * 2. **The two refusals are distinct codes**, because "the guide does not publish this" and "we do
 *    not generate this yet" are different answers and a caller has to be able to tell them apart on
 *    `err.code` without matching message text.
 *
 * 3. **Every refusal happens before an artifact exists.** Each negative case below asserts a throw
 *    and therefore that no value was returned: there is no route here that yields a mislabelled
 *    artifact, and no default profile to fall through to.
 */

import { describe, it, expect } from "vitest";
import { serializeResource } from "@cosyte/fhir";

import { SYNTH_FATAL_CODES, SynthError } from "../../src/index.js";
import {
  generateUsCoreProfile,
  usCoreCoverage,
  US_CORE_ADOPTED_PROFILES,
  US_CORE_PROFILE_BASE,
  type UsCoreProfileId,
} from "../../src/fhir/index.js";

/**
 * The 49 resource profiles the US Core 6.1.0 implementation guide publishes, transcribed from its
 * artifact index. Independent of the implementation's own list by construction (see the header).
 */
const PUBLISHED_RESOURCE_PROFILES: readonly string[] = [
  "head-occipital-frontal-circumference-percentile",
  "pediatric-bmi-for-age",
  "pediatric-weight-for-height",
  "us-core-allergyintolerance",
  "us-core-blood-pressure",
  "us-core-bmi",
  "us-core-body-height",
  "us-core-body-temperature",
  "us-core-body-weight",
  "us-core-careplan",
  "us-core-careteam",
  "us-core-condition-encounter-diagnosis",
  "us-core-condition-problems-health-concerns",
  "us-core-coverage",
  "us-core-diagnosticreport-lab",
  "us-core-diagnosticreport-note",
  "us-core-documentreference",
  "us-core-encounter",
  "us-core-goal",
  "us-core-head-circumference",
  "us-core-heart-rate",
  "us-core-immunization",
  "us-core-implantable-device",
  "us-core-location",
  "us-core-medication",
  "us-core-medicationdispense",
  "us-core-medicationrequest",
  "us-core-observation-clinical-result",
  "us-core-observation-lab",
  "us-core-observation-occupation",
  "us-core-observation-pregnancyintent",
  "us-core-observation-pregnancystatus",
  "us-core-observation-screening-assessment",
  "us-core-observation-sexual-orientation",
  "us-core-organization",
  "us-core-patient",
  "us-core-practitioner",
  "us-core-practitionerrole",
  "us-core-procedure",
  "us-core-provenance",
  "us-core-pulse-oximetry",
  "us-core-questionnaireresponse",
  "us-core-relatedperson",
  "us-core-respiratory-rate",
  "us-core-servicerequest",
  "us-core-simple-observation",
  "us-core-smokingstatus",
  "us-core-specimen",
  "us-core-vital-signs",
];

/**
 * The guide's 10 **extension definitions**, from the same index's "Structures: Extension Definitions"
 * section. An extension is not a standalone artifact, so none of these is in the adopted set and a
 * request naming one refuses on the same route as any other name outside it.
 */
const PUBLISHED_EXTENSIONS: readonly string[] = [
  "us-core-birthsex",
  "us-core-direct",
  "us-core-ethnicity",
  "us-core-extension-questionnaire-uri",
  "us-core-genderIdentity",
  "us-core-jurisdiction",
  "us-core-race",
  "us-core-sex",
  "us-core-tribal-affiliation",
  "uscdi-requirement",
];

/** The profiles this build generates today. A move in either direction has to be made here too. */
const EXPECTED_GENERATED: readonly string[] = [
  "us-core-allergyintolerance",
  "us-core-condition-problems-health-concerns",
  "us-core-diagnosticreport-lab",
  "us-core-encounter",
  "us-core-immunization",
  "us-core-medicationrequest",
  "us-core-observation-lab",
  "us-core-patient",
  "us-core-procedure",
  "us-core-provenance",
  "us-core-vital-signs",
];

/**
 * A profile selector is typed as a closed union that is **erased at run time**, so a JavaScript
 * caller reaches the entry point with any value at all. Every cast below plants such a value in that
 * position deliberately, and exists for that reason and no other.
 */
const asProfile = (value: unknown): UsCoreProfileId => value as UsCoreProfileId;

/** Run `generateUsCoreProfile` and return the {@link SynthError} it threw, failing if it returned. */
function refusalFor(profile: unknown): SynthError {
  let thrown: unknown;
  let returned: unknown;
  try {
    returned = generateUsCoreProfile({ profile: asProfile(profile), seed: 7 });
  } catch (error) {
    thrown = error;
  }
  // "Refuse before generating anything, and never return an artifact of any kind."
  expect(returned).toBeUndefined();
  expect(thrown).toBeInstanceOf(SynthError);
  return thrown as SynthError;
}

describe("the adopted US Core 6.1.0 profile set", () => {
  it("reports an entry for exactly the 49 published resource profiles", () => {
    const reported = usCoreCoverage().map((entry) => entry.profile);
    expect(reported).toStrictEqual(PUBLISHED_RESOURCE_PROFILES);
    expect(reported).toHaveLength(49);
    expect(new Set(reported).size).toBe(49);
    // The exported set and the report are the same closed set, in the same order.
    expect([...US_CORE_ADOPTED_PROFILES]).toStrictEqual(PUBLISHED_RESOURCE_PROFILES);
  });

  it("carries each profile's canonical URL alongside its coverage flag", () => {
    for (const entry of usCoreCoverage()) {
      expect(entry.canonical).toBe(`${US_CORE_PROFILE_BASE}${entry.profile}`);
      expect(entry.canonical.startsWith("http://hl7.org/fhir/us/core/StructureDefinition/")).toBe(
        true,
      );
      expect(typeof entry.generated).toBe("boolean");
    }
  });

  it("names the generated set, and reports every other adopted profile as uncovered", () => {
    const coverage = usCoreCoverage();
    const generated = coverage.filter((e) => e.generated).map((e) => e.profile);
    const uncovered = coverage.filter((e) => !e.generated).map((e) => e.profile);
    expect(generated).toStrictEqual(EXPECTED_GENERATED);
    expect(uncovered).toHaveLength(38);
    expect(generated.length + uncovered.length).toBe(49);
    // Every uncovered profile is named in the report rather than merely missing from it.
    for (const profile of PUBLISHED_RESOURCE_PROFILES) {
      expect([...generated, ...uncovered]).toContain(profile);
    }
  });

  it("excludes the guide's extension definitions from the adopted set", () => {
    for (const extension of PUBLISHED_EXTENSIONS) {
      expect(PUBLISHED_RESOURCE_PROFILES).not.toContain(extension);
      expect([...US_CORE_ADOPTED_PROFILES]).not.toContain(extension);
    }
  });
});

describe("profile-addressed generation resolves before it generates", () => {
  it("returns an artifact for every profile the coverage surface reports as generated", () => {
    for (const entry of usCoreCoverage().filter((e) => e.generated)) {
      const resource = generateUsCoreProfile({ profile: entry.profile, seed: 4242 });
      expect(resource.kind).toBe("complex");
      const resourceType = resource.properties.find((p) => p.name === "resourceType");
      expect(resourceType, `${entry.profile} has a resourceType`).toBeDefined();
    }
  });

  it("defaults the seed to 0, and only the seed", () => {
    for (const entry of usCoreCoverage().filter((e) => e.generated)) {
      expect(
        serializeResource(generateUsCoreProfile({ profile: entry.profile })),
        entry.profile,
      ).toBe(serializeResource(generateUsCoreProfile({ profile: entry.profile, seed: 0 })));
    }
  });

  it("refuses an ADOPTED profile it does not generate, with its own distinct code", () => {
    const uncovered = usCoreCoverage().filter((e) => !e.generated);
    expect(uncovered.length).toBeGreaterThan(0);
    for (const entry of uncovered) {
      expect(refusalFor(entry.profile).code).toBe(SYNTH_FATAL_CODES.SYNTH_PROFILE_NOT_GENERATED);
    }
  });

  it("refuses a name outside the adopted set with a DIFFERENT code", () => {
    const outside = [
      "us-core-nope",
      "Patient",
      "us-core-patient ",
      " us-core-patient",
      "US-CORE-PATIENT",
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
      "us-core-provenance-participant-type",
    ];
    for (const name of outside) {
      expect(refusalFor(name).code, name).toBe(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_KIND);
    }
    // The two refusals are genuinely distinct, which is the whole point of the second code.
    expect(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_KIND).not.toBe(
      SYNTH_FATAL_CODES.SYNTH_PROFILE_NOT_GENERATED,
    );
  });

  it("refuses an extension definition on the same fail-closed route", () => {
    for (const extension of PUBLISHED_EXTENSIONS) {
      expect(refusalFor(extension).code, extension).toBe(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_KIND);
    }
  });

  it("refuses an empty, blank, or non-string name rather than defaulting", () => {
    const notAName: readonly unknown[] = [
      "",
      " ",
      "\t",
      "\n",
      undefined,
      null,
      0,
      1,
      Number.NaN,
      true,
      false,
      [],
      ["us-core-patient"],
      {},
      { profile: "us-core-patient" },
      Symbol.iterator,
    ];
    for (const value of notAName) {
      expect(refusalFor(value).code, String(value)).toBe(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_KIND);
    }
  });
});
