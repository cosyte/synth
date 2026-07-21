/**
 * C-CDA **vendor-quirk generation** (roadmap §Phase 7 — the differentiator). A quirk deviates the
 * *structure* of an otherwise spec-clean document (built through `@cosyte/ccda`'s `buildCcda`) so it
 * round-trips through `parseCcda` to **exactly** one intended, stable warning code — the tolerance a
 * `defineCcdaProfile` profile encodes. With the matching built-in profile active, that warning is
 * **re-badged** to the value-free `PROFILE_QUIRK_APPLIED` marker (`expected: true`, `toleratedCode` = the
 * original), exactly as the parser's `profileQuirkApplied` does.
 *
 * The deviation is applied **post-serialize** (roadmap §10 Q4: profile tolerance is parse-side, so the
 * quirk is a deterministic transform of the serializer's own conservative emit). Three quirks ship, each
 * publicly grounded (ADR 0018) and re-badged by a built-in public profile:
 *
 * - **`template-extension-absent`** → `TEMPLATE_EXTENSION_ABSENT` (profile `legacyR11`). The R2.1
 *   `@extension="2015-08-01"` version stamp is dropped from the document-type templateId — a legacy
 *   R1.1-era document shape.
 * - **`deprecated-loinc`** → `DEPRECATED_LOINC` (profile `smartScorecard`). A result/vital observation
 *   LOINC code is swapped to a known-deprecated LOINC (`41909-3`).
 * - **`deprecated-code-system`** → `DEPRECATED_CODE_SYSTEM` (profile `smartScorecard`). A problem
 *   observation's value is swapped to a deprecated code system (ICD-9-CM `2.16.840.1.113883.6.103`).
 *
 * A quirk **never** introduces a real-looking value — it changes a template stamp or a code, never a PHI
 * locus, so the synthetic-safety gate still runs and stays zero (roadmap §Phase 7 "Safety framing").
 *
 * @module
 */

import { parseCcda, serializeCcda, ccdaProfiles, type CcdaProfile } from "@cosyte/ccda";

import { createRng } from "../rng/rng.js";
import { makeCorpus, type Corpus } from "../corpus.js";
import { defineSynthProfile, type SynthProfile } from "../profile.js";
import {
  resolveQuirk,
  sameCodeSet,
  profileTolerated,
  validateProfileQuirks,
  assertIntendedWarnings,
  type QuirkDescriptor,
  type QuirkArtifact,
  type QuirkRoundTripResult,
} from "../quirk.js";

import { generateCcda, type CcdaDocumentType } from "./ccd.js";

/** Every C-CDA quirk this phase ships. */
export type CcdaQuirkName =
  | "template-extension-absent"
  | "deprecated-loinc"
  | "deprecated-code-system";

/** The C-CDA quirk registry — each recipe bound to the exact `@cosyte/ccda` warning code it targets. */
export const CCDA_QUIRKS: Readonly<Record<CcdaQuirkName, QuirkDescriptor>> = Object.freeze({
  "template-extension-absent": Object.freeze({
    name: "template-extension-absent",
    format: "ccda",
    intendedWarnings: Object.freeze(["TEMPLATE_EXTENSION_ABSENT"]),
    grounding:
      "ONC 2015 Edition §170.315(b)(1) + HL7/C-CDA-Examples (CC0): legacy R1.1-era documents omit the " +
      "R2.1 @extension=2015-08-01 version stamp. Re-badged by @cosyte/ccda's public `legacyR11` profile.",
    toleratingProfile: "legacyR11",
    disposition: "rebadged",
  }),
  "deprecated-loinc": Object.freeze({
    name: "deprecated-loinc",
    format: "ccda",
    intendedWarnings: Object.freeze(["DEPRECATED_LOINC"]),
    grounding:
      "SMART C-CDA Scorecard + D'Amore et al., JAMIA 2014: real documents carry deprecated LOINC codes " +
      "(e.g. 41909-3). Re-badged by @cosyte/ccda's public `smartScorecard` profile.",
    toleratingProfile: "smartScorecard",
    disposition: "rebadged",
  }),
  "deprecated-code-system": Object.freeze({
    name: "deprecated-code-system",
    format: "ccda",
    intendedWarnings: Object.freeze(["DEPRECATED_CODE_SYSTEM"]),
    grounding:
      "SMART C-CDA Scorecard + D'Amore et al., JAMIA 2014: legacy problem lists code diagnoses in " +
      "ICD-9-CM (2.16.840.1.113883.6.103). Re-badged by @cosyte/ccda's public `smartScorecard` profile.",
    toleratingProfile: "smartScorecard",
    disposition: "rebadged",
  }),
});

