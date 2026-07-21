/**
 * ASTM E1394 **vendor-quirk generation** (roadmap §Phase 7 — the differentiator). A quirk deviates the
 * *structure* of an otherwise spec-clean record report (built through `@cosyte/astm`'s
 * `buildAstmMessage`) so it round-trips through `parseAstmRecords` to **exactly** one intended, stable
 * warning code — a code in the parser's `defineAstmProfile` tolerable set. Where a built-in public
 * profile tolerates the quirk, the warning is **re-badged** to the value-free `PROFILE_QUIRK_APPLIED`
 * marker (`expected: true`), exactly as the parser's `profileQuirkApplied` does.
 *
 * The deviation is applied **post-serialize** on the record stream (roadmap §10 Q4). Two quirks ship:
 *
 * - **`unknown-escape`** → `ASTM_UNKNOWN_ESCAPE_SEQUENCE` (profile `referenceCorpus`). A non-standard
 *   `&Z&` escape body is injected into a result's units field. Grounded on `@cosyte/astm`'s public
 *   `referenceCorpus` profile (the redistributable kxepal/python-astm + senaite OSS corpus, ADR 0018),
 *   which re-badges it.
 * - **`unknown-record-type`** → `ASTM_RECORD_UNKNOWN_TYPE`. A record's leading type letter is changed to
 *   a site-defined `Z` — a real ASTM tolerance (the parser's tolerable set includes this code), but no
 *   built-in profile tolerates it, so it is a `"bare"` quirk (a consumer authors a `defineAstmProfile`
 *   to re-badge it).
 *
 * A quirk **never** introduces a real-looking value — it changes an escape body or a record type letter,
 * never a P-record identity locus, so the synthetic-safety gate still runs and stays zero.
 *
 * @module
 */

import { parseAstmRecords, astmProfiles, type AstmProfile } from "@cosyte/astm";

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

import { generateAstmResult } from "./message.js";

/** Every ASTM quirk this phase ships. */
export type AstmQuirkName = "unknown-escape" | "unknown-record-type";

/**
 * Both shipped ASTM quirks are **result-report** deviations — `unknown-escape` targets an `R` record's
 * units field and `unknown-record-type` a `C` (comment) record, neither of which an *order* report
 * carries. So the quirk base is always a result report (`generateAstmResult`).
 */
export type AstmQuirkKind = "Result";

/** The ASTM quirk registry — each recipe bound to the exact `@cosyte/astm` warning code it targets. */
export const ASTM_QUIRKS: Readonly<Record<AstmQuirkName, QuirkDescriptor>> = Object.freeze({
  "unknown-escape": Object.freeze({
    name: "unknown-escape",
    format: "astm",
    intendedWarnings: Object.freeze(["ASTM_UNKNOWN_ESCAPE_SEQUENCE"]),
    grounding:
      "ASTM E1394 escape delimiter (&); a non-standard &Z& body is preserved verbatim and flagged. " +
      "Re-badged by @cosyte/astm's public `referenceCorpus` profile (kxepal/python-astm + senaite OSS).",
    toleratingProfile: "referenceCorpus",
    disposition: "rebadged",
  }),
  "unknown-record-type": Object.freeze({
    name: "unknown-record-type",
    format: "astm",
    intendedWarnings: Object.freeze(["ASTM_RECORD_UNKNOWN_TYPE"]),
    grounding:
      "ASTM E1394 permits manufacturer/site-defined record types; a Z record is surfaced as unsupported. " +
      "A tolerable code (in the parser's defineAstmProfile allow-list) — a consumer authors a profile to " +
      "re-badge it; no built-in public profile does.",
    disposition: "bare",
  }),
});

/** The tolerating ASTM profile object for a quirk, when a built-in public one exists. */
function toleratingProfile(quirk: AstmQuirkName): AstmProfile | undefined {
  return quirk === "unknown-escape" ? astmProfiles.referenceCorpus : undefined;
}

/** The E1394 record separator. */
const CR = "\r";

