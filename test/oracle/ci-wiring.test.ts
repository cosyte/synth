/**
 * The oracle is wired into CI as a check that can fail, ALONGSIDE the shared pipeline caller.
 *
 * Two failures this guards, and neither of them is theoretical in a repository whose workflows are
 * mostly thin callers of somebody else's ladder:
 *
 *   * REPLACING THE CALLER RATHER THAN ADDING TO IT. `ci.yml` invokes the shared `cosyte/.github`
 *     pipeline, and every universal gate this package has (typecheck, lint, format, test, coverage,
 *     build, attw, smoke, the PHI scan) rides on that one line. A repo-specific job is added on top
 *     of it, never instead of it, so this asserts BOTH are present.
 *   * A CHECK THAT CANNOT FAIL. `|| true` and `continue-on-error` turn a gate into documentation
 *     that reports green over the defect it exists to catch, which is the whole failure mode the
 *     oracle was built to close for the round-trip assertion. So the oracle job may carry neither.
 *
 * It reads the workflow as text on purpose. A YAML parse would be a nicer object and a worse test:
 * the thing being asserted is what a reader and the runner both see in the file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const CI_WORKFLOW = join(import.meta.dirname, "..", "..", ".github", "workflows", "ci.yml");
const workflow = (): string => readFileSync(CI_WORKFLOW, "utf8");

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
});
