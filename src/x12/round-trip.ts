/**
 * The **round-trip-through-the-parser harness** for X12 — the headline gate for the synthetic-fixture
 * generator (roadmap §6). A generated interchange is "spec-clean" only if `@cosyte/x12` — not
 * `@cosyte/synth`'s own opinion — reads it back cleanly. This harness serializes a built interchange,
 * parses it straight back through `parseX12`, and reports what the parser found, so a false
 * "spec-clean" claim cannot hide (roadmap §4.5, the first head of the two-headed hazard).
 *
 * `@cosyte/x12`'s domain builders (`build837P`, `build835`, `build271`) are round-trip-by-construction
 * (each maps its typed model to segments and computes the ISA/GS/ST…SE/GE/IEA envelope + counts), but
 * this harness re-verifies that **independently**, against the parser, because the parser is the judge.
 *
 * @module
 */

import { parseX12, serializeX12, type X12Interchange } from "@cosyte/x12";

/** The verdict of one round-trip through `@cosyte/x12`. */
export interface RoundTripResult {
  /** The serialized X12 EDI (the builder/serializer's own conservative emit). */
  readonly content: string;
  /** The warning codes the parser emitted on re-parse. Empty ⇒ spec-clean. */
  readonly warnings: readonly string[];
  /** Whether re-serializing the re-parsed interchange is byte-identical to `content`. */
  readonly byteStable: boolean;
  /** `true` iff the artifact is spec-clean: zero warnings **and** byte-stable. */
  readonly specClean: boolean;
}

/**
 * Round-trip a built `@cosyte/x12` `X12Interchange` through serialize → parse → serialize and report
 * the verdict. A spec-clean interchange re-parses with **zero warnings** and re-serializes
 * byte-identically.
 *
 * @param interchange - The interchange to check (typically from a `generate837P` / `generate835` /
 *   `generate271`).
 * @returns The {@link RoundTripResult}.
 * @example
 * ```ts
 * import { generate837P, roundTrip } from "@cosyte/synth/x12";
 * const { specClean, warnings } = roundTrip(generate837P({ seed: 1 }));
 * // specClean === true, warnings.length === 0
 * ```
 */
export function roundTrip(interchange: X12Interchange): RoundTripResult {
  const content = serializeX12(interchange);
  const reparsed = parseX12(content);
  const warnings = reparsed.warnings.map((w) => String(w.code));
  const byteStable = serializeX12(reparsed) === content;
  return {
    content,
    warnings,
    byteStable,
    specClean: warnings.length === 0 && byteStable,
  };
}
