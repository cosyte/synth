/**
 * The **diagnostic-surface gate**: no consumer-controlled position `@cosyte/synth` accepts may echo
 * into anything a consumer will log — a thrown value, its `message`, its `stack`, or a structural
 * identifier this package puts on one of its own models.
 *
 * `synth` is a *generator*, so the values flowing through its diagnostics are synthetic by
 * construction and nobody's PHI is in a `synth` diagnostic today. That is not what this suite is for.
 * It exists because the guarantee was **incidental** — every fatal was built by interpolating the
 * caller's value into a template string, and the only thing keeping PHI out was that the caller
 * happened to be passing a quirk name. A guarantee that depends on who calls you is a sentence, not a
 * mechanism. This suite makes it structural: the messages come from a frozen registry and the error
 * factory takes no value parameter at all, so there is no position for a value to enter.
 *
 * Two design notes, because both are the kind of judgement the runner's own docs ask reviewers to
 * question rather than accept:
 *
 * 1. **`parseStrict` is `null`, honestly.** A parser has a lenient mode and a strict mode; a generator
 *    has neither. Every failure `synth` can have is already fatal, so the lenient arm *is* the whole
 *    surface and there is no second mode whose `err.stack` could carry an echo the first one does not.
 *
 * 2. **What `getModelIdentifiers` returns, and what it deliberately does not.** It returns the
 *    structural identifiers `synth` **derives**: an artifact `kind`, the manifest's per-kind keys and
 *    quirk set, a quirk descriptor's name and tolerating-profile name, and every warning **code** a
 *    round-trip harness reports. Those must come from a closed set, because a downstream package
 *    building its own diagnostics will interpolate them — the `hl7`/`deid` layering lesson.
 *    It does **not** return the caller's own labels that a model is merely asked to carry back
 *    (`SynthProfile.name`, the `givenNames`/`familyNames` pools, and the `kind`/`content` of an
 *    `Artifact` a caller hands straight to `makeCorpus`), for the same reason a parser's model sweep
 *    excludes document values: the model is asked to hold them, they are derived from nothing, and no
 *    `synth` code path interpolates them into a diagnostic.
 *
 * 3. **The model half of the sweep is VACUOUS, and saying so is the point.** Every slot below throws:
 *    each one plants its marker in a position that now fails closed before any model exists, so the
 *    runner returns from its sweep without ever calling `getModelIdentifiers`. That is the *result* of
 *    the fix, not an oversight in the table, and it is stated here rather than left for a reader to
 *    infer coverage that is not there — an earlier draft of this file left it unsaid and a refuter
 *    was right to call it the audit's own "green over unreachable space" reproduced inside the fix
 *    for it. What carries the model half instead is the closed-set assertion further down, which runs
 *    the three identifier helpers over real corpora and real quirk round-trips and checks that every
 *    identifier they yield comes from a set this package controls. Between them: the slots prove no
 *    caller value survives to a model, and the closed-set test proves the identifiers that do exist
 *    were derived rather than passed through.
 *
 * 4. **`src/deid/**` has no slot, and the reason is a boundary, not an absence of positions.** It has
 *    three unresolved selectors of its own — `x12DeidLoop({ variant })` and
 *    `ncpdpTelecomDeidLoop({ transaction })` fall out of a switch as an uncoded `TypeError`, and
 *    `ccdaDeidLoop({ documentType })` is a two-way ternary that silently generates a Referral Note for
 *    anything but `"ccd"`. None of those echo a caller value into a message, so none is a leak; all
 *    three are the same erased-union defect this change closed elsewhere, left for its own item rather
 *    than swept in here after two refuter passes. `identifierSentinels`, `assembleVerdict` and
 *    `summarizeDeidCoverage` take caller strings and hand them straight back: pass-through
 *    constructors over data the caller already holds, in the same class as `makeCorpus`. In the loop
 *    itself those fields come from `@cosyte/deid`'s extractors walking output `synth` generated.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import {
  SYNTH_FATAL_CODES,
  SynthError,
  SYNTH_FATAL_MESSAGES,
  resolveQuirk,
  validateProfileQuirks,
  assertIntendedWarnings,
  defineSynthProfile,
  makeCorpus,
  type Corpus,
  type QuirkArtifact,
  type QuirkDescriptor,
  type QuirkRoundTripResult,
  type SynthFormat,
} from "../../src/index.js";
import {
  generateAdt,
  generateHl7,
  hl7Corpus,
  generateHl7Quirk,
  hl7QuirkRoundTrip,
  hl7QuirkCorpus,
  HL7_QUIRKS,
  type AdtTrigger,
  type Hl7MessageKind,
  type Hl7QuirkKind,
  type Hl7QuirkName,
} from "../../src/hl7/index.js";
import {
  generateCcda,
  ccdaCorpus,
  generateCcdaQuirk,
  ccdaQuirkRoundTrip,
  ccdaQuirkCorpus,
  injectCcdaQuirk,
  toBuildCode,
  CCDA_QUIRKS,
  type CcdaCorpusKind,
  type CcdaDocumentType,
  type CcdaQuirkName,
} from "../../src/ccda/index.js";
import {
  astmCorpus,
  generateAstmQuirk,
  astmQuirkRoundTrip,
  astmQuirkCorpus,
  astmRoundTrip,
  ASTM_QUIRKS,
  type AstmCorpusKind,
  type AstmQuirkKind,
  type AstmQuirkName,
} from "../../src/astm/index.js";
import {
  dec,
  x12Corpus,
  generate837,
  type Claim837Variant,
  type X12CorpusKind,
} from "../../src/x12/index.js";
import {
  ncpdpCorpus,
  scriptRoundTrip,
  telecomRoundTrip,
  type NcpdpCorpusKind,
} from "../../src/ncpdp/index.js";
import {
  fhirCorpus,
  generateBundle,
  generatePatient,
  type FhirBundleType,
  type FhirResourceKind,
} from "../../src/fhir/index.js";

import { assertNoDiagnosticPhiLeak, type DiagnosticSlot } from "@cosyte/test-utils";

/**
 * `synth`'s diagnostics are bare, stable codes: a round-trip harness reports `warnings: string[]`, and
 * a fatal is a {@link SynthError} carrying `.code`. The runner reads `.code` off each diagnostic and
 * sweeps every rendering, so a collection is normalised to that shape — and the *absence* of a
 * `message` field here is the point being proven, not an omission.
 */
