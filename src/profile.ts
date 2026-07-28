/**
 * `defineSynthProfile` — the growth-loop hook for site/vendor fixture recipes. A profile bundles the
 * value pools and the quirk recipe a fixture set should use, authored through the same public API as
 * the built-ins: a validated, frozen `SynthProfile` carrying a name, optional value overrides, and the
 * quirk names a format's quirk corpus should apply.
 *
 * @module
 */

/** The user-authored spec passed to {@link defineSynthProfile}. */
export interface SynthProfileSpec {
  /** A stable, human-readable profile name (e.g. `"acme-hospital"`). Required, non-empty. */
  readonly name: string;
  /** Optional given-name pool override (clearly-synthetic names only — see the safety invariant). */
  readonly givenNames?: readonly string[];
  /** Optional family-name pool override (clearly-synthetic names only). */
  readonly familyNames?: readonly string[];
  /**
   * The vendor quirk recipe names this profile requests. Validated against the target format's quirk
   * registry when the profile drives a quirk corpus (an unsupported quirk is a fatal
   * `SYNTH_UNSUPPORTED_QUIRK`, never a silent no-op).
   */
  readonly quirks?: readonly string[];
}

/** A frozen, validated fixture recipe produced by {@link defineSynthProfile}. */
export interface SynthProfile {
  /** The profile name. */
  readonly name: string;
  /** The given-name pool this profile draws from (overrides or the built-in default). */
  readonly givenNames?: readonly string[];
  /** The family-name pool this profile draws from. */
  readonly familyNames?: readonly string[];
  /** The requested quirk recipe names. */
  readonly quirks: readonly string[];
}

/**
 * Define a reusable, frozen synthetic-fixture profile.
 *
 * @param spec - The profile spec; `name` is required and non-empty.
 * @returns A deep-frozen {@link SynthProfile}.
 * @throws TypeError when `name` is missing or blank.
 * @example
 * ```ts
 * import { defineSynthProfile } from "@cosyte/synth";
 * const acme = defineSynthProfile({ name: "acme-hospital", quirks: [] });
 * ```
 */
export function defineSynthProfile(spec: SynthProfileSpec): SynthProfile {
  if (typeof spec.name !== "string" || spec.name.trim().length === 0) {
    throw new TypeError("defineSynthProfile: `name` is required and must be a non-empty string.");
  }
  return Object.freeze({
    name: spec.name,
    ...(spec.givenNames ? { givenNames: Object.freeze([...spec.givenNames]) } : {}),
    ...(spec.familyNames ? { familyNames: Object.freeze([...spec.familyNames]) } : {}),
    quirks: Object.freeze([...(spec.quirks ?? [])]),
  });
}
