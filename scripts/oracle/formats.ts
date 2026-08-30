/**
 * scripts/oracle/formats.ts
 *
 * THE SET OF FORMATS THIS LIBRARY ACTUALLY GENERATES, DERIVED RATHER THAN LISTED.
 *
 * The coverage declaration has to name every format the library generates and say, for each, whether
 * an independent grader passed a verdict on it. A hand-written list of six strings would be a second
 * lever on that declaration's own scope: add a seventh format and the list stays at six, the
 * declaration stays complete-looking, and the new format ships with nobody having said whether
 * anything grades it. So the set is derived, on every run, from the library's own behaviour.
 *
 * HOW IT IS DERIVED, in the same shape `scripts/check-test-selection.ts` derives its headline
 * subject, and for the same reason: the artifact is one that exists for its own reasons and is not
 * ours to quietly edit.
 *
 *   1. `package.json` `exports` gives the published subpaths.
 *   2. A format generator lives behind a FORMAT SUBPATH, never the root. That is this package's own
 *      documented boundary (`src/index.ts`: the root "exposes the format-agnostic core ... per-format
 *      generation lives behind its own subpath so importing the root never pulls a parser"), not a
 *      rule invented here. So the root `"."` and the structural `"./package.json"` entry are skipped
 *      because of what they ARE, and no format name is ever written down.
 *   3. Each remaining subpath's source module is imported, and every export whose name ends in
 *      `Corpus` is invoked with a fixed seed. The `format` on the artifacts that come back IS the
 *      format the library generates. `./deid` contributes nothing because it exports no corpus
 *      factory, again because of what it is rather than because it was named.
 *
 * WHY INVOKE RATHER THAN READ A NAME. `hl7Corpus` generates the format the library labels `hl7v2`.
 * Deriving the label from the subpath would have quietly renamed a format inside the declaration;
 * deriving it from a generated artifact cannot, because it is the same string the artifact carries.
 *
 * IT REFUSES RATHER THAN SKIPS. A subpath whose module cannot be imported, a `*Corpus` export that
 * is not callable, a call that throws, and a corpus that comes back empty are all THROWN, not
 * skipped. A subject that cannot be derived is not a subject that is absent: skipping would shrink
 * the declaration's scope in silence, which is the failure this derivation exists to prevent.
 *
 * This runs offline. It imports the library's own source and generates one artifact per factory; no
 * network and no external tool are involved, which is why `test/oracle/coverage.test.ts` can run it.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root, from this file's own location. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The `package.json` members this derivation reads. */
interface PackageManifest {
  readonly exports?: unknown;
}

/** True for a plain JSON object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Read `package.json` from the repository root. */
function readManifest(root: string): PackageManifest {
  const parsed: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (!isRecord(parsed)) {
    throw new Error("package.json did not parse to an object, so no published surface can be read");
  }
  return parsed;
}

/**
 * The published FORMAT subpaths: every `exports` key of the shape `./<name>` except the structural
 * `"./package.json"` entry, whose target is a bare data file rather than a built module.
 *
 * There is no exclusion list of format names, deliberately. The root and the manifest entry drop out
 * because of what they are: the root has no subpath name, and `"./package.json"` names no `dist/`
 * target. Anything else under `exports` is a candidate and is asked, not assumed.
 */
export function publishedSubpaths(root: string = REPO_ROOT): readonly string[] {
  const map = readManifest(root).exports;
  if (!isRecord(map)) {
    throw new Error(
      "package.json has no `exports` object, so the set of formats the library generates cannot " +
        "be derived. Refusing to fall back to a hand-written list: that is the lever this " +
        "derivation exists to remove.",
    );
  }
  const names: string[] = [];
  for (const [key, target] of Object.entries(map)) {
    if (key === "." || key === "./package.json") continue;
    if (!key.startsWith("./") || key.slice(2).includes("/")) {
      throw new Error(
        `exports["${key}"] is not a single-segment subpath, so this derivation cannot map it to a ` +
          "source module. Refusing rather than skipping it.",
      );
    }
    if (typeof target !== "object" && typeof target !== "string") {
      throw new Error(`exports["${key}"] has an unreadable target`);
    }
    names.push(key.slice(2));
  }
  if (names.length === 0) {
    throw new Error("package.json `exports` publishes no subpath, so no format can be derived");
  }
  return names.sort();
}