interface SynthDiagnostic {
  readonly code: string;
}

/** What one probe yields when the call under test does **not** throw. */
interface ProbeResult {
  /** Every diagnostic collection the call exposes. */
  readonly diagnostics: readonly SynthDiagnostic[];
  /** Every structural identifier `synth` derived onto the returned model. */
  readonly identifiers: readonly string[];
}

/** A probe is a thunk: the runner's `parse` invokes it, so a throw is swept exactly as a fatal parse is. */
type Probe = () => ProbeResult;

const codes = (warnings: readonly string[]): SynthDiagnostic[] =>
  warnings.map((code) => ({ code }));

const NO_RESULT: ProbeResult = { diagnostics: [], identifiers: [] };

/** Structural identifiers derived onto a {@link Corpus} — manifest keys, quirk set, kinds, codes. */
const corpusIdentifiers = (corpus: Corpus): string[] => [
  ...corpus.manifest.formats,
  ...Object.keys(corpus.manifest.counts),
  ...corpus.manifest.quirks,
  ...corpus.artifacts.flatMap((a) => [a.format, a.kind, ...a.warnings]),
];

/** Structural identifiers on a {@link QuirkArtifact} — `content` is the artifact itself, not an identifier. */
const quirkArtifactIdentifiers = (artifact: QuirkArtifact): string[] => [
  artifact.format,
  artifact.quirk,
  artifact.kind,
  ...artifact.intendedWarnings,
];

/** Structural identifiers on a {@link QuirkRoundTripResult}. */
const quirkRoundTripIdentifiers = (result: QuirkRoundTripResult): string[] => [
  ...result.warnings,
  ...result.intendedWarnings,
  ...(result.withProfile
    ? [
        result.withProfile.profileName,
        result.withProfile.disposition,
        ...result.withProfile.warnings,
      ]
    : []),
];

