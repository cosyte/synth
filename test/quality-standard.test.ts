/**
 * How this repository adopts the shared testing standard, checked from the files that carry it:
 * the floor file, the scripts, the mutation config, the per-directory coverage gates, the property
 * runner and the workflow callers.
 *
 * Each piece is quiet when it goes missing. A floor file without a metric is a metric nobody holds,
 * a caller that drops an input turns its job into a skipped check that still reads green, and a
 * property that calls fast-check directly runs its own depth whatever the nightly job asks for. So
 * each is read here, and a pass means each was found as it should be.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { propertyRun, propertyTimeout } from "./support/property.js";

const REPO_ROOT = join(import.meta.dirname, "..");
const WORKFLOWS = join(REPO_ROOT, ".github", "workflows");

function read(...parts: string[]): string {
  return readFileSync(join(REPO_ROOT, ...parts), "utf8");
}

/** Import a module of this repository by its path: a file URL, which Windows needs. */
async function importModule<T>(...parts: string[]): Promise<T> {
  return (await import(pathToFileURL(join(REPO_ROOT, ...parts)).href)) as T;
}

/** The commit a caller's `uses:` line names for a shared workflow, or `undefined`. */
function sharedCommit(text: string, workflow: string): string | undefined {
  const pattern = new RegExp(
    `uses: cosyte/\\.github/\\.github/workflows/${workflow.replace(".", "\\.")}@([0-9a-f]{40}) # `,
    "u",
  );
  return pattern.exec(text)?.[1];
}

/** Every `.ts` file under a directory, relative to the repository root with forward slashes. */
function tsFiles(dir: string): string[] {
  return readdirSync(join(REPO_ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".ts"))
    .map((name) =>
      relative(REPO_ROOT, join(REPO_ROOT, dir, name))
        .split(sep)
        .join("/"),
    )
    .sort();
}

/** The seed-sweep fuzz target and its knobs: they keep their own nightly run (`nightly-fuzz.yml`). */
const FUZZ_FILES = [
  "test/property/_fuzz-config.ts",
  "test/property/seed-sweep.fuzz.property.test.ts",
];

describe("the floor file", () => {
  it("holds coverage at 100 on every metric and a mutation floor from 0 to 100", () => {
    const floor = JSON.parse(read("quality-floor.json")) as {
      packages: Record<string, { coverage?: Record<string, number>; mutation?: unknown }>;
    };
    expect(Object.keys(floor.packages)).toEqual(["."]);
    const entry = floor.packages["."];
    expect(entry?.coverage).toEqual({ lines: 100, branches: 100, functions: 100, statements: 100 });
    expect(typeof entry?.mutation).toBe("number");
    expect(entry?.mutation as number).toBeGreaterThan(0);
    expect(entry?.mutation as number).toBeLessThanOrEqual(100);
  });
});

describe("the scripts", () => {
  it("run the shared tools: the ratchet, the mutation runs and the property suites", () => {
    const { scripts } = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(scripts["quality:check"]).toBe("cosyte-ratchet check --skip mutation");
    expect(scripts["quality:mutation"]).toBe("cosyte-ratchet check --skip coverage");
    expect(scripts["quality:raise"]).toBe("cosyte-ratchet raise");
    expect(scripts["mutate"]).toBe("cosyte-mutate");
    expect(scripts["mutate:full"]).toBe("cosyte-mutate full");
    expect(scripts["test:property"]).toMatch(/^vitest run /u);
    expect(scripts["test:property"]).toContain("--exclude");
    expect(scripts["test:property"]).toContain("seed-sweep.fuzz.property.test.ts");
  });
});

describe("the mutation config", () => {
  it("is the shared StrykerJS config over every source file, on the mutation suite", async () => {
    const { default: config } = await importModule<{
      default: {
        mutate: string[];
        vitest: { configFile?: string };
        testRunner?: string;
        timeoutFactor?: number;
        timeoutMS?: number;
      };
    }>("stryker.config.mjs");
    expect(config.testRunner).toBe("vitest");
    expect(config.mutate).toContain("src/**/*.ts");
    expect(config.vitest.configFile).toBe("vitest.mutation.config.ts");
    expect(config.timeoutFactor).toBe(3);
    expect(config.timeoutMS).toBe(10_000);
  });

  it("leaves out of the mutation suite only tests that never run the instrumented source", async () => {
    const { default: config } = await importModule<{
      default: { test: { exclude: string[] } };
    }>("vitest.mutation.config.ts");
    const own = config.test.exclude.filter((pattern) => pattern.startsWith("test/"));
    expect(own.sort()).toEqual([
      "test/docs-content.test.ts",
      "test/examples-typecheck.test.ts",
      "test/scripts/**",
    ]);
  });
});