/** The post-serialize transform for each quirk — a pure, deterministic function of the clean record stream. */
function applyQuirk(quirk: AstmQuirkName, records: string): string {
  const lines = records.split(CR);
  switch (quirk) {
    case "unknown-escape": {
      // Inject a non-standard &Z& escape into the units field (field 5, index 4) of the first R record.
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line !== undefined && line.startsWith("R|")) {
          const fields = line.split("|");
          const units = fields[4];
          if (units !== undefined && units.length > 0) {
            fields[4] = `&Z&${units}`;
            lines[i] = fields.join("|");
            return lines.join(CR);
          }
        }
      }
      return records;
    }
    case "unknown-record-type": {
      // Change the first comment (C) record's leading type letter to a site-defined Z.
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line !== undefined && line.startsWith("C|")) {
          lines[i] = `Z${line.slice(1)}`;
          return lines.join(CR);
        }
      }
      return records;
    }
  }
}

/** Options for {@link generateAstmQuirk}. */
export interface GenerateAstmQuirkOptions {
  /** The seed — the same seed + quirk yields a byte-identical record stream. Defaults to `0`. */
  readonly seed?: number;
  /** The quirk to inject. Required. */
  readonly quirk: AstmQuirkName;
  /** The spec-clean base report kind. Always `"Result"` (see {@link AstmQuirkKind}). */
  readonly kind?: AstmQuirkKind;
}

/**
 * Generate one ASTM **quirk** artifact: a spec-clean record report (built through `@cosyte/astm`) with
 * the requested vendor deviation injected post-serialize. Deterministic in `seed` + `quirk` + `kind`.
 *
 * @param options - Seed, quirk, and base kind. See {@link GenerateAstmQuirkOptions}.
 * @returns The {@link QuirkArtifact} — its `content` round-trips to `intendedWarnings` exactly.
 * @throws SynthError `SYNTH_UNSUPPORTED_QUIRK` if `quirk` is not a supported ASTM quirk.
 * @throws Error if the base report does not contain the structural anchor the quirk targets.
 * @example
 * ```ts
 * import { generateAstmQuirk, astmQuirkRoundTrip } from "@cosyte/synth/astm";
 * const rt = astmQuirkRoundTrip(generateAstmQuirk({ seed: 1, quirk: "unknown-escape" }));
 * rt.withProfile?.tolerated; // true — `referenceCorpus` re-badges ASTM_UNKNOWN_ESCAPE_SEQUENCE
 * ```
 */
export function generateAstmQuirk(options: GenerateAstmQuirkOptions): QuirkArtifact {
  const seed = options.seed ?? 0;
  const kind: AstmQuirkKind = "Result";
  const descriptor = resolveQuirk(ASTM_QUIRKS, "astm", options.quirk);
  const clean = generateAstmResult({ seed });
  const content = applyQuirk(options.quirk, clean);
  if (content === clean) {
    throw new Error(
      `generateAstmQuirk: quirk "${options.quirk}" found no structural anchor in a ${kind} report at ` +
        `seed ${seed} — refusing to emit a fixture that does not carry the intended deviation.`,
    );
  }
  // Self-check the intended-warning contract at generation time — never emit a mislabeled fixture.
  assertIntendedWarnings(
    descriptor.name,
    descriptor.intendedWarnings,
    parseAstmRecords(content).warnings.map((w) => String(w.code)),
  );
  return Object.freeze({
    format: "astm" as const,
    quirk: descriptor.name,
    kind,
    content,
    intendedWarnings: descriptor.intendedWarnings,
  });
}

/**
 * Round-trip an ASTM quirk artifact through `@cosyte/astm` and report the intended-warning verdict
 * (roadmap §6): a bare parse must produce **exactly** the intended code, and — when a built-in public
 * profile tolerates the quirk — the profiled parse must re-badge it to `PROFILE_QUIRK_APPLIED`.
 *
 * @param artifact - The quirk artifact (from {@link generateAstmQuirk}).
 * @returns The {@link QuirkRoundTripResult}.
 * @example
 * ```ts
 * import { generateAstmQuirk, astmQuirkRoundTrip } from "@cosyte/synth/astm";
 * astmQuirkRoundTrip(generateAstmQuirk({ seed: 1, quirk: "unknown-escape" })).intendedWarningHeld;
 * ```
 */