// A spec-clean quirk artifact per format, used as the *clean* base a slot mutates one field of.
const hl7Artifact = generateHl7Quirk({ seed: 1, quirk: "unknown-zsegment" });
const ccdaArtifact = generateCcdaQuirk({ seed: 1, quirk: "deprecated-loinc" });
const astmArtifact = generateAstmQuirk({ seed: 1, quirk: "unknown-escape" });

// Planting a marker in a slot whose *type* is a closed union is the whole point of the probe: the
// union is erased at runtime, so a JavaScript caller reaches these branches with any string at all.
// Every cast below exists for that reason and for no other.
const asHl7Quirk = (marker: string): Hl7QuirkName => marker as Hl7QuirkName;
const asCcdaQuirk = (marker: string): CcdaQuirkName => marker as CcdaQuirkName;
const asAstmQuirk = (marker: string): AstmQuirkName => marker as AstmQuirkName;
const asFormat = (marker: string): SynthFormat => marker as SynthFormat;
const as = <T extends string>(marker: string): T => marker as T;

const UNSUPPORTED_QUIRK = SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_QUIRK;
const UNSUPPORTED_KIND = SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_KIND;

/**
 * **The slot table.** The consumer-controlled positions this suite covers, each bound to the code it
 * must produce. Exported so the table itself is a reviewable artifact rather than an inline literal.
 *
 * **It is an enumeration, and it is deliberately not claimed to be exhaustive.** Two independent
 * refuter passes each found a position a previous version of this comment had called complete: the
 * first found eighteen selector positions, when the table covered only `throw` sites; the second found
 * the tail of a quirk list a `count` never reaches, after the selectors had been called "generalised,
 * not patched". The lesson is not that the third claim of completeness would be true. What the suite
 * proves is that **these** positions hold; what protects the ones nobody has thought of is the
 * mechanism, not the table — `SynthError` has no value parameter, and `resolveKind`/`resolveMix` are
 * the only way a selector is read. Add a slot when you add a position; do not read the table as a
 * proof that no other position exists.
 */
