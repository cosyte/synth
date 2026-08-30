/**
 * THE DECLARED SUPPORTED-ENGINE SET, AND THE RECONCILIATIONS THAT STOP IT DRIFTING.
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
 *   * THE JOB GRAPH, because the rule above reads ONE job block and a job does not need its own
 *     `if:` to skip. An editor told "no `if:` on these jobs" who still wants to save CI minutes
 *     puts the `if:` on a NEW job and writes a `needs:`, so the rule as written makes the uncaught
 *     route the compliant-looking one. Every job the three determinism jobs reach through `needs:`
 *     is walked, transitively, and has to be guaranteed to run as well.
 *   * TWO SPELLINGS A RUNNER TREATS ALIKE AND A LINE READER DOES NOT: a step written as a YAML flow
 *     mapping, and a `paths:` filter added under a trigger whose `branches:` is left in place. Both
 *     are refused rather than approximated, which is the same answer `strategy:` already gets.
 *
 * THE LIVE CASE IS ASSERTED FIRST, against the real `package.json` and the real workflow, so this
 * suite reds the moment the committed declaration and this repository disagree. EVERY CASE HAS ITS
 * FALSE-POSITIVE TWIN: a legitimate `needs:`, a comment under a trigger, a `${{ }}` expression and
 * a shell `${VAR}` all have to stay green, because a check that reds on ordinary editing is a check
 * somebody deletes.
 *
 * WHAT THIS SUITE DOES NOT REACH, since a text scan cannot answer "actually runs" in full: the
 * required-status-check ruleset, a `runs-on:` label no runner answers, Actions being disabled at
 * the organisation, and a redefined `determinism:digest` script. THE ROUTES BELOW ARE THE ROUTES
 * THAT WERE SEEDED AND OBSERVED TO RED, WHICH IS NARROWER THAN "THE WORKFLOW CANNOT BE EDITED INTO
 * A FALSE GREEN": that sentence stood in the header of `scripts/determinism/engines.ts` and a
 * refuter answered it with a route it did not cover. The residual is carried there in full, stated
 * rather than implied, because a gate that reds correctly and then explains itself with a falsehood
 * teaches the next reader the wrong story.
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

describe("a determinism job that reaches a switched-off job through `needs:` is the same hole", () => {
  /**
   * The rule "no `if:` on these jobs" makes this the COMPLIANT-LOOKING route: an editor obeying it
   * to the letter who still wants to save CI minutes puts the `if:` on a NEW job and writes a
   * `needs:`, the mainstream idiom for gating an expensive job behind change detection. The
   * dependent then skips WITHOUT an `if:` of its own, the comparison skips behind it, and GitHub
   * reports a skipped job as SUCCESS for a required status check.
   */
  const workflowWith = (job: string, edit?: readonly [string, string]): string => {
    const base = edit === undefined ? workflowText() : workflowText().replace(edit[0], edit[1]);
    expect(
      edit === undefined || base !== workflowText(),
      "the sabotage did not apply, so the case below asserts nothing",
    ).toBe(true);
    return `${base}\n${job}`;
  };

  /** A change-detection job that skips. It carries the `if:`, so no determinism job carries one. */
  const SKIPPING_HELPER =
    "  changed-files:\n" +
    "    if: github.event_name == 'workflow_dispatch'\n" +
    "    runs-on: ubuntu-latest\n" +
    "    steps:\n" +
    "      - run: echo 'nothing to do'\n";

  /** The same job with nothing conditional about it. The negative control for every case below. */
  const RUNNING_HELPER =
    "  changed-files:\n" +
    "    runs-on: ubuntu-latest\n" +
    "    steps:\n" +
    "      - run: echo 'nothing to do'\n";

  const JOB_24_NEEDS: readonly [string, string] = [
    "  determinism-digest-24:\n    runs-on: ubuntu-latest\n",
    "  determinism-digest-24:\n    needs: [changed-files]\n    runs-on: ubuntu-latest\n",
  ];

  it("fails when a digest job depends on a job that is itself switched off", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowWith(SKIPPING_HELPER, JOB_24_NEEDS),
    );
    const named = problems.join("\n");
    expect(named).toContain("determinism-digest-24");
    expect(named).toContain("changed-files");
    expect(named).toContain("CONDITIONAL");
    // AC9's own clause: the set CI unconditionally digests on is no longer the declared one, and
    // the engine that went missing is named rather than left to be inferred.
    expect(named).toContain("UNCONDITIONALLY runs the per-engine digest step on [22]");
  });

  it("fails when the COMPARISON job depends on a switched-off job, so two engines never meet", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowWith(SKIPPING_HELPER, [
        "    needs: [determinism-digest-22, determinism-digest-24]\n",
        "    needs: [determinism-digest-22, determinism-digest-24, changed-files]\n",
      ]),
    );
    const named = problems.join("\n");
    expect(named).toContain("determinism-verify");
    expect(named).toContain("changed-files");
    // Both digest jobs still run here, which is what makes this quiet: the one thing that goes
    // missing is the comparison, the entire subject of this gate.
    expect(readWorkflowDeterminismJobs(workflowText()).digestEngines).toEqual([22, 24]);
  });

  it("follows the graph TRANSITIVELY, so one hop of indirection does not hide the `if:`", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowWith(
        "  changed-files:\n" +
          "    needs: [decide]\n" +
          "    runs-on: ubuntu-latest\n" +
          "    steps:\n" +
          "      - run: echo 'nothing to do'\n\n" +
          "  decide:\n" +
          "    if: github.event_name == 'workflow_dispatch'\n" +
          "    runs-on: ubuntu-latest\n" +
          "    steps:\n" +
          "      - run: echo 'nothing to do'\n",
        JOB_24_NEEDS,
      ),
    );
    expect(problems.join("\n")).toContain("`decide`");
    expect(problems.join("\n")).toContain("determinism-digest-24");
  });

  it("REFUSES a `needs:` on a job it cannot find rather than reading it as satisfied", () => {
    // An unfindable dependency is an underivable subject, and this file's standing rule is that an
    // underivable subject is not an absent one. It also closes the misparse direction: a name this
    // reader gets wrong matches no job and lands here rather than being dropped.
    const problems = reconcileWorkflowEngines([22, 24], workflowText().replace(...JOB_24_NEEDS));
    expect(problems.join("\n")).toContain("cannot find as a job block");
    expect(problems.join("\n")).toContain("determinism-digest-24");
  });

  it("reads the block-sequence spelling of `needs:` as well as the flow one", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowWith(SKIPPING_HELPER, [
        "  determinism-digest-24:\n    runs-on: ubuntu-latest\n",
        "  determinism-digest-24:\n    needs:\n      - changed-files\n    runs-on: ubuntu-latest\n",
      ]),
    );
    expect(problems.join("\n")).toContain("changed-files");
  });

  it("does NOT fail on a dependency that is itself guaranteed to run", () => {
    // The false-positive side again: the rule is about a job that can SKIP, not about `needs:`
    // itself, and a check that reds on a legitimate edge is a check somebody deletes.
    expect(reconcileWorkflowEngines([22, 24], workflowWith(RUNNING_HELPER, JOB_24_NEEDS))).toEqual(
      [],
    );
  });
});

