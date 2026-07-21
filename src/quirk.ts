/**
 * The **quirk core** (roadmap §6, §Phase 7 — the differentiator). Where the spec-clean generators prove
 * *synthetic-by-construction* through each parser's own builder, the quirk layer proves the mirror
 * property: a **deliberately off-spec** fixture round-trips to **exactly the intended parser warning
 * code(s)** — no more, no fewer. The quirk vocabulary **is the parsers' own profile systems**
 * (`hl7.defineProfile`, `ccda.defineCcdaProfile`, `astm.defineAstmProfile`): a quirk exercises exactly
 * the tolerance the corresponding parser profile encodes, so a quirk fixture is never a fiction — it
 * targets a documented, coded leniency (the **intended-warning contract**).
 *
 * This module is the **format-agnostic** part: the descriptor a quirk carries, the artifact a quirk
 * generator returns, the round-trip verdict shape, and the `SYNTH_UNSUPPORTED_QUIRK` fail-closed. Each
 * format's concrete quirk recipes + transforms live behind its own subpath (`@cosyte/synth/hl7`, …).
 *
 * @module
 */

import type { SynthFormat } from "./corpus.js";
import { SYNTH_FATAL_CODES, SynthError } from "./codes.js";
import type { SynthProfile } from "./profile.js";

/**
 * How the parser's matching profile treats a quirk once it is active — the three shapes the parsers'
 * profile systems actually exhibit (verified firsthand against each parser, roadmap §6):
 *
 * - `"suppressed"` — the profile makes the warning **disappear** (HL7 v2: a `defineProfile`
 *   `customSegments` claim suppresses `UNKNOWN_SEGMENT` for a declared Z-segment).
 * - `"rebadged"` — the profile **downgrades** the warning to the value-free `PROFILE_QUIRK_APPLIED`
 *   marker with `expected: true` (C-CDA `defineCcdaProfile` / ASTM `defineAstmProfile`
 *   `profileQuirkApplied`).
 * - `"bare"` — no shipped profile tolerates it; the quirk targets a real coded leniency a consumer can
 *   tolerate via their own `defineProfile`/`defineAstmProfile`, but no built-in re-badges it.
 */
export type QuirkProfileDisposition = "suppressed" | "rebadged" | "bare";

/**
 * The stable, value-free re-badge code the C-CDA and ASTM parsers emit when a profile tolerates a
 * quirk. HL7 v2 has no equivalent (it suppresses instead — see {@link QuirkProfileDisposition}).
 */
export const PROFILE_QUIRK_APPLIED = "PROFILE_QUIRK_APPLIED";

/**
 * A public, grounded description of one vendor quirk — the metadata that binds a quirk recipe to a real
 * parser warning code and a **publicly-groundable** deviation (ADR 0018: cited-public, never a private
 * vendor corpus).
 */
export interface QuirkDescriptor {
  /** The quirk recipe name (e.g. `"unknown-zsegment"`). Stable; part of the public contract. */
  readonly name: string;
  /** The format this quirk applies to. */
  readonly format: SynthFormat;
  /**
   * The **exact** parser warning code(s) a bare parse (no profile) surfaces for this quirk — the
   * intended-warning contract. A quirk that produces any other code, or none, is a generation bug.
   */
  readonly intendedWarnings: readonly string[];
  /**
   * The **public** grounding for this quirk — the spec clause or the parser's public profile that
   * documents the tolerance (ADR 0018). Never a private vendor-attributed corpus.
   */
  readonly grounding: string;
  /** The parser profile that tolerates this quirk (when a built-in public one exists). */
  readonly toleratingProfile?: string;
  /** How {@link toleratingProfile} treats the quirk. */
  readonly disposition: QuirkProfileDisposition;
}

/** One generated quirk artifact — the off-spec wire text plus the contract it is meant to satisfy. */
export interface QuirkArtifact {
  /** The format this artifact belongs to. */
  readonly format: SynthFormat;
  /** The quirk recipe applied. */
  readonly quirk: string;
  /** The underlying spec-clean message kind the quirk was injected into (e.g. `"ORU^R01"`). */
  readonly kind: string;
  /** The **quirked** wire text (deterministic in the seed + quirk). */
  readonly content: string;
  /** The exact parser warning code(s) this artifact is meant to round-trip to. */
  readonly intendedWarnings: readonly string[];
}