export function astmQuirkRoundTrip(artifact: QuirkArtifact): QuirkRoundTripResult {
  const quirk = artifact.quirk as AstmQuirkName;
  const descriptor = resolveQuirk(ASTM_QUIRKS, "astm", quirk);
  const bare = parseAstmRecords(artifact.content).warnings.map((w) => String(w.code));
  const profile = toleratingProfile(quirk);
  const withProfile =
    profile !== undefined && descriptor.toleratingProfile !== undefined
      ? (() => {
          const warnings = parseAstmRecords(artifact.content, { profile }).warnings.map((w) =>
            String(w.code),
          );
          return {
            profileName: descriptor.toleratingProfile,
            disposition: descriptor.disposition,
            warnings,
            tolerated: profileTolerated(
              descriptor.disposition,
              artifact.intendedWarnings,
              warnings,
            ),
          };
        })()
      : undefined;
  return {
    content: artifact.content,
    warnings: bare,
    intendedWarnings: artifact.intendedWarnings,
    intendedWarningHeld: sameCodeSet(bare, artifact.intendedWarnings),
    ...(withProfile ? { withProfile } : {}),
  };
}

/** Options for {@link astmQuirkCorpus}. */
export interface AstmQuirkCorpusOptions {
  /** The seed for the whole corpus (deterministic). */
  readonly seed: number;
  /** How many quirk artifacts to generate. Defaults to the number of quirks. */
  readonly count?: number;
  /** The quirk names to cycle through. Defaults to every ASTM quirk. Validated; unsupported ⇒ fatal. */
  readonly quirks?: readonly AstmQuirkName[];
  /** A {@link SynthProfile} whose `quirks` drive the corpus (validated). Takes precedence over `quirks`. */
  readonly profile?: SynthProfile;
}

const ALL_ASTM_QUIRKS: readonly AstmQuirkName[] = Object.freeze(
  Object.keys(ASTM_QUIRKS) as AstmQuirkName[],
);

/**
 * Build a reproducible {@link Corpus} of ASTM quirk artifacts. Each artifact's `warnings` record the
 * intended code for its quirk; the manifest lists the applied quirk names.
 *
 * @param options - Seed, count, and the quirk selection. See {@link AstmQuirkCorpusOptions}.
 * @returns A deep-frozen {@link Corpus}.
 * @example
 * ```ts
 * import { astmQuirkCorpus } from "@cosyte/synth/astm";
 * astmQuirkCorpus({ seed: 42 }).manifest.quirks; // the applied quirk names
 * ```
 */
export function astmQuirkCorpus(options: AstmQuirkCorpusOptions): Corpus {
  const quirks: readonly string[] = options.profile
    ? validateProfileQuirks(options.profile, ASTM_QUIRKS, "astm")
    : (options.quirks ?? ALL_ASTM_QUIRKS);
  const names = quirks.length > 0 ? quirks : ALL_ASTM_QUIRKS;
  const count = options.count ?? names.length;
  const seedStream = createRng(options.seed);
  const artifacts = Array.from({ length: count }, (_unused, i) => {
    const quirk = names[i % names.length] as AstmQuirkName;
    const artifactSeed = seedStream.nextUint32();
    const artifact = generateAstmQuirk({ seed: artifactSeed, quirk });
    return {
      format: "astm" as const,
      kind: `Result~${quirk}`,
      content: artifact.content,
      warnings: artifact.intendedWarnings,
    };
  });
  return makeCorpus(options.seed, artifacts, [...new Set(names)]);
}

/** A ready-made {@link SynthProfile} requesting every built-in ASTM quirk. */
export const astmQuirkProfile: SynthProfile = defineSynthProfile({
  name: "cosyte-astm-quirks",
  quirks: [...ALL_ASTM_QUIRKS],
});