describe("the reader is LINE-ORIENTED, so a spelling it cannot read is refused, not passed over", () => {
  /** The digest step of the LAST digest job, immediately above the comparison job. */
  const LAST_DIGEST_STEP =
    "      - name: Digest the declared corpus on this engine\n" +
    "        id: digest\n" +
    "        run: pnpm run determinism:digest\n\n  determinism-verify:";

  const sabotaged = (from: string, to: string): string => {
    const edited = workflowText().replace(from, to);
    expect(edited, "the sabotage did not apply, so the case below asserts nothing").not.toEqual(
      workflowText(),
    );
    return edited;
  };

  it("REFUSES a digest step written as a YAML FLOW MAPPING carrying an `if:`", () => {
    // A runner reads this identically to the block spelling four cases above cover. The `if:` KEY
    // rule is the right shape; what missed this is the line reader underneath it, so the shape it
    // cannot read is refused rather than approximated.
    const problems = reconcileWorkflowEngines(
      [22, 24],
      sabotaged(
        LAST_DIGEST_STEP,
        '      - { if: false, name: "Digest the declared corpus on this engine", id: digest, ' +
          'run: "pnpm run determinism:digest" }\n\n  determinism-verify:',
      ),
    );
    const named = problems.join("\n");
    expect(named).toContain("determinism-digest-24");
    expect(named).toContain("REFUSES to read");
    expect(named).toContain("UNCONDITIONALLY runs the per-engine digest step on [22]");
  });

  it("REFUSES flow syntax in the comparison job too", () => {
    const problems = reconcileWorkflowEngines(
      [22, 24],
      sabotaged(
        "      - name: Compare the digests across engines\n" +
          "        run: pnpm run determinism:verify\n",
        '      - { name: "Compare the digests across engines", ' +
          'run: "pnpm run determinism:verify" }\n',
      ),
    );
    expect(problems.join("\n")).toContain("determinism-verify");
    expect(problems.join("\n")).toContain("REFUSES to read");
  });

  it("does not read a GitHub expression or a shell expansion as flow syntax", () => {
    // `${{ ... }}` is the workflow language's braces and `${VAR}` is the shell's; the committed
    // workflow carries both. A refusal that fired on either would be a refusal nobody keeps.
    expect(reconcileWorkflowEngines([22, 24], workflowText())).toEqual([]);
    expect(
      reconcileWorkflowEngines(
        [22, 24],
        sabotaged(
          "      - run: pnpm install --frozen-lockfile\n\n" +
            "      - name: Digest the declared corpus on this engine\n" +
            "        id: digest\n" +
            "        run: pnpm run determinism:digest\n\n  determinism-verify:",
          "      - run: pnpm install --frozen-lockfile\n\n" +
            "      - name: Say where this ran\n" +
            "        run: echo ${HOME} ${{ github.run_id }}\n\n" +
            "      - name: Digest the declared corpus on this engine\n" +
            "        id: digest\n" +
            "        run: pnpm run determinism:digest\n\n  determinism-verify:",
        ),
      ),
    ).toEqual([]);
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

  it("fails when a `paths:` filter is added under a trigger whose `branches:` is left in place", () => {
    // The trigger is still there and still names `main`, so a check that matched `<event>:`
    // followed by `branches: [main]` and read no further saw nothing. A filter decides whether the
    // workflow STARTS AT ALL, which is quieter than an `if:`: an unstarted workflow leaves a
    // required check UNREPORTED rather than red.
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowText().replace(
        "  pull_request:\n    branches: [main]\n",
        "  pull_request:\n    branches: [main]\n    paths:\n      - src/**\n",
      ),
    );
    expect(problems.join("\n")).toContain("`pull_request:` trigger carries `paths`");
  });

  it("fails on every other filter under an event, because the rule is about the KEY", () => {
    for (const [event, filter] of [
      ["push", "    paths-ignore:\n      - docs-content/**\n"],
      ["push", "    branches-ignore:\n      - wip/**\n"],
      ["pull_request", "    types: [opened]\n"],
    ] as const) {
      const edited = workflowText().replace(
        `  ${event}:\n    branches: [main]\n`,
        `  ${event}:\n    branches: [main]\n${filter}`,
      );
      expect(edited, filter).not.toEqual(workflowText());
      expect(reconcileWorkflowEngines([22, 24], edited).join("\n"), filter).toContain(
        `\`${event}:\` trigger carries`,
      );
    }
  });

  it("reads every spelling of the branch list, because a runner reads them alike", () => {
    // The other side of the flow-mapping lesson: refusing a legitimate spelling is a check somebody
    // deletes, so `[main]`, `main` and a nested `- main` all have to be accepted, and a branch that
    // is not `main` has to red in each of them.
    for (const [spelling, expected] of [
      ["    branches: [main]\n", 0],
      ["    branches: main\n", 0],
      ["    branches:\n      - main\n", 0],
      ["    branches:\n      - some-integration-branch\n", 1],
      ["    branches: [main, wip/**]\n", 1],
    ] as const) {
      const edited = workflowText().replace(
        "  pull_request:\n    branches: [main]\n",
        `  pull_request:\n${spelling}`,
      );
      expect(reconcileWorkflowEngines([22, 24], edited), spelling).toHaveLength(expected);
    }
  });

  it("does not read a comment under a trigger as a filter", () => {
    // The false-positive side of the same rule: a comment is not a key, and a check that reds on
    // one is a check somebody stops writing comments around.
    const problems = reconcileWorkflowEngines(
      [22, 24],
      workflowText().replace(
        "  pull_request:\n    branches: [main]\n",
        "  pull_request:\n    # every pull request, deliberately unfiltered\n    branches: [main]\n",
      ),
    );
    expect(problems).toEqual([]);
  });
});
