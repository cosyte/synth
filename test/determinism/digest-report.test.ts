/**
 * THE PER-ENGINE DIGEST REPORT: WHAT IT CARRIES, WHAT IT MAY NEVER CARRY, AND WHAT HAPPENS WHEN IT
 * CANNOT BE WRITTEN.
 *
 * A report is the only thing that leaves a digest job, so three properties of it are load-bearing:
 *
 *   * IT COVERS THE DECLARED CORPUS EXACTLY, one digest per (format, seed) pair, and it names the
 *     engine that produced it. A report that cannot say which engine it came from is worthless to a
 *     comparison, and one that covers a different corpus cannot be compared at all.
 *   * IT CARRIES NO GENERATED ARTIFACT CONTENT. `pnpm phi-scan` with no arguments reads every
 *     tracked file, so a baseline or a report carrying artifact bytes would put generated fixture
 *     content into a permanently tracked file to buy nothing the comparison needs. This suite
 *     generates the real corpora and asserts their bytes are absent from the report, rather than
 *     asserting the shape and hoping.
 *   * IT FAILS LOUDLY WHEN IT CANNOT BE WRITTEN. "The destination was not writable" and "the run
 *     produced no report" must never be the same observation, because the second one is what an
 *     exit code of 0 with an empty artifact directory looks like.
 *
 * AND THE ONE WAY THE CORPUS MAY BE NARROWED: a named (format, seed) exclusion carrying a reason,
 * declared in a committed file, never counted toward a pass, and never expressed as tolerating a
 * digest difference.
 */

import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  baselineFromReport,
  compareToBaseline,
  parseBaseline,
  readBaseline,
} from "../../scripts/determinism/baseline.js";
import {
  declareCorpus,
  digestContents,
  digestDeclaredCorpus,
  DIGEST_ALGORITHM,
  SPEC_CLEAN_FACTORIES,
  type DeclaredCorpus,
} from "../../scripts/determinism/corpus.js";
import { validatePolicy, type DeterminismPolicy } from "../../scripts/determinism/policy.js";
import {
  buildReport,
  currentEngine,
  parseReport,
  renderReport,
  reportFileName,
  writeReport,
} from "../../scripts/determinism/report.js";

/** The six format labels the library generates, as `generatedFormats()` derives them at run time. */
const GENERATED = ["astm", "ccda", "fhir", "hl7v2", "ncpdp", "x12"];

/** A small policy, so the suite is about the report and not about generating a full corpus. */
const policy = (overrides: Partial<DeterminismPolicy> = {}): DeterminismPolicy => ({
  engines: [22, 24],
  seeds: [1001],
  artifactsPerPair: 2,
  exclusions: [],
  ...overrides,
});

