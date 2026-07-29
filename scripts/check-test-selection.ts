#!/usr/bin/env tsx
/**
 * scripts/check-test-selection.ts
 *
 * WHAT THIS GUARDS, AND WHY NOTHING ELSE COVERS IT.
 *
 * The required CI job runs `pnpm test` and `pnpm test:coverage`, which run vitest, which runs
 * whatever the config's `include` globs select. A required JOB gates its STEPS; it does not gate
 * what those steps SELECT. So this package's whole synthetic-safety property layer hangs off one
 * line of repo-local config:
 *
 *     include: ["test/**\/*.test.ts", "src/**\/*.test.ts"]
 *
 * The shared `@cosyte/vitest-config` supplies no `include` of its own and spreads this repo's
 * `test` block last, so that line is hand-written, unguarded, and a one-line edit. Narrow it to
 * `test/hl7` and every one of the six `synthetic-safety.property.test.ts` files stops running,
 * together with the seed-sweep fuzz and the PHI-scanner suite, while every required check stays
 * green. `test/hl7` is the example because it is the ONE format directory holding no safety suite:
 * an earlier draft of this line said `test/hl7` and `test/fhir`, which a refuter caught, because
 * `test/fhir/synthetic-safety.property.test.ts` exists and that pair would have left 1 of the 6
 * running. Getting the illustration wrong in the direction of overstating the damage is still
 * getting it wrong.
 *
 * FOR THIS PACKAGE THAT IS THE WHOLE SAFETY STORY. `@cosyte/synth` is a synthetic-data generator:
 * its one non-negotiable promise is that no value it emits can be real or plausibly-real PHI. The
 * executable proof of that promise is the property layer, and nothing names it. A generator that
 * silently starts emitting a real-looking SSN, MRN or name is the failure mode, and it fails green.
 *
 * COVERAGE CANNOT BACKSTOP IT. Coverage is measured over `src/**\/*.ts`. The property suites
 * re-walk `src/` paths the unit suites already touch, and the PHI scanner lives in `scripts/`, so
 * dropping either costs approximately zero coverage percent. That is what makes this silent rather
 * than merely risky.
 *
 * WHAT THIS FILE DOES. It compares the set of test files that EXIST against the set of test files
 * vitest would actually RUN, checks that the package scripts CI invokes do not narrow the run
 * behind the config's back, and reds on any shortfall IN ITS SUBJECT. It then proves, on every
 * single run, that it can still observe each of those, by seeding the removals and requiring
 * itself to catch them.
 *
 * "IN ITS SUBJECT" IS LOAD-BEARING, so the OK line prints the denominator rather than a bare OK.
 *
 * ---------------------------------------------------------------------------
 * FIVE DESIGN RULES, each load-bearing. Do not "simplify" past them.
 *
 * (1) DENY-LIST THE EXCLUSIONS, NEVER ALLOW-LIST THE INCLUSIONS. An allow-list silently skips
 *     everything it does not name. The sibling PHI gate shipped exactly that bug: it allow-listed
 *     git status letters with `--diff-filter=AM` and therefore skipped renames, and then type
 *     changes, because neither letter was named. Here the subjects are membership tests that
 *     INCLUDE by default: a new file that references a published entry is in the subject the
 *     moment it exists, with no registration step and no exemption to qualify for.
 *
 * (2) OBSERVE THE RESOLVED SELECTION, NOT THE CONFIG TEXT. This asks vitest itself, via
 *     `vitest list --filesOnly`, which files it would run. Reading the globs out of
 *     `vitest.config.ts` and reasoning about them would miss every other way to narrow a
 *     selection: `exclude`, `projects`, `dir`, a workspace. Asking the runner is the only way the
 *     answer stays true when the mechanism changes. It does NOT buy a config body that branches on
 *     its own invocation; see the limits below, where that is measured rather than asserted.
 *
 * (3) THE CONFIG IS NOT THE ONLY SELECTOR. THE INVOCATION IS ONE TOO. A pristine config proves
 *     nothing if the command line narrows the run, and `vitest list` cannot see that, because it
 *     resolves the config rather than the package script. THIS RULE DOES NOT PARSE. The sibling
 *     repo shipped three parsing versions and a refuter broke each: keying on the literal
 *     `vitest run` let `vitest --run <path>` past; looking for bare tokens made every
 *     `--flag=value` narrowing invisible; and tokenising after a whole-word `vitest` failed CLOSED
 *     on arguments but OPEN on the invocation, so `"test": "pnpm run test:unit"` contained no
 *     `vitest` token, produced no arguments, and was reported as passing. Analysing a shell string
 *     is unbounded and each round bought exactly one more spelling. The rule is total instead: the
 *     body must equal one of two exact strings. See `ALLOWED_TEST_SCRIPT_BODIES`, ported here
 *     unchanged because this repo's two script bodies are spelled identically to that repo's.
 *
 * (4) THE SUBJECTS ARE DERIVED FROM ARTIFACTS THAT EXIST FOR THEIR OWN REASONS. A list in this
 *     file saying "the safety property suites matter" would be a second, hand-editable lever on
 *     the gate's own scope, deletable in one line by the same person narrowing the glob. A gate
 *     whose subject is hand-edited is not a gate.
 *
 *     THE SIBLING'S DERIVATION DOES NOT PORT, AND WAS NOT FORCED TO. That repo derives its fuzz
 *     subject from a workflow that hands a path straight to `vitest run`. No workflow in this repo
 *     contains the string `vitest run` at all, so ported verbatim that rule finds nothing and
 *     refuses. Three subjects are derived here instead, each read out of a committed file that is
 *     not ours to quietly edit:
 *
 *     (4a) THE PUBLISHED SURFACE, `package.json` `exports`. This is the headline subject and the
 *          one that reaches the safety property layer. Every `exports` entry resolves to a built
 *          `dist/<x>/index.mjs`, which is emitted from `src/<x>/index.ts`; that mapping is
 *          mechanical, not a convention this file invented. So the eight published subpaths yield
 *          eight source entry points, and the rule is: EVERY tracked code module IN SCOPE that
 *          names one of those entry points as an import specifier MUST be selected, and EVERY
 *          published entry point must have at least one selected module naming it. It is keyed on
 *          a RESOLVED PATH, not on a filename and not on a bare mention, so a rename changes
 *          nothing, and its scope is a DENY-LIST of three locations (see `OUT_OF_SCOPE`), so a move
 *          anywhere outside those three changes nothing either. It reaches 38 of this repo's 39
 *          in-scope test modules, which is why the denominator below reads the way it does.
 *          Removing a subpath from `exports` to shrink the subject is a breaking change to the
 *          published package, and it also reds the smoke, which derives its own subpath set from
 *          the same map.
 *
 *     (4b) THE FUZZ PATH, derived in two steps because that is how this repo spells it. The
 *          nightly `Fuzz` workflow runs `pnpm test:fuzz`, and the `test:fuzz` script body is a
 *          `vitest run <path>`. Both halves are committed files that exist to make the nightly
 *          fuzz run at all, and deleting either breaks that job rather than quietly shrinking this
 *          one. TODAY THIS SUBJECT IS REDUNDANT: the single module it names also imports a
 *          published entry, so (4a) already reaches it. It is kept because it is independently
 *          grounded, and for its empty-set refusal. STATE THAT REFUSAL PRECISELY: it fires when NO
 *          workflow names any path, so it is a tripwire on the fuzz job disappearing WITHOUT some
 *          other literal path being left behind anywhere in a workflow. It is forgeable in the
 *          suppressing direction, because the extraction is text and does not distinguish a real
 *          `run:` command from prose that quotes one: leaving `# e.g. vitest run test/hl7` in a
 *          comment and then deleting `fuzz.yml` and the `test:fuzz` script yields a derived path of
 *          `test/hl7`, whose two modules are selected, and this passes green. That generosity is
 *          the safe direction for KEEPING a subject alive and the unsafe one for the refusal, and
 *          calling it an unconditional tripwire would be an overclaim.
 *
 *     (4c) THE PHI SCANNER, ported directly: a `phi-scan` package script plus `run-phi-scan: true`
 *          in the CI caller make "a suite must exercise the scanner" a derived requirement rather
 *          than an opinion held by this file.
 *
 * (5) THE GATE MUST DEMONSTRATE ITS OWN REDNESS, NOT ASSERT IT. A guard like this is easy to make
 *     vacuous by accident: point it at the wrong root, mis-normalise a path, let a subprocess fail
 *     open. So before it reports anything it seeds the removals it exists to catch and requires
 *     itself to catch them. Note what self-test A does differently from the sibling's: it requires
 *     a DERIVED rule to name the dropped file, ignoring the filename floor entirely. The sibling's
 *     A passed even with both derived rules NEUTERED, because every file it protected was also
 *     name-shaped and the floor answered for them; this one fails in that case, which is the
 *     reading that matters.
 *
 *     BE EXACT ABOUT WHAT A DOES NOT PROVE, because the honest version of this claim is narrower
 *     than "A cannot pass with the derived rules gutted". A's targets come from `protectedFiles()`
 *     and its verdict from `derivedNames()`, which read the same three sets, so EMPTYING a subject
 *     empties A's targets along with it and A passes vacuously for that subject. What A actually
 *     proves is that the comparison in `violationsFor` still reports every member of a POPULATED
 *     subject, one at a time, in the colliding direction. Self-test C is the real backstop for the
 *     derived rules; do not delete it thinking A covers them.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DOES NOT COVER, stated plainly rather than left to be discovered. A list of known
 * limits, not a proof that the list is complete.
 *
 *   * A CONFIG THAT BRANCHES ON ITS OWN INVOCATION. `resolvedSelection` runs `vitest list` and CI
 *     runs `vitest run`, so an `include` that reads `process.argv` can answer the two differently
 *     and this gate reports the wide answer. STATED BECAUSE IT WAS MEASURED, NOT BECAUSE IT IS
 *     SUSPECTED: seeded here, a config serving the full glob under `list` and `["test/hl7/**"]`
 *     under `run` left this gate green while CI would have run 2 of 39 suites. Every other
 *     config-side narrowing is caught; this one is not, and no rule below claims otherwise.
 *   * WHICH SCRIPT the shared pipeline elects to invoke. This checks `test` and `test:coverage`,
 *     the two the shared caller in `cosyte/.github` runs today. That repo is not this one's to
 *     edit, and a change there is out of this gate's reach.
 *   * Scripts other than those two, and anything a workflow runs inline rather than through a
 *     package script.
 *   * SHRINKING THE PUBLISHED SURFACE ITSELF. Subject (4a) is only as wide as `exports`, so removing
 *     a subpath narrows it. MEASURED: deleting `"./astm"` from `exports` leaves this gate GREEN and
 *     moves TWO `test/astm` suites (`determinism.property.test.ts`, `generators.test.ts`) out of the
 *     derived subject and onto the filename floor, which the denominator reports as 38
 *     name-independent going to 36 and the filename-only count going 1 to 3. The other three
 *     `test/astm` suites also name `src/index.ts`, so they stay. It is not a free escape. The
 *     suites still red if they are also dropped from the selection, un-exporting a subpath is a
 *     breaking change to the published package, and `scripts/smoke.mjs` derives its own subpath set
 *     from the same map and REFUSES when that set and its probe map disagree, so the same edit reds
 *     the smoke. Two gates on one map, on purpose. What this gate does NOT do is red on it by
 *     itself, and the denominator is how you see it happen.
 *   * A MOVE INTO ONE OF THE THREE DENIED LOCATIONS. `src/`, `scripts/` and the repo root are out
 *     of scope for both content-keyed subjects, so a suite moved into one of them leaves the
 *     subject and every denominator count at once. FOUND BY A REFUTER AGAINST THE FIRST VERSION OF
 *     THIS FILE, WHICH SCOPED BOTH SUBJECTS TO `test/` AND THEREFORE LOST A SUITE MOVED ANYWHERE
 *     ELSE AT ALL. Measured then: relocating all six `synthetic-safety.property.test.ts` files into
 *     an `internal/` directory removed the entire safety layer from CI, `vitest list` selected zero
 *     of them, and this gate printed OK exit 0. The deny-list narrows that to three locations; it
 *     does not close it. Note the deny-list's three (`src/`, `scripts/`, the repo root) are NOT the
 *     same set `tsconfig.json` and the lint globs name (`src/`, `scripts/`, `test/`, plus root
 *     `*.config.ts`); an earlier draft said they were. The overlap that matters is that a module in a
 *     directory none of them names, an `internal/` say, is invisible to typecheck and lint as well as
 *     to vitest, which is why this subject had to stop being an allow-list.
 *   * A MODULE THAT REACHES `src/` WITHOUT NAMING IT. Subject (4a) resolves import specifiers, so
 *     a suite that reaches the public surface only through a computed `import()` expression, or
 *     only via a helper module that does the importing, is not in that subject and falls back to
 *     the filename floor. That is the residual on the strongest rule here, and it is narrower than
 *     it was: a refuter found that discarding any specifier containing a backslash made a unicode
 *     escape inside the path a one-edit way out, so `specifierSpellings` now decodes escapes and
 *     normalises separators before resolving.
 *
 *     WHAT REMAINS IS AT LEAST FOUR KINDS OF LITERAL, and a second refuter pass caught an earlier
 *     draft of this line claiming otherwise ("not a literal at all, a conspicuous rewrite rather
 *     than one character"). That was false. `specifierSpellings` decodes the JSON escape subset
 *     only. "At least" is deliberate: this is a list of known holes, not a proof it is complete, and
 *     a third pass added the fourth after an earlier draft said "three".
 *
 *       (i)   an escape JSON does not accept: `"../../src/hl7/index\x2ejs"`, or `\u{2e}`. Both cook
 *             to `.` at runtime; a four-digit `.` IS decoded here, so the pass-1 fix is real.
 *             MEASURED: taking the seeded route that reds under `.` and changing it to `\x2e`
 *             flips this gate to OK exit 0. The denominator does move (the file lands in the
 *             unwatched count and is named there), which is the only thing standing under it.
 *       (ii)  a DEEP `src/` path rather than an entry point: `../../src/x12/claim-837.js` is not one
 *             of the eight published entries. Suites here already import deep paths legitimately
 *             (`../../src/x12/money.js`, `../../src/safe/names-pool.js`), so swapping an
 *             `index.js` import for the module a suite actually exercises reads as a refactor.
 *       (iii) a self-reference through the package name, `@cosyte/synth/hl7`, filtered out before
 *             resolution because it is neither relative nor `src/`-rooted. Weaker than (i) and (ii)
 *             in practice, and an earlier draft overstated it by lumping it in with them: it
 *             resolves only once `dist/` exists, and CI runs `typecheck` before `build`, so on a
 *             clean checkout a suite rewritten this way fails typecheck rather than passing quietly.
 *       (iv)  a specifier longer than `QUOTED`'s 400-character body cap, which is never captured at
 *             all. Padding a path past 400 characters resolves, typechecks and lints. Same outcome
 *             as (i), and about as conspicuous in review.
 *
 *     DO NOT CHASE THESE BY TEACHING THE DECODER JS ESCAPES OR BY WIDENING `sources` PAST
 *     `exports`. That is growing the guard to defend a sentence, which is how this file's subject
 *     got its polarity wrong in the first place. Fix the sentence; the routes are named here.
 *   * `test/docs-content.test.ts`, the one in-scope test module no derived rule reaches. It is
 *     watched by the `.test.`/`.spec.` filename shape alone, so renaming it out of that shape
 *     stops it running with this gate green. The OK line counts it.
 *   * Whether a selected test ASSERTS anything useful. Selection is necessary, never sufficient.
 *     That is the refuter's job and the coverage gate's.
 *   * A file whose only home is an untracked working tree. Invisible here and equally invisible to
 *     CI, which is the same thing being true twice rather than a hole.
 *
 * ---------------------------------------------------------------------------
 * HOW EVERY NUMBER ABOVE WAS MEASURED, so none of them is merely asserted.
 *
 * Three refuter passes on this file all came back red, and TWO of the three found a false NUMBER or a
 * false CLAIM OF REACH rather than a hole in the mechanism: a figure labelled `MEASURED` that was not
 * (three `test/astm` suites, actually two), and a motivating example that was wrong (`test/hl7` plus
 * `test/fhir`, which leaves one of the six safety suites running). The cause was the same both times,
 * and it was diagnosed rather than guessed: SENTENCES PORTED FROM A SIBLING REPO WITHOUT RE-MEASURING
 * THEM HERE. So every quantity is listed with the command that produces it, and every statement about
 * reach is bounded to a route that was actually seeded.
 *
 *   39 / 38 / 1 / 0 (in scope, name-independent, filename-shape-only, unwatched)
 *       Printed by this file on every run. Never quote it from memory: run `pnpm check:test-selection`.
 *   8 published entry points
 *       Same OK line, derived from `package.json` `exports` at run time.
 *   six `synthetic-safety.property.test.ts` files, and `test/hl7` the only format directory with none
 *       `git ls-files | grep -c 'synthetic-safety\.property\.test\.ts'` is 6;
 *       `git ls-files -- test/<dir> | grep -c synthetic-safety` is 0 for `hl7` and 1 for each of
 *       `fhir`, `ccda`, `x12`, `ncpdp`, `astm`, `property`.
 *   "2 of 39" for the argv-divergence route, and "zero of the six"
 *       Set `include: ["test/hl7/**\/*.test.ts"]` and run `vitest list --filesOnly -r .`: 2 files, of
 *       which 0 match `synthetic-safety`. The unnarrowed config lists 39.
 *   "38 to 36, TWO `test/astm` suites" for the un-export route
 *       Delete `"./astm"` from `exports`, run this gate, read its DENOMINATOR line: derived 36, and
 *       the filename-shape-only list names `test/astm/determinism.property.test.ts` and
 *       `test/astm/generators.test.ts` alongside `test/docs-content.test.ts`.
 *   "ncpdp's like-for-like is 4 of 27"
 *       In `../ncpdp`: `git ls-files -- test | grep -cE '\.[cm]?[jt]sx?$'` is 27 in-scope modules
 *       (its own header quotes "4 of 24", counting only the 24 name-shaped files, which flatters the
 *       ratio); 3 modules under `test/property` plus 1 referencing the PHI scanner is the 4.
 *   "the invocation rule ports verbatim"
 *       Both repos' `test` and `test:coverage` bodies compared and byte-identical:
 *       `["vitest run","vitest run --coverage"]`.
 *   "no workflow here contains `vitest run`"
 *       `git grep -c 'vitest run' -- .github/workflows` returns nothing.
 *
 * WHAT "THESE ROUTES ARE CLOSED" IS BOUNDED TO. Only the routes seeded one at a time and observed to
 * red: narrowing `include`; an `exclude` on the safety suites and on `test/property/`; both spellings
 * of a positional path filter; `--shard=`; `--config=`; bodies naming no vitest at all, including a
 * delegation to this repo's own `test:fuzz`; a suite renamed to `.ts`, `.spec.ts`, `_safety.ts`,
 * `_helpers.ts`, `test/_helpers/load-fixture.ts`, `test/_x/parse.ts` or
 * `test/_helpers/fuzz-config.ts`; the PHI suite renamed; the fuzz subject renamed; `run-phi-scan:
 * false`; un-exporting `./astm` together with a narrowed include; and any suite relocated out of
 * `test/`. It is NOT a claim that the selection cannot be collapsed, and the limits above are the
 * routes that stayed green.
 *
 * Run it locally with `pnpm check:test-selection`, also reached by `pnpm check`, which is on the
 * meta-repo's `scripts/verify.sh synth` ladder.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_DIR = join(ROOT, ".github", "workflows");

/** The two package scripts the shared CI pipeline invokes. Both must exist. */
const CI_TEST_SCRIPTS = ["test", "test:coverage"];

