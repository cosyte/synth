/**
 * HL7 v2 **vendor-quirk generation** (roadmap §Phase 7 — the differentiator). A quirk deviates the
 * *structure* of an otherwise spec-clean message so it round-trips through `@cosyte/hl7` to **exactly**
 * one intended, stable warning code — the tolerance a `defineProfile` profile encodes. The deviation is
 * applied **post-serialize** (roadmap §10 Q4: HL7 v2 profile tolerance is parse-side, so the quirk is a
 * deterministic transform of the parser's own conservative emit, never a hand-written message).
 *
 * Two publicly-groundable quirks ship (ADR 0018 — cited-public, never a private vendor corpus):
 *
 * - **`unknown-zsegment`** → `UNKNOWN_SEGMENT`. HL7 v2.x §2.5 permits site-defined `Z`-segments; a
 *   receiver with no profile flags them. `@cosyte/hl7`'s public imaging/PACS profiles (`visage`,
 *   `philips`, `va` — each grounded in a downloadable vendor/federal interface spec) declare `ZDS`, so a
 *   `defineProfile` that claims the segment **suppresses** the warning.
 * - **`unknown-escape`** → `UNKNOWN_ESCAPE_SEQUENCE`. HL7 v2.x §2.7 escaping — a locally-defined
 *   `\Z..\` escape is preserved verbatim and flagged. HL7 v2 has no re-badge mechanism, so this is a
 *   `"bare"` quirk (no built-in profile downgrades it).
 *
 * A quirk **never** introduces a real-looking value — it changes the message *shape*, never the
 * *provenance* of the data, so the synthetic-safety gate still runs and stays zero (roadmap §Phase 7
 * "Safety framing").
 *
 * @module
 */

import { parseHL7, profiles as hl7Profiles, type Hl7Message, type Profile } from "@cosyte/hl7";

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

import { generateAdt } from "./adt.js";
import { generateOru } from "./oru.js";
import { generateOrm } from "./orm.js";
import { generateSiu } from "./siu.js";
import { generateVxu } from "./vxu.js";

/** Every HL7 v2 quirk this phase ships. */
export type Hl7QuirkName = "unknown-zsegment" | "unknown-escape";

/** The HL7 v2 message families a quirk can be injected into (the spec-clean base). */
export type Hl7QuirkKind =
  | "ADT^A01"
  | "ADT^A04"
  | "ADT^A08"
  | "ORU^R01"
  | "ORM^O01"
  | "SIU^S12"
  | "VXU^V04";

/**
 * The HL7 v2 quirk registry — each recipe bound to the exact `@cosyte/hl7` warning code it targets and
 * its public grounding (roadmap §Phase 7).
 */
export const HL7_QUIRKS: Readonly<Record<Hl7QuirkName, QuirkDescriptor>> = Object.freeze({
  "unknown-zsegment": Object.freeze({
    name: "unknown-zsegment",
    format: "hl7v2",
    intendedWarnings: Object.freeze(["UNKNOWN_SEGMENT"]),
    grounding:
      "HL7 v2.x §2.5 site-defined Z-segments; grounded on @cosyte/hl7's public imaging/PACS profiles " +
      "(Visage 7 / Philips Vue PACS / VA Radiology interface specs) which declare the ZDS segment.",
    toleratingProfile: "visage",
    disposition: "suppressed",
  }),
  "unknown-escape": Object.freeze({
    name: "unknown-escape",
    format: "hl7v2",
    intendedWarnings: Object.freeze(["UNKNOWN_ESCAPE_SEQUENCE"]),
    grounding:
      "HL7 v2.x §2.7 escaping — a locally-defined \\Z..\\ escape is preserved verbatim and flagged. " +
      "HL7 v2 has no profile re-badge, so no built-in profile downgrades it.",
    disposition: "bare",
  }),
});

/** The tolerating HL7 profile object for a quirk (only the `unknown-zsegment` quirk has one). */
function toleratingProfile(quirk: Hl7QuirkName): Profile | undefined {
  return quirk === "unknown-zsegment" ? hl7Profiles.visage : undefined;
}

/** Split a serialized HL7 message into non-empty segment lines (tolerating any newline convention). */
function segmentsOf(wire: string): string[] {
  return wire.split(/\r\n|\r|\n/).filter((s) => s.length > 0);
}

