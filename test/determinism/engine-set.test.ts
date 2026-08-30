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
 *   * CONDITIONAL EXECUTION, because "the job EXISTS" and "the job RUNS" are different claims and
 *     the drift routes below only ever asserted the first. `if: false` on a digest job leaves the
 *     declaration, the job name, the pinned `node-version`, the `report` output, the `needs:` list
 *     and the report reference all intact while the engine is never digested; a `needs:` on a
 *     skipped job SKIPS the dependent and GitHub reports a skipped job as SUCCESS for a required
 *     status check, so the whole gate goes off AND GREEN. The route that matters is not sabotage:
 *     `if: github.event_name != 'pull_request'` on the Node 24 job, added in good faith to save CI
 *     minutes, turns this gate off on every pull request and reds nothing.
 *
 * THE LIVE CASE IS ASSERTED FIRST, against the real `package.json` and the real workflow, so this
 * suite reds the moment the committed declaration and this repository disagree.
 *
 * WHAT THIS SUITE DOES NOT REACH, since a text scan cannot answer "actually runs" in full: the
 * required-status-check ruleset, a `runs-on:` label no runner answers, Actions being disabled at
 * the organisation, and a redefined `determinism:digest` script. The header of
 * `scripts/determinism/engines.ts` carries that residual in full; it is stated rather than implied,
 * because a gate that reds correctly and then explains itself with a falsehood teaches the next
 * reader the wrong story.
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
    expect(found.digestJobs).toEqual([22, 24]);
    expect(found.verifyNeeds).toEqual([22, 24]);
    expect(found.verifyConsumes).toEqual([22, 24]);
    expect(found.conditionalJobs).toEqual([]);
    expect(found.problems).toEqual([]);
  });
});

