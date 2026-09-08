/**
 * The oracle is wired into CI as a check that can fail, ALONGSIDE the shared pipeline caller.
 *
 * Four failures this guards, and none of them is theoretical in a repository whose workflows are
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
 *   * A GUARD AIMED AT THE WRONG STEP, WHICH IS THE ONE THAT ACTUALLY HAPPENED HERE. `pnpm run
 *     oracle` is a PREFIX of every `pnpm run oracle<suffix>`, so an assertion that located the
 *     grading step with `indexOf("run: pnpm run oracle")` landed on an acquisition step spelled
 *     `run: pnpm run oracle:acquire` the moment one was added above it. Nothing about the assertion
 *     changed; it simply stopped reading the gate, and a `|| true` on the grading step would have
 *     gone green underneath it. Two independent answers below, because either alone can rot: a step
 *     is located by the NAME it carries, never by the command it runs, AND no command in the job
 *     may begin with the grading command, so a text scan cannot be ambiguous in the first place.
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

/** The command the gate itself runs. Everything below is anchored on this exact spelling. */
const GRADING_COMMAND = "pnpm run oracle";

/** The `name:` the grading step carries, which is how the step is found rather than its command. */
const GRADING_STEP_NAME = "Grade the declared corpus with the external validator";

/**
 * The grading step alone, located by the NAME it carries.
 *
 * NOT by its command, and that is the whole point: `indexOf("run: pnpm run oracle")` finds the
 * FIRST command with that prefix, which stopped being the gate as soon as an acquisition step was
 * added above it. A name is not a prefix of anything and renaming the step reds here loudly.
 */
function gradingStep(): string {
  const job = oracleJob();
  const at = job.indexOf(`- name: ${GRADING_STEP_NAME}`);
  expect(at).toBeGreaterThan(-1);
  const rest = job.slice(at);
  // Ends at the next step's bullet or the banner above it, so no neighbouring step is read as
  // part of this one.
  const end = rest.search(/\n\s*(?:- |#)/);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Every command the oracle job runs, bullet-form (`- run:`) and continuation-form alike. */
function oracleCommands(): readonly string[] {
  return [...oracleJob().matchAll(/^ *(?:- )?run: (.+)$/gm)].map((match) =>
    (match[1] ?? "").trim(),
  );
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
    expect(workflow()).toMatch(/^ {2}oracle:$/m);
    // THE WHOLE COMMAND ON ITS OWN LINE, never the substring. `toContain("pnpm run oracle")` is
    // satisfied by `pnpm run oracle:acquire`, by a comment mentioning the gate, and by a job that
    // downloads a validator and never grades with it.
    expect(oracleJob()).toMatch(/^ *run: pnpm run oracle$/m);
  });

  it("spells its commands so none of them can be mistaken for the grading command", () => {
    const commands = oracleCommands();
    expect(commands).toContain(GRADING_COMMAND);
    // Exactly one command may begin with the gate's, and it is the gate's. A second one makes
    // every text scan over this file ambiguous, and an ambiguous scan can be pointed at the wrong
    // step without a single assertion changing, which is what happened to the `|| true` guard.
    expect(commands.filter((command) => command.startsWith(GRADING_COMMAND))).toEqual([
      GRADING_COMMAND,
    ]);
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
    //
    // THE STEP IS FOUND BY NAME. It used to be found by slicing from the first occurrence of
    // `run: pnpm run oracle`, and that slice moved onto a different step the moment one spelled
    // `run: pnpm run oracle:acquire` was inserted above it: the assertion still passed, still read
    // a line, and no longer read the gate's.
    const grading = gradingStep();
    // The step found by that name really is the one that runs the gate, whole and alone, so the
    // refusals below are asserted about the grading command and not about whatever else is here.
    expect(grading).toMatch(/^ *run: pnpm run oracle$/m);
    expect(grading).not.toContain("|| true");
    // An `if:` on this step is the quieter half of the same move: a step that never runs reports
    // no failure, exactly like one that cannot fail.
    expect(grading).not.toMatch(/^\s*if:/m);
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
    expect(job).toContain("run: pnpm run acquire:oracle");
    expect(packageScripts()["acquire:oracle"]).toBe("tsx scripts/oracle/acquire.ts");

    const acquire = readFileSync(join(REPO_ROOT, "scripts", "oracle", "acquire.ts"), "utf8");
    expect(acquire).toContain("readOracleLock");
    expect(acquire).toContain("planAcquisition");

    // Order is part of the contract: acquire, then grade. Both ends are whole `run:` lines, so
    // neither index can land on the other step, which is the failure the assertion above closes.
    const acquireAt = job.search(/^ *run: pnpm run acquire:oracle$/m);
    const gradeAt = job.search(/^ *run: pnpm run oracle$/m);
    expect(acquireAt).toBeGreaterThan(-1);
    expect(gradeAt).toBeGreaterThan(-1);
    expect(acquireAt).toBeLessThan(gradeAt);
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