/** Everywhere this suite wrote, cleaned up whatever happened. */
const scratchDirs: string[] = [];
const scratch = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "synth-determinism-"));
  scratchDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of scratchDirs) {
    chmodSync(dir, 0o700);
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A report over two real, generated pairs, plus the content that went into it. */
function reportOverRealArtifacts(): { rendered: string; contents: string[] } {
  const corpus: DeclaredCorpus = {
    graded: [
      { format: "hl7v2", seed: 1001 },
      { format: "astm", seed: 1001 },
    ],
    excluded: [],
  };
  const contents: string[] = [];
  for (const pair of corpus.graded) {
    const factory = SPEC_CLEAN_FACTORIES.get(pair.format);
    expect(factory, pair.format).toBeDefined();
    if (factory === undefined) continue;
    for (const artifact of factory({ seed: pair.seed, count: 2 }).artifacts) {
      contents.push(artifact.content);
    }
  }
  const report = buildReport({
    engine: currentEngine(),
    packageName: "@cosyte/synth",
    packageVersion: "0.0.0",
    window: "0.x",
    digestAlgorithm: DIGEST_ALGORITHM,
    artifactsPerPair: 2,
    entries: digestDeclaredCorpus(corpus, 2),
    excluded: [],
  });
  return { rendered: renderReport(report), contents };
}

describe("a report carries one digest per declared pair and the engine that produced it", () => {
  it("covers exactly the declared graded pairs, in declaration order", () => {
    const corpus = declareCorpus(policy(), GENERATED);
    const entries = digestDeclaredCorpus(corpus, 2);
    expect(entries).toHaveLength(corpus.graded.length);
    expect(entries.map((entry) => `${entry.format}/${String(entry.seed)}`)).toEqual(
      corpus.graded.map((pair) => `${pair.format}/${String(pair.seed)}`),
    );
    for (const entry of entries) expect(entry.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("names the producing engine, and the report round-trips through its own parser", () => {
    const { rendered } = reportOverRealArtifacts();
    const read = parseReport(rendered);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.report.engine.id).toBe(currentEngine().id);
    expect(read.report.engine.nodeVersion).toBe(process.version);
    expect(read.report.entries).toHaveLength(2);
  });

  it("files a report under a name derived from the engine, so a slot cannot be guessed at", () => {
    expect(reportFileName(22)).toBe("node-22.json");
    expect(reportFileName(24)).toBe("node-24.json");
  });

  it("digests the generated bytes and nothing else, with an injective framing", () => {
    // The length prefix is what stops two different corpora hashing the same by being joined
    // differently. Without it, ["ab"] and ["a", "b"] would be the same stream.
    expect(digestContents(["ab"])).not.toBe(digestContents(["a", "b"]));
    expect(digestContents(["a", "b"])).toBe(digestContents(["a", "b"]));
    expect(digestContents([])).not.toBe(digestContents([""]));
  });
});

describe("a report carries NO generated artifact content", () => {
  it("holds none of the bytes of the artifacts it digested", () => {
    const { rendered, contents } = reportOverRealArtifacts();
    expect(contents.length).toBeGreaterThan(0);
    for (const content of contents) {
      expect(content.length).toBeGreaterThan(0);
      expect(rendered).not.toContain(content);
      // Not just the whole artifact: no meaningful slice of one either.
      const slice = content.slice(0, Math.min(40, content.length));
      expect(rendered, `report quotes ${JSON.stringify(slice)}`).not.toContain(slice);
    }
  });

  it("holds no wire marker from any of the six formats", () => {
    const { rendered } = reportOverRealArtifacts();
    for (const marker of ["MSH|", "resourceType", "<ClinicalDocument", "ISA*", "<Message", "H|"]) {
      expect(rendered, marker).not.toContain(marker);
    }
  });
});

describe("a report that cannot be written is a failed run, not a quiet one", () => {
  it("fails naming the destination when the directory does not exist, and writes nothing", () => {
    const { rendered } = reportOverRealArtifacts();
    const read = parseReport(rendered);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    const destination = join(scratch(), "no-such-directory", "node-22.json");
    expect(() => {
      writeReport(destination, read.report);
    }).toThrow(destination);
    expect(existsSync(destination)).toBe(false);
  });

  it("fails naming the destination when permission is denied, and writes nothing", () => {
    const { rendered } = reportOverRealArtifacts();
    const read = parseReport(rendered);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    const dir = scratch();
    chmodSync(dir, 0o500);
    const destination = join(dir, "node-22.json");
    expect(() => {
      writeReport(destination, read.report);
    }).toThrow(destination);
    expect(existsSync(destination)).toBe(false);
  });

  it("writes the report when the destination is writable", () => {
    const { rendered } = reportOverRealArtifacts();
    const read = parseReport(rendered);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    const destination = join(scratch(), "node-22.json");
    writeReport(destination, read.report);
    expect(parseReport(readFileSync(destination, "utf8")).ok).toBe(true);
  });
});

describe("an exclusion is named, reasoned, and never counted toward a pass", () => {
  const excluded = { format: "ccda", seed: 1001, reason: "under investigation, filed separately" };

  it("takes the named pair out of the graded set and publishes it with its reason", () => {
    const corpus = declareCorpus(policy({ exclusions: [excluded] }), GENERATED);
    expect(corpus.graded.some((pair) => pair.format === "ccda")).toBe(false);
    expect(corpus.excluded).toEqual([excluded]);

    const report = buildReport({
      engine: currentEngine(),
      packageName: "@cosyte/synth",
      packageVersion: "0.0.0",
      window: "0.x",
      digestAlgorithm: DIGEST_ALGORITHM,
      artifactsPerPair: 2,
      entries: [],
      excluded: corpus.excluded,
    });
    expect(report.excluded[0]?.reason).toBe(excluded.reason);
    // It is OUT of the comparison, not tolerated inside it: no entry names it.
    expect(report.entries.some((entry) => entry.format === "ccda")).toBe(false);
  });

  it("refuses an exclusion with no reason, so a bare pair name can never remove one", () => {
    expect(() =>
      validatePolicy(
        {
          engines: [22, 24],
          corpus: { artifactsPerPair: 2, seeds: [1001] },
          exclusions: [{ format: "ccda", seed: 1001 }],
        },
        "inline",
      ),
    ).toThrow(/reason/);
    expect(() =>
      validatePolicy(
        {
          engines: [22, 24],
          corpus: { artifactsPerPair: 2, seeds: [1001] },
          exclusions: [{ format: "ccda", seed: 1001, reason: "   " }],
        },
        "inline",
      ),
    ).toThrow(/reason/);
  });

  it("refuses a stale exclusion, so a bypass that removes nothing is an error and not a no-op", () => {
    expect(() =>
      declareCorpus(policy({ exclusions: [{ ...excluded, seed: 999999 }] }), GENERATED),
    ).toThrow(/not a declared/);
  });

  it("refuses when every declared pair has been excluded", () => {
    const all = [...SPEC_CLEAN_FACTORIES.keys()].map((format) => ({
      format,
      seed: 1001,
      reason: "excluded for this test",
    }));
    expect(() => declareCorpus(policy({ exclusions: all }), GENERATED)).toThrow(/empty/);
  });

  it("refuses when the library generates a format the corpus has no factory for", () => {
    expect(() => declareCorpus(policy(), [...GENERATED, "dicom"])).toThrow(/dicom/);
  });

  it("refuses when the corpus names a format the library does not generate", () => {
    expect(() =>
      declareCorpus(
        policy(),
        GENERATED.filter((format) => format !== "ncpdp"),
      ),
    ).toThrow(/ncpdp/);
  });
});

describe("the committed declaration is well formed", () => {
  it("is the declaration this repository actually ships", () => {
    const committed: unknown = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "..", "..", "scripts", "determinism", "determinism-policy.json"),
        "utf8",
      ),
    );
    const validated = validatePolicy(committed, "the committed declaration");
    expect(validated.engines.length).toBeGreaterThanOrEqual(2);
    expect(validated.seeds.length).toBeGreaterThan(0);
    expect(validated.artifactsPerPair).toBeGreaterThan(0);
  });

  it("refuses a declaration with no seeds, so an empty corpus never reaches the comparison", () => {
    expect(() =>
      validatePolicy(
        { engines: [22, 24], corpus: { artifactsPerPair: 2, seeds: [] }, exclusions: [] },
        "inline",
      ),
    ).toThrow(/no seeds/);
  });

  it("refuses a declaration with no exclusions array at all", () => {
    expect(() =>
      validatePolicy({ engines: [22, 24], corpus: { artifactsPerPair: 2, seeds: [1] } }, "inline"),
    ).toThrow(/exclusions/);
  });
});

