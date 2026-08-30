/**
 * scripts/determinism/corpus.ts
 *
 * THE DECLARED SEED CORPUS, AND THE DIGEST TAKEN OVER IT.
 *
 * WHAT IS DIGESTED. For each (format, seed) pair the declaration names, the format's own spec-clean
 * corpus factory generates a fixed number of artifacts and their CONTENT is hashed, in order, with
 * a length prefix in front of every artifact. Nothing else enters the hash: not the kind, not the
 * warning set, not a path and not a clock. A digest that is not a pure function of the generated
 * bytes is this harness's bug, not a finding about the library, and the length framing is what
 * makes the concatenation injective, so two corpora cannot collide by joining differently.
 *
 * WHY THE FORMAT SET IS NOT IN THE DECLARATION. A hand-written list of six format names would be a
 * second, one-line lever on this gate's scope: add a seventh format and the list stays at six, the
 * declaration stays complete-looking, and the new format ships with nothing comparing it across
 * engines. So the registry below (which has to exist, because a digest needs a FUNCTION and not a
 * name) is RECONCILED, on every run, against the set of formats the library actually generates,
 * derived by `scripts/oracle/formats.ts` from the published surface. The two must be equal in both
 * directions. Reusing that derivation rather than writing a second one is deliberate: two
 * derivations of "what does this library generate" would be two things to keep true.
 *
 * NARROWING IS ONLY EVER IN THE OPEN. Taking a pair out of the graded set means writing an
 * `exclusions` entry naming it and saying why, and the entry is published in every report. An
 * exclusion that matches no declared pair is an ERROR rather than a no-op, exactly as a stale
 * `phi-scan` override is: an operator who believes a bypass is in effect when it is not is worse
 * off than one with no bypass at all. There is no tolerance on a digest, no warning-only mode and
 * no suppression list, deliberately.
 */

import { createHash } from "node:crypto";

import { hl7Corpus } from "../../src/hl7/index.js";
import { fhirCorpus } from "../../src/fhir/index.js";
import { ccdaCorpus } from "../../src/ccda/index.js";
import { x12Corpus } from "../../src/x12/index.js";
import { ncpdpCorpus } from "../../src/ncpdp/index.js";
import { astmCorpus } from "../../src/astm/index.js";

import type { DeterminismPolicy, ExclusionDeclaration } from "./policy.js";

/** The hash a digest is taken with. Carried in every report so two reports cannot silently differ. */
export const DIGEST_ALGORITHM = "sha256";

/**
 * The framing version. It goes into the hash so that a change to HOW artifacts are joined moves
 * every digest visibly, through the same breaking-change route a change to the bytes takes, rather
 * than looking like a change in the library's output.
 */
const DIGEST_FRAMING = "cosyte-synth-determinism/1";

/** What a corpus factory hands back, narrowed to the members this file reads. */
export interface GeneratedCorpus {
  /** The generated artifacts, in generation order. */
  readonly artifacts: readonly { readonly format: string; readonly content: string }[];
}

/** A corpus factory: `{ seed, count }` in, a corpus out. Every format ships one. */
export type CorpusFactory = (options: {
  readonly seed: number;
  readonly count: number;
}) => GeneratedCorpus;

/**
 * The six spec-clean corpus factories, keyed by the format label their artifacts carry.
 *
 * These are the same six the consolidated property suite drives. This registry names FUNCTIONS,
 * which a declaration file cannot; it is not a second declaration, and `reconcileRegistry` below
 * refuses when it and the library disagree in either direction.
 */
export const SPEC_CLEAN_FACTORIES: ReadonlyMap<string, CorpusFactory> = new Map<
  string,
  CorpusFactory
>([
  ["hl7v2", hl7Corpus],
  ["fhir", fhirCorpus],
  ["ccda", ccdaCorpus],
  ["x12", x12Corpus],
  ["ncpdp", ncpdpCorpus],
  ["astm", astmCorpus],
]);

/** One member of the declared corpus. */
export interface CorpusPair {
  /** The format label. */
  readonly format: string;
  /** The seed it is generated from. */
  readonly seed: number;
}

/** A stable, readable identity for one pair. Used as a map key and in every diagnostic. */
export const pairKey = (format: string, seed: number): string => `${format}/seed-${String(seed)}`;

/** The declared corpus: what is compared, and what is declared and deliberately not. */
export interface DeclaredCorpus {
  /** Pairs whose digests are compared. */
  readonly graded: readonly CorpusPair[];
  /** Pairs declared and taken out, each with its reason. */
  readonly excluded: readonly ExclusionDeclaration[];
}

/**
 * Reconcile the factory registry against the formats the library actually generates.
 *
 * @param generated - The format labels the library emits, derived from its published surface.
 * @param registry - The factory registry. Defaults to the six spec-clean factories.
 * @returns Every problem found, empty when the two agree.
 * @example
 * ```ts
 * reconcileRegistry(["astm", "ccda", "fhir", "hl7v2", "ncpdp", "x12"]); // []
 * ```
 */
export function reconcileRegistry(
  generated: readonly string[],
  registry: ReadonlyMap<string, CorpusFactory> = SPEC_CLEAN_FACTORIES,
): readonly string[] {
  const problems: string[] = [];
  for (const format of generated) {
    if (!registry.has(format)) {
      problems.push(
        `this library generates the format "${format}" and the cross-engine determinism corpus ` +
          "has no factory for it, so nothing compares it across engines. A format does not get " +
          "to ship without being in this comparison; narrowing is done by naming an excluded " +
          "(format, seed) pair and its reason, never by leaving a format out.",
      );
    }
  }
  for (const format of registry.keys()) {
    if (!generated.includes(format)) {
      problems.push(
        `the cross-engine determinism corpus names the format "${format}", which this library ` +
          "does not generate. Refusing rather than skipping it: a corpus that names artifacts " +
          "nobody produces is a corpus whose size means nothing.",
      );
    }
  }
  return problems;
}

