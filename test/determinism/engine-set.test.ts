/**
 * THE DECLARED SUPPORTED-ENGINE SET, AND THE TWO RECONCILIATIONS THAT STOP IT DRIFTING.
 *
 * "Each supported Node major" names no set on its own. `engines.node` is an open-ended range that
 * fixes a floor and no member list, and the shared pipeline's Node matrix lives in a repository
 * this one may not edit. So the set is DECLARED here, and the declaration is only worth something
 * if it cannot quietly stop matching the two things that constrain it:
 *
 *   * the range the package publishes, so the set can never bless a major the package excludes,
 *     never omit the floor the package promises, and never shrink to a single engine (a
 *     "cross-engine" comparison over one engine agrees with itself by construction);
 *   * the jobs continuous integration actually runs, so a declaration naming two engines while the
 *     workflow digests on one is caught. That is a ONE LINE edit and the resulting green is
 *     indistinguishable from a real one, which is exactly why it is asserted rather than trusted.
 *
 * THE LIVE CASE IS ASSERTED FIRST, against the real `package.json` and the real workflow, so this
 * suite reds the moment the committed declaration and this repository disagree.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  majorIsPermitted,
  minimumPermittedMajor,
  parseEngineRange,
  readWorkflowDeterminismJobs,
  reconcileDeclaredEngines,
  reconcileWorkflowEngines,
} from "../../scripts/determinism/engines.js";
import { readPackageFacts, readPolicy } from "../../scripts/determinism/policy.js";

const ROOT = join(import.meta.dirname, "..", "..");
const CI_WORKFLOW = join(ROOT, ".github", "workflows", "ci.yml");
const workflowText = (): string => readFileSync(CI_WORKFLOW, "utf8");

describe("the committed declaration reconciles against this repository", () => {
  it("reconciles against the range package.json publishes", () => {
    const policy = readPolicy();
    const facts = readPackageFacts();
    expect(reconcileDeclaredEngines(policy.engines, facts.engineRange)).toEqual([]);
  });

  it("reconciles against the jobs the continuous-integration workflow runs", () => {
    expect(reconcileWorkflowEngines(readPolicy().engines, workflowText())).toEqual([]);
  });

  it("declares at least the two majors the promise is about", () => {
    const policy = readPolicy();
    expect(policy.engines).toContain(22);
    expect(policy.engines).toContain(24);
  });
});

describe("the declaration is reconciled against engines.node", () => {
  it("fails when it names a major the range excludes", () => {
    const problems = reconcileDeclaredEngines([20, 22, 24], ">=22.0.0");
    expect(problems.join("\n")).toContain("Node 20");
    expect(problems.join("\n")).toContain(">=22.0.0");
  });

  it("fails when it omits the minimum major the range permits", () => {
    const problems = reconcileDeclaredEngines([24, 26], ">=22.0.0");
    expect(problems.join("\n")).toContain("omits Node 22");
  });

  it("fails when it holds fewer than two distinct majors", () => {
    expect(reconcileDeclaredEngines([22], ">=22.0.0").join("\n")).toContain("fewer than two");
    expect(reconcileDeclaredEngines([22, 22], ">=22.0.0").join("\n")).toContain("fewer than two");
  });

  it("accepts a major above the floor, because the set may grow but never shrink below it", () => {
    expect(reconcileDeclaredEngines([22, 24, 26], ">=22.0.0")).toEqual([]);
  });

  it("honours an upper bound when the range has one", () => {
    expect(majorIsPermitted(">=22.0.0 <25.0.0", 24)).toBe(true);
    expect(majorIsPermitted(">=22.0.0 <25.0.0", 25)).toBe(false);
    expect(majorIsPermitted(">=22.0.0 <=25.0.0", 25)).toBe(true);
    expect(reconcileDeclaredEngines([22, 26], ">=22.0.0 <25.0.0").join("\n")).toContain("Node 26");
  });

  it("reads the floor off the range rather than assuming it", () => {
    expect(minimumPermittedMajor(">=22.0.0")).toBe(22);
    expect(minimumPermittedMajor(">=18.17.1")).toBe(18);
    expect(minimumPermittedMajor(">22.0.0")).toBe(22);
    expect(minimumPermittedMajor(">22.99.99")).toBe(22);
    expect(minimumPermittedMajor(">=22.0.0 <25.0.0")).toBe(22);
  });

  it("REFUSES a range it cannot read rather than approximating one", () => {
    // Reading a range wrongly in the permissive direction blesses a major the package does not
    // support, and there is no semver dependency available here to read one properly.
    for (const range of ["^22.0.0", "~22.1", "22.x", ">=18 || >=22", "*", "22.0.0 - 24.0.0"]) {
      expect(() => parseEngineRange(range), range).toThrow();
    }
    expect(reconcileDeclaredEngines([22, 24], "^22.0.0").length).toBeGreaterThan(0);
  });
});

describe("the declaration is reconciled against the jobs CI runs", () => {
  /** The committed workflow with one textual edit applied. */
  const edited = (from: string | RegExp, to: string): string => workflowText().replace(from, to);

  it("fails when the workflow digests on fewer engines than are declared", () => {
    const withoutTwentyFour = workflowText().replace(
      /\n {2}determinism-digest-24:[\s\S]*?(?=\n {2}determinism-verify:)/,
      "\n",
    );
    const problems = reconcileWorkflowEngines([22, 24], withoutTwentyFour);
    expect(problems.join("\n")).toContain("runs the per-engine digest step on [22]");
  });

  it("fails when a digest job runs on an engine other than the one its name claims", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      edited(/node-version: "24"/, 'node-version: "22"'),
    );
    expect(problems.join("\n")).toContain("determinism-digest-24");
  });

  it("fails when a digest job does not run the digest step", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowText().replace(/pnpm run determinism:digest/g, "echo skipping"),
    );
    expect(problems.join("\n")).toContain("does not run `pnpm run determinism:digest`");
  });

  it("fails when the comparison job does not depend on every digest job", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      edited(
        "needs: [determinism-digest-22, determinism-digest-24]",
        "needs: [determinism-digest-22]",
      ),
    );
    expect(problems.join("\n")).toContain("depends on [22]");
  });

  it("fails when the comparison job never reads one of the reports it waited for", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      edited(/ *REPORT_NODE_24: \$\{\{ needs\.determinism-digest-24\.outputs\.report \}\}\n/, ""),
    );
    expect(problems.join("\n")).toContain("reads a digest report for [22]");
  });

  it("fails when the comparison job never materialises one of the reports", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowText().replace(/node-24\.json/g, "somewhere-else.json"),
    );
    expect(problems.join("\n")).toContain("reads a digest report for [22]");
  });

  it("fails when there is no comparison job at all, so two runs never meet", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowText().replace(/\n {2}determinism-verify:[\s\S]*$/, "\n"),
    );
    expect(problems.join("\n")).toContain("no `determinism-verify` job");
  });

  it("REFUSES a workflow whose jobs it cannot split rather than reporting an empty set", () => {
    const found = readWorkflowDeterminismJobs("name: CI\non:\n  push:\n    branches: [main]\n");
    expect(found.digestEngines).toEqual([]);
    expect(found.problems.join("\n")).toContain("Refusing rather than reporting an empty set");
  });

  it("does not mistake the two-space keys under `on:` for job names", () => {
    const found = readWorkflowDeterminismJobs(workflowText());
    expect(found.digestEngines).toEqual([22, 24]);
    expect(found.verifyNeeds).toEqual([22, 24]);
    expect(found.verifyConsumes).toEqual([22, 24]);
    expect(found.problems).toEqual([]);
  });
});
