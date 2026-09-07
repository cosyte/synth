/**
 * scripts/determinism/compare.ts
 *
 * THE CROSS-ENGINE COMPARISON: PASS OR FAIL, AND WHY.
 *
 * This is the whole decision the gate makes, written as a PURE FUNCTION over a set of digest
 * reports, for one reason: THE MULTI-ENGINE CONDITION EXISTS ONLY IN CI. There is one Node install
 * in a development session, so nobody, ever, can watch two engines disagree on their own machine.
 * A gate whose behaviour can only be observed where it runs is a gate nobody can test, so every
 * decision below is driven offline in `test/determinism/cross-engine.test.ts` against reports
 * committed as HAND-AUTHORED FIXTURES. They are fixtures, not captured matrix runs, and the files
 * say so in their own text.
 *
 * WHAT IT DECIDES, and every one of these is a way a comparison can be green while comparing
 * nothing, which is the failure mode a gate like this actually has:
 *
 *   * AGREEMENT           every declared engine reported the same digest for every declared pair.
 *                         The pass records WHICH engines it compared and HOW MANY pairs, because an
 *                         OK without its denominator is how a narrowing goes quiet.
 *   * MISMATCH            two engines disagree. Named by seed, format and both engine identities,
 *                         and by nothing else: no bytes, no digests, no artifact content. The
 *                         corpus is reproducible from the seed, so a reader can put both sides in
 *                         front of themselves without the job.
 *   * MISSING REPORT      an engine in the declared set filed nothing. FAIL, and deliberately NOT a
 *                         pass over the engines that did report: a comparison over a partial set is
 *                         the one that reports green on the day an engine's job silently stopped
 *                         running.
 *   * UNREADABLE REPORT   present but not JSON, truncated, the wrong shape, filed under the wrong
 *                         engine, or covering a different (format, seed) set than the declaration.
 *                         FAIL, naming that report. An unreadable report is NEVER agreement.
 *   * NOTHING TO COMPARE  an empty declared corpus, or fewer than two distinct engines. FAIL. A
 *                         comparison that compared nothing never reports a pass.
 *
 * THE RESULT TYPE IS A DISCRIMINATED UNION ON PURPOSE. There is no shape in which a failing
 * comparison can carry a list of engines it "passed over": the pass arm is the only one with
 * `engines` and `pairs` on it, so a partial pass cannot be expressed, let alone printed.
 */

import { pairKey, type CorpusPair } from "./corpus.js";
import { engineId, parseReport, type DigestReport } from "./report.js";

/** Where one engine's report came from, or why there is none. */
export type ReportSource =
  | {
      readonly kind: "text";
      /** How to name this report in a diagnostic, usually its path. */
      readonly label: string;
      /** The report text, exactly as it arrived. */
      readonly text: string;
    }
  | {
      readonly kind: "absent";
      /** How to name the report that is not here. */
      readonly label: string;
      /** Why it is not here. */
      readonly detail: string;
    };

/** Everything the comparison is given. */
export interface ComparisonInput {
  /** The declared supported Node majors. */
  readonly declaredEngines: readonly number[];
  /** The declared, graded (format, seed) pairs. */
  readonly declaredPairs: readonly CorpusPair[];
  /** One source per engine the run went looking for, keyed by Node major. */
  readonly sources: ReadonlyMap<number, ReportSource>;
}

/** A comparison that agreed, and the denominator it agreed over. */
export interface ComparisonPass {
  readonly status: "pass";
  /** The engine identities that were compared. */
  readonly engines: readonly string[];
  /** How many (format, seed) pairs were compared. */
  readonly pairs: number;
  /** The exclusions the reports published, republished here so a narrowing is never quiet. */
  readonly excluded: readonly string[];
}

/** A comparison that did not agree, or could not be made. */
export interface ComparisonFail {
  readonly status: "fail";
  /** Every problem found, all of them, in one run. */
  readonly failures: readonly string[];
}

/** The comparison's verdict. */
export type ComparisonResult = ComparisonPass | ComparisonFail;

/** The pair keys a report covers. */
const coveredKeys = (report: DigestReport): Set<string> =>
  new Set(report.entries.map((entry) => pairKey(entry.format, entry.seed)));

/**
 * Compare the per-engine digest reports.
 *
 * @param input - The declared engines, the declared pairs, and one source per engine.
 * @returns A pass carrying the engines and pair count compared, or a fail carrying every problem.
 * @example
 * ```ts
 * const result = compareEngines({ declaredEngines: [22, 24], declaredPairs, sources });
 * result.status; // "pass" when every engine agreed on every pair
 * ```
 */
