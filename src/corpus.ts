/**
 * The `Corpus` abstraction — a seed plus a self-describing manifest of what was generated, so a
 * fixture set is itself reproducible and regenerable (roadmap §2, §5). A downstream repo pins a seed
 * and gets a stable fixture set that regenerates identically.
 *
 * Generated artifacts and the `Corpus` are **deep-frozen** — this is where the archetype's immutability
 * invariant lives in a generator (roadmap §6): a consumer cannot mutate a shared fixture out from under
 * another test.
 *
 * @module
 */

/** The format an artifact was generated for. Extended as later phases add formats. */
export type SynthFormat = "hl7v2" | "fhir" | "ccda" | "x12" | "ncpdp";

/**
 * One generated artifact — the serialized wire text plus the metadata needed to reproduce and check
 * it. `warnings` records what the artifact's own parser reported on the round-trip (zero for a
 * spec-clean artifact — roadmap §6).
 */
export interface Artifact {
  /** The format this artifact belongs to. */
  readonly format: SynthFormat;
  /** A format-specific kind label (e.g. `"ADT^A01"`). */
  readonly kind: string;
  /** The serialized wire text, produced by the parser's own conservative serializer. */
  readonly content: string;
  /** The warning codes the parser emitted when the artifact was round-tripped (empty = spec-clean). */
  readonly warnings: readonly string[];
}

/** A self-describing manifest of a {@link Corpus}. */
export interface CorpusManifest {
  /** The formats present in the corpus. */
  readonly formats: readonly SynthFormat[];
  /** Per-kind artifact counts (e.g. `{ "ADT^A01": 3 }`). */
  readonly counts: Readonly<Record<string, number>>;
  /** The quirk names applied (empty until Phase 7). */
  readonly quirks: readonly string[];
}

/** A reproducible, self-describing set of generated artifacts. */
export interface Corpus {
  /** The seed the corpus was generated from — regenerating from it yields byte-identical artifacts. */
  readonly seed: number;
  /** The manifest describing what was generated. */
  readonly manifest: CorpusManifest;
  /** The generated artifacts, in generation order. */
  readonly artifacts: readonly Artifact[];
}

/**
 * Assemble a deep-frozen {@link Corpus} from a seed and its artifacts, deriving the manifest.
 *
 * @param seed - The seed the artifacts were generated from.
 * @param artifacts - The generated artifacts, in order.
 * @param quirks - The quirk names applied (default none).
 * @returns A deep-frozen, self-describing {@link Corpus}.
 * @example
 * ```ts
 * import { makeCorpus } from "@cosyte/synth";
 * const corpus = makeCorpus(1, [{ format: "hl7v2", kind: "ADT^A01", content, warnings: [] }]);
 * corpus.manifest.counts["ADT^A01"]; // 1
 * ```
 */
export function makeCorpus(
  seed: number,
  artifacts: readonly Artifact[],
  quirks: readonly string[] = [],
): Corpus {
  const counts: Record<string, number> = {};
  const formats = new Set<SynthFormat>();
  const frozenArtifacts = artifacts.map((a) => {
    counts[a.kind] = (counts[a.kind] ?? 0) + 1;
    formats.add(a.format);
    return Object.freeze({ ...a, warnings: Object.freeze([...a.warnings]) });
  });
  const manifest: CorpusManifest = Object.freeze({
    formats: Object.freeze([...formats]),
    counts: Object.freeze(counts),
    quirks: Object.freeze([...quirks]),
  });
  return Object.freeze({
    seed,
    manifest,
    artifacts: Object.freeze(frozenArtifacts),
  });
}
