/**
 * The oracle is wired into CI as a check that can fail, ALONGSIDE the shared pipeline caller.
 *
 * Three failures this guards, and none of them is theoretical in a repository whose workflows are
 * mostly thin callers of somebody else's ladder:
 *
 *   * REPLACING THE CALLER RATHER THAN ADDING TO IT. `ci.yml` invokes the shared `cosyte/.github`
 *     pipeline, and every universal gate this package has (typecheck, lint, format, test, coverage,
 *     build, attw, smoke, the PHI scan) rides on that one line. A repo-specific job is added on top
 *     of it, never instead of it, so this asserts BOTH are present.
 *   * A CHECK THAT CANNOT FAIL. `|| true` and `continue-on-error` turn a gate into documentation
 *     that reports green over the defect it exists to catch, which is the whole failure mode the
 *     oracle was built to close for the round-trip assertion. So the oracle job may carry neither.
 *   * A CHECK THAT REACHES THE GRADING STEP WITH NOTHING TO GRADE, or with something it cannot
 *     name. The acquisition step is the one that fetches somebody else's binary, and its two
 *     failures (an address that identifies no version, an artifact that will not download) have to
 *     stop the job loudly, naming the artifact. A silent acquisition failure would hand the run an
 *     absent validator, and "nothing could be fetched" must not read like "nothing was wrong".
 *
 * It reads the workflow as text on purpose. A YAML parse would be a nicer object and a worse test:
 * the thing being asserted is what a reader and the runner both see in the file. The refusals
 * themselves are asserted against the functions the step runs, because a text scan can see that a
 * step is wired up and never that it says no.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { acquireArtifacts } from "../../scripts/oracle/acquisition.js";
import { planAcquisition, readOracleLock } from "../../scripts/oracle/lock.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const CI_WORKFLOW = join(REPO_ROOT, ".github", "workflows", "ci.yml");
const workflow = (): string => readFileSync(CI_WORKFLOW, "utf8");

/** Just the oracle job, so an assertion about it cannot be satisfied by another job's text. */
function oracleJob(): string {
  const text = workflow();
  const start = text.indexOf("\n  oracle:\n");
  expect(start).toBeGreaterThan(-1);
  const rest = text.slice(start + 1);
  // Ends at the next thing written at job indentation, a key or the banner above one, so the
  // neighbouring job's commentary is not read as part of this one.
  const next = rest.slice(1).search(/\n {2}(?:#|[a-z][a-z0-9-]*:)/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

const packageScripts = (): Record<string, string> => {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return parsed.scripts ?? {};
};

describe("the oracle runs in CI alongside the shared pipeline caller", () => {
  it("still calls the shared pipeline, so the universal gates are not replaced", () => {
    expect(workflow()).toContain("uses: cosyte/.github/.github/workflows/ci.yml@main");
    expect(workflow()).toContain("run-phi-scan: true");
  });

  it("declares an oracle job that runs the gate", () => {
    const text = workflow();
    expect(text).toMatch(/^ {2}oracle:$/m);
    expect(text).toContain("pnpm run oracle");
  });

  it("runs on pull requests to the default branch and on pushes to it", () => {
    const text = workflow();
    expect(text).toMatch(/pull_request:\s*\n\s*branches: \[main\]/);
    expect(text).toMatch(/push:\s*\n\s*branches: \[main\]/);
  });

  it("has no escape hatch, so a failing oracle fails the check", () => {
    const text = workflow();
    // The KEY, not the word: the banner above the job explains why the escape hatch is absent, and
    // a test that reds on its own explanation is a test somebody deletes.
    expect(text).not.toMatch(/^\s*continue-on-error:/m);
    // `|| true` on the grading step would swallow the exit code. The only tolerated `||` is on the
    // step that prints the verdict after the fact, which is not a gate.
    const gradingStep = text.slice(text.indexOf("run: pnpm run oracle"));
    expect(gradingStep.split("\n")[0]).not.toContain("|| true");
  });

  it("takes the download sources from the committed pin rather than from the workflow", () => {
    expect(workflow()).toContain("scripts/oracle/oracle-lock.json");
  });

  it("writes no download address of its own, so the pin is the only place one lives", () => {
    // Not "the pin is mentioned somewhere", which a comment satisfies: the job carries no URL at
    // all, so there is nowhere in this file for a second, competing source to be recorded.
    expect(oracleJob()).not.toMatch(/https?:\/\//);
  });

  it("acquires through the script that reads the pin, before anything is graded", () => {
    const job = oracleJob();
    expect(job).toContain("run: pnpm run oracle:acquire");
    expect(packageScripts()["oracle:acquire"]).toBe("tsx scripts/oracle/acquire.ts");

    const acquire = readFileSync(join(REPO_ROOT, "scripts", "oracle", "acquire.ts"), "utf8");
    expect(acquire).toContain("readOracleLock");
    expect(acquire).toContain("planAcquisition");

    // Order is part of the contract: acquire, then grade.
    expect(job.indexOf("pnpm run oracle:acquire")).toBeLessThan(job.indexOf("pnpm run oracle\n"));
  });

  it("records the pinned address, never the end of the redirect chain", () => {
    const acquire = readFileSync(join(REPO_ROOT, "scripts", "oracle", "acquire.ts"), "utf8");
    // The mechanism that produced the storage GUID recorded as a "version" on this job's first run.
    expect(`${oracleJob()}${acquire}`).not.toContain("redirect_url");
  });
});

describe("the acquisition step fails loudly, naming the artifact", () => {
  it("refuses a pinned source that names no version, rather than resolving one", () => {
    const lock = readOracleLock();
    const plan = planAcquisition({
      ...lock,
      validator: {
        ...lock.validator,
        downloadUrl:
          "https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar",
      },
    });

    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.refusals[0]).toContain(lock.validator.name);
    expect(plan.refusals[0]).toContain("names no single release or registry version");
  });

  it("refuses an artifact that could not be obtained, naming it and its source", () => {
    const outcome = acquireArtifacts(
      [
        {
          key: "validator",
          name: "validator_cli.jar",
          source: "https://example.invalid/releases/download/6.6.9/validator_cli.jar",
          destination: ".oracle/validator_cli.jar",
        },
      ],
      () => {
        throw new Error("curl exited 22: HTTP 404");
      },
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusals).toHaveLength(1);
    expect(outcome.refusals[0]).toContain("validator_cli.jar");
    expect(outcome.refusals[0]).toContain("https://example.invalid/releases/download/6.6.9");
    expect(outcome.refusals[0]).toContain("HTTP 404");
  });

  it("records the PINNED source for what did arrive, not wherever the download went", () => {
    const source = "https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.6.9/x.jar";
    const outcome = acquireArtifacts(
      [{ key: "validator", name: "validator_cli.jar", source, destination: ".oracle/x.jar" }],
      // A downloader that "resolves" somewhere else entirely. Nothing it learns is recorded.
      () => undefined,
    );

    expect(outcome).toEqual({
      ok: true,
      acquired: [{ key: "validator", path: ".oracle/x.jar", source }],
    });
  });

  it("acquiring NOTHING is refused, because a vacuous success looks exactly like a real one", () => {
    const outcome = acquireArtifacts([], () => undefined);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusals[0]).toContain("no artifact was acquired");
  });

  it("reports every artifact that failed, so one run says all of it", () => {
    const outcome = acquireArtifacts(
      [
        {
          key: "validator",
          name: "validator_cli.jar",
          source: "https://example.invalid/releases/download/6.6.9/validator_cli.jar",
          destination: ".oracle/validator_cli.jar",
        },
        {
          key: "conformancePackage",
          name: "hl7.fhir.us.core",
          source: "https://example.invalid/hl7.fhir.us.core/6.1.0",
          destination: ".oracle/us-core.tgz",
        },
      ],
      () => {
        throw new Error("no route to host");
      },
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusals).toHaveLength(2);
    expect(outcome.refusals[1]).toContain("hl7.fhir.us.core");
  });
});