/** TypeScript/JavaScript module suffixes, used where a rule must not key on `.test.`. */
const CODE_FILE = /\.[cm]?[jt]sx?$/;

/** A path is compared and reported in POSIX form, whatever the host separator is. */
const toPosix = (p: string): string => p.split(sep).join("/");

/** Every problem found, printed together at the end. One run, all the news. */
const failures: string[] = [];
const fail = (message: string): void => {
  failures.push(message);
};

/**
 * A refusal is not a failure. A failure means the repo is wrong; a refusal means THIS FILE could
 * not do its job, and reporting either OK or a tidy list of violations from a scan that did not
 * complete is the worst of the three outcomes. Refusals exit immediately.
 */
function refuse(message: string): never {
  process.stderr.write(`check-test-selection: REFUSING TO REPORT\n  ${message}\n`);
  process.exit(1);
}

/** Run a command, refusing on any non-zero exit or spawn error. No silent fail-open. */
function run(cmd: string, args: string[], what: string): string {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (r.error) refuse(`${what}: could not run \`${cmd}\`: ${r.error.message}`);
  if (r.status !== 0) {
    refuse(
      `${what}: \`${cmd} ${args.join(" ")}\` exited ${String(r.status)}\n  ${r.stderr.trim()}`,
    );
  }
  return r.stdout;
}