export function compareEngines(input: ComparisonInput): ComparisonResult {
  const failures: string[] = [];
  const declared = [...new Set(input.declaredEngines)].sort((a, b) => a - b);

  if (input.declaredPairs.length === 0) {
    failures.push(
      "the declared corpus contains no (format, seed) pair, so this comparison would compare " +
        "nothing. A run with nothing to compare fails rather than reporting a pass over nothing.",
    );
  }
  if (declared.length < 2) {
    failures.push(
      `${String(declared.length)} distinct engine identity/identities were supplied for ` +
        "comparison. Two runs cannot disagree about the engine they run on unless there are two " +
        "engines, so a comparison over fewer than two fails rather than passing vacuously.",
    );
  }

  for (const major of input.sources.keys()) {
    if (!declared.includes(major)) {
      failures.push(
        `a digest report was supplied for ${engineId(major)}, which is not in the declared ` +
          "supported-engine set. Refusing rather than comparing it: the set being compared is the " +
          "set that was declared, or the declaration means nothing.",
      );
    }
  }

  const declaredKeys = new Set(input.declaredPairs.map((pair) => pairKey(pair.format, pair.seed)));
  const reports = new Map<number, DigestReport>();

  for (const major of declared) {
    const identity = engineId(major);
    const source = input.sources.get(major);

    if (source === undefined) {
      failures.push(
        `no digest report was supplied for ${identity}, which is in the declared ` +
          "supported-engine set. This comparison FAILS rather than passing over the engines that " +
          "did report: a green run over a partial set is exactly how an engine's job going " +
          "missing stays invisible.",
      );
      continue;
    }
    if (source.kind === "absent") {
      failures.push(
        `the digest report for ${identity} (${source.label}) is missing: ${source.detail}. An ` +
          "absent report is never read as agreement.",
      );
      continue;
    }

    const read = parseReport(source.text);
    if (!read.ok) {
      failures.push(
        `the digest report for ${identity} (${source.label}) ${read.error}. An unreadable report ` +
          "is never read as agreement.",
      );
      continue;
    }
    const report = read.report;

    if (report.engine.id !== identity) {
      failures.push(
        `the digest report at ${source.label} was collected for ${identity} and declares itself ` +
          `produced by ${report.engine.id}. Refusing rather than trusting either name.`,
      );
      continue;
    }

    const covered = coveredKeys(report);
    const missing = [...declaredKeys].filter((key) => !covered.has(key)).sort();
    const extra = [...covered].filter((key) => !declaredKeys.has(key)).sort();
    if (missing.length > 0 || extra.length > 0) {
      const parts: string[] = [];
      if (missing.length > 0) parts.push(`does not cover ${missing.join(", ")}`);
      if (extra.length > 0) parts.push(`covers undeclared ${extra.join(", ")}`);
      failures.push(
        `the digest report for ${identity} (${source.label}) ${parts.join(" and ")}, so it is a ` +
          "report about a different corpus than the declared one and cannot be compared against " +
          "the others.",
      );
      continue;
    }

    reports.set(major, report);
  }

  // The reports must also agree about HOW they were taken. Two engines that hashed different
  // corpora with different algorithms would otherwise "disagree" for a reason that is not the
  // library's, and the diagnostic would blame the wrong thing.
  const reference = reports.get(declared[0] ?? -1);
  if (reference !== undefined) {
    for (const [major, report] of reports) {
      if (report.digestAlgorithm !== reference.digestAlgorithm) {
        failures.push(
          `${engineId(major)} took its digests with ${report.digestAlgorithm} and ` +
            `${reference.engine.id} used ${reference.digestAlgorithm}, so the two reports are not ` +
            "comparable.",
        );
      }
      if (report.artifactsPerPair !== reference.artifactsPerPair) {
        failures.push(
          `${engineId(major)} generated ${String(report.artifactsPerPair)} artifact(s) per pair ` +
            `and ${reference.engine.id} generated ${String(reference.artifactsPerPair)}, so the ` +
            "two reports are about different corpora.",
        );
      }
      if (report.package.window !== reference.package.window) {
        failures.push(
          `${engineId(major)} reports compatibility window ${report.package.window} and ` +
            `${reference.engine.id} reports ${reference.package.window}, so the two jobs did not ` +
            "build the same tree.",
        );
      }
    }
  }

  if (failures.length > 0) return { status: "fail", failures };

  // Every declared engine parsed and covers exactly the declared corpus. Now the actual question.
  for (const pair of input.declaredPairs) {
    const key = pairKey(pair.format, pair.seed);
    const digests = new Map<number, string>();
    for (const [major, report] of reports) {
      const entry = report.entries.find((e) => pairKey(e.format, e.seed) === key);
      if (entry !== undefined) digests.set(major, entry.digest);
    }
    const referenceMajor = declared[0];
    if (referenceMajor === undefined) continue;
    const referenceDigest = digests.get(referenceMajor);
    if (referenceDigest === undefined) continue;
    for (const [major, digest] of digests) {
      if (major === referenceMajor || digest === referenceDigest) continue;
      failures.push(
        `${pair.format} seed ${String(pair.seed)}: ${engineId(referenceMajor)} and ` +
          `${engineId(major)} did not produce byte-identical artifacts. The seed-to-bytes mapping ` +
          "is not the same on those two engines.",
      );
    }
  }

  if (failures.length > 0) return { status: "fail", failures };

  const excluded = [
    ...new Set(
      [...reports.values()].flatMap((report) =>
        report.excluded.map((item) => `${pairKey(item.format, item.seed)}: ${item.reason}`),
      ),
    ),
  ].sort();

  return {
    status: "pass",
    engines: declared.map(engineId),
    pairs: input.declaredPairs.length,
    excluded,
  };
}

/**
 * Render a comparison result for a build log.
 *
 * @param result - The verdict.
 * @returns The text to print.
 * @example
 * ```ts
 * renderComparison({ status: "pass", engines: ["node-22"], pairs: 1, excluded: [] });
 * ```
 */
export function renderComparison(result: ComparisonResult): string {
  if (result.status === "pass") {
    const lines = [
      "determinism: PASS",
      `  engines compared : ${result.engines.join(", ")}`,
      `  pairs compared   : ${String(result.pairs)} (format, seed) pair(s), byte-identical on ` +
        "every engine above",
    ];
    if (result.excluded.length > 0) {
      lines.push(
        `  declared exclusions (NOT counted toward this pass): ${result.excluded.join("; ")}`,
      );
    }
    return lines.join("\n");
  }
  return [
    `determinism: FAIL (${String(result.failures.length)} problem(s))`,
    ...result.failures.map((failure) => `  - ${failure}`),
  ].join("\n\n");
}