export const SLOTS: readonly DiagnosticSlot<Probe>[] = [
  // ---- resolveQuirk: the one factory every quirk path funnels through -------------------
  {
    name: "resolveQuirk(name)",
    plant: (m) => () => {
      resolveQuirk(HL7_QUIRKS, "hl7v2", m);
      return NO_RESULT;
    },
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "resolveQuirk(format)",
    plant: (m) => () => {
      resolveQuirk(HL7_QUIRKS, asFormat(m), "no-such-quirk");
      return NO_RESULT;
    },
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "resolveQuirk(registry) key",
    plant: (m) => () => {
      const registry: Record<string, QuirkDescriptor> = {
        [m]: { ...hl7Descriptor(), name: m },
      };
      resolveQuirk(registry, "hl7v2", "no-such-quirk");
      return NO_RESULT;
    },
    expectCode: UNSUPPORTED_QUIRK,
  },

  // ---- defineSynthProfile -> validateProfileQuirks ---------------------------------------
  {
    name: "validateProfileQuirks(profile.quirks[])",
    plant: (m) => () => {
      const profile = defineSynthProfile({ name: "probe-profile", quirks: [m] });
      return { diagnostics: [], identifiers: validateProfileQuirks(profile, HL7_QUIRKS, "hl7v2") };
    },
    expectCode: UNSUPPORTED_QUIRK,
  },

  // ---- the three quirk generators --------------------------------------------------------
  {
    name: "generateHl7Quirk(options.quirk)",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: quirkArtifactIdentifiers(generateHl7Quirk({ seed: 1, quirk: asHl7Quirk(m) })),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "generateCcdaQuirk(options.quirk)",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: quirkArtifactIdentifiers(generateCcdaQuirk({ seed: 1, quirk: asCcdaQuirk(m) })),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "generateAstmQuirk(options.quirk)",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: quirkArtifactIdentifiers(generateAstmQuirk({ seed: 1, quirk: asAstmQuirk(m) })),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },

  // ---- the three quirk round-trip harnesses ----------------------------------------------
  {
    name: "hl7QuirkRoundTrip(artifact.quirk)",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: quirkRoundTripIdentifiers(hl7QuirkRoundTrip({ ...hl7Artifact, quirk: m })),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "ccdaQuirkRoundTrip(artifact.quirk)",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: quirkRoundTripIdentifiers(ccdaQuirkRoundTrip({ ...ccdaArtifact, quirk: m })),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "astmQuirkRoundTrip(artifact.quirk)",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: quirkRoundTripIdentifiers(astmQuirkRoundTrip({ ...astmArtifact, quirk: m })),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },

  // ---- the three quirk corpora, by explicit list and by profile --------------------------
  {
    name: "hl7QuirkCorpus(options.quirks[])",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(hl7QuirkCorpus({ seed: 1, quirks: [asHl7Quirk(m)] })),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "ccdaQuirkCorpus(options.quirks[])",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(ccdaQuirkCorpus({ seed: 1, quirks: [asCcdaQuirk(m)] })),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "astmQuirkCorpus(options.quirks[])",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(astmQuirkCorpus({ seed: 1, quirks: [asAstmQuirk(m)] })),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },
  // The tail of a quirk list a `count` never reaches. Found by the second refuter pass, in the same
  // class as the first pass's finding: a caller string landing on `manifest.quirks`, which
  // `corpusIdentifiers` below counts as a derived identifier. The list is now resolved whole, at the
  // corpus entry point, rather than lazily per generated artifact.
  {
    name: "hl7QuirkCorpus(options.quirks[]) past count",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(
        hl7QuirkCorpus({
          seed: 1,
          count: 1,
          quirks: ["unknown-zsegment", as<Hl7QuirkName>(m)],
        }),
      ),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "ccdaQuirkCorpus(options.quirks[]) past count",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(
        ccdaQuirkCorpus({
          seed: 1,
          count: 1,
          quirks: ["deprecated-loinc", as<CcdaQuirkName>(m)],
        }),
      ),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "astmQuirkCorpus(options.quirks[]) past count",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(
        astmQuirkCorpus({ seed: 1, count: 1, quirks: ["unknown-escape", as<AstmQuirkName>(m)] }),
      ),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "hl7QuirkCorpus(options.profile.quirks[])",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(
        hl7QuirkCorpus({
          seed: 1,
          profile: defineSynthProfile({ name: "probe-profile", quirks: [m] }),
        }),
      ),
    }),
    expectCode: UNSUPPORTED_QUIRK,
  },

  // ---- the intended-warning self-check ----------------------------------------------------
  // Its third position, the quirk name, is absent from this table because the parameter is gone: it
  // existed only to be interpolated into the refusal, so it was deleted rather than bounded.
  {
    name: "assertIntendedWarnings(intendedWarnings[])",
    plant: (m) => () => {
      assertIntendedWarnings([m], []);
      return NO_RESULT;
    },
    expectCode: SYNTH_FATAL_CODES.SYNTH_INTENDED_WARNING_MISMATCH,
  },
  {
    name: "assertIntendedWarnings(bareWarnings[])",
    plant: (m) => () => {
      assertIntendedWarnings([], [m]);
      return NO_RESULT;
    },
    expectCode: SYNTH_FATAL_CODES.SYNTH_INTENDED_WARNING_MISMATCH,
  },

  // ---- the C-CDA quirk injector, both of its parameters -----------------------------------
  {
    name: "injectCcdaQuirk(quirk)",
    plant: (m) => () => {
      injectCcdaQuirk(asCcdaQuirk(m), ccdaArtifact.content);
      return NO_RESULT;
    },
    expectCode: UNSUPPORTED_QUIRK,
  },
  {
    name: "injectCcdaQuirk(cleanXml)",
    plant: (m) => () => {
      injectCcdaQuirk("deprecated-loinc", m);
      return NO_RESULT;
    },
    expectCode: SYNTH_FATAL_CODES.SYNTH_QUIRK_ANCHOR_ABSENT,
  },

  // ---- the two value-shaped fatals -------------------------------------------------------
  {
    name: "toBuildCode(concept.system)",
    plant: (m) => () => {
      toBuildCode({ system: m, code: "12345", display: "probe" });
      return NO_RESULT;
    },
    expectCode: SYNTH_FATAL_CODES.SYNTH_UNMAPPED_CODE_SYSTEM,
  },
  {
    name: "dec(value)",
    plant: (m) => () => {
      dec(m);
      return NO_RESULT;
    },
    expectCode: SYNTH_FATAL_CODES.SYNTH_INVALID_DECIMAL,
  },

  // ---- the selectors: every closed union a caller supplies, all of them erased at run time -
  // These are the positions the first pass of this suite missed, and the miss was not academic:
  // an unrecognised `documentType` used to travel into `@cosyte/ccda`'s `buildCcda`, which quotes it
  // back in its own `TypeError`, so a caller-supplied string reached an `err.message` and an
  // `err.stack` through a `@cosyte/synth` entry point. An unrecognised corpus mix entry used to
  // become an `Artifact.kind` and a `manifest.counts` key, which is a model identifier. Both now
  // resolve against their own set first.
  {
    name: "generateCcda(options.documentType)",
    plant: (m) => () => {
      generateCcda({ seed: 1, documentType: as<CcdaDocumentType>(m) });
      return NO_RESULT;
    },
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "generateCcdaQuirk(options.documentType)",
    plant: (m) => () => {
      generateCcdaQuirk({
        seed: 1,
        quirk: "deprecated-loinc",
        documentType: as<CcdaDocumentType>(m),
      });
      return NO_RESULT;
    },
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "ccdaCorpus(options.mix[])",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(ccdaCorpus({ seed: 1, mix: [as<CcdaCorpusKind>(m)] })),
    }),
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "ccdaQuirkCorpus(options.documentType)",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(
        ccdaQuirkCorpus({ seed: 1, documentType: as<CcdaDocumentType>(m) }),
      ),
    }),
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "hl7Corpus(options.mix[])",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(hl7Corpus({ seed: 1, mix: [as<Hl7MessageKind>(m)] })),
    }),
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "hl7Corpus(options.triggers[])",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(hl7Corpus({ seed: 1, triggers: [as<AdtTrigger>(m)] })),
    }),
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "generateHl7(kind)",
    plant: (m) => () => {
      generateHl7(as<Hl7MessageKind>(m), 1);
      return NO_RESULT;
    },
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "generateAdt(options.trigger)",
    plant: (m) => () => {
      generateAdt({ seed: 1, trigger: as<AdtTrigger>(m) });
      return NO_RESULT;
    },
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "generateHl7Quirk(options.kind)",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: quirkArtifactIdentifiers(
        generateHl7Quirk({ seed: 1, quirk: "unknown-zsegment", kind: as<Hl7QuirkKind>(m) }),
      ),
    }),
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "hl7QuirkCorpus(options.kind)",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(hl7QuirkCorpus({ seed: 1, kind: as<Hl7QuirkKind>(m) })),
    }),
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "x12Corpus(options.mix[])",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(x12Corpus({ seed: 1, mix: [as<X12CorpusKind>(m)] })),
    }),
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "generate837(variant)",
    plant: (m) => () => {
      generate837(as<Claim837Variant>(m), { seed: 1 });
      return NO_RESULT;
    },
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "ncpdpCorpus(options.mix[])",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(ncpdpCorpus({ seed: 1, mix: [as<NcpdpCorpusKind>(m)] })),
    }),
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "astmCorpus(options.mix[])",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(astmCorpus({ seed: 1, mix: [as<AstmCorpusKind>(m)] })),
    }),
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "generateAstmQuirk(options.kind)",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: quirkArtifactIdentifiers(
        generateAstmQuirk({ seed: 1, quirk: "unknown-escape", kind: as<AstmQuirkKind>(m) }),
      ),
    }),
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "fhirCorpus(options.mix[])",
    plant: (m) => () => ({
      diagnostics: [],
      identifiers: corpusIdentifiers(fhirCorpus({ seed: 1, mix: [as<FhirResourceKind>(m)] })),
    }),
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "generateBundle(options.type)",
    plant: (m) => () => {
      generateBundle({ seed: 1, type: as<FhirBundleType>(m) });
      return NO_RESULT;
    },
    expectCode: UNSUPPORTED_KIND,
  },
  {
    name: "generatePatient(options.profile)",
    plant: (m) => () => {
      generatePatient({ seed: 1, profile: as<"base" | "us-core">(m) });
      return NO_RESULT;
    },
    expectCode: UNSUPPORTED_KIND,
  },

  // ---- artifact.content: the layering check -----------------------------------------------
  // These three do **not** throw. They are the reason the table is not just a list of fatals:
  // a consumer's own bytes go out to a sibling parser and the verdict comes back, and what
  // `synth` keeps of that verdict must be **codes only** — never the parser's message, never a
  // snippet. Each artifact is spec-shaped enough to parse, with the marker spliced into a free
  // -text field, so the intended warning still fires and the reduction is genuinely exercised.
  {
    name: "hl7QuirkRoundTrip(artifact.content)",
    plant: (m) => () => {
      const result = hl7QuirkRoundTrip({ ...hl7Artifact, content: `${hl7Artifact.content}${m}` });
      return {
        diagnostics: codes(result.warnings),
        identifiers: quirkRoundTripIdentifiers(result),
      };
    },
    expectCode: "UNKNOWN_SEGMENT",
  },
  {
    name: "ccdaQuirkRoundTrip(artifact.content)",
    plant: (m) => () => {
      const result = ccdaQuirkRoundTrip({
        ...ccdaArtifact,
        content: ccdaArtifact.content.replace(
          "</ClinicalDocument>",
          `<!--${m}--></ClinicalDocument>`,
        ),
      });
      return {
        diagnostics: codes(result.warnings),
        identifiers: quirkRoundTripIdentifiers(result),
      };
    },
    expectCode: "DEPRECATED_LOINC",
  },
  {
    name: "astmQuirkRoundTrip(artifact.content)",
    plant: (m) => () => {
      const result = astmQuirkRoundTrip({
        ...astmArtifact,
        content: spliceIntoAstmComment(astmArtifact.content, m),
      });
      return {
        diagnostics: codes(result.warnings),
        identifiers: quirkRoundTripIdentifiers(result),
      };
    },
    expectCode: "ASTM_UNKNOWN_ESCAPE_SEQUENCE",
  },
];