// ---------------------------------------------------------------------------
// THE TWO SETS.

/** Every tracked path in the repo. The one enumeration everything else is derived from. */
function trackedFiles(): string[] {
  const out = run("git", ["ls-files", "-z"], "listing tracked files");
  const files = out.split("\0").filter(Boolean).map(toPosix).sort();
  if (files.length === 0) {
    refuse(
      "`git ls-files` reported zero tracked files, so the enumeration is broken rather than the " +
        "repo being empty. Refusing to report anything from a listing that read nothing.",
    );
  }
  return files;
}

/**
 * The repo-wide floor: tracked files whose NAME says they are tests. This is a filename allow-list
 * and is therefore the weakest rule here on purpose. Suffixes are broad (`.test.` and `.spec.`,
 * any TS/JS extension) because the narrow version of this line was itself the escape hatch a
 * rename walked through in the sibling repo.
 */
const nameShapedTests = (tracked: string[]): string[] =>
  tracked.filter((f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f));

/**
 * What RUNS. Asks vitest to resolve its own selection. `configPath` is used only by self-test C,
 * which points it at a deliberately narrowed config.
 *
 * The output filter takes whole-line, whitespace-free, code-suffixed tokens, so a banner or
 * deprecation notice that happens to name a `.ts` file cannot be mistaken for a selected file.
 * Anything that slips through anyway is additive, and an addition can only mask a real shortfall by
 * coinciding exactly with a tracked path; the OK line reports the count of selected-but-untracked
 * entries so that stays visible rather than silent.
 */