describe("a declared engine whose digest step never RUNS is drift, not a detail", () => {
  /** The committed workflow with one textual edit applied, asserting the edit landed. */
  const sabotaged = (from: string, to: string): string => {
    const edited = workflowText().replace(from, to);
    expect(edited, "the sabotage did not apply, so the case below asserts nothing").not.toEqual(
      workflowText(),
    );
    return edited;
  };

  /** The committed job header of the Node 24 digest job, the anchor most of these edits use. */
  const JOB_24 = "  determinism-digest-24:\n    runs-on: ubuntu-latest\n";

  /** The digest step of the LAST digest job, immediately above the comparison job. */
  const LAST_DIGEST_STEP =
    "      - name: Digest the declared corpus on this engine\n" +
    "        id: digest\n" +
    "        run: pnpm run determinism:digest\n\n  determinism-verify:";

  it("fails when a digest job carries a job-level `if:` that switches it off", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      sabotaged(JOB_24, "  determinism-digest-24:\n    if: false\n    runs-on: ubuntu-latest\n"),
    );
    const named = problems.join("\n");
    expect(named).toContain("determinism-digest-24");
    expect(named).toContain("CONDITIONAL");
    // AC9's own clause, restated: the set CI unconditionally digests on is no longer the declared
    // one. The set message and the reason for it are both present, so a reader is not left to
    // infer which engine went missing.
    expect(named).toContain("UNCONDITIONALLY runs the per-engine digest step on [22]");
  });

  it("fails on the PLAUSIBLE `if:`, which is the route that actually happens", () => {
    // Added in good faith to save CI minutes. It turns this gate off on every pull request, which
    // is every run a human ever looks at, and reds nothing.
    const problems = reconcileWorkflowEngines(
      [22, 24],
      sabotaged(
        JOB_24,
        "  determinism-digest-24:\n" +
          "    if: github.event_name != 'pull_request'\n" +
          "    runs-on: ubuntu-latest\n",
      ),
    );
    expect(problems.join("\n")).toContain("determinism-digest-24");
    expect(problems.join("\n")).toContain("github.event_name != 'pull_request'");
  });

  it("fails when the digest STEP is switched off inside a job that still runs", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      sabotaged(
        LAST_DIGEST_STEP,
        "      - name: Digest the declared corpus on this engine\n" +
          "        id: digest\n" +
          "        if: false\n" +
          "        run: pnpm run determinism:digest\n\n  determinism-verify:",
      ),
    );
    expect(problems.join("\n")).toContain("determinism-digest-24");
  });

  it("fails when the comparison job itself is switched off, so two runs never meet", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      sabotaged(
        "  determinism-verify:\n    runs-on: ubuntu-latest\n",
        "  determinism-verify:\n    if: false\n    runs-on: ubuntu-latest\n",
      ),
    );
    expect(problems.join("\n")).toContain("determinism-verify");
    expect(readWorkflowDeterminismJobs(workflowText()).conditionalJobs).toEqual([]);
  });

  it("is a rule about the KEY, not about a list of expressions that switch a job off", () => {
    // Enumerating the expressions that evaluate false is unbounded, and this repository has paid
    // for a deny-list of spellings once already (scripts/attw.mjs). Both quoted YAML spellings and
    // a condition written as a step's first key are the same key to a runner, so they are here.
    for (const line of [
      "    if: ${{ vars.RUN_DETERMINISM == 'yes' }}",
      '    "if": false',
      "    'if': always()",
    ]) {
      const problems = reconcileWorkflowEngines(
        [22, 24],
        sabotaged(JOB_24, `  determinism-digest-24:\n${line}\n    runs-on: ubuntu-latest\n`),
      );
      expect(problems.join("\n"), line).toContain("determinism-digest-24");
    }
    const asFirstStepKey = reconcileWorkflowEngines(
      [22, 24],
      sabotaged(
        LAST_DIGEST_STEP,
        "      - if: false\n" +
          "        name: Digest the declared corpus on this engine\n" +
          "        id: digest\n" +
          "        run: pnpm run determinism:digest\n\n  determinism-verify:",
      ),
    );
    expect(asFirstStepKey.join("\n")).toContain("determinism-digest-24");
  });

  it("does not read a shell line inside a `run:` body, or a comment, as a condition", () => {
    // The false-positive side matters as much as the false-negative one: a check that reds on the
    // contents of a script is a check somebody turns off. A block scalar's body is text.
    const withHeredoc = reconcileWorkflowEngines(
      [22, 24],
      sabotaged(
        "      - run: pnpm install --frozen-lockfile\n\n      - name: Digest the declared corpus " +
          "on this engine\n        id: digest\n        run: pnpm run determinism:digest\n\n  " +
          "determinism-verify:",
        "      - run: pnpm install --frozen-lockfile\n\n" +
          "      - name: Leave a snippet behind\n" +
          "        shell: bash\n" +
          "        run: |\n" +
          "          cat > snippet.yml <<'YAML'\n" +
          "          if: false\n" +
          "          YAML\n\n" +
          "      - name: Digest the declared corpus on this engine\n" +
          "        id: digest\n" +
          "        run: pnpm run determinism:digest\n\n  determinism-verify:",
      ),
    );
    expect(withHeredoc).toEqual([]);

    const withComment = reconcileWorkflowEngines(
      [22, 24],
      sabotaged(JOB_24, "  determinism-digest-24:\n    # if: false\n    runs-on: ubuntu-latest\n"),
    );
    expect(withComment).toEqual([]);
  });

  it("REFUSES a `strategy:` on a determinism job rather than approximating what it runs", () => {
    // A matrix decides how many times a job runs and on what, so the job name and its pinned
    // node-version stop being the answer to the question this reconciliation asks. Zero legs is a
    // job that never ran. Refusing an unreadable shape is this file's standing rule.
    const problems = reconcileWorkflowEngines(
      [22, 24],
      sabotaged(
        JOB_24,
        "  determinism-digest-24:\n" +
          "    strategy:\n" +
          "      matrix:\n" +
          "        include: []\n" +
          "    runs-on: ubuntu-latest\n",
      ),
    );
    expect(problems.join("\n")).toContain("determinism-digest-24");
    expect(problems.join("\n")).toContain("REFUSES to read");
  });
});

describe("the workflow's triggers are read too, because they are the same hole", () => {
  it("fails when it no longer runs on pull requests to the default branch", () => {
    // Deleting this trigger and writing `if: github.event_name != 'pull_request'` on a digest job
    // have the identical effect. Closing one route and leaving its twin open would be a check that
    // only catches the spelling it was written against.
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowText().replace("  pull_request:\n    branches: [main]\n", ""),
    );
    expect(problems.join("\n")).toContain("does not run on `pull_request` to `main`");
  });

  it("fails when it no longer runs on pushes to the default branch", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowText().replace("  push:\n    branches: [main]\n", ""),
    );
    expect(problems.join("\n")).toContain("does not run on `push` to `main`");
  });

  it("fails when the triggers are narrowed to a branch that is not the default one", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowText().replace(
        "  pull_request:\n    branches: [main]",
        "  pull_request:\n    branches: [some-integration-branch]",
      ),
    );
    expect(problems.join("\n")).toContain("does not run on `pull_request` to `main`");
  });

  it("REFUSES a workflow whose `on:` block it cannot find rather than assuming triggers", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowText().replace(/^on:$/m, "on: [pull_request]"),
    );
    expect(problems.join("\n")).toContain("declares no `on:` block this reader could find");
  });
});