/** The verdict of a bare parse under the tolerating profile, if any. */
export interface QuirkProfiledVerdict {
  /** The profile applied. */
  readonly profileName: string;
  /** How the profile treats the quirk. */
  readonly disposition: QuirkProfileDisposition;
  /** The warning codes the parser emitted with the profile active. */
  readonly warnings: readonly string[];
  /**
   * `true` iff the profile handled the quirk as its disposition declares: `"suppressed"` ⇒ the intended
   * code is gone; `"rebadged"` ⇒ the intended code is gone and `PROFILE_QUIRK_APPLIED` is present.
   */
  readonly tolerated: boolean;
}

/** The verdict of round-tripping a quirk artifact through its parser (roadmap §6). */
export interface QuirkRoundTripResult {
  /** The quirked wire text that was parsed. */
  readonly content: string;
  /** The warning codes a **bare** parse (no profile) emitted. */
  readonly warnings: readonly string[];
  /** The exact code(s) the quirk is meant to produce. */
  readonly intendedWarnings: readonly string[];
  /**
   * `true` iff the bare parse produced **exactly** the intended code(s) — the intended-warning contract.
   */
  readonly intendedWarningHeld: boolean;
  /** The verdict under the tolerating profile, when a built-in public one exists. */
  readonly withProfile?: QuirkProfiledVerdict;
}

/**
 * Exact multiset (order-independent) equality of two code lists — the intended-warning comparison.
 *
 * @param a - The first code list.
 * @param b - The second code list.
 * @returns `true` iff the two lists contain the same codes with the same multiplicities.
 * @example
 * ```ts
 * import { sameCodeSet } from "@cosyte/synth";
 * sameCodeSet(["A", "B"], ["B", "A"]); // true
 * ```
 */
export function sameCodeSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const c of a) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const c of b) {
    const n = counts.get(c);
    if (n === undefined) return false;
    if (n === 1) counts.delete(c);
    else counts.set(c, n - 1);
  }
  return counts.size === 0;
}

/**
 * Resolve a requested quirk name against a format's registry, or **fail closed**. A quirk the format's
 * profile system does not support is a fatal `SYNTH_UNSUPPORTED_QUIRK` — never a silent no-op and never
 * a fabricated quirk with a made-up warning (roadmap §Phase 7 "Fail-safe behavior").
 *
 * @param registry - The format's quirk descriptors, keyed by name.
 * @param format - The format being generated (for the error message).
 * @param name - The requested quirk name.
 * @returns The matching {@link QuirkDescriptor}.
 * @throws SynthError with code `SYNTH_UNSUPPORTED_QUIRK` when `name` is not a supported quirk.
 * @example
 * ```ts
 * import { resolveQuirk } from "@cosyte/synth";
 * import { HL7_QUIRKS } from "@cosyte/synth/hl7";
 * resolveQuirk(HL7_QUIRKS, "hl7v2", "unknown-zsegment").intendedWarnings; // ["UNKNOWN_SEGMENT"]
 * ```
 */
export function resolveQuirk(
  registry: Readonly<Record<string, QuirkDescriptor>>,
  format: SynthFormat,
  name: string,
): QuirkDescriptor {
  const descriptor = registry[name];
  if (descriptor === undefined) {
    const supported = Object.keys(registry).sort().join(", ");
    throw new SynthError(
      SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_QUIRK,
      `${format}: unsupported quirk "${name}". The ${format} profile system supports: ${supported}.`,
    );
  }
  return descriptor;
}

