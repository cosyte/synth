/**
 * THE DETERMINISM GATE IS WIRED INTO CI AS CHECKS THAT CAN FAIL, ALONGSIDE THE SHARED PIPELINE.
 *
 * Three failures this guards, none of them theoretical in a repository whose workflows are mostly
 * thin callers of somebody else's ladder:
 *
 *   * REPLACING THE CALLER RATHER THAN ADDING TO IT. Every universal gate this package has rides on
 *     one `uses:` line. A repo-specific job is added on top of it, never instead of it, so both are
 *     asserted present. The oracle job is asserted too: adding this gate must not cost that one.
 *   * A CHECK THAT CANNOT FAIL. `|| true` and `continue-on-error` turn a gate into documentation
 *     that reports green over the defect it exists to catch.
 *   * A GATE THAT NEVER RUNS ON THE THING BEING REVIEWED. The digest jobs and the comparison job
 *     inherit the workflow's triggers, so those are asserted here rather than assumed.
 *
 * It reads the workflow as TEXT, in the same shape `test/oracle/ci-wiring.test.ts` does and for the
 * same reason: a YAML parse would be a nicer object and a worse test, because what is being
 * asserted is what a reader and the runner both see in the file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readPolicy } from "../../scripts/determinism/policy.js";

const CI_WORKFLOW = join(import.meta.dirname, "..", "..", ".github", "workflows", "ci.yml");
const workflow = (): string => readFileSync(CI_WORKFLOW, "utf8");

describe("the determinism gate runs alongside the shared pipeline caller", () => {
  it("still calls the shared pipeline, so the universal gates are not replaced", () => {
    expect(workflow()).toContain("uses: cosyte/.github/.github/workflows/ci.yml@main");
    expect(workflow()).toContain("run-phi-scan: true");
  });

  it("still declares the oracle job, so this gate was added and nothing was traded for it", () => {
    expect(workflow()).toMatch(/^ {2}oracle:$/m);
  });

  it("declares one digest job per declared engine and one comparison job", () => {
    const text = workflow();
    for (const major of readPolicy().engines) {
      expect(text, `no digest job for Node ${String(major)}`).toMatch(
        new RegExp(`^ {2}determinism-digest-${String(major)}:$`, "m"),
      );
    }
    expect(text).toMatch(/^ {2}determinism-verify:$/m);
    expect(text).toContain("pnpm run determinism:digest");
    expect(text).toContain("pnpm run determinism:verify");
  });

  it("checks the compatibility window, so a changed baseline cannot land undeclared", () => {
    expect(workflow()).toContain("pnpm run check:determinism-window");
  });

  it("runs on pull requests to the default branch and on pushes to it", () => {
    const text = workflow();
    expect(text).toMatch(/pull_request:\s*\n\s*branches: \[main\]/);
    expect(text).toMatch(/push:\s*\n\s*branches: \[main\]/);
  });

  it("has no escape hatch, so a failing comparison fails the check", () => {
    const text = workflow();
    expect(text).not.toMatch(/^\s*continue-on-error:/m);
    for (const command of [
      "run: pnpm run determinism:digest",
      "run: pnpm run determinism:verify",
      "run: pnpm run check:determinism-window",
    ]) {
      const at = text.indexOf(command);
      expect(at, command).toBeGreaterThan(-1);
      expect(text.slice(at).split("\n")[0]).not.toContain("|| true");
    }
  });

  it("passes each report to the shell through the environment rather than the script body", () => {
    // A job output interpolated into `run:` text is a script-injection surface even when we
    // produced the value ourselves.
    const text = workflow();
    for (const major of readPolicy().engines) {
      expect(text).toContain(
        `REPORT_NODE_${String(major)}: \${{ needs.determinism-digest-${String(major)}.outputs.report }}`,
      );
    }
  });

  it("fetches the default branch before comparing a baseline against it", () => {
    // Without this the window check finds no default branch and REFUSES, which is the correct
    // behaviour and a useless check. The fetch is what makes it able to answer.
    expect(workflow()).toContain("refs/remotes/origin/main");
  });
});