describe("the committed baseline catches a mapping that moved on EVERY engine at once", () => {
  // The cross-engine comparison is blind to this by construction: a toolchain or dependency change
  // upgrades every job together, every engine agrees, and the golden file a consumer committed
  // stops matching with nothing red anywhere. The baseline is the only thing that sees it.
  const report = () => {
    const read = parseReport(reportOverRealArtifacts().rendered);
    expect(read.ok).toBe(true);
    if (!read.ok) throw new Error("the report this suite just built did not parse");
    return read.report;
  };

  it("passes when every digest matches", () => {
    const current = report();
    expect(compareToBaseline(current, baselineFromReport(current))).toEqual([]);
  });

  it("fails naming the pair when one digest moved, and quotes no bytes", () => {
    const current = report();
    const frozen = baselineFromReport(current);
    const moved = {
      ...frozen,
      entries: frozen.entries.map((entry, index) =>
        index === 0 ? { ...entry, digest: "0".repeat(64) } : entry,
      ),
    };
    const failures = compareToBaseline(current, moved);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(`${frozen.entries[0]?.format ?? ""}/seed-`);
    expect(failures[0]).not.toContain("0".repeat(64));
  });

  it("fails when the corpus grew or shrank without the baseline being regenerated", () => {
    const current = report();
    const frozen = baselineFromReport(current);
    expect(
      compareToBaseline(current, { ...frozen, entries: frozen.entries.slice(1) }).join("\n"),
    ).toContain("has grown");
    expect(
      compareToBaseline({ ...current, entries: current.entries.slice(1) }, frozen).join("\n"),
    ).toContain("has shrunk");
  });

  it("refuses to compare across a compatibility-window boundary rather than guessing", () => {
    const current = report();
    const frozen = baselineFromReport(current);
    const failures = compareToBaseline(current, {
      ...frozen,
      package: { ...frozen.package, window: "9.x" },
    });
    expect(failures.join("\n")).toContain("window");
  });

  it("refuses a baseline that is missing, malformed or of an unknown schema", () => {
    expect(parseBaseline("{ not json").ok).toBe(false);
    expect(parseBaseline(JSON.stringify({ schema: "something-else" })).ok).toBe(false);
    expect(() => readBaseline(join(scratch(), "no-such-baseline.json"))).toThrow(
      /could not be read/,
    );
  });
});

describe("a report written to disk is a plain text file with a trailing newline", () => {
  it("ends in exactly one newline", () => {
    const dir = scratch();
    const path = join(dir, reportFileName(22));
    const { rendered } = reportOverRealArtifacts();
    writeFileSync(path, rendered);
    const text = readFileSync(path, "utf8");
    expect(text.endsWith("}\n")).toBe(true);
  });
});