describe("the coverage gates", () => {
  it("hold every generator directory and the shared providers to 100 on its own", () => {
    const config = read("vitest.config.ts");
    const dirs = /const COVERAGE_DIRS = \[([^\]]*)\]/u.exec(config)?.[1];
    expect(dirs).toBeDefined();
    const listed = [...(dirs ?? "").matchAll(/"([a-z0-9]+)"/gu)].map((m) => m[1]).sort();
    expect(listed).toEqual(["astm", "ccda", "deid", "fhir", "hl7", "ncpdp", "rng", "safe", "x12"]);
  });
});

describe("the property tests", () => {
  const files = tsFiles("test").filter((file) => !FUZZ_FILES.includes(file));

  it("run every property through the shared runner, never fast-check's own depth", () => {
    const direct = files.filter((file) => /\bfc\.(assert|check)\(/u.test(read(file)));
    expect(direct).toEqual([]);
  });

  it("name no depth below the pull-request default of 100", () => {
    const low = files.flatMap((file) =>
      [...read(file).matchAll(/\bnumRuns:\s*([0-9_]+)/gu)]
        .filter((m) => Number((m[1] ?? "").replaceAll("_", "")) < 100)
        .map((m) => `${file}: ${m[0]}`),
    );
    expect(low).toEqual([]);
  });

  it("read the depth from the environment and print the seed", () => {
    const lines: string[] = [];
    const run = propertyRun({ numRuns: 200 }, { COSYTE_PROPERTY_RUNS: "10000" }, (line) => {
      lines.push(line);
    });
    expect(run.numRuns).toBe(10_000);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(`10000 cases from COSYTE_PROPERTY_SEED=${String(run.seed)}`);

    const pr = propertyRun({}, {}, () => undefined);
    expect(pr.numRuns).toBe(100);
    expect(propertyRun({ seed: 7 }, {}, () => undefined).seed).toBe(7);
  });

  it("scale a test's own timeout with the depth the environment asks for", () => {
    expect(propertyTimeout(10_000, 100, {})).toBe(10_000);
    expect(propertyTimeout(10_000, 100, { COSYTE_PROPERTY_RUNS: "10000" })).toBe(1_000_000);
    expect(propertyTimeout(10_000, 200, { COSYTE_PROPERTY_RUNS: "50" })).toBe(10_000);
  });
});

describe("the workflow callers", () => {
  it("ci.yml turns on macOS, Bun, Deno, the coverage ratchet and the mutation job", () => {
    const ci = read(".github", "workflows", "ci.yml");
    for (const input of ["run-bun", "run-deno", "run-coverage-ratchet", "run-mutation"]) {
      expect(ci).toMatch(new RegExp(`^      ${input}: true$`, "mu"));
    }
    expect(ci).toMatch(/^ {6}os: '\["ubuntu-latest", "macos-latest"\]'$/mu);
  });

  it("ci.yml runs the suite on Windows in a job of its own, every step of verify but attw", () => {
    const ci = read(".github", "workflows", "ci.yml");
    const job = /^ {2}windows:\n((?: {4}.*\n|\n)+)/mu.exec(ci)?.[1] ?? "";
    expect(job).toContain("runs-on: windows-latest");
    for (const step of [
      "pnpm typecheck",
      "pnpm lint",
      "pnpm format:check",
      "pnpm phi-scan",
      "pnpm test",
      "pnpm test:coverage",
      "pnpm build",
    ]) {
      expect(job).toMatch(new RegExp(`run: ${step.replace(".", "\\.")}$`, "mu"));
    }
    expect(job).not.toMatch(/run: pnpm attw/u);
  });

  it("the nightly property run and the sharded weekly mutation run are scheduled, at the reference ci.yml uses", () => {
    const commit = sharedCommit(read(".github", "workflows", "ci.yml"), "ci.yml");
    expect(commit).toBeDefined();
    for (const file of ["nightly-properties.yml", "weekly-mutation.yml"]) {
      expect(existsSync(join(WORKFLOWS, file)), file).toBe(true);
      const text = read(".github", "workflows", file);
      expect(sharedCommit(text, file), file).toBe(commit);
      expect(text, file).toMatch(/^ {2}schedule:\n(?: {4}#.*\n)* {4}- cron: "[^"]+"$/mu);
      // Only the schedule and a manual start: a pull request trigger would rerun them on every push.
      expect(text, file).not.toMatch(/^ {2}(?:push|pull_request):/mu);
    }
    const nightly = read(".github", "workflows", "nightly-properties.yml");
    expect(nightly).toContain('property-runs: "10000"');
    expect(nightly).toMatch(/pnpm test:property/u);
    const weekly = read(".github", "workflows", "weekly-mutation.yml");
    expect(weekly).toMatch(/^ {6}mutate-cmd: "pnpm mutate:full"$/mu);
    expect(weekly).toMatch(/^ {6}shard-count: \d+$/mu);
  });
});