function resolvedSelection(configPath?: string): string[] {
  const args = ["list", "--filesOnly", "-r", ROOT];
  if (configPath !== undefined) args.push("-c", configPath);
  const out = run("./node_modules/.bin/vitest", args, "resolving the vitest selection");
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/\s/.test(l) && CODE_FILE.test(l))
    .map((l) => toPosix(relative(ROOT, resolve(ROOT, l))))
    .sort();
}

// ---------------------------------------------------------------------------
// THE INVOCATION RULE (design rule 3). PORTED UNCHANGED.

/**
 * The COMPLETE, exact bodies the two CI test scripts are allowed to have.
 *
 * THIS RULE DOES NOT PARSE, and the reason is written out in design rule 3 above: three successive
 * parsing versions in the sibling repo each shipped an evasion that the next refuter pass found. So
 * the rule is total instead. The script body must be one of these strings, character for character.
 * There is no spelling to miss, because nothing is interpreted. A wrapper, a delegation to another
 * script, an extra flag, an alternate config, a path filter and a shard are all simply "not one of
 * these two strings".
 *
 * PORTED VERBATIM ON PURPOSE. This repo's `test` and `test:coverage` bodies are spelled identically
 * to the sibling's, verified before reuse, so this is the same closed rule rather than a
 * re-derivation that might drift.
 *
 * THE COST, ACCEPTED DELIBERATELY: a legitimate addition such as `--reporter=github-actions` reds
 * until it is added here. That is a one-line, reviewed commit, and the diff shows the whole new
 * body rather than a flag name whose effect a reader has to know.
 */
const ALLOWED_TEST_SCRIPT_BODIES = new Set(["vitest run", "vitest run --coverage"]);

/** True when a script body is an exactly-known-good invocation. Whitespace-normalised. */
const bodyIsAllowed = (body: string): boolean =>
  ALLOWED_TEST_SCRIPT_BODIES.has(body.trim().replace(/\s+/g, " "));

// ---------------------------------------------------------------------------
// THE PACKAGE MANIFEST.

interface PackageJson {
  scripts?: Record<string, string>;
  exports?: unknown;
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as PackageJson;
const scripts = pkg.scripts ?? {};

// ---------------------------------------------------------------------------
// DERIVED SUBJECT 4a: THE PUBLISHED SURFACE.

/** A published subpath and the `src/` entry point its build output is emitted from. */
interface PublishedEntry {
  subpath: string;
  source: string;
}

/** Every string leaf in an `exports` condition tree, however deeply the conditions nest. */
function stringLeaves(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") {
    out.push(node);
  } else if (typeof node === "object" && node !== null) {
    for (const v of Object.values(node as Record<string, unknown>)) stringLeaves(v, out);
  }
  return out;
}

/**
 * The published source entry points, derived from `package.json` `exports`.
 *
 * `./dist/<x>/index.mjs` is emitted from `src/<x>/index.ts` and `./dist/index.mjs` from
 * `src/index.ts`. That mapping is the build's, not this file's invention, and `tsup.config.ts`
 * lists exactly those entries.
 *
 * THERE IS NO EXCLUSION LIST, DELIBERATELY. `"./package.json": "./package.json"` drops out because
 * its target is structurally DATA (a bare string that is not a `dist/` entry), not because a key
 * was named somewhere. A named exclusion would be a second lever on this gate's scope, which is
 * exactly what design rule 4 exists to prevent. Anything under `exports` that looks like a built
 * entry and does not fit the shape REFUSES rather than being skipped: a subject that cannot be
 * derived is not a subject that is absent.
 */
