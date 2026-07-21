/**
 * Thin helpers that build `@cosyte/hl7` `RawField` objects with **components** for `addSegment`.
 *
 * Why this exists: `Hl7Message.addSegment` accepts a field as either a plain string or a structured
 * `RawField`. A plain string is emitted **verbatim** — a literal `^` in it is escaped to `\S\`, not
 * treated as a component separator (the parser re-escapes on serialize, by design). To place true
 * components (a name's family/given, a CX's id/authority/type) we must hand `addSegment` a `RawField`
 * with explicit `components`, so the parser's own conservative serializer lays out the separators.
 * That is the whole point of building *through* the parser (roadmap §1).
 *
 * @module
 */

import type { RawField } from "@cosyte/hl7";

/**
 * Build a `RawField` from a flat list of component strings (single repetition, single subcomponent
 * per component). Empty strings become empty components (absent at the wire level).
 *
 * @param components - The component values, in HL7 component order.
 * @returns A `RawField` the hl7 serializer lays out with `^` separators.
 * @example
 * ```ts
 * import { componentsField } from "@cosyte/synth/hl7";
 * componentsField(["Testerson", "Quilliam"]); // family^given
 * ```
 */
export function componentsField(components: readonly string[]): RawField {
  return {
    repetitions: [{ components: components.map((c) => ({ subcomponents: [c] })) }],
    isNull: false,
  };
}
