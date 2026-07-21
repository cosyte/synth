/**
 * The **round-trip-through-the-parser harness** for C-CDA — the headline gate for the synthetic-fixture
 * generator (roadmap §6). A generated document is "spec-clean" only if `@cosyte/ccda` — not
 * `@cosyte/synth`'s own opinion — reads it back cleanly. This harness serializes a generated document,
 * parses it straight back through `parseCcda`, and reports what the parser found, so a false
 * "spec-clean" claim cannot hide (roadmap §4.5, the first head of the two-headed hazard).
 *
 * `@cosyte/ccda`'s `buildCcda` is round-trip-by-construction (it emits through the same DOM the parser
 * reads), so a clean build carries zero warnings — but this harness re-verifies that *independently*,
 * against the parser, because the parser is the judge.
 *
 * @module
 */

import { parseCcda, serializeCcda, type CcdaDocument } from "@cosyte/ccda";

/** The verdict of one round-trip through `@cosyte/ccda`. */
export interface RoundTripResult {
  /** The serialized C-CDA XML (the builder/serializer's own conservative emit). */
  readonly content: string;
  /** The warning codes the parser emitted on re-parse. Empty ⇒ spec-clean. */
  readonly warnings: readonly string[];
  /** Whether re-serializing the re-parsed document is byte-identical to `content`. */
  readonly byteStable: boolean;
  /** `true` iff the artifact is spec-clean: zero warnings **and** byte-stable. */
  readonly specClean: boolean;
}

/**
 * Round-trip a generated `@cosyte/ccda` `CcdaDocument` through serialize → parse → serialize and report
 * the verdict. A spec-clean document re-parses with **zero warnings** and re-serializes byte-identically.
 *
 * @param doc - The document to check (typically from {@link ./ccd.generateCcd}).
 * @returns The {@link RoundTripResult}.
 * @example
 * ```ts
 * import { generateCcd, roundTrip } from "@cosyte/synth/ccda";
 * const { specClean, warnings } = roundTrip(generateCcd({ seed: 1 }));
 * // specClean === true, warnings.length === 0
 * ```
 */
export function roundTrip(doc: CcdaDocument): RoundTripResult {
  const content = serializeCcda(doc);
  const reparsed = parseCcda(content);
  const warnings = reparsed.warnings.map((w) => String(w.code));
  const byteStable = serializeCcda(reparsed) === content;
  return {
    content,
    warnings,
    byteStable,
    specClean: warnings.length === 0 && byteStable,
  };
}