/**
 * The artifact list of something a corpus factory returned, narrowed without a cast: a corpus is an
 * object with an `artifacts` array of objects, and anything else is not one.
 */
function artifactsOf(value: unknown): readonly Record<string, unknown>[] | undefined {
  if (!isRecord(value)) return undefined;
  const artifacts = value["artifacts"];
  if (!Array.isArray(artifacts) || !artifacts.every(isRecord)) return undefined;
  return artifacts;
}

/** Every export of a module whose name ends in `Corpus`, paired with its name. */
function corpusFactories(
  module: Record<string, unknown>,
): ReadonlyArray<readonly [string, unknown]> {
  return Object.entries(module).filter(([name]) => name.endsWith("Corpus"));
}

/** The seed every derivation call uses. Any seed works; a fixed one keeps the run reproducible. */
const DERIVATION_SEED = 20260830;

/**
 * The set of formats the library actually generates, as the library labels them.
 *
 * @param root - The repository root. Defaults to this checkout.
 * @returns The format labels, sorted, derived from generated artifacts.
 * @throws Error when a published subpath cannot be imported, or a corpus factory cannot be run.
 * @example
 * ```ts
 * const formats = await generatedFormats();
 * formats.includes("hl7v2"); // true: derived from what hl7Corpus emits, not from the subpath name
 * ```
 */
export async function generatedFormats(root: string = REPO_ROOT): Promise<readonly string[]> {
  const formats = new Set<string>();

  for (const subpath of publishedSubpaths(root)) {
    const source = join(root, "src", subpath, "index.ts");
    let module: Record<string, unknown>;
    try {
      const imported: unknown = await import(source);
      if (!isRecord(imported)) throw new Error("the module namespace is not an object");
      module = imported;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `published subpath "./${subpath}" maps to ${source}, which could not be imported: ` +
          `${message}. A subject that cannot be derived is not a subject that is absent.`,
        { cause: error },
      );
    }

    for (const [name, value] of corpusFactories(module)) {
      if (typeof value !== "function") {
        throw new Error(
          `${source} exports \`${name}\`, which is corpus-shaped but not callable, so the formats ` +
            "it generates cannot be observed. Refusing rather than skipping it.",
        );
      }
      let corpus: unknown;
      try {
        const factory = value as (options: { seed: number; count: number }) => unknown;
        corpus = factory({ seed: DERIVATION_SEED, count: 1 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${source} exports \`${name}\`, which threw when asked for one artifact: ${message}. ` +
            "The set of generated formats cannot be derived while a factory refuses to run.",
          { cause: error },
        );
      }
      const artifacts = artifactsOf(corpus);
      if (artifacts === undefined) {
        throw new Error(`${source} export \`${name}\` did not return a corpus with artifacts`);
      }
      if (artifacts.length === 0) {
        throw new Error(
          `${source} export \`${name}\` returned an EMPTY corpus, so it names no format. A ` +
            "generator that produces nothing cannot be declared covered or uncovered.",
        );
      }
      for (const artifact of artifacts) {
        const label = artifact["format"];
        if (typeof label !== "string" || label.length === 0) {
          throw new Error(`${source} export \`${name}\` produced an artifact with no format label`);
        }
        formats.add(label);
      }
    }
  }

  if (formats.size === 0) {
    throw new Error(
      "no published subpath exports a corpus factory, so this library appears to generate nothing. " +
        "Refusing to build a coverage declaration over an empty set: it would be vacuously complete.",
    );
  }
  return [...formats].sort();
}