/**
 * Build the declared corpus from the policy and the reconciled format registry.
 *
 * @param policy - The committed declaration.
 * @param generated - The format labels the library emits.
 * @param registry - The factory registry. Defaults to the six spec-clean factories.
 * @returns The graded pairs and the declared exclusions.
 * @throws Error when the registry and the library disagree, when an exclusion names a pair that is
 *   not declared, or when every declared pair has been excluded.
 * @example
 * ```ts
 * const corpus = declareCorpus(readPolicy(), await generatedFormats());
 * corpus.graded.length; // 24
 * ```
 */
export function declareCorpus(
  policy: DeterminismPolicy,
  generated: readonly string[],
  registry: ReadonlyMap<string, CorpusFactory> = SPEC_CLEAN_FACTORIES,
): DeclaredCorpus {
  const problems = reconcileRegistry(generated, registry);
  if (problems.length > 0) {
    throw new Error(
      `the cross-engine determinism corpus does not account for every format this library ` +
        `generates:\n  - ${problems.join("\n  - ")}`,
    );
  }

  const declared: CorpusPair[] = [];
  for (const format of [...registry.keys()].sort()) {
    for (const seed of policy.seeds) declared.push({ format, seed });
  }

  const excludedKeys = new Set<string>();
  for (const exclusion of policy.exclusions) {
    const key = pairKey(exclusion.format, exclusion.seed);
    if (!declared.some((pair) => pairKey(pair.format, pair.seed) === key)) {
      throw new Error(
        `the declaration excludes ${key}, which is not a declared (format, seed) pair. A stale ` +
          "exclusion is an error rather than a no-op: it leaves an operator believing a pair is " +
          "out of the comparison when it never was in it.",
      );
    }
    if (excludedKeys.has(key)) {
      throw new Error(`the declaration excludes ${key} twice`);
    }
    excludedKeys.add(key);
  }

  const graded = declared.filter((pair) => !excludedKeys.has(pairKey(pair.format, pair.seed)));
  if (graded.length === 0) {
    throw new Error(
      "every declared (format, seed) pair has been excluded, so the corpus is empty. A comparison " +
        "with nothing to compare is refused here rather than allowed to report a pass over " +
        "nothing; if the honest corpus really covers no format, that is a stop, not a green run.",
    );
  }

  return { graded, excluded: policy.exclusions };
}

/**
 * The digest of one corpus's artifact contents.
 *
 * The framing tag and the artifact count go in first, then every artifact as its own byte length in
 * decimal, a colon, and its UTF-8 bytes. The length prefix is what makes the join injective: two
 * different corpora cannot hash the same by being concatenated differently.
 *
 * @param contents - The artifact contents, in generation order.
 * @returns The lower-case hex digest.
 * @example
 * ```ts
 * digestContents(["MSH|^~\\&|"]).length; // 64
 * ```
 */
export function digestContents(contents: readonly string[]): string {
  const hash = createHash(DIGEST_ALGORITHM);
  hash.update(`${DIGEST_FRAMING}:${String(contents.length)}:`, "utf8");
  for (const content of contents) {
    const bytes = Buffer.from(content, "utf8");
    hash.update(`${String(bytes.byteLength)}:`, "utf8");
    hash.update(bytes);
  }
  return hash.digest("hex");
}

/** One digested pair: the identity, and the digest of the bytes it produced. */
export interface DigestEntry {
  /** The format label. */
  readonly format: string;
  /** The seed. */
  readonly seed: number;
  /** The lower-case hex digest of this pair's generated bytes. */
  readonly digest: string;
}

/**
 * Generate and digest every graded pair.
 *
 * @param corpus - The declared corpus.
 * @param artifactsPerPair - How many artifacts each pair generates.
 * @param registry - The factory registry. Defaults to the six spec-clean factories.
 * @returns One entry per graded pair, in declaration order.
 * @throws Error when a declared format has no factory, or a factory produces nothing.
 * @example
 * ```ts
 * const entries = digestDeclaredCorpus(corpus, 3);
 * entries[0]?.digest.length; // 64
 * ```
 */
export function digestDeclaredCorpus(
  corpus: DeclaredCorpus,
  artifactsPerPair: number,
  registry: ReadonlyMap<string, CorpusFactory> = SPEC_CLEAN_FACTORIES,
): readonly DigestEntry[] {
  const entries: DigestEntry[] = [];
  for (const pair of corpus.graded) {
    const factory = registry.get(pair.format);
    if (factory === undefined) {
      throw new Error(
        `the declared corpus names the format "${pair.format}", which has no factory`,
      );
    }
    const generated = factory({ seed: pair.seed, count: artifactsPerPair });
    if (generated.artifacts.length === 0) {
      throw new Error(
        `${pairKey(pair.format, pair.seed)} generated no artifact, so there are no bytes to ` +
          "digest. Refusing rather than recording a digest of nothing, which would agree across " +
          "every engine while proving nothing at all.",
      );
    }
    entries.push({
      format: pair.format,
      seed: pair.seed,
      digest: digestContents(generated.artifacts.map((artifact) => artifact.content)),
    });
  }
  return entries;
}