describe("diagnostic surface — no consumer-controlled input reaches a diagnostic", () => {
  it("puts no consumer-controlled input on any diagnostic or derived identifier", () => {
    assertNoDiagnosticPhiLeak<Probe, ProbeResult>({
      slots: SLOTS,
      parse: (probe) => probe(),
      // A generator has no strict mode: every failure it can have is already fatal. See the note above.
      parseStrict: null,
      getDiagnostics: (result) => result.diagnostics,
      getModelIdentifiers: (result) => result.identifiers,
    });
  });
});

/** Every tracked TypeScript module under `src/`, walked rather than listed. */
function sourceFiles(): string[] {
  const root = join(fileURLToPath(new URL("../../", import.meta.url)), "src");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
    });
  const files = walk(root);
  // A scanner over an empty set passes vacuously; `src/` is never empty.
  expect(files.length).toBeGreaterThan(20);
  return files;
}

/** A built-in descriptor to clone when a probe needs a syntactically valid registry entry. */
function hl7Descriptor(): QuirkDescriptor {
  const descriptor = HL7_QUIRKS["unknown-zsegment"];
  if (descriptor === undefined) throw new Error("test fixture: HL7_QUIRKS lost unknown-zsegment");
  return descriptor;
}

/** Append a marker to the first ASTM comment record, leaving the stream parseable. */
function spliceIntoAstmComment(records: string, marker: string): string {
  const lines = records.split("\r");
  const index = lines.findIndex((line) => line.startsWith("C|"));
  if (index === -1) throw new Error("test fixture: the ASTM quirk base lost its C record");
  return lines.map((line, i) => (i === index ? `${line}${marker}` : line)).join("\r");
}