function publishedEntries(): PublishedEntry[] {
  const map = pkg.exports;
  if (typeof map !== "object" || map === null) {
    refuse(
      "package.json has no `exports` object, so there is no published surface to derive the test " +
        "subject from. This gate's headline subject is the set of published subpaths; without it " +
        "the gate would fall back to filename shape alone and report a green it has not earned.",
    );
  }

  const entries: PublishedEntry[] = [];
  for (const [subpath, target] of Object.entries(map as Record<string, unknown>)) {
    const dists = stringLeaves(target)
      .map((s) => s.replace(/^\.\//, ""))
      .filter((s) => s.startsWith("dist/"));
    if (dists.length === 0) continue; // structurally data, not a built entry point

    const sources = new Set<string>();
    for (const d of dists) {
      const m = /^dist\/(?:(.+)\/)?index\.[cm]?js$/.exec(d);
      if (m === null) {
        if (/\.d\.[cm]?ts$/.test(d)) continue; // a types condition, same entry, no new source
        refuse(
          `exports["${subpath}"] points at \`${d}\`, which is not the \`dist/[<dir>/]index.<ext>\` ` +
            "shape this gate maps back to a `src/` entry point. Refusing rather than skipping it: " +
            "a published subpath whose source cannot be derived would silently leave its suites " +
            "outside this gate's subject.",
        );
      }
      const dir = m[1];
      sources.add(dir === undefined ? "src/index.ts" : `src/${dir}/index.ts`);
    }
    if (sources.size === 0) {
      refuse(
        `exports["${subpath}"] names \`dist/\` targets but none of them resolve to a runtime entry ` +
          "point, so its source cannot be derived.",
      );
    }
    for (const source of sources) entries.push({ subpath, source });
  }

  if (entries.length === 0) {
    refuse(
      "no `exports` entry resolves to a `dist/` entry point, so this gate has no published surface " +
        "to protect. If the package genuinely stopped publishing subpaths, this derivation has to " +
        "be re-grounded deliberately rather than allowed to pass vacuously.",
    );
  }
  return entries;
}

/**
 * Every spelling of one quoted string that could denote the same module specifier.
 *
 * A REFUTER FOUND THIS. The first version discarded any specifier containing a backslash, which
 * made `"../../src/hl7/index\u002ejs"` a one-edit way out of the subject: the escape is resolved by
 * the compiler, so the import still works and still typechecks, while the raw source text this file
 * reads no longer looks like the path. So the raw text is not trusted to be the specifier. It is
 * decoded as a JSON string literal when it can be, and backslashes are also read as separators for
 * a Windows-style path, and every spelling is tried.
 */
function specifierSpellings(raw: string): string[] {
  const out = new Set<string>([raw]);
  if (raw.includes("\\")) {
    try {
      out.add(JSON.parse(`"${raw}"`) as string);
    } catch {
      // Not a decodable JSON literal (a single-quoted string escaping its own quote, say). The raw
      // and separator-normalised spellings below still get their turn.
    }
    for (const s of [...out]) out.add(s.split("\\").join("/"));
  }
  return [...out];
}

/**
 * Candidate repo-relative paths a specifier could denote, resolved against the importing file.
 * Generous on purpose: over-matching puts a file INTO the subject, which is a loud false red, and
 * under-matching drops it out silently. Under PHI, a false red is the safe way to be wrong.
 */
function specifierCandidates(fromFile: string, raw: string): string[] {
  const out: string[] = [];
  for (const spec of specifierSpellings(raw)) {
    if (!spec.includes("/") || spec.includes("$")) continue;
    let base: string;
    if (spec.startsWith(".")) {
      base = toPosix(relative(ROOT, resolve(ROOT, dirname(fromFile), spec)));
    } else if (spec.startsWith("src/")) {
      base = spec;
    } else {
      continue;
    }
    if (base.startsWith("..") || base.length === 0) continue;
    out.push(base, base.replace(/\.[cm]?js$/, ".ts"), `${base}.ts`, `${base}/index.ts`);
  }
  return out;
}

/** Every quoted string in a file. Template literals carrying `${}` are skipped by the resolver. */
const QUOTED = /(['"`])([^'"`\n]{1,400})\1/g;

/**
 * WHERE A SUBJECT MAY NOT LIVE. THE POLARITY HERE IS THE WHOLE POINT, AND IT WAS WRONG ONCE.
 *
 * The first version of this file scoped both content-keyed subjects with `f.startsWith("test/")`,
 * which is an ALLOW-LIST OF LOCATIONS: every directory it did not name was skipped by default. That
 * is the identical shape design rule 1 exists to forbid, committed against this gate's own subject,
 * and a refuter demonstrated it. `git mv test/property/synthetic-safety.property.test.ts
 * internal/synthetic-safety.ts` (fixing the two relative imports) left the module tracked, importing
 * a published entry, and selected by nothing, and this gate printed OK exit 0. Doing it to all six
 * `synthetic-safety.property.test.ts` files removed the ENTIRE synthetic-safety property layer from
 * CI: measured, `vitest list` then selected zero of them and the gate still printed OK, with only
 * the denominator sliding 39 to 33 to show for it.
 *
 * So the scope is a DENY-LIST now. A tracked code module is in scope wherever it lives unless it is
 * one of three things that legitimately name the package's own source without being a test:
 *
 *   `src/`      the implementation itself, which imports its own entry points constantly.
 *   `scripts/`  repo tooling, including this file, which builds `src/<x>/index.ts` strings.
 *   repo root   the build and lint config (`tsup.config.ts` names all eight entries as its entry
 *               points, `vitest.config.ts`, `eslint.config.js`).
 *
 * Those three are the complete set of tracked code locations outside `test/` today, so this change
 * is behaviour-identical on the current tree and differs only on a location that does not yet
 * exist, which is exactly the direction a deny-list is supposed to differ in. A new `internal/`,
 * `lib/`, `spec/` or `e2e/` is covered the moment it appears, with no edit here.
 */
const OUT_OF_SCOPE = (f: string): boolean =>
  f.startsWith("src/") || f.startsWith("scripts/") || !f.includes("/");

/**
 * For each tracked module in scope, the set of published source entry points it names.
 *
 * KEYED ON A RESOLVED PATH, NOT ON A NAME AND NOT ON A BARE MENTION. The sibling repo's PHI rule
 * matched any occurrence of a substring, and its own header records why that is weak: prose can
 * forge a substring. A specifier that RESOLVES onto a published entry point cannot be forged by
 * rewording, and it cannot be evaded by renaming the file or moving it, because neither the
 * filename nor the directory plays any part outside the deny-list above. Reading the whole file
 * rather than only its `import` statements is the generous direction: a path named in a comment
 * keeps the file in the subject, which costs a visible false red at worst.
 */
function entryReferences(tracked: string[], entries: PublishedEntry[]): Map<string, Set<string>> {
  const sources = new Set(entries.map((e) => e.source));
  const out = new Map<string, Set<string>>();
  for (const f of tracked) {
    if (OUT_OF_SCOPE(f) || !CODE_FILE.test(f)) continue;
    const hits = new Set<string>();
    const text = readFileSync(join(ROOT, f), "utf8");
    for (const m of text.matchAll(QUOTED)) {
      for (const cand of specifierCandidates(f, m[2] ?? "")) {
        if (sources.has(cand)) hits.add(cand);
      }
    }
    if (hits.size > 0) out.set(f, hits);
  }
  return out;
}

// ---------------------------------------------------------------------------
// DERIVED SUBJECT 4b: THE FUZZ PATH, IN TWO STEPS.

/**
 * Paths this repo's workflows hand to a `vitest run`, directly or through a package script.
 *
 * THE TWO-STEP FORM IS WHY THIS IS NOT THE SIBLING'S RULE VERBATIM. No workflow here contains the
 * string `vitest run`; the nightly `Fuzz` job runs `pnpm test:fuzz`, and the path lives in that
 * script's body. Both halves are committed files that exist to make the nightly fuzz run at all.
 * The direct form is kept alongside it so a workflow that inlines the command in future is picked
 * up without an edit here.
 *
 * The extraction is text, not YAML, so it needs shape filters: stop at the first shell
 * metacharacter (so a redirection like `2>/dev/null` is not mistaken for a path) and keep only
 * tokens containing a `/`. Script names are matched as whole words anywhere in a workflow, which is
 * deliberately generous: prose in a comment that names a script counts, because a subject kept
 * alive is the safe direction to be wrong in.
 *
 * NOT filtered by "does this path exist": deleting the directory would otherwise delete the
 * requirement along with it, which is precisely the failure being closed. An interpolated argument
 * yields no literal path and therefore no subject; if it were the only one, the empty-set refusal
 * fires rather than a quiet pass.
 */
function workflowDerivedPaths(): string[] {
  const names = run("git", ["ls-files", "-z", "--", ".github/workflows"], "listing workflows")
    .split("\0")
    .filter(Boolean);
  if (names.length === 0) refuse("no tracked workflow files found under .github/workflows");

  const workflowText = names.map((n) => readFileSync(join(ROOT, n), "utf8")).join("\n");

  // Step one: every line that can carry the command. Directly from a workflow, or from the body of
  // any package script a workflow names.
  const commandLines = [...workflowText.split("\n")];
  for (const [name, body] of Object.entries(scripts)) {
    const word = new RegExp(
      `(^|[\\s'"\`])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[\\s'"\`])`,
      "m",
    );
    if (word.test(workflowText)) commandLines.push(body);
  }

  // Step two: the path tokens each such line hands to `vitest run`.
  const found = new Set<string>();
  for (const line of commandLines) {
    const after = /vitest\s+run\s+(.*)$/.exec(line)?.[1];
    if (after === undefined) continue;
    for (const raw of (after.split(/[|&;<>#]/)[0] ?? "").split(/\s+/)) {
      const tok = raw.replace(/[`'"\\,.)(]+$/, "").replace(/^[`'"\\(]+/, "");
      if (tok.startsWith("-") || tok.includes("$") || !tok.includes("/")) continue;
      found.add(toPosix(tok));
    }
  }

  if (found.size === 0) {
    refuse(
      "no workflow hands a path to `vitest run`, directly or through a package script it names, so " +
        "this gate has no derived fuzz subject to protect. The nightly Fuzz workflow runs " +
        "`pnpm test:fuzz`, whose body names the seed-sweep suite. If that job or that script was " +
        "removed on purpose, this derivation has to be re-grounded on whatever replaced it, " +
        "deliberately, rather than allowed to pass vacuously.",
    );
  }
  return [...found].sort();
}

/**
 * EVERY tracked module under a derived path, and EVERY ONE OF THEM MUST RUN. No name filter, and no
 * exemption of any kind. The sibling repo shipped two exemptions here and a rename walked through
 * both: `_`-prefixed modules, and then `_`-prefixed modules that nothing running imports, where the
 * import test was a substring search that `_helpers.ts` satisfied by collision. Both measured
 * green. An absent exemption has nothing to forge.
 */
const modulesUnder = (tracked: string[], path: string): string[] =>
  tracked.filter((f) => (f === path || f.startsWith(`${path}/`)) && CODE_FILE.test(f));

// ---------------------------------------------------------------------------
// DERIVED SUBJECT 4c: THE PHI SCANNER. PORTED DIRECTLY.

/**
 * Whether the shared CI caller switches the PHI scanner on. Paired with the presence of a
 * `phi-scan` package script, this is what makes "a suite must exercise the PHI scanner" a derived
 * requirement rather than an opinion held by this file.
 */
function ciEnablesPhiScan(): boolean {
  const p = join(WORKFLOW_DIR, "ci.yml");
  if (!existsSync(p)) refuse(".github/workflows/ci.yml is missing; cannot derive the PHI subject");
  return /^\s*run-phi-scan:\s*true\s*$/m.test(readFileSync(p, "utf8"));
}

/**
 * Tracked modules in scope whose text references the PHI scanner. Keyed on CONTENT, not on the
 * filename, so renaming the suite does not remove it from the gate's subject, and scoped by the same
 * `OUT_OF_SCOPE` deny-list as subject 4a, so moving it does not either. EVERY ONE OF THEM MUST RUN.
 * (`scripts/` is denied here for the obvious reason that the scanner itself lives there.)
 *
 * The direction matters. Inverting this to "does at least one module that ACTUALLY RUNS reference
 * the scanner" swaps a loud, one-commit-fixable false red for a silent hole, and was measured green
 * in the sibling repo on a rename plus a planted comment. Under PHI, a false red is the safe way to
 * be wrong. The residual is the same one recorded there: the subject is text-derived, so stripping
 * the reference from a renamed suite and planting one in a running file leaves this green.
 */
const phiScannerSuites = (tracked: string[]): string[] =>
  tracked.filter(
    (f) =>
      !OUT_OF_SCOPE(f) &&
      CODE_FILE.test(f) &&
      /scripts[/\\]phi-scan/.test(readFileSync(join(ROOT, f), "utf8")),
  );

// ---------------------------------------------------------------------------
// THE CHECKS.

interface Violations {
  /** Filename floor: a name-shaped test that is not selected. */
  missing: string[];
  /** Subject 4a, first half: a module naming a published entry point that is not selected. */
  surfaceDropped: string[];
  /** Subject 4a, second half: a published entry point no selected module exercises. */
  surfaceOrphan: string[];
  /** Subject 4b. */
  fuzz: string[];
  /** Subject 4c. */
  phi: string[];
}

/**
 * Applies every selection rule to one selection and returns what it found. Taking the selection as
 * a parameter is what lets the self-tests run the REAL rules against a DELIBERATELY NARROWED
 * selection, rather than against a mock of them.
 */
function violationsFor(
  tracked: string[],
  selected: string[],
  entries: PublishedEntry[],
  references: Map<string, Set<string>>,
  derivedPaths: string[],
  phiSuites: string[],
): Violations {
  // Set arithmetic and nothing else. No rule here reads the content of a SELECTED file, so there is
  // no text for a rename or a planted comment to talk its way past at comparison time.
  const running = new Set(selected);

  const missing = nameShapedTests(tracked).filter((f) => !running.has(f));
  const surfaceDropped = [...references.keys()].filter((f) => !running.has(f)).sort();

  const surfaceOrphan: string[] = [];
  for (const e of entries) {
    const exercised = [...references].some(([f, srcs]) => running.has(f) && srcs.has(e.source));
    if (!exercised) {
      surfaceOrphan.push(
        `published subpath "${e.subpath}" (${e.source}) has no SELECTED test module naming it`,
      );
    }
  }

  const fuzz: string[] = [];
  for (const p of derivedPaths) {
    const inPath = modulesUnder(tracked, p);
    if (inPath.length === 0) {
      fuzz.push(`${p} is named by a workflow's \`vitest run\` but contains no tracked module`);
      continue;
    }
    const dropped = inPath.filter((f) => !running.has(f));
    if (dropped.length > 0)
      fuzz.push(`${p}: tracked module(s) not selected: ${dropped.join(", ")}`);
  }

  return {
    missing,
    surfaceDropped,
    surfaceOrphan,
    fuzz,
    phi: phiSuites.filter((f) => !running.has(f)),
  };
}

const tracked = trackedFiles();
const selected = resolvedSelection();
const entries = publishedEntries();
const references = entryReferences(tracked, entries);
const derivedPaths = workflowDerivedPaths();
const phiSuites = phiScannerSuites(tracked);

// The PHI subject, derived in two steps so neither half can go quiet on its own.
if (scripts["phi-scan"] !== undefined && !ciEnablesPhiScan()) {
  fail(
    "package.json defines a `phi-scan` script but .github/workflows/ci.yml does not set " +
      "`run-phi-scan: true`, so the PHI scanner ships without running in CI.",
  );
}
if (scripts["phi-scan"] !== undefined && phiSuites.length === 0) {
  fail(
    "no tracked module in scope exercises scripts/phi-scan.ts. The PHI scanner is the floor " +
      "under every fixture in this repo; it does not get to be the one thing with no suite.",
  );
}

// The invocation rule. A path filter, an alternate config, a project filter or a shard on the
// command line narrows the run just as effectively as a narrowed glob, and leaves vitest.config.ts
// looking untouched.
for (const name of CI_TEST_SCRIPTS) {
  const body = scripts[name];
  if (body === undefined) {
    fail(
      `package.json has no \`${name}\` script, but the shared CI pipeline invokes it. A missing ` +
        `script is not a passing check.`,
    );
    continue;
  }
  if (!bodyIsAllowed(body)) {
    fail(
      `package.json script \`${name}\` is not an exactly-known-good vitest invocation:\n` +
        `      ${body}\n    ` +
        `Anything other than a bare \`vitest run [--coverage]\` can change WHICH FILES run, and ` +
        `resolving\n    the config cannot see it: a path filter, an alternate --config, a ` +
        `--project, a --shard, or a\n    delegation to another script that does any of those. If ` +
        `this body genuinely cannot narrow the\n    run, add it verbatim to ` +
        `ALLOWED_TEST_SCRIPT_BODIES in scripts/check-test-selection.ts, in its own\n    reviewed ` +
        `commit, with the reason.`,
    );
  }
}

const real = violationsFor(tracked, selected, entries, references, derivedPaths, phiSuites);
if (real.missing.length > 0) {
  fail(
    `${String(real.missing.length)} tracked test file(s) exist but are NOT selected by ` +
      `vitest.config.ts, so CI never runs them:\n    ${real.missing.join("\n    ")}`,
  );
}
if (real.surfaceDropped.length > 0) {
  fail(
    `${String(real.surfaceDropped.length)} tracked module(s) in scope import a PUBLISHED entry ` +
      `point but are NOT selected, so nothing that runs exercises that part of the shipped ` +
      `surface:\n    ${real.surfaceDropped.join("\n    ")}`,
  );
}
for (const f of real.surfaceOrphan) fail(`published surface: ${f}`);
for (const f of real.fuzz) fail(`workflow-derived test path: ${f}`);
if (real.phi.length > 0) {
  fail(
    `tracked module(s) in scope reference scripts/phi-scan.ts but are NOT selected, so nothing ` +
      `that runs exercises the PHI scanner: ${real.phi.join(", ")}`,
  );
}

// ---------------------------------------------------------------------------
// SELF-TESTS (design rule 5). Seed the removal; require the catch.

/** Everything the three DERIVED rules are supposed to protect. */
function protectedFiles(): Set<string> {
  const s = new Set<string>(phiSuites);
  for (const f of references.keys()) s.add(f);
  for (const p of derivedPaths) for (const f of modulesUnder(tracked, p)) s.add(f);
  return s;
}

/** Whether a DERIVED rule named this file. The filename floor deliberately does not count. */
const derivedNames = (v: Violations, target: string): boolean =>
  v.surfaceDropped.includes(target) ||
  v.phi.includes(target) ||
  v.fuzz.some((l) => l.includes(target));

/**
 * Self-test A, against the comparison directly: drop each protected file from the selection ONE AT
 * A TIME, leaving every other file selected, and require a DERIVED rule to name it.
 *
 * ONE AT A TIME IS HALF THE POINT. A seed that hides EVERY protected file at once exercises only
 * the direction where nothing is left to collide with; that is exactly why two forgeable-by-
 * collision rules passed their own self-test in the sibling repo. Hiding one file while all the
 * rest stay selected IS the colliding case, by construction and for every file in turn.
 *
 * IGNORING THE FILENAME FLOOR IS THE OTHER HALF, and it is the one thing here that the sibling's A
 * does not do. Every file it protected was also name-shaped, so its A passed with both derived
 * rules gutted (measured, and recorded in its own header). This assertion fails if the derived
 * rules stop working, whatever the filenames happen to be.
 */
function selfTestComparison(): void {
  const targets = [...protectedFiles()];
  if (targets.length === 0) refuse("self-test A has nothing to hide, so it would pass vacuously");

  for (const target of targets) {
    const v = violationsFor(
      tracked,
      selected.filter((f) => f !== target),
      entries,
      references,
      derivedPaths,
      phiSuites,
    );
    if (!derivedNames(v, target)) {
      refuse(
        `self-test A FAILED: dropping ${target} from the selection, with every other file left ` +
          "selected, was reported by no DERIVED rule. The detector cannot detect.",
      );
    }
  }
}

/**
 * Self-test B, against the invocation rule.
 *
 * EVERY POSITIVE HERE IS A ROUTE A REFUTER ACTUALLY FOUND in the sibling repo, and the list is
 * append-only for that reason. Note especially the group with no `vitest` token at all: the rule
 * this replaced tokenised arguments after a whole-word `vitest`, so those bodies produced no
 * arguments and were reported as PASSING. Every other sample contained a `vitest` token, which is
 * exactly why the self-test did not catch it: the table tested the rule's behaviour and never its
 * ENTRY CONDITION.
 */
function selfTestInvocationRule(): void {
  const positives = [
    // Positional path filters, both spellings of the run flag.
    "vitest run test/hl7",
    "vitest --run test/hl7 test/fhir",
    "vitest run --coverage test/hl7",
    // Flag-form narrowings.
    "vitest run --coverage --config=vitest.ci.config.ts",
    "vitest run --coverage -c vitest.ci.config.ts",
    "vitest run --coverage --project=unit",
    "vitest run --coverage --dir=test/fhir",
    "vitest run --coverage --shard=1/4",
    "vitest run --coverage -t somePattern",
    "vitest run --coverage --changed",
    "vitest run --coverage --flag-this-file-has-never-heard-of",
    // Chained: the narrowing lives in the SECOND invocation.
    "vitest run --coverage && vitest run test/hl7",
    // The argument value ends in the word `vitest`, which broke one tokenizer in the sibling.
    "vitest run --dir=vitest",
    "vitest run --coverage --config=my-vitest",
    // NO `vitest` TOKEN AT ALL. These are the ones that shipped green there.
    "pnpm run test:unit",
    // Delegation to this repo's OWN narrowing script, which runs one file of thirty-nine.
    "pnpm run test:fuzz",
    "node node_modules/vitest/vitest.mjs run --coverage test/hl7",
    "sh -c 'vitest run --coverage test/hl7'",
    'bash -c "vitest run test/hl7"',
    "echo skipping tests",
    "",
  ];
  const negatives = ["vitest run", "vitest run --coverage", "  vitest   run  --coverage  "];

  for (const p of positives) {
    if (bodyIsAllowed(p)) {
      refuse(
        `self-test B FAILED: \`${p}\` can change which files vitest runs, or hides what does, and ` +
          "the invocation rule accepted it. The detector cannot detect.",
      );
    }
  }
  for (const n of negatives) {
    if (!bodyIsAllowed(n)) {
      refuse(
        `self-test B FAILED: \`${n}\` cannot narrow the file set, but the invocation rule rejected ` +
          "it. A rule that reds on correct work gets disabled.",
      );
    }
  }
}

/**
 * Self-test C, end to end through real vitest: resolve a genuinely narrowed config and require the
 * same rules to red on it. This proves the OBSERVATION CHANNEL works, not just the arithmetic; if
 * `vitest list` ever stops reporting what it runs, or the root resolves somewhere unexpected,
 * self-test A would still pass and this will not.
 *
 * The narrowed config keeps exactly one test file, chosen at run time so there is no hardcoded
 * filename to go stale: preferably one no derived rule protects, and otherwise the name-shaped test
 * naming the FEWEST published entry points, with that file excused from the "everything dropped was
 * reported" assertion. The fallback matters because this repo has exactly one unprotected test
 * module today, and a gate that refuses the moment that file grows an import would be a gate that
 * reds on correct work. Fewest-references rather than first-alphabetically is what keeps the
 * fallback from being self-defeating: keeping a module that happened to name all eight entry points
 * would leave `surfaceOrphan` empty and make C refuse with a message reading like a detector fault,
 * when nothing is actually wrong.
 *
 * It is written to an OS temp dir, never into the repo: this tree has suites that enumerate fixture
 * directories, and seeding files inside the repo to test tooling is how a previous change in a
 * sibling nearly hard-reddened a required check. It carries no imports, so nothing needs resolving
 * from outside the repo.
 */
function selfTestNarrowedConfig(): void {
  const excluded = protectedFiles();
  const named = nameShapedTests(tracked);
  const fewestReferences = [...named].sort(
    (a, b) => (references.get(a)?.size ?? 0) - (references.get(b)?.size ?? 0),
  )[0];
  const keep = named.find((f) => !excluded.has(f)) ?? fewestReferences;
  if (keep === undefined) refuse("no tracked test file to keep, so self-test C cannot narrow");

  const dir = mkdtempSync(join(tmpdir(), "synth-selection-selftest-"));
  try {
    const cfg = join(dir, "narrowed.config.ts");
    writeFileSync(cfg, `export default { test: { include: ${JSON.stringify([keep])} } };\n`);
    const narrowed = resolvedSelection(cfg);
    if (narrowed.length !== 1 || narrowed[0] !== keep) {
      refuse(
        `self-test C FAILED: the narrowed config resolved to [${narrowed.join(", ")}] rather than ` +
          `[${keep}], so this gate is not observing what it thinks it is observing.`,
      );
    }
    const v = violationsFor(tracked, narrowed, entries, references, derivedPaths, phiSuites);
    if (v.surfaceDropped.length === 0 || v.surfaceOrphan.length === 0) {
      refuse(
        "self-test C FAILED: a real narrowing hid the suites exercising the published surface and " +
          "the published-surface rule was green.",
      );
    }
    if (v.fuzz.length === 0) {
      refuse(
        "self-test C FAILED: a real narrowing hid the fuzz layer and the fuzz rule was green.",
      );
    }
    if (phiSuites.length > 0 && v.phi.length === 0) {
      refuse("self-test C FAILED: a real narrowing hid the PHI suite and the PHI rule was green.");
    }
    const stillUnreported = [...excluded].filter((f) => f !== keep && !derivedNames(v, f));
    if (stillUnreported.length > 0) {
      refuse(
        "self-test C FAILED: a real, narrowed vitest config dropped these files and no derived " +
          `rule reported them:\n    ${stillUnreported.join("\n    ")}`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

selfTestComparison();
selfTestInvocationRule();
selfTestNarrowedConfig();

// ---------------------------------------------------------------------------
// REPORT.

if (failures.length > 0) {
  process.stderr.write(
    `\ncheck-test-selection: FAILED (${String(failures.length)} problem(s))\n\n` +
      failures.map((f) => `  - ${f}`).join("\n\n") +
      "\n\n" +
      "  A required job gates its steps, not what those steps select. The suites above are the " +
      "synthetic-safety\n  floor under a package whose entire promise is that nothing it emits can " +
      "be real or plausibly-real\n  PHI, and the coverage gate measures src/ only, so dropping them " +
      "costs no coverage percent at all.\n\n" +
      "  THE FIX IS TO WIDEN THE SELECTION SO THESE RUN. There is deliberately no exemption to " +
      "qualify for:\n  the published-surface subject is keyed on which entry point a module names, " +
      "not on what it is\n  called, so renaming it changes nothing, and its scope is a deny-list of " +
      "three locations rather\n  than an allow-list, so moving it anywhere else changes nothing " +
      "either. Both exemptions the\n  sibling gate once offered were walked through by a rename, " +
      "and both measured green.\n\n" +
      "  IF THE FILE ABOVE IS NOT A TEST, that is the other correct fix and this gate cannot tell " +
      "the\n  difference. An example, a benchmark or a codemod that imports a published entry point " +
      "lands in\n  this subject legitimately, and making vitest run a benchmark is not the answer: " +
      "move it under\n  src/ or scripts/, which are out of scope precisely because they name the " +
      "package's own entries\n  for their own reasons. Do that only because it IS one; doing it to " +
      "silence this message is the\n  thing the gate exists to catch.\n\n" +
      "  KNOW THE THREE LOCATIONS THAT DO ESCAPE, because pretending otherwise is how a gate gets " +
      "trusted\n  past its reach: src/, scripts/, and the repo root. A module moved into any of " +
      "them leaves this\n  subject and every denominator count. That is a stated limit, not a fix, " +
      "and it is not the reason\n  you are reading this message.\n",
  );
  process.exit(1);
}

const named = nameShapedTests(tracked);
const extra = selected.filter((f) => !tracked.includes(f));
const testModules = tracked.filter((f) => !OUT_OF_SCOPE(f) && CODE_FILE.test(f));

/**
 * THE DENOMINATOR. An OK printed without the number it is an OK over is how a narrowing goes quiet,
 * and the sibling PHI gate learned that the hard way. Three counts, not one:
 *
 *   derived  - watched by a name-independent rule. Neither a rename nor a move can take a file out
 *              of this, except a move into one of the three denied locations.
 *   nameOnly - watched by the `.test.`/`.spec.` filename shape and nothing else. Renaming one of
 *              these out of that shape stops it running with this gate green.
 *   unwatched- watched by no rule at all. A rename anywhere in scope moves a file from nameOnly
 *              into here, so a reviewer watching this number sees the hole being used.
 *
 * It is deliberately a number and not a failure: a genuine helper legitimately lands in the last
 * count, and a gate that reds on a helper gets disabled. Note it is not a universal tripwire: a
 * file moved into `src/`, `scripts/` or the repo root drops out of all three counts together, which
 * is the residual the failure epilogue names rather than hides.
 */
const derivedWatched = testModules.filter(
  (f) =>
    references.has(f) ||
    phiSuites.includes(f) ||
    derivedPaths.some((p) => modulesUnder(tracked, p).includes(f)),
);
const nameOnly = testModules.filter((f) => !derivedWatched.includes(f) && named.includes(f));
const unwatched = testModules.filter((f) => !derivedWatched.includes(f) && !named.includes(f));

process.stdout.write(
  `check-test-selection: OK\n` +
    `  selection : ${String(named.length)} name-shaped test file(s), all selected by ` +
    `vitest.config.ts` +
    (extra.length > 0 ? `; ${String(extra.length)} selected file(s) are untracked` : "") +
    `\n` +
    `  surface   : ${String(entries.length)} published entry point(s) from package.json exports ` +
    `[${entries.map((e) => e.subpath).join(", ")}], each exercised by at least one selected ` +
    `module; ${String(references.size)} tracked module(s) in scope name one, all selected\n` +
    `  fuzz      : ${String(derivedPaths.length)} workflow-derived test path(s) ` +
    `[${derivedPaths.join(", ")}] intact with every tracked module under them selected\n` +
    `  phi       : ${String(phiSuites.length)} tracked module(s) referencing scripts/phi-scan.ts, ` +
    `all selected\n` +
    `  invocation: ${String(CI_TEST_SCRIPTS.length)} CI test script(s) have an exactly-known-good ` +
    `body; all three self-tests reddened as required\n` +
    `  DENOMINATOR: of ${String(testModules.length)} tracked code module(s) in scope (everything ` +
    `tracked except src/, scripts/ and the repo root), ` +
    `${String(derivedWatched.length)} are watched by a name-independent rule, ` +
    `${String(nameOnly.length)} by the .test./.spec. filename shape ALONE ` +
    `(${nameOnly.length > 0 ? nameOnly.join(", ") : "none"}), and ` +
    `${String(unwatched.length)} by no rule at all ` +
    `(${unwatched.length > 0 ? unwatched.join(", ") : "none"}). Renaming a module in the ` +
    `filename-shape-only count out of that shape moves it into the unwatched count rather than ` +
    `reddening anything; renaming one of the name-independent ones instead REDS, because its ` +
    `subject does not read filenames. A module moved into src/, scripts/ or the repo root leaves ` +
    `every count, which is this gate's one relocation escape and is stated in its header rather ` +
    `than denied.\n`,
);