/** The post-serialize transform for each quirk — a pure, deterministic function of the spec-clean wire. */
function applyQuirk(quirk: Hl7QuirkName, wire: string): string {
  const segments = segmentsOf(wire);
  switch (quirk) {
    case "unknown-zsegment":
      // A site-defined Z-segment carrying only clearly-synthetic, structural tokens (no PHI locus).
      return [...segments, "ZDS|1|SYNTHETIC-Z-SEGMENT^COSYTE-SYNTH"].join("\r");
    case "unknown-escape":
      // An NTE comment whose body carries a locally-defined \Zff\ escape — preserved verbatim on parse.
      return [...segments, "NTE|1||\\Zff\\"].join("\r");
  }
}

/** Options for {@link generateHl7Quirk}. */
export interface GenerateHl7QuirkOptions {
  /** The seed — the same seed + quirk yields a byte-identical message. Defaults to `0`. */
  readonly seed?: number;
  /** The quirk to inject. Required. */
  readonly quirk: Hl7QuirkName;
  /** The spec-clean base message family. Defaults to `"ORU^R01"`. */
  readonly kind?: Hl7QuirkKind;
}

/** Generate the spec-clean base message for a quirk kind. */
function baseMessage(kind: Hl7QuirkKind, seed: number): Hl7Message {
  switch (kind) {
    case "ADT^A01":
      return generateAdt({ seed, trigger: "A01" });
    case "ADT^A04":
      return generateAdt({ seed, trigger: "A04" });
    case "ADT^A08":
      return generateAdt({ seed, trigger: "A08" });
    case "ORU^R01":
      return generateOru({ seed });
    case "ORM^O01":
      return generateOrm({ seed });
    case "SIU^S12":
      return generateSiu({ seed });
    case "VXU^V04":
      return generateVxu({ seed });
  }
}

/**
 * Generate one HL7 v2 **quirk** artifact: a spec-clean message (built through `@cosyte/hl7`) with the
 * requested vendor deviation injected post-serialize. Deterministic in `seed` + `quirk` + `kind`.
 *
 * @param options - Seed, quirk, and base kind. See {@link GenerateHl7QuirkOptions}.
 * @returns The {@link QuirkArtifact} — its `content` round-trips to `intendedWarnings` exactly.
 * @throws SynthError `SYNTH_UNSUPPORTED_QUIRK` if `quirk` is not a supported HL7 quirk.
 * @example
 * ```ts
 * import { generateHl7Quirk, hl7QuirkRoundTrip } from "@cosyte/synth/hl7";
 * const artifact = generateHl7Quirk({ seed: 1, quirk: "unknown-zsegment" });
 * hl7QuirkRoundTrip(artifact).intendedWarningHeld; // true — exactly UNKNOWN_SEGMENT
 * ```
 */
export function generateHl7Quirk(options: GenerateHl7QuirkOptions): QuirkArtifact {
  const seed = options.seed ?? 0;
  const kind = options.kind ?? "ORU^R01";
  const descriptor = resolveQuirk(HL7_QUIRKS, "hl7v2", options.quirk);
  const content = applyQuirk(options.quirk, baseMessage(kind, seed).toString());
  // Self-check the intended-warning contract at generation time — never emit a mislabeled fixture.
  assertIntendedWarnings(
    descriptor.name,
    descriptor.intendedWarnings,
    parseHL7(content).warnings.map((w) => String(w.code)),
  );
  return Object.freeze({
    format: "hl7v2" as const,
    quirk: descriptor.name,
    kind,
    content,
    intendedWarnings: descriptor.intendedWarnings,
  });
}

/**
 * Round-trip an HL7 v2 quirk artifact through `@cosyte/hl7` and report the intended-warning verdict
 * (roadmap §6): a bare parse must produce **exactly** the intended code(s), and — when a built-in public
 * profile tolerates the quirk — the profiled parse must suppress it.
 *
 * @param artifact - The quirk artifact (from {@link generateHl7Quirk}).
 * @returns The {@link QuirkRoundTripResult}.
 * @example
 * ```ts
 * import { generateHl7Quirk, hl7QuirkRoundTrip } from "@cosyte/synth/hl7";
 * const rt = hl7QuirkRoundTrip(generateHl7Quirk({ seed: 1, quirk: "unknown-zsegment" }));
 * rt.withProfile?.tolerated; // true — the `visage` profile suppresses UNKNOWN_SEGMENT
 * ```
 */