/**
 * The three raw-text harnesses (`astmRoundTrip`, `scriptRoundTrip`, `telecomRoundTrip`) take a
 * consumer's own bytes and, when those bytes are not a document at all, **re-throw the sibling
 * parser's fatal unchanged**. They are deliberately not slots above: `synth`'s own reduction (keep
 * `String(w.code)`, drop everything else) never runs on that path, so a slot there would assert
 * something about `@cosyte/astm` and `@cosyte/ncpdp` rather than about this package. What is in scope
 * is that `synth` adds nothing of its own to what it re-throws, and that the re-thrown fatal stays
 * branchable on a code — which is what this asserts, against the builds this repo vendors.
 */
describe("the raw-text harnesses re-throw a sibling fatal, adding nothing", () => {
  const marker = "ZqPhI7xK".repeat(64);
  const harnesses: readonly (readonly [string, (raw: string) => unknown])[] = [
    ["astmRoundTrip", astmRoundTrip],
    ["scriptRoundTrip", scriptRoundTrip],
    ["telecomRoundTrip", telecomRoundTrip],
  ];

  for (const [name, harness] of harnesses) {
    it(`${name} re-throws a coded fatal carrying no echo of its input`, () => {
      let thrown: unknown;
      try {
        harness(marker);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      const error = thrown as Error & { readonly code?: unknown };
      expect(typeof error.code).toBe("string");
      expect(error.message.toLowerCase()).not.toContain("zqphi7xk");
      expect(error).not.toBeInstanceOf(SynthError);
    });
  }
});

describe("the fatal message registry is the only source of a diagnostic message", () => {
  it("every code's message is identical to its frozen registry entry", () => {
    for (const code of Object.values(SYNTH_FATAL_CODES)) {
      expect(new SynthError(code).message).toBe(SYNTH_FATAL_MESSAGES[code]);
    }
  });

  it("every fatal code has a registry entry and every entry has a code", () => {
    expect(Object.keys(SYNTH_FATAL_MESSAGES).sort()).toStrictEqual(
      Object.values(SYNTH_FATAL_CODES).sort(),
    );
  });

  it("no registry message interpolates anything", () => {
    for (const message of Object.values(SYNTH_FATAL_MESSAGES)) {
      expect(message).not.toContain("${");
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("descriptors carry no `undefined` seams a message could have papered over", () => {
    for (const registry of [HL7_QUIRKS, CCDA_QUIRKS, ASTM_QUIRKS]) {
      for (const [key, descriptor] of Object.entries(registry)) {
        expect(descriptor.name).toBe(key);
      }
    }
  });

  /**
   * The registry is only the *only* source of a message if nothing in `src/` throws around it.
   *
   * **Read the title literally.** This is a regex over source text, so it asserts exactly that no
   * `throw new X` in `src/` names an `X` other than `SynthError`. It does not and cannot see a
   * `TypeError` the runtime raises on its own (an exhaustive `switch` over an erased union falling
   * through to `undefined` is the live example, which is why every such selector is now resolved
   * against its set), nor a fatal an optional peer parser raises on input `synth` forwarded to it.
   * Those two routes are covered by the slot table above and by the raw-text harness assertions,
   * respectively, and neither is covered here.
   */
  it("no `throw new` in src/ names anything but SynthError", () => {
    const detect = (source: string): string[] =>
      [...source.matchAll(/throw\s+new\s+([A-Za-z_$][\w$]*)/g)]
        .map((match) => match[1] ?? "")
        .filter((constructor) => constructor !== "SynthError");

    // Positive control, constructed rather than borrowed: a control that does not contain the thing
    // being hunted returns zero and proves nothing.
    expect(detect('throw new Error("x");')).toStrictEqual(["Error"]);
    expect(detect("throw new TypeError(m); throw new RangeError(m);")).toStrictEqual([
      "TypeError",
      "RangeError",
    ]);
    expect(detect("throw new SynthError(CODE);")).toStrictEqual([]);

    const offenders = sourceFiles().flatMap((file) => {
      const found = detect(readFileSync(file, "utf8"));
      return found.map((constructor) => `${file}: throw new ${constructor}`);
    });
    expect(offenders).toStrictEqual([]);
  });

  it("no src/ file interpolates into a SynthError construction", () => {
    // `SynthError` takes one argument by type, but a template literal reaching the call would be the
    // shape this change removes, so it is worth failing on the spelling as well as on the type.
    const offenders = sourceFiles().filter((file) =>
      /new\s+SynthError\([^)]*[`$]/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toStrictEqual([]);
  });

  /**
   * The model half, carried explicitly because the slot sweep cannot carry it (see note 3 in the file
   * header). Every identifier the three helpers yield over a real generation must come from a set
   * this package controls: the format labels, the corpus kind unions, the quirk registries, the
   * profile dispositions, or a parser warning code. A caller string reaching any of these would land
   * outside every one of those sets and outside the token shape a code has.
   */
  it("every identifier a real generation derives comes from a closed set", () => {
    const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/;
    const closed = new Set<string>([
      ...(["hl7v2", "fhir", "ccda", "x12", "ncpdp", "astm"] as const),
      ...Object.keys(HL7_QUIRKS),
      ...Object.keys(CCDA_QUIRKS),
      ...Object.keys(ASTM_QUIRKS),
      ...(["suppressed", "rebadged", "bare"] as const),
      "visage",
      "smartScorecard",
      "referenceCorpus",
    ]);
    // The corpus `kind` unions, spelled out so an added kind has to be added here too.
    const kinds = [
      "ADT^A01",
      "ADT^A04",
      "ADT^A08",
      "ORU^R01",
      "ORM^O01",
      "SIU^S12",
      "VXU^V04",
      "ccd",
      "referralNote",
      "837P",
      "837I",
      "837D",
      "835",
      "271",
      "NewRx",
      "RxRenewalRequest",
      "RxChangeRequest",
      "B1",
      "B2",
      "B3",
      "Result",
      "Order",
      "Patient",
      "USCorePatient",
      "Condition",
      "ObservationLab",
      "VitalSign",
      "MedicationRequest",
      "Encounter",
      "Immunization",
      "AllergyIntolerance",
      "Procedure",
      "DiagnosticReport",
      "Bundle",
      "DocumentBundle",
    ];
    for (const kind of kinds) closed.add(kind);
    // A quirk corpus labels an artifact `<kind>~<quirk>`, both halves already closed.
    for (const kind of kinds) {
      for (const quirk of [
        ...Object.keys(HL7_QUIRKS),
        ...Object.keys(CCDA_QUIRKS),
        ...Object.keys(ASTM_QUIRKS),
      ]) {
        closed.add(`${kind}~${quirk}`);
      }
    }

    const identifiers = [
      ...corpusIdentifiers(hl7Corpus({ seed: 7, count: 7 })),
      ...corpusIdentifiers(ccdaCorpus({ seed: 7, count: 2 })),
      ...corpusIdentifiers(x12Corpus({ seed: 7 })),
      ...corpusIdentifiers(ncpdpCorpus({ seed: 7 })),
      ...corpusIdentifiers(astmCorpus({ seed: 7 })),
      ...corpusIdentifiers(fhirCorpus({ seed: 7, count: 11 })),
      ...corpusIdentifiers(hl7QuirkCorpus({ seed: 7 })),
      ...corpusIdentifiers(ccdaQuirkCorpus({ seed: 7 })),
      ...corpusIdentifiers(astmQuirkCorpus({ seed: 7 })),
      ...quirkArtifactIdentifiers(hl7Artifact),
      ...quirkArtifactIdentifiers(ccdaArtifact),
      ...quirkArtifactIdentifiers(astmArtifact),
      ...quirkRoundTripIdentifiers(hl7QuirkRoundTrip(hl7Artifact)),
      ...quirkRoundTripIdentifiers(ccdaQuirkRoundTrip(ccdaArtifact)),
      ...quirkRoundTripIdentifiers(astmQuirkRoundTrip(astmArtifact)),
    ];
    // Non-vacuity: a helper that returned nothing would satisfy the loop below trivially.
    expect(identifiers.length).toBeGreaterThan(120);
    const outside = identifiers.filter((id) => !closed.has(id) && !CODE_SHAPE.test(id));
    expect(outside).toStrictEqual([]);
  });

  it("a corpus manifest derives only counts and a quirk set", () => {
    const corpus = makeCorpus(1, [
      { format: "hl7v2", kind: "ADT^A01", content: "x", warnings: [] },
    ]);
    expect(corpus.manifest.counts).toStrictEqual({ "ADT^A01": 1 });
    expect(corpusIdentifiers(corpus)).toContain("ADT^A01");
  });
});