/** The tolerating C-CDA profile object for a quirk. */
function toleratingProfile(quirk: CcdaQuirkName): CcdaProfile {
  return quirk === "template-extension-absent"
    ? ccdaProfiles.legacyR11
    : ccdaProfiles.smartScorecard;
}

/**
 * The document-type templateId roots whose R2.1 `@extension` stamp the `legacyR11` quirk drops — the
 * US Realm Header (`…22.1.1`) **and** every document-type template `buildCcda` emits: CCD (`…22.1.2`)
 * and Referral Note (`…22.1.14`). The parser keys `TEMPLATE_EXTENSION_ABSENT` on the **document-type**
 * template, so this must cover each generable document type; dropping a root a given document does not
 * carry is a harmless no-op, and the generation-time contract assertion catches any type left uncovered.
 */
const DOC_TEMPLATE_ROOTS = [
  "2.16.840.1.113883.10.20.22.1.1",
  "2.16.840.1.113883.10.20.22.1.2",
  "2.16.840.1.113883.10.20.22.1.14",
] as const;

/**
 * Match the first Result-Observation (template `…22.4.2`) or Vital-Sign-Observation (`…22.4.27`) LOINC
 * `<code>` — its code value is the capture between groups 1 and 2. Structural, so it is seed-robust (it
 * never depends on which example LOINC a given seed drew).
 */