export function hl7QuirkRoundTrip(artifact: QuirkArtifact): QuirkRoundTripResult {
  const quirk = artifact.quirk as Hl7QuirkName;
  const descriptor = resolveQuirk(HL7_QUIRKS, "hl7v2", quirk);
  const bare = parseHL7(artifact.content).warnings.map((w) => String(w.code));
  const profile = toleratingProfile(quirk);
  const withProfile =
    profile !== undefined && descriptor.toleratingProfile !== undefined
      ? {
          profileName: descriptor.toleratingProfile,
          disposition: descriptor.disposition,
          warnings: parseHL7(artifact.content, profile).warnings.map((w) => String(w.code)),
          tolerated: false,
        }
      : undefined;
  return {
    content: artifact.content,
    warnings: bare,
    intendedWarnings: artifact.intendedWarnings,
    intendedWarningHeld: sameCodeSet(bare, artifact.intendedWarnings),
    ...(withProfile
      ? {
          withProfile: {
            ...withProfile,
            tolerated: profileTolerated(
              descriptor.disposition,
              artifact.intendedWarnings,
              withProfile.warnings,
            ),
          },
        }
      : {}),
  };
}

/** Options for {@link hl7QuirkCorpus}. */
export interface Hl7QuirkCorpusOptions {
  /** The seed for the whole corpus (deterministic). */
  readonly seed: number;
  /** How many quirk artifacts to generate. Defaults to the number of quirks. */
  readonly count?: number;
  /** The quirk names to cycle through. Defaults to every HL7 quirk. Validated; unsupported ⇒ fatal. */
  readonly quirks?: readonly Hl7QuirkName[];
  /** A {@link SynthProfile} whose `quirks` drive the corpus (validated). Takes precedence over `quirks`. */
  readonly profile?: SynthProfile;
  /** The base message family each quirk is injected into. Defaults to `"ORU^R01"`. */
  readonly kind?: Hl7QuirkKind;
}

const ALL_HL7_QUIRKS: readonly Hl7QuirkName[] = Object.freeze(
  Object.keys(HL7_QUIRKS) as Hl7QuirkName[],
);

/**
 * Build a reproducible {@link Corpus} of HL7 v2 quirk artifacts. Each artifact's `warnings` record the
 * parser's verdict — the intended code(s) for its quirk (not empty: a quirk corpus is deliberately
 * off-spec) — and the manifest lists the applied quirk names.
 *
 * @param options - Seed, count, and the quirk selection. See {@link Hl7QuirkCorpusOptions}.
 * @returns A deep-frozen {@link Corpus}.
 * @example
 * ```ts
 * import { hl7QuirkCorpus } from "@cosyte/synth/hl7";
 * const corpus = hl7QuirkCorpus({ seed: 42 });
 * corpus.manifest.quirks; // ["unknown-zsegment", "unknown-escape"]
 * ```
 */
export function hl7QuirkCorpus(options: Hl7QuirkCorpusOptions): Corpus {
  const quirks: readonly string[] = options.profile
    ? validateProfileQuirks(options.profile, HL7_QUIRKS, "hl7v2")
    : (options.quirks ?? ALL_HL7_QUIRKS);
  const names = quirks.length > 0 ? quirks : ALL_HL7_QUIRKS;
  const kind = options.kind ?? "ORU^R01";
  const count = options.count ?? names.length;
  const seedStream = createRng(options.seed);
  const artifacts = Array.from({ length: count }, (_unused, i) => {
    const quirk = names[i % names.length] as Hl7QuirkName;
    const artifactSeed = seedStream.nextUint32();
    const artifact = generateHl7Quirk({ seed: artifactSeed, quirk, kind });
    return {
      format: "hl7v2" as const,
      kind: `${kind}~${quirk}`,
      content: artifact.content,
      warnings: artifact.intendedWarnings,
    };
  });
  return makeCorpus(options.seed, artifacts, [...new Set(names)]);
}

/**
 * A ready-made {@link SynthProfile} that requests every built-in HL7 quirk — a convenience for wiring
 * `defineSynthProfile`'s quirk list to the parser's real tolerance.
 *
 * @example
 * ```ts
 * import { hl7QuirkProfile, hl7QuirkCorpus } from "@cosyte/synth/hl7";
 * hl7QuirkCorpus({ seed: 1, profile: hl7QuirkProfile });
 * ```
 */
export const hl7QuirkProfile: SynthProfile = defineSynthProfile({
  name: "cosyte-hl7-quirks",
  quirks: [...ALL_HL7_QUIRKS],
});
