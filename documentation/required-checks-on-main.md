Split out of `CLAUDE.md` to keep that file inside its byte budget. The text below is unchanged.
A pointer written `notes#<section>` names a section of `agent-notes.md` beside this file.

## Required checks on `main`

One ruleset protects `main`: **`required-checks`, id `19913330`**. **Read the live set back rather
than trusting any list written down** (`gh api "repos/cosyte/synth/rulesets?includes_parents=true"`):
a hardcoded list goes stale and it is prose no test can check. Snapshot + why every context is pinned
to the GitHub Actions app: `notes#the-one-ruleset-that-protects-main`.

- **Extend that one ruleset in place; never add a second for the next gate.** An unpinned required
  context can be satisfied by any actor with write access posting a commit status of that name,
  without the workflow ever running. `notes#extend-that-one-ruleset-in-place`.
- **Never require a context before its workflow has completed on `main`**: every future PR goes
  PENDING and unmergeable with nothing saying why. `test-selection`, `smoke (22)`/`smoke (24)` and
  `install (22)`/`install (24)` are deliberately not required yet; read real names off a live check
  run, never off a workflow's `name:`. `notes#contexts-deliberately-not-required-yet`.
- **Never rename a required job, and never split a step out of one**: both silently un-require it
  and leave PRs pending rather than red (why `build` and `smoke` are one job in `smoke.yml`).
  `notes#things-that-silently-detach-or-hollow-out-a-required-check`.
- **Never narrow `include` in `vitest.config.ts`.** `pnpm test` takes no path arguments, so that one
  glob selects everything `ci / verify` runs, and **coverage does not backstop it** (measured over
  `src/**` only, so dropping every `synthetic-safety.property.test.ts` costs 0% and reds nothing).
  **For a synthetic-data generator that is the whole safety story.** Gated by
  `pnpm check:test-selection`. `notes#things-that-silently-detach-or-hollow-out-a-required-check`.
- **Never replace that gate's exact-match script rule with a parser, and never answer a hole in it
  with one more spelling**: analysing a shell string is unbounded, and this is the half a refuter
  broke **three times** in `ncpdp`, each time in the remedy for the last. Its four deliberate shapes,
  and why **self-test C is NOT covered by self-test A**:
  `notes#the-test-selection-gate-and-its-four-deliberate-shapes`.
- **READ THE COUNTS OFF THE GATE, NOT OFF PROSE, AND MOVE THEM WHEN YOU ADD A TEST FILE.**
  `pnpm check:test-selection` prints watched / name-only / unwatched every run; they have gone stale
  **twice**. The numbers, and what the gate does **not** reach:
  `notes#know-the-denominator-and-what-the-gate-does-not-reach`.
- **Deleting a subpath from `exports` shrinks that gate's headline subject and it stays green**
  (measured). Not a free escape: it is a breaking change, and `scripts/smoke.mjs` derives its subpath
  set from the same map and **refuses** on disagreement. Two gates on one map, on purpose.
  `notes#narrowing-the-published-surface`.
- **Never require a workflow with no `pull_request` trigger** (`fuzz`, `scorecard`, `release`): it
  strands every PR forever. `notes#requiring-a-workflow-with-no-pull_request-trigger`.
- **RE-MEASURE EVERY PORTED SENTENCE AGAINST THIS REPO: the one failure that repeated.** Two of
  three refuter passes found a false number or a false claim of reach carried over from `ncpdp`/`deid`
  rather than a hole in the mechanism. **Where a number is asserted, name what produced it; where
  reach is asserted, bound it to a route actually seeded.**
  `notes#re-measure-every-ported-sentence-against-this-repo`.
- **Nothing inside this repository can observe its own ruleset.** Delete it and every test still
  passes, every gate still prints OK, and this file still says `main` is protected. A ruleset makes a
  red check block a merge; it does not make the check correct.
  `notes#nothing-inside-this-repository-can-observe-its-own-ruleset`.