/**
 * Evaluate whether a profiled parse tolerated a quirk as its disposition declares. Shared across the
 * formats so the "suppressed vs re-badged" logic lives in exactly one place.
 *
 * @param disposition - The quirk's declared profile disposition.
 * @param intendedWarnings - The bare-parse intended code(s).
 * @param warningsUnderProfile - The code(s) the parser emitted with the profile active.
 * @returns `true` iff the profile handled the quirk correctly for its disposition.
 * @example
 * ```ts
 * import { profileTolerated } from "@cosyte/synth";
 * profileTolerated("suppressed", ["UNKNOWN_SEGMENT"], []); // true — the profile suppressed it
 * ```
 */
export function profileTolerated(
  disposition: QuirkProfileDisposition,
  intendedWarnings: readonly string[],
  warningsUnderProfile: readonly string[],
): boolean {
  const stillHasIntended = intendedWarnings.some((c) => warningsUnderProfile.includes(c));
  switch (disposition) {
    case "suppressed":
      return !stillHasIntended;
    case "rebadged":
      return !stillHasIntended && warningsUnderProfile.includes(PROFILE_QUIRK_APPLIED);
    case "bare":
      return false;
  }
}

/**
 * Assert a freshly-generated quirk artifact **actually** round-trips to its intended warning(s), or
 * **fail closed**. This is the generator's self-check on the intended-warning contract (roadmap §6): a
 * fixture whose bare parse does not produce exactly the declared code(s) is a *mislabeled* fixture — a
 * golden file that lies about the parser verdict it anchors — and must never be emitted. It is a
 * stronger guard than "the transform changed some bytes": a transform can mutate the wrong element (a
 * template a given document type does not key its warning on) and still change bytes while producing no
 * warning. Every format's `generate*Quirk` calls this after transforming, so the contract is enforced at
 * generation time, not merely at round-trip time.
 *
 * @param quirk - The quirk name (for the error message).
 * @param intendedWarnings - The declared intended code(s).
 * @param bareWarnings - The code(s) a bare parse of the generated artifact actually produced.
 * @throws Error when the bare parse did not produce exactly the intended code(s).
 * @example
 * ```ts
 * import { assertIntendedWarnings } from "@cosyte/synth";
 * assertIntendedWarnings("unknown-zsegment", ["UNKNOWN_SEGMENT"], ["UNKNOWN_SEGMENT"]); // ok
 * ```
 */
export function assertIntendedWarnings(
  quirk: string,
  intendedWarnings: readonly string[],
  bareWarnings: readonly string[],
): void {
  if (!sameCodeSet(bareWarnings, intendedWarnings)) {
    throw new Error(
      `quirk "${quirk}": the intended-warning contract does not hold — expected exactly ` +
        `[${intendedWarnings.join(", ")}] but a bare parse produced [${bareWarnings.join(", ")}]. ` +
        `Refusing to emit a mislabeled fixture.`,
    );
  }
}

/**
 * Validate the quirk names carried by a {@link SynthProfile} against a format's registry, failing closed
 * on the first unsupported one. Lets a consumer author a fixture recipe with `defineSynthProfile` and
 * have its quirks checked against the *parser's* real tolerance before any fixture is generated (roadmap
 * §Phase 1 skeleton → §Phase 7 wiring).
 *
 * @param profile - The synth profile whose `quirks` to validate.
 * @param registry - The format's quirk descriptors.
 * @param format - The format being generated.
 * @returns The validated quirk names (the profile's, in order).
 * @throws SynthError `SYNTH_UNSUPPORTED_QUIRK` for the first unsupported quirk.
 * @example
 * ```ts
 * import { validateProfileQuirks, defineSynthProfile } from "@cosyte/synth";
 * import { HL7_QUIRKS } from "@cosyte/synth/hl7";
 * const p = defineSynthProfile({ name: "site", quirks: ["unknown-zsegment"] });
 * validateProfileQuirks(p, HL7_QUIRKS, "hl7v2"); // ["unknown-zsegment"]
 * ```
 */
export function validateProfileQuirks(
  profile: SynthProfile,
  registry: Readonly<Record<string, QuirkDescriptor>>,
  format: SynthFormat,
): readonly string[] {
  for (const name of profile.quirks) resolveQuirk(registry, format, name);
  return profile.quirks;
}