const RESULT_OR_VITAL_LOINC =
  /(<templateId root="2\.16\.840\.1\.113883\.10\.20\.22\.4\.(?:2|27)"[^>]*\/>(?:(?!<templateId)[\s\S])*?<code code=")[^"]+(" codeSystem="2\.16\.840\.1\.113883\.6\.1")/;

/** Match the first Problem-Observation (`…22.4.4`) SNOMED CD `<value>` — code + codeSystem are captured. */
const PROBLEM_VALUE_SNOMED =
  /(<templateId root="2\.16\.840\.1\.113883\.10\.20\.22\.4\.4"[\s\S]*?<value code=")[^"]+(" codeSystem=")2\.16\.840\.1\.113883\.6\.96("[^>]*xsi:type="CD"\/>)/;

/** A known-deprecated LOINC (BMI, superseded by 39156-5) — the `deprecated-loinc` target. */
const DEPRECATED_LOINC_CODE = "41909-3";

/** The post-serialize XML transform for each quirk — a pure, deterministic function of the clean XML. */
function applyQuirk(quirk: CcdaQuirkName, xml: string): string {
  switch (quirk) {
    case "template-extension-absent": {
      let out = xml;
      for (const root of DOC_TEMPLATE_ROOTS) {
        out = out.replace(
          `<templateId root="${root}" extension="2015-08-01"/>`,
          `<templateId root="${root}"/>`,
        );
      }
      return out;
    }
    case "deprecated-loinc":
      return xml.replace(RESULT_OR_VITAL_LOINC, `$1${DEPRECATED_LOINC_CODE}$2`);
    case "deprecated-code-system":
      // ICD-9-CM hypertension (401.9) under the deprecated ICD-9-CM diagnosis code system.
      return xml.replace(PROBLEM_VALUE_SNOMED, `$1401.9$22.16.840.1.113883.6.103$3`);
  }
}

/**
 * Apply a C-CDA quirk transform to a spec-clean document, or **fail closed**. Refuses to return a
 * document that does not carry the intended deviation (a quirk whose structural anchor is absent) —
 * a fixture that silently lost its quirk would test the wrong thing.
 *
 * @param quirk - The quirk to inject.
 * @param cleanXml - The spec-clean C-CDA XML.
 * @returns The quirked XML.
 * @throws Error when the quirk found no structural anchor to mutate.
 * @example
 * ```ts
 * import { injectCcdaQuirk } from "@cosyte/synth/ccda";
 * injectCcdaQuirk("template-extension-absent", cleanXml);
 * ```
 */
export function injectCcdaQuirk(quirk: CcdaQuirkName, cleanXml: string): string {
  const content = applyQuirk(quirk, cleanXml);
  if (content === cleanXml) {
    throw new Error(
      `injectCcdaQuirk: quirk "${quirk}" found no structural anchor to mutate — refusing to emit a ` +
        `fixture that does not carry the intended deviation.`,
    );
  }
  return content;
}

/** Options for {@link generateCcdaQuirk}. */
export interface GenerateCcdaQuirkOptions {
  /** The seed — the same seed + quirk yields a byte-identical document. Defaults to `0`. */
  readonly seed?: number;
  /** The quirk to inject. Required. */
  readonly quirk: CcdaQuirkName;
  /** The spec-clean base document type. Defaults to `"ccd"`. */
  readonly documentType?: CcdaDocumentType;
}

/**
 * Generate one C-CDA **quirk** artifact: a spec-clean document (built through `@cosyte/ccda`'s
 * `buildCcda`) with the requested vendor deviation injected post-serialize. Deterministic in `seed` +
 * `quirk` + `documentType`.
 *
 * @param options - Seed, quirk, and base document type. See {@link GenerateCcdaQuirkOptions}.
 * @returns The {@link QuirkArtifact} — its `content` round-trips to `intendedWarnings` exactly.
 * @throws SynthError `SYNTH_UNSUPPORTED_QUIRK` if `quirk` is not a supported C-CDA quirk.
 * @throws Error if the base document does not contain the structural anchor the quirk targets.
 * @example
 * ```ts
 * import { generateCcdaQuirk, ccdaQuirkRoundTrip } from "@cosyte/synth/ccda";
 * const rt = ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: 1, quirk: "deprecated-loinc" }));
 * rt.withProfile?.tolerated; // true — `smartScorecard` re-badges DEPRECATED_LOINC
 * ```
 */
export function generateCcdaQuirk(options: GenerateCcdaQuirkOptions): QuirkArtifact {
  const seed = options.seed ?? 0;
  const documentType = options.documentType ?? "ccd";
  const descriptor = resolveQuirk(CCDA_QUIRKS, "ccda", options.quirk);
  const clean = serializeCcda(generateCcda({ seed, documentType }));
  const content = injectCcdaQuirk(options.quirk, clean);
  // Self-check the intended-warning contract at generation time: never emit a mislabeled fixture (a
  // transform can change bytes on the wrong template and still produce no warning — e.g. a document
  // type whose document-type root is not in DOC_TEMPLATE_ROOTS).
  assertIntendedWarnings(
    descriptor.name,
    descriptor.intendedWarnings,
    parseCcda(content).warnings.map((w) => String(w.code)),
  );
  return Object.freeze({
    format: "ccda" as const,
    quirk: descriptor.name,
    kind: documentType,
    content,
    intendedWarnings: descriptor.intendedWarnings,
  });
}

/**
 * Round-trip a C-CDA quirk artifact through `@cosyte/ccda` and report the intended-warning verdict
 * (roadmap §6): a bare parse must produce **exactly** the intended code, and the matching public profile
 * must re-badge it to `PROFILE_QUIRK_APPLIED`.
 *
 * @param artifact - The quirk artifact (from {@link generateCcdaQuirk}).
 * @returns The {@link QuirkRoundTripResult}.
 * @example
 * ```ts
 * import { generateCcdaQuirk, ccdaQuirkRoundTrip } from "@cosyte/synth/ccda";
 * ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: 1, quirk: "deprecated-loinc" })).intendedWarningHeld;
 * ```
 */
export function ccdaQuirkRoundTrip(artifact: QuirkArtifact): QuirkRoundTripResult {
  const quirk = artifact.quirk as CcdaQuirkName;
  const descriptor = resolveQuirk(CCDA_QUIRKS, "ccda", quirk);
  const bare = parseCcda(artifact.content).warnings.map((w) => String(w.code));
  const profile = toleratingProfile(quirk);
  const profiledWarnings = parseCcda(artifact.content, { profile }).warnings.map((w) =>
    String(w.code),
  );
  return {
    content: artifact.content,
    warnings: bare,
    intendedWarnings: artifact.intendedWarnings,
    intendedWarningHeld: sameCodeSet(bare, artifact.intendedWarnings),
    withProfile: {
      profileName: descriptor.toleratingProfile ?? profile.name,
      disposition: descriptor.disposition,
      warnings: profiledWarnings,
      tolerated: profileTolerated(
        descriptor.disposition,
        artifact.intendedWarnings,
        profiledWarnings,
      ),
    },
  };
}

/** Options for {@link ccdaQuirkCorpus}. */
export interface CcdaQuirkCorpusOptions {
  /** The seed for the whole corpus (deterministic). */
  readonly seed: number;
  /** How many quirk artifacts to generate. Defaults to the number of quirks. */
  readonly count?: number;
  /** The quirk names to cycle through. Defaults to every C-CDA quirk. Validated; unsupported ⇒ fatal. */
  readonly quirks?: readonly CcdaQuirkName[];
  /** A {@link SynthProfile} whose `quirks` drive the corpus (validated). Takes precedence over `quirks`. */
  readonly profile?: SynthProfile;
  /** The base document type each quirk is injected into. Defaults to `"ccd"`. */
  readonly documentType?: CcdaDocumentType;
}

const ALL_CCDA_QUIRKS: readonly CcdaQuirkName[] = Object.freeze(
  Object.keys(CCDA_QUIRKS) as CcdaQuirkName[],
);

/**
 * Build a reproducible {@link Corpus} of C-CDA quirk artifacts. Each artifact's `warnings` record the
 * intended code for its quirk; the manifest lists the applied quirk names.
 *
 * @param options - Seed, count, and the quirk selection. See {@link CcdaQuirkCorpusOptions}.
 * @returns A deep-frozen {@link Corpus}.
 * @example
 * ```ts
 * import { ccdaQuirkCorpus } from "@cosyte/synth/ccda";
 * ccdaQuirkCorpus({ seed: 42 }).manifest.quirks; // the applied quirk names
 * ```
 */
export function ccdaQuirkCorpus(options: CcdaQuirkCorpusOptions): Corpus {
  const quirks: readonly string[] = options.profile
    ? validateProfileQuirks(options.profile, CCDA_QUIRKS, "ccda")
    : (options.quirks ?? ALL_CCDA_QUIRKS);
  const names = quirks.length > 0 ? quirks : ALL_CCDA_QUIRKS;
  const documentType = options.documentType ?? "ccd";
  const count = options.count ?? names.length;
  const seedStream = createRng(options.seed);
  const artifacts = Array.from({ length: count }, (_unused, i) => {
    const quirk = names[i % names.length] as CcdaQuirkName;
    const artifactSeed = seedStream.nextUint32();
    const artifact = generateCcdaQuirk({ seed: artifactSeed, quirk, documentType });
    return {
      format: "ccda" as const,
      kind: `${documentType}~${quirk}`,
      content: artifact.content,
      warnings: artifact.intendedWarnings,
    };
  });
  return makeCorpus(options.seed, artifacts, [...new Set(names)]);
}

/** A ready-made {@link SynthProfile} requesting every built-in C-CDA quirk. */
export const ccdaQuirkProfile: SynthProfile = defineSynthProfile({
  name: "cosyte-ccda-quirks",
  quirks: [...ALL_CCDA_QUIRKS],
});
