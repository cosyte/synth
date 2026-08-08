#!/usr/bin/env tsx
/**
 * `@cosyte/synth` PHI scanner: the CI / pre-commit half of the PHI commit-gate.
 *
 * Pure Node. Zero runtime deps (the scanner does NOT import this package's own
 * generators or a sibling parser: a safety gate must be independent of the code
 * it guards, so a shared bug cannot blind both). `git` is the only subprocess,
 * always via `execFileSync` with array args (never shell-form). Walks `src/`,
 * `test/` and `scripts/` (see `SCAN_ROOTS`), THEN ADDS EVERY OTHER TRACKED FILE
 * THE WALK DID NOT REACH (see `buildTargetsForTracked`), and REFUSES anything
 * that looks like real PHI, so a developer cannot commit a real-looking fixture
 * by accident.
 *
 * THIS IS A FLOOR, NOT THE GATE. The executable proof that nothing this package
 * emits can be real or plausibly-real PHI is the property layer: the
 * `synthetic-safety.property.test.ts` suites and `test/phi/`, selected by the
 * `include` glob in `vitest.config.ts` and gated by `scripts/check-test-selection.ts`.
 * This scanner is the commit-time backstop under those: it sweeps committed text
 * for PHI shapes, which is a different question from "can the generator produce
 * one". Read a green `phi-scan` as "no real-looking PHI is committed", never as
 * "the generator is synthetic-safe".
 *
 * What it does detect. A format-agnostic floor (a dashed SSN outside the SSA
 * never-issued space; an email at a non-allow-listed domain) plus structured,
 * field-level detection for every format this package generates: HL7 v2 (PID-5 /
 * -13 / -19), FHIR (`HumanName`, phone `ContactPoint`), C-CDA (`<given>`/`<family>`
 * name + `telecom`), X12 (NM1 / PER / REF*SY), NCPDP SCRIPT (name tags, `<NPI>`,
 * `<DEANumber>`) and Telecom (CA/CB/CC/CD/CQ/CY/C2/DB), and ASTM (`P`-record
 * name + practice/lab ids, framed or bare). Each arm is documented at its own
 * function. Dates of birth are deliberately NOT value-gated in any arm: a
 * synthetic DOB is seeded and structurally indistinguishable from a real one,
 * and there is no reserved DOB range to check against.
 *
 * The mechanism for declaring genuinely-synthetic identifiers is the allow-list
 * (`scripts/phi-allow-list.txt`), a positive declaration that a fixture's
 * identifiers are fake. Byte-strict formats cannot carry an inline
 * `# synthetic: true` header, so the allow-list is the proven substitute (the
 * same approach every sibling uses). A whole-file bypass needs
 * `--allow-fixture <path>` AND a logged entry in `phi-scan-overrides.md`.
 *
 * Modes:
 *   --staged                 - scan only files staged in `git diff --cached`
 *   --allow-fixture <path>   - SUBTRACT one already-enumerated path from the scan;
 *                              rejected unless logged in phi-scan-overrides.md
 *   <path> [<path>...]       - scan specific paths
 *   (no args)                - scan all in-scope working-tree files
 *
 * Exit codes: 0 (clean), 1 (hits found), 2 (invocation error).
 *
 * A SCAN THAT OBSERVES NOTHING MUST NOT REPORT OK. A safety gate that can be
 * collapsed to an empty target set is worse than no gate, because it prints the
 * same `OK` a real pass prints. Three invariants close the argument-driven routes
 * to that, and every one is checked before any hit counting (`enforceObservation`):
 *
 *   1. `--allow-fixture` is PURELY SUBTRACTIVE and never seeds the target set.
 *      Seeding it meant `--allow-fixture X` with no positional path expanded to
 *      "scan [X], then subtract X" = scan nothing, exit 0.
 *   2. Every `--allow-fixture` path must actually subtract an enumerated target.
 *      An override that matches nothing is inert: the operator believes a bypass
 *      is in effect when it is not, and a stale override log drifts unnoticed.
 *   3. The post-subtraction target set must be non-empty whenever the
 *      pre-subtraction set was, and the pre-subtraction set must be non-empty in
 *      every mode but `--staged` (where "nothing staged" is legitimate).
 *
 * A scan that could not READ what it enumerated refuses (exit 2) for the same
 * reason, rather than reporting a clean tree it never observed. The one bounded
 * exception is the enumeration's own TOCTOU window, documented on
 * `Target.tolerateVanish`: an UNTRACKED file the walk listed itself and that is
 * gone by the time we read it is reported as skipped instead of refusing. A
 * tracked file, a non-`ENOENT` failure, a file that reappears, and a `git` that
 * cannot say what is tracked all still refuse. The denominator counts files
 * actually READ, so a tolerated skip shrinks it rather than being counted as an
 * `OK` over a file nothing was read from.
 *
 * THE OBSERVATION RULE IS PER-ROOT, NOT GLOBAL: all-mode refuses unless EVERY
 * member of `SCAN_ROOTS` yielded at least one file that was actually read.
 * ITS GRANULARITY IS THE DECLARED ROOT AND NOTHING FINER, which is a real bound
 * and not a slogan, see the limits list below for what that leaves open, each
 * entry with the reading that produced it. The rule, its cause and its
 * measurement live at the end of `main()`; the limits live below.
 *
 * An in-scope entry that is NOT A REGULAR FILE refuses the scan (exit 2) on both
 * enumerating routes, rather than being skipped or followed. That rule is stated
 * once, with its evidence, at "NON-REGULAR ENTRIES" in the target-enumeration
 * section below; it is not restated here, and it should not be restated anywhere
 * else either.
 *
 * Every SUMMARY line carries the DENOMINATOR (files scanned), so an `OK` is never
 * read without the number it is an `OK` over. (The per-hit `HIT:` and `segment=`
 * lines do not repeat it; they are detail under a summary that does.)
 *
 * THE EXTENSION GATES ARE GONE. Every structured arm now keys off the BYTES. It
 * used to be that three of the seven returned early unless the path ended `.xml`
 * (`scanCcda`, `scanNcpdpScript`) or `.json` (`scanFhir`), so a byte-identical
 * payload was refused as `probe.xml` and passed as `probe.ts`: a gap that was
 * measured, pinned by a characterization test, and left open, because
 * content-sniffing XML/JSON out of arbitrary TypeScript is its own job. Each arm
 * now admits a target by its extension OR by what the bytes say. C-CDA and SCRIPT
 * key off the formats' own required discriminators (a CDA root/namespace, a SCRIPT
 * `<Message>` envelope) and FHIR's TEXTUAL route off `resourceType`, never a guess
 * at "looks XML-ish", so a file has to CLAIM to be the format before the NEW CONTENT
 * ROUTES read its identity loci. That is not a precondition on the gate as a whole,
 * and saying so was wrong twice: an `.xml` path still reaches the C-CDA arm on its
 * EXTENSION with no marker at all, and FHIR's STRUCTURAL route still runs whenever
 * `JSON.parse` succeeds with no `resourceType` check, both exactly as before. See
 * each arm.
 *
 * THE CHANGE IS PURELY ADDITIVE, AND IT COST THREE REVIEW PASSES TO GET THERE. No
 * target admitted before is refused admission now, and NO detector was taught to
 * skip anything. Every name token this scanner reaches is still compared against
 * the allow-list exactly as it always was.
 *
 * That is a deliberate retreat. Widening the arms made this scanner's own test
 * suite one of its targets, and that suite necessarily writes name elements. The
 * first three attempts answered it by teaching the SCANNER to skip template
 * placeholders, and on a PHI detector a skip rule has to be exactly right, which
 * it twice was not: it silenced `Anderson ...`, then `${"Anderson"}`, then spliced
 * `{{Anderson ${s}}` across two constructs the source never nested. Each remedy
 * bought one more evasion shape, which is the signature of a rule that does not
 * belong here. The suite assembles its elements at run time instead, so the
 * detector stays maximally literal and this file has NO subtraction to audit.
 *
 * What the three invariants do NOT cover, because the honest limits matter more
 * than the slogan: they constrain the target set, not what enumeration finds in
 * the first place. A file the enumerator never lists is invisible to all three,
 * and the denominator counts the files that WERE listed, so it still reads
 * plausible. The gaps we KNOW of:
 *
 *   - MARKER ADMISSION IS FILE-SCOPED, NOT OBJECT-SCOPED, the cost of the change
 *     above, and the one most likely to mislead now. Once a file states
 *     `resourceType` (or carries a CDA root), EVERY `family:` / `<given>` in it is
 *     read, whether or not it belongs to that resource. Scoping to the enclosing
 *     object needs a real JavaScript parser, which this scanner deliberately does
 *     not have. The remedy for a false positive is the allow-list: the same
 *     positive declaration the rest of the gate asks for.
 *   - The C-CDA name/telecom sweep is DOCUMENT-WIDE, not `recordTarget`-scoped. It
 *     always was; until 2026-08-02 it mislabelled every hit as `recordTarget/…`
 *     anyway. The sweep is deliberate (an author's or informant's name in a
 *     committed fixture is as real as a patient's); only the label was wrong.
 *   - The C-CDA name loci are NOT namespace-prefix-tolerant: `<hl7:given>` is not
 *     read, though `hasCdaMarker` does tolerate a prefix when deciding to look.
 *     Pre-existing, and not widened here.
 *   - `.md` is out of scope everywhere, deliberately, AND THAT IS NOW THE LARGER
 *     HALF OF WHAT ALL-MODE DOES NOT READ, so it is priced rather than repeated:
 *     at `4c9900f`, 20 of the 225 tracked files were markdown, and all 20 were
 *     read by hand on 2026-08-08 with no SSN shape and no email at all in any of
 *     them. DERIVE THE COUNT, DO NOT TRUST IT: every changeset adds a markdown
 *     file, so it moves on most commits, and the change that widened the scan
 *     wrote a cleared address into `documentation/agent-notes.md` itself, which
 *     the hand-read predates. `git ls-files | grep -ci '\.md$'` is the answer.
 *     It stays out of scope because `phi-scan-overrides.md` exists to record WHY
 *     a value was tolerated, so scanning it makes the log that satisfies the gate
 *     red the gate. Lifting it is a separate decision with its own false-positive
 *     surface, and this slice deliberately does not take it.
 *   - THE ROOTS ARE NO LONGER THE WHOLE OF ALL-MODE'S SCOPE. A file outside
 *     `src/`, `test/` and `scripts/` used to be invisible to BOTH routes: the
 *     walk never listed it and `--staged` filtered it out, so every workflow, the
 *     manifest, the lockfile and every root config file was scanned by nothing.
 *     Measured on the base of this change: 225 tracked files, 176 read, 49 read by
 *     neither route. All-mode now reconciles against `git ls-files` and reads every
 *     tracked file the walk did not, which is a UNION with the walk and never a
 *     replacement of it. What is still in neither route is 20 markdown files (the
 *     bullet above) and the 7 literal paths in `BINARY_EXEMPT_PATHS`.
 *   - `--staged` STILL NARROWS TO THE ROOTS, and that asymmetry is deliberate
 *     rather than an oversight to fix later in the same style. The widening above
 *     needs a corpus exemption (a compressed archive read as text produces
 *     nonsense hits, measured: 4 across 3 of the 7 vendored tarballs), and an
 *     exemption on the commit-blocking route is exactly the shape that has
 *     subtracted a real detection in a sibling. So the widening is `all`-route
 *     only, and a repo-root file carrying PHI is caught by CI on the pull request
 *     rather than by the pre-commit hook. Stated as the trade it is.
 *   - AND SAY EXACTLY WHAT "UNCHANGED" MEANS THERE, BECAUSE THE FIRST VERSION OF
 *     THAT SENTENCE OVERSTATED IT AND A REFUTER MEASURED THE DIFFERENCE. What is
 *     byte-identical on `--staged` is the ENUMERATION: which files each mode
 *     lists. THE ALLOW-LIST IS NOT PART OF THAT AND NEVER WAS. It is read once and
 *     consumed inside `scanTarget`, which every mode shares, so ANY entry added to
 *     `scripts/phi-allow-list.txt` clears its value on every route, the
 *     commit-blocking one included. The widening added one: the publisher contact
 *     in `package.json`, which the roots had never opened. A file under `src/`
 *     carrying that address red before and does not now. One literal value, and it
 *     is a real subtraction, so it is written down in the allow-list beside the
 *     entry, pinned from both directions by the suite, and not called free.
 *   - All-mode drops git-ignored files; `--staged` does NOT apply that filter, so
 *     the two modes disagree about a force-added ignored file. BOTH directions are
 *     now exercised by the suite, and neither is changed: all-mode walks the working
 *     tree, where an ignored path is build output; `--staged` reads the INDEX, which
 *     a file reaches only via `git add -f` and which a commit will therefore carry.
 *     Reading that one is the shipping direction.
 *   - A scan of one named in-scope file truthfully reports `1 file(s) scanned`;
 *     the denominator is honest but small, and small is not the same as wrong.
 *
 * AND WHAT THE PER-ROOT OBSERVATION RULE DOES NOT COVER. Every reading below was
 * taken on this checkout with the rule in place, because a bound asserted without
 * one is the failure this file already keeps a paragraph about:
 *
 *   - ITS GRANULARITY IS STILL THE DECLARED ROOT, NOT A SUB-TREE. Read that as a
 *     statement about THIS RULE, never as a statement about the scan: an absent
 *     directory inside a root, and a root emptied down to one file, are both now
 *     caught, and NOT by this rule. They are caught by the tracked-file
 *     reconciliation, which is exactly the "floor derived from what git tracks"
 *     an earlier draft named as a separate decision and then declined to take.
 *     Measured both ways on `4c9900f` and on the change that closed them:
 *     `mv test/fixtures ..` returned `OK, no hits` and exit 0 on the base and
 *     refuses with 2 now; deleting all but one file under `test/` returned
 *     `OK, no hits (78 file(s) scanned)` and exit 0 on the base with 98 tracked
 *     files unread, and refuses with 2 now, naming them.
 *   - AND THE BOUND ON THAT, WHICH IS WHERE THIS RULE STILL EARNS ITS KEEP: the
 *     reconciliation only knows about TRACKED files. A root holding nothing but
 *     UNTRACKED files, or emptied of untracked ones, is invisible to it, and the
 *     per-root rule is what refuses a root that yielded nothing at all. Neither
 *     rule subsumes the other, so do not delete one thinking the other covers it.
 *     A DANGLING `test/fixtures` refuses (exit 2) through the non-regular-entry
 *     rule, a third mechanism again.
 *   - TWO OF THE FOUR ARE NOW CLOSED, BY A KIND CHECK ON THE ROOT ITSELF rather
 *     than by growing the per-root rule, and both readings below were taken on
 *     `4c9900f`, the base of that change, so the fix is measured against a
 *     defect that existed rather than one argued for:
 *       * A ROOT THAT IS A REGULAR FILE threw `ENOTDIR` out of `walk()` past the
 *         `InvocationError`-only catch, so node exited **1**: the code this
 *         contract reserves for "hits found". Replacing `test` with a regular
 *         file returned exit 1 on the base. It now refuses with **2**. Do not
 *         port an exit code for this state from a sibling: it was 1 HERE, is 2
 *         in some siblings, and is deliberately 1 in another.
 *       * A ROOT THAT IS ITSELF A SYMLINK WAS FOLLOWED, including to ANOTHER
 *         root, and the per-root rule was then satisfied by that other root's
 *         bytes: `rm -rf test && ln -s src test` returned
 *         `OK, no hits (145 file(s) scanned)` and exit **0** on the base with the
 *         99-file test corpus absent from disk, because `normalizePath` is purely
 *         lexical (`resolve`/`relative`, never `realpath`) so `src/` was read
 *         twice and attributed once to each prefix. That is a false GREEN, the
 *         worst state this file has. It now refuses with 2.
 *     Both are handled by `lstat`ing each root before walking it, NOT by
 *     `existsSync`: `existsSync` FOLLOWS a link, which is what let a dangling
 *     root read as merely absent. "A root yielded a file" is still not "that
 *     root's corpus was observed", which is the next bullet.
 *   - IT IS A FLOOR OF ONE, AS A RULE, AND THAT HAS NOT CHANGED. It asks whether
 *     a root was observed at all, never whether it was observed in full. What
 *     changed is that the state it could not see is now seen by something else,
 *     per the two bullets above. Do not restate the reconciliation as a property
 *     of this rule: STAGE the deletions and the files leave the index, the
 *     reconciliation stops naming them, and this rule is again a floor of one
 *     over whatever remains.
 *
 * THAT IS NOT A CLOSED LIST, and in `ncpdp` saying
 * otherwise was wrong twice: the staged enumerator turned out to be dropping
 * renames, and then typechanges, both because `--diff-filter` was an allow-list
 * of status letters. Treat any change to what the enumerator lists as a change to
 * the gate itself, and prefer exclusion lists to allow-lists there.
 */

import {
  readFileSync,
  statSync,
  lstatSync,
  existsSync,
  readdirSync,
  type Dirent,
  type Stats,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, relative, sep, isAbsolute } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REPO_ROOT = process.cwd();
const ALLOW_LIST_PATH = join(REPO_ROOT, "scripts", "phi-allow-list.txt");
const OVERRIDE_LOG_PATH = join(REPO_ROOT, "phi-scan-overrides.md");

// The scan roots, as repo-relative prefixes. ONE list, used by BOTH "all" mode
// (which walks them) and "--staged" mode (which filters the staged set by them),
// so this is the single place the ROOTS narrow. It is not the only thing that
// narrows a scan: see the honest-limits list in the header for the others.
//
// `test/` is walked WHOLE. It used to stop at `test/fixtures/`, which left every
// test outside `fixtures/` invisible to the gate, and this repo builds messages as
// inline string literals in exactly those files (measured on the widening: 114
// in-scope files became 170). `scripts/` is walked for the same reason: it is
// tracked, hand-written text that can carry a real address or email as easily as a
// fixture can. `src/` keeps the same conservative pass it always had: JSDoc
// `@example` snippets are compiled into `dist/*.d.ts` and must not carry real PHI.
//
// WHAT THE WIDENED ROOTS BUY IS NOW THE WHOLE GATE, which it was not when they
// were widened. Over a `.ts` file the roots originally delivered the format-agnostic
// floor (dashed SSN, non-declared email) plus the four CONTENT-gated arms: HL7 v2,
// X12, ASTM and NCPDP Telecom, and NOTHING from the three arms that gated on the
// file extension, so a C-CDA `recordTarget` or a FHIR `HumanName` written as an
// inline literal in a TypeScript test was enumerated and then not structurally read.
// That was recorded as a known gap rather than fixed in passing, on the grounds that
// content-sniffing XML/JSON out of arbitrary TypeScript is a separate job with its
// own false-positive surface and that a gate should not grow teeth as a side effect
// of a roots change. It was then done AS that separate job: no arm decides from the
// path alone any more. What each arm keys off differs and is stated at the arm rather
// than counted here, because a count was written here once and was wrong in both
// directions: C-CDA still admits any `.xml` with no marker at all, and FHIR's textual
// route IS marker-gated while its structural route is not. The false-positive surface
// was measured over this repo rather than argued about.
//
// WHAT THAT FIRST RUN ACTUALLY RETURNED, because an earlier draft of this comment got
// it wrong and the wrong version was the stated evidence for a predicate: over 170
// files it returned FOUR hits across TWO files. Two were real names the widening had
// just made visible for the first time (`test/deid/loop.test.ts`) and are now declared
// in the allow-list. Two were name elements in this scanner's own test fixtures, which
// the suite now assembles at run time so they are not written in its source at all. So
// it was NOT "four placeholders, none a name": half of it was names, and finding them
// was the point of the change.
const SCAN_ROOTS: readonly string[] = ["src", "test", "scripts"];

// THE ROOTS ARE NO LONGER THE WHOLE OF ALL-MODE'S SCOPE. After the walk, all-mode
// reconciles what it listed against `git ls-files` and reads every tracked file the
// walk did not reach: the manifest, the lockfile, every workflow, every root config
// file. That is a UNION with the walk, never a replacement of it, and the walk's own
// scope is untouched: no file the roots delivered before is dropped, and no detector
// was taught to skip anything.
//
// WHY THAT SHAPE RATHER THAN A WIDER ROOT LIST. Adding `.` as a root walks
// `node_modules/` and `dist/` on every run and then throws the result away through
// `git check-ignore`. Reconciling against the index asks the question the gate
// actually has: of the bytes a commit would carry, which ones did nothing open.
//
// THESE PATHS ARE READ FROM THE WORKING TREE, NOT FROM THE INDEX, so all-mode keeps
// one answer to "what is a file's content" across both of its arms. The cost is that
// a tracked file deleted from the working tree but not yet staged as deleted REFUSES
// (exit 2) rather than being skipped: staging the deletion removes it from
// `git ls-files` and the refusal goes away. Fail-closed, and it names the path.
//
// AND ONE COST THAT REMEDY DOES NOT REACH, DISCLOSED BECAUSE A REFUTER MEASURED IT:
// `git ls-files` lists a `skip-worktree` or sparse-checkout entry exactly like any
// other, so in a CONE-MODE OR SPARSE CHECKOUT the deliberately-absent files land in
// that same refusal and all-mode cannot run at all. Staging a deletion is not an
// available answer there, and pretending it is would be worse than saying so: the
// answer is a full checkout, which is what CI and every hook here use. Fail-closed
// either way, so it costs a run and never a false green.
//
// EXEMPTIONS ARE LITERAL PATHS, ONE PER LINE, AND THEY REACH `all` MODE ONLY.
// A compressed archive read as UTF-8 produces name-shaped and email-shaped nonsense:
// measured on this repo's base, scanning the seven vendored tarballs by path returned
// 4 hits across 3 of them, none of which stands for anything. They are excluded here
// rather than by a `.tgz` test, an "is it binary" heuristic or a `git check-attr`
// query, because a corpus exemption written as a PREDICATE is the shape that has
// already subtracted a real detection in a sibling repo: a predicate silently grows
// to cover files nobody enumerated, and a list cannot.
//
// REFRESHING A VENDORED TARBALL MEANS EDITING THIS LIST, because the version is in the
// filename. That is deliberate, and BOTH directions of drift are loud: an unlisted
// archive is scanned and reds on nonsense hits, and a stale entry reds the test in
// `test/scripts/phi-scan.test.ts` that reconciles this list against what git DECLARES
// binary in `.gitattributes`. The reconciliation lives there rather than here because
// it is a fact about this repo's corpus, not about the scanner: refusing here would
// make the scanner unusable in any tree that has it and not the seven archives.
const BINARY_EXEMPT_PATHS: readonly string[] = [
  "vendor/cosyte-astm-0.0.0.tgz",
  "vendor/cosyte-ccda-0.0.1.tgz",
  "vendor/cosyte-deid-0.0.0.tgz",
  "vendor/cosyte-fhir-0.0.0.tgz",
  "vendor/cosyte-hl7-0.0.0.tgz",
  "vendor/cosyte-ncpdp-0.0.1.tgz",
  "vendor/cosyte-x12-0.0.1.tgz",
];

/**
 * WHICH scan root a repo-relative path sits under, or `undefined` for none. The single
 * definition of the root-prefix rule: {@link inScanRoot} is the boolean over it, and the
 * per-root observation rule in `main` attributes every file it read through it. A second
 * copy of `rel === root || rel.startsWith(root + "/")` anywhere is a bug waiting to
 * happen, because the two copies decide scope and coverage respectively.
 *
 * ONE DEFINITION IS NOT THE SAME AS ONE ANSWER, so do not read the above as a claim that
 * scope and coverage can never disagree. This returns the FIRST match, which is exactly
 * right while `SCAN_ROOTS` are disjoint (they are: `src`, `test`, `scripts`) and wrong the
 * moment one nests inside another, scope wants ANY match, coverage wants EVERY match. With
 * the OUTER root listed first, the inner one is never attributed and all-mode refuses
 * forever; listed inner-first it happens to work, which is worse, because then the ordering
 * is load-bearing and nothing says so. Fail-closed either way, and not hypothetical
 * housekeeping: `test/` used to be `test/fixtures/`. Nesting a root means revisiting this
 * function, not just the list.
 */
function rootOf(rel: string): string | undefined {
  return SCAN_ROOTS.find((root) => rel === root || rel.startsWith(`${root}/`));
}

/**
 * Whether a repo-relative path sits under a scan root. THE ROOT HALF OF SCOPE, SPLIT
 * OUT FROM THE `.md` EXEMPTION ON PURPOSE: the two halves are not interchangeable,
 * and treating them as one predicate is what made the staged route disagree with the
 * walk about a link named `.md`. See "NON-REGULAR ENTRIES" below.
 */
function inScanRoot(rel: string): boolean {
  return rootOf(rel) !== undefined;
}

/**
 * Whether a repo-relative path is MARKDOWN, the one content exemption, split out
 * because the tracked-file arm needs it WITHOUT the root half. Documentation
 * legitimately quotes violator values: `phi-scan-overrides.md` exists to record why a
 * value was tolerated, so a scan of it would red the very log that satisfies the gate.
 */
function isMarkdown(rel: string): boolean {
  return rel.toLowerCase().endsWith(".md");
}

/**
 * Whether a repo-relative path is in scope AS A FILE THE WALK READS: under a root and
 * not markdown.
 *
 * That judgement is about a file whose BYTES the scan could have read. It is NOT the
 * predicate for deciding whether an entry is scannable at all: a link's name is no
 * evidence about what is on the other side of it, so the non-regular check on each
 * route keys on {@link inScanRoot} alone.
 */
function isScannable(rel: string): boolean {
  if (isMarkdown(rel)) return false;
  return inScanRoot(rel);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Hit {
  path: string;
  segment: string; // locator (e.g. "(ssn)" / "(email)" or your field id)
  value: string;
  reason: string;
}

interface AllowList {
  /**
   * Uppercase synthetic person-name tokens: the shipped fake-name pool. Consumed
   * by every structured name detector (HL7 PID-5, FHIR `HumanName`, C-CDA
   * `recordTarget`, X12 NM1/PER, NCPDP SCRIPT + Telecom, ASTM `P`-6).
   */
  names: Set<string>;
  /**
   * Synthetic dates of birth. Loaded but NOT consumed by any detector: no arm
   * value-gates a DOB, because a seeded synthetic DOB is structurally
   * indistinguishable from a real one and there is no reserved DOB range. Kept
   * so a future DOB rule has a declared source rather than inventing one.
   */
  dobs: Set<string>;
  /**
   * Synthetic id values (SSN / MRN / member-id shapes). Loaded but NOT consumed:
   * the id arms check a *shape* (SSA never-issued range, synthetic assigning
   * authority, failing NPI Luhn / DEA checksum) rather than a declared literal,
   * because a generator mints ids per seed and a literal list would never keep up.
   */
  ids: Set<string>;
  /** Allowed email domains (anything else is a hit). Used by the shape floor. */
  emailDomains: Set<string>;
  /**
   * Allowed EXACT email addresses, lower-cased. Strictly narrower than an
   * `EMAILDOMAIN` entry, and the right declaration when a real-but-not-PHI
   * address is carried inside a third-party artifact this repo vendors: it
   * clears that one address without clearing everything at its domain.
   */
  emails: Set<string>;
}

interface Args {
  mode: "all" | "staged" | "paths";
  paths: string[];
  allowFixtures: string[];
}

class InvocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvocationError";
  }
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Args {
  let staged = false;
  const paths: string[] = [];
  const allowFixtures: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--") {
      for (let j = i + 1; j < argv.length; j += 1) {
        const v = argv[j];
        if (v !== undefined) paths.push(v);
      }
      break;
    } else if (a === "--staged") {
      staged = true;
      i += 1;
    } else if (a === "--allow-fixture") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new InvocationError("--allow-fixture requires a path argument");
      }
      allowFixtures.push(next);
      i += 2;
    } else if (a !== undefined && a.startsWith("--")) {
      throw new InvocationError(`Unknown flag: ${a}`);
    } else if (a !== undefined) {
      paths.push(a);
      i += 1;
    } else {
      i += 1;
    }
  }

  if (staged && paths.length > 0) {
    throw new InvocationError("--staged cannot be combined with positional paths");
  }

  // An `--allow-fixture` path is a PURELY SUBTRACTIVE acknowledgement on a
  // broader scan, and never a scan target on its own. It must NOT seed the
  // positional path set: doing so made `--allow-fixture X` (with no positional
  // path) flip the mode to "paths", build the target set `[X]`, subtract `X`, and
  // scan NOTHING while printing `OK, no hits` and exiting 0. The mode is decided
  // by `--staged` and positional paths alone; `--allow-fixture X` on its own now
  // means "scan everything in scope EXCEPT X", which is what it always read as.
  let mode: Args["mode"];
  if (staged) {
    mode = "staged";
  } else if (paths.length > 0) {
    mode = "paths";
  } else {
    mode = "all";
  }
  return { mode, paths, allowFixtures };
}

/**
 * The `errno` string of a Node system error (`ENOENT`, `EACCES`, …), or
 * `undefined` for anything else. Narrowed with `in` rather than cast, so a thrown
 * non-error cannot masquerade as a system error and buy itself the tolerance
 * below.
 */
function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("code" in err)) return undefined;
  const { code } = err;
  return typeof code === "string" ? code : undefined;
}

// ---------------------------------------------------------------------------
// Allow-list + override log
// ---------------------------------------------------------------------------

function loadAllowList(): AllowList {
  if (!existsSync(ALLOW_LIST_PATH)) {
    throw new InvocationError(`allow-list not found at ${ALLOW_LIST_PATH}`);
  }
  const raw = readFileSync(ALLOW_LIST_PATH, "utf8");
  const names = new Set<string>();
  const dobs = new Set<string>();
  const ids = new Set<string>();
  const emailDomains = new Set<string>();
  const emails = new Set<string>();
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const sp = line.indexOf(" ");
    if (sp < 0) continue;
    const tag = line.slice(0, sp);
    const value = line.slice(sp + 1).trim();
    if (value.length === 0) continue;
    switch (tag) {
      case "NAME":
        names.add(value.toUpperCase());
        break;
      case "DOB":
        dobs.add(value);
        break;
      case "ID":
        ids.add(value.toUpperCase());
        break;
      case "EMAILDOMAIN":
        emailDomains.add(value.toLowerCase());
        break;
      case "EMAIL":
        emails.add(value.toLowerCase());
        break;
      default:
        break;
    }
  }
  return { names, dobs, ids, emailDomains, emails };
}

function normalizePath(p: string): string {
  const abs = isAbsolute(p) ? p : resolve(REPO_ROOT, p);
  const rel = relative(REPO_ROOT, abs);
  return rel.split(sep).join("/");
}

function loadOverrideLog(): Set<string> {
  if (!existsSync(OVERRIDE_LOG_PATH)) return new Set();
  const raw = readFileSync(OVERRIDE_LOG_PATH, "utf8");
  const out = new Set<string>();
  // Only `### <path>` subsections UNDER the "## Entries" heading are real override
  // entries. The prose above that heading (the format template, the detection map)
  // also uses `###` headings: parsing those as allowed paths would let a fixture
  // named to collide with a doc heading be silently bypassed.
  let inEntries = false;
  for (const lineRaw of raw.split(/\r?\n/)) {
    if (/^##\s+Entries\s*$/.test(lineRaw)) {
      inEntries = true;
      continue;
    }
    if (!inEntries) continue;
    const m = /^###\s+(.+?)\s*$/.exec(lineRaw);
    if (m && m[1] !== undefined) out.add(normalizePath(m[1]));
  }
  return out;
}

function validateAllowFixtures(allowFixtures: string[]): void {
  if (allowFixtures.length === 0) return;
  const overrides = loadOverrideLog();
  const missing = allowFixtures.map(normalizePath).filter((p) => !overrides.has(p));
  if (missing.length > 0) {
    const lines = missing.map((p) => `  - ${p}`).join("\n");
    throw new InvocationError(
      `--allow-fixture rejected: no matching entry in phi-scan-overrides.md for:\n${lines}\n` +
        `Add a "### <path>" subsection to phi-scan-overrides.md and commit it.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Target enumeration
// ---------------------------------------------------------------------------

interface Target {
  path: string; // forward-slash repo-relative path for reporting
  read: () => Buffer;
  /**
   * Absolute path, set only for a target the walk enumerated itself, so a vanished
   * file can be re-checked once the sweep has finished.
   */
  absPath?: string;
  /**
   * TOCTOU: true only for a file the scanner ENUMERATED ITSELF in `all` mode AND
   * that git does not track. All-mode lists `src/`, `test/` and `scripts/` first
   * and reads each file afterwards, so a transient created and deleted inside that
   * window makes the read throw `ENOENT` and refuses the whole sweep.
   *
   * IT IS REACHABLE IN THIS REPO, MEASURED RATHER THAN ASSUMED. `ccda` was the
   * sibling that got caught, by a repo-root `tsup.config.bundled_<hash>.mjs`; this
   * package's roots stop short of the repo root, so that particular transient is
   * never enumerated here. Its own suite is: `test/scripts/phi-scan.test.ts` seeds
   * untracked violators at `scripts/zz-phi-scan-seed-scripts.xml`,
   * `test/scripts/zz-phi-scan-seed-outside.xml` and
   * `test/fixtures/zz-phi-scan-seed-fixtures.xml`, all three inside `SCAN_ROOTS`,
   * and removes them in a `finally`. Sweeping this checkout in all-mode while that
   * suite runs refused 8 of 165 sweeps with exit 2 on those paths.
   *
   * Only the ENUMERATION was unsound, never the refusal, so the fix is scoped hard
   * rather than by relaxing what a failed read means:
   *   - a TRACKED file is never tolerated. The committed corpus is what the gate
   *     promises to have observed, so if a tracked file cannot be read the scan is
   *     incomplete and still refuses (exit 2);
   *   - only `ENOENT` is tolerated. `EACCES`, `EISDIR` and friends are not a file
   *     that went away, they are a scan that failed;
   *   - a tolerated file is re-checked after the sweep. If it is back on disk the
   *     sweep did not observe a file that exists now, so the run refuses;
   *   - `staged` mode reads blobs out of the git index (`git show :path`), so the
   *     pre-commit gate never depends on any of this.
   *
   * RESIDUAL, stated rather than hidden: the re-check is keyed on the PATH the walk
   * enumerated, not on content. An untracked file RENAMED inside the window is
   * `ENOENT` at the old path and was never enumerated under the new one, so its
   * bytes go unscanned under a clean report. It is bounded: the file has to be
   * untracked, so committing it means `git add`, after which it is tracked and
   * untolerable, and pre-commit reads the index either way.
   *
   * TWO WAYS TO CLOSE IT, AND NEITHER IS A WIDER BOUND, stated as the trade it is
   * rather than as an impossibility, because saying "this needs a content-addressed
   * sweep" alone reads as the latter and a refuter called that out. A
   * content-addressed sweep closes it in general. A cheaper one closes the in-roots
   * half: RE-ENUMERATE `SCAN_ROOTS` after the sweep and refuse if an in-scope file
   * exists that was never read. That is not free: it walks the tree twice and it
   * refuses on any unrelated file that arrives mid-sweep, which is the flake this
   * defect is about, so it is a trade a later slice should weigh, not an oversight
   * here.
   */
  tolerateVanish?: boolean;
}

// ---------------------------------------------------------------------------
// NON-REGULAR ENTRIES: the authoritative statement of the rule. Every other
// surface that mentions it (this file's header, CHANGELOG, the changeset) points
// HERE and does not restate it, because a guard described in four places drifts in
// three of them.
//
// AN IN-SCOPE ENTRY THAT IS NOT A REGULAR FILE REFUSES THE SCAN (exit 2). It is
// never silently skipped and it is never followed, because BOTH enumerating routes
// were blind to it in a way that read as CLEAN:
//
//   - the walk collected `Dirent.isFile()`, which is an lstat answer, so a symbolic
//     link is neither a file nor a directory and fell out of the loop silently,
//     whatever it pointed at. A linked DIRECTORY took a whole subtree with it;
//   - `--staged` listed paths with `--name-only` and read content with
//     `git show :<path>`. Git stores a symbolic link as its TARGET PATH under mode
//     `120000`, so that route was handed the path text and never the target's bytes,
//     then counted the result in its own denominator as a file scanned.
//
// MEASURED ON THIS PACKAGE'S BASE (`026e432`), with a name-bearing synthetic C-CDA
// `recordTarget` held outside the scan roots and a link to it under `src/`: all-mode
// reported `OK, no hits (1 file(s) scanned)` and exit 0, where the same bytes as a
// regular file under `src/` reported 2 hits and exit 1. Staging that link, and
// separately replacing a TRACKED regular file with it (git status `T`), each reported
// `OK, no hits (1 file(s) scanned)` and exit 0 over a mode-`120000` blob.
//
// THE STAGED HALF OF THIS PACKAGE HAD ALREADY WON THE ARGUMENT A SIBLING LOST, AND
// THAT IS WHY THE REMEDY HERE IS SMALLER THAN IT LOOKS ELSEWHERE. The status filter
// below is `--diff-filter=d`: an EXCLUSION, so `T` was already enumerated here; the
// sibling this remedy comes from used an `AM` allow-list and had to admit `T` first.
// What was missing here was not the record, it was the MODE: `--name-only` does not
// carry one, so nothing downstream could tell a blob from a link. Hence `--raw`.
//
// NEITHER ROUTE IS MADE TO FOLLOW A LINK. Following would read bytes the enumeration
// does not control (outside the repo, a loop, a device, a FIFO that blocks the gate
// forever), and git does not carry those bytes anyway, so a hit on them would be a
// claim about something no commit contains. Refusing states the only true thing
// available: there is an entry here the scan cannot account for, so the scan is not
// clean.
//
// "IN SCOPE" IS EACH ROUTE'S OWN EXISTING BOUNDARY, NOT A NEW ONE. The walk still
// drops a gitignored entry: the same rule that already drops a gitignored file, so a
// link does not get a second, stricter boundary of its own, and `--staged` still
// reads only the index. This narrows what those scopes ADMIT; it does not widen the
// scopes.
//
// THE ONE DELIBERATE ASYMMETRY IS `.md`, AND IT COST A REVIEW PASS TO GET RIGHT ON
// BOTH ROUTES RATHER THAN ONE. A markdown FILE is out of scope because documentation
// quotes violator values; a link merely NAMED `.md` is not, because its name is no
// evidence at all about what is on the other side. So the two halves of the old
// single scope predicate are now separate: `inScanRoot` decides whether an entry is
// the scan's business, and `isScannable`, which is `inScanRoot` plus the `.md`
// exemption, decides whether a REGULAR FILE's bytes get read. Every non-regular
// check keys on the first. The first version of this slice keyed the staged route on
// the second and asserted the rule anyway: a `.md`-named link refused in all-mode and
// returned `OK, no hits (0 file(s) scanned)` exit 0 when staged, with `.md` the sole
// discriminator. That is why the split is here and not inlined at one call site.
//
// A REFUSAL NAMES THE ENTRY'S OWN REPO-RELATIVE PATH AND AN ENGINE-OWNED TOKEN FOR
// ITS KIND. IT NEVER REPORTS THE LINK TARGET, which is text off the working tree and
// can itself carry PHI: a target path of the shape `../<surname>-<given>-<dob>.txt`
// is the whole reason. The shape is written out rather than an example, because a
// diagnostic ABOUT a PHI leak is itself a PHI surface, and that applies to the prose
// explaining it too.
//
// THIS IS NOT THE `tolerateVanish` TOLERANCE AND MUST NOT BE FOLDED INTO IT. That one
// is about a read that failed on a file the walk had already listed; this is about an
// entry the walk listed and can never read. A non-regular entry is a durable fact of
// the tree at enumeration time, not a race artifact, so there is no window to tolerate
// and an untracked one refuses exactly like a tracked one.
//
// REACHABLE AND REACHABLE-AT-A-RATE-THAT-MATTERS ARE DIFFERENT CLAIMS, SO BOTH WERE
// MEASURED. Reachable: the three readings above, each seeded by hand. Rate: a `find`
// over `src/`, `test/` and `scripts/` for every non-regular type, looped for the
// duration of one `pnpm build` followed by one `pnpm test`, ran 824 sweeps and saw a
// non-regular entry in 0 of them. At rest the same `find` returns 0, and
// `git ls-files -s` reports no entry outside modes `100644`/`100755`. So this rule
// refuses nothing this package's own tooling or suite produces, which is what makes
// refusing affordable here, and is a claim to RE-MEASURE rather than inherit if the
// roots or the suite's seeding ever move.
//
// ONE RESIDUAL, DISCLOSED RATHER THAN CLOSED, AND ONE THAT USED TO BE HERE AND IS NOT.
// `buildTargetsForPaths` still resolves an operator-named positional path through
// `statSync`, which FOLLOWS a link: that is left alone deliberately, every non-regular
// resolution still refuses there, and the one case that gets through (a link to a
// regular file) reads that file's real bytes, so it can only ever produce MORE hits,
// never fewer.
//
// THE SECOND RESIDUAL IS GONE, and the sentence is rewritten rather than deleted so the
// next reader knows it was real: the three roots in `SCAN_ROOTS` are named by this file
// rather than enumerated, and a root that was ITSELF a link used to be followed for the
// same reason, including to another root, which reported a clean exit 0 over a corpus
// that was not on disk. `buildTargetsForAll` now `lstat`s each root before walking it.
//
// AND A THIRD SURFACE THIS RULE NOW REACHES: a tracked path OUTSIDE the roots, which
// nothing classified before because no walk listed it and `--staged` filtered it out.
// `buildTargetsForTracked` refuses one whose git mode or whose on-disk kind is not a
// regular file, using the same two closed-set describers and the same refusal.
// ---------------------------------------------------------------------------

/**
 * An entry the enumeration reached but cannot scan. Both fields are safe to print:
 * `path` is the entry's own repo-relative path (the same locus every hit already
 * carries) and `kind` is a token from the closed set below. Nothing off the other
 * side of a link is ever recorded here.
 */
interface Unscannable {
  path: string;
  kind: string;
}

/** Closed-set, engine-owned description of a directory entry's kind. */
function direntKind(e: Dirent): string {
  if (e.isSymbolicLink()) return "a symbolic link";
  if (e.isFIFO()) return "a FIFO";
  if (e.isSocket()) return "a socket";
  if (e.isBlockDevice()) return "a block device";
  if (e.isCharacterDevice()) return "a character device";
  return "not a regular file";
}

/**
 * The same closed set over an `lstat` answer rather than a `Dirent`. Used for the two
 * things a `Dirent` cannot describe: a SCAN ROOT (nothing lists it, `walk` is entered
 * AT it) and a tracked path the walk never reached.
 */
function statKind(st: Stats): string {
  if (st.isSymbolicLink()) return "a symbolic link";
  if (st.isDirectory()) return "a directory";
  // NOT redundant with the fallback, and a refuter caught its absence: a scan root that
  // IS a regular file used to be described as "not a regular file", which is the walk's
  // framing arriving where the unmet requirement is "a directory". A diagnostic that
  // states the opposite of what it found teaches the reader the wrong thing to look for.
  if (st.isFile()) return "a regular file";
  if (st.isFIFO()) return "a FIFO";
  if (st.isSocket()) return "a socket";
  if (st.isBlockDevice()) return "a block device";
  if (st.isCharacterDevice()) return "a character device";
  return "not a regular file";
}

/**
 * `lstat` without following, or `undefined` when the path does not exist. Deliberately
 * NOT `existsSync`, which FOLLOWS a symbolic link and therefore answers false for a
 * DANGLING one: that is what let a dangling root read as merely absent, and a root
 * linked at another root read as present and healthy.
 *
 * @throws InvocationError for any failure that is not `ENOENT`. A path the scan cannot
 *   even stat is a scan that failed, not a path that is not there.
 */
function lstatOrUndefined(abs: string, rel: string): Stats | undefined {
  try {
    return lstatSync(abs);
  } catch (err) {
    if (errorCode(err) === "ENOENT") return undefined;
    throw new InvocationError(
      `could not stat ${rel}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Enumerate a scan root. `Dirent`'s predicates are lstat answers and are NOT
 * exhaustive: an entry that is neither a directory nor a regular file is collected
 * into `unscannable` rather than dropped, so the caller can refuse instead of
 * reporting clean over it.
 *
 * ONLY EVER ENTERED AT A VERIFIED DIRECTORY: the caller `lstat`s each root, and the
 * recursion below only follows a `Dirent` that lstat says is a directory. So a
 * `readdirSync` failure here is not "a root that is really a file", it is the tree
 * moving under the sweep, and it REFUSES rather than escaping as an uncaught throw
 * that node reports as exit 1, the code this contract reserves for "hits found".
 */
function walk(dir: string, out: string[], unscannable: Unscannable[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    throw new InvocationError(
      `could not list ${normalizePath(dir)}: ${err instanceof Error ? err.message : String(err)}. ` +
        `Refusing rather than reporting a sweep over a directory it could not read.`,
    );
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out, unscannable);
    } else if (e.isFile()) {
      // `isScannable` is the single in-scope predicate, shared with staged mode.
      if (!isScannable(normalizePath(full))) continue;
      out.push(full);
    } else {
      // Deliberately NOT subject to `isScannable`'s `.md` exemption. That exemption
      // is a judgement about a file whose bytes the walk could have read; see the
      // section comment above. The ROOT half of `isScannable` is satisfied
      // structurally: `walk` is only ever entered at a member of `SCAN_ROOTS`.
      unscannable.push({ path: normalizePath(full), kind: direntKind(e) });
    }
  }
}

/**
 * Refuse (exit 2) over entries the enumeration reached and cannot scan. EVERY
 * offender is named, not just the first: a developer who has to re-run the gate once
 * per link learns to distrust it.
 */
function refuseUnscannable(entries: readonly Unscannable[], why: string, remedy: string): void {
  if (entries.length === 0) return;
  const lines = entries.map((u) => `  - ${u.path} (${u.kind})`).join("\n");
  const noun =
    entries.length === 1 ? "entry is not a regular file" : "entries are not regular files";
  throw new InvocationError(
    `refusing the scan: ${String(entries.length)} ${noun}:\n${lines}\n${why} ${remedy}`,
  );
}

function gitIgnored(paths: string[]): Set<string> {
  const ignored = new Set<string>();
  if (paths.length === 0) return ignored;
  try {
    // SECURITY: array-form execFileSync, no shell. Default (Buffer) encoding:
    // `encoding: "buffer"` with `input` is rejected by Node.
    const out = execFileSync("git", ["check-ignore", "--stdin", "-z"], {
      input: paths.map(normalizePath).join("\0"),
      stdio: ["pipe", "pipe", "ignore"],
    });
    for (const p of out.toString("utf8").split("\0")) {
      if (p.length > 0) ignored.add(p);
    }
  } catch {
    // `git check-ignore` exits 1 when nothing matches, treat as none ignored.
  }
  return ignored;
}

/**
 * Every path git tracks, mapped to its file MODE, or `null` when git could not answer.
 *
 * TWO CALLERS WITH DIFFERENT STAKES. It still switches the `tolerateVanish` tolerance
 * off (without the tracked set there is no way to tell a build transient from committed
 * content), and it is now also the SUBJECT of the tracked-file arm, which is why
 * all-mode REFUSES on `null` rather than carrying on: a silently absent tracked set
 * would silently subtract that whole arm, which is the defect this file is about.
 *
 * An EMPTY answer counts as no answer for the same reason. `git ls-files` exits 0
 * with no output for a repo whose index is empty or has been removed (a CORRUPT
 * index exits 128 and is already caught by the `catch`), and an empty set would
 * make EVERY file untracked: the one state in which the tracked-file bound
 * silently stops existing. This repo always tracks files, so there is no
 * legitimate empty case here.
 *
 * ONE LIMIT, DISCLOSED RATHER THAN CLOSED. `execFileSync`'s default 1 MiB `maxBuffer`
 * bounds the answer: a repo whose `git ls-files -s -z` output exceeds it throws and
 * lands in the `catch`. Measured on this repo: 18,015 bytes against 6,765 for a bare
 * listing, so `-s` costs 2.7x and leaves roughly 58x of headroom, under two orders of
 * magnitude. Recorded because the next repo to take this change may have less room.
 * It fails in the refusing direction.
 */
function gitTracked(): Map<string, string> | null {
  try {
    // SECURITY: array-form execFileSync, no shell. `-z` is NUL-separated and
    // unquoted, so it matches the walk's forward-slash relative paths exactly.
    //
    // `-s` rather than a bare listing, because the MODE is what distinguishes a
    // tracked regular blob from a tracked symlink or gitlink, and the tracked-file
    // arm below reads paths nothing else classifies. Record shape is
    // `<mode> <sha> <stage>\t<path>`, and only the `\t` is positional.
    const out = execFileSync("git", ["ls-files", "-s", "-z"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    const tracked = new Map<string, string>();
    for (const record of out.toString("utf8").split("\0")) {
      if (record.length === 0) continue;
      const tab = record.indexOf("\t");
      const mode = record.slice(0, 6);
      const path = tab < 0 ? "" : record.slice(tab + 1);
      // A record this cannot read is NOT skipped: a silently shortened tracked set
      // narrows the scan below without narrowing the denominator, which is the exact
      // shape this file exists to refuse.
      if (path.length === 0 || !/^\d{6}$/.test(mode)) return null;
      tracked.set(path, mode);
    }
    return tracked.size > 0 ? tracked : null;
  } catch {
    return null;
  }
}

/**
 * Every tracked file the walk did not reach: the reconciliation half of all-mode.
 *
 * Its subject is `git ls-files` MINUS what the walk already listed, so it is a union
 * with the walk and can never shrink it. Markdown stays out ({@link isMarkdown}), and
 * so do the literal paths in {@link BINARY_EXEMPT_PATHS}.
 *
 * TWO WAYS IT REFUSES RATHER THAN QUIETLY READING LESS, because this arm's whole point
 * is to notice what nothing opened:
 *   - a tracked path whose git MODE is not a regular blob, or whose on-disk kind is
 *     not a regular file, refuses exactly as the walk's non-regular rule does;
 *   - a tracked path ABSENT from the working tree refuses. That is the case a root's
 *     missing sub-directory used to hide in: the files stay in the index, so they turn
 *     up here and are named, rather than going unread under a plausible denominator.
 *
 * AN INERT EXEMPTION IS NOT ONE OF THEM, AND THAT IS A DELIBERATE PLACEMENT RATHER THAN
 * AN OMISSION. Refusing here on an exempt path git does not track would couple the
 * scanner to seven specific archives existing, so it would refuse in any tree that has
 * the scanner and not the vendored tarballs, which is every throwaway root this suite
 * builds and any shallow export. The drift is caught where a repo-specific fact belongs,
 * in `test/scripts/phi-scan.test.ts`, which reconciles the literal list against what git
 * DECLARES binary and reds if either side moves.
 *
 * @param walked - repo-relative paths the walk already yielded, after the ignore filter.
 * @param tracked - `git ls-files -s` as path to mode.
 * @returns one target per tracked file the walk did not reach.
 * @throws InvocationError for each of the two cases above.
 */
function buildTargetsForTracked(
  walked: ReadonlySet<string>,
  tracked: ReadonlyMap<string, string>,
): Target[] {
  const exempt = new Set(BINARY_EXEMPT_PATHS);
  const candidates = [...tracked.keys()]
    .filter((rel) => !walked.has(rel) && !exempt.has(rel) && !isMarkdown(rel))
    .sort();

  const irregular: Unscannable[] = [];
  const absent: string[] = [];
  const targets: Target[] = [];
  for (const rel of candidates) {
    const mode = tracked.get(rel) ?? "";
    if (!REGULAR_BLOB_MODES.has(mode)) {
      irregular.push({ path: rel, kind: gitModeKind(mode) });
      continue;
    }
    const abs = join(REPO_ROOT, rel);
    const st = lstatOrUndefined(abs, rel);
    if (st === undefined) {
      absent.push(rel);
      continue;
    }
    if (!st.isFile()) {
      irregular.push({ path: rel, kind: statKind(st) });
      continue;
    }
    // NEVER `tolerateVanish`: that tolerance is for an UNTRACKED transient the walk
    // listed itself, and every path here is tracked by definition.
    targets.push({ path: rel, read: () => readFileSync(abs), absPath: abs });
  }

  refuseUnscannable(
    irregular,
    "The scan can neither read such an entry nor vouch for what is on the other side of it.",
    "Remove it, replace it with a regular file, or untrack it.",
  );

  if (absent.length > 0) {
    throw new InvocationError(
      `refusing the scan: ${String(absent.length)} tracked file(s) in scope are absent from the ` +
        `working tree:\n${absent.map((p) => `  - ${p}`).join("\n")}\n` +
        `git still carries them, so an OK here would be an OK over bytes nothing read. ` +
        `Restore them, or stage the deletion so they leave the index too.`,
    );
  }

  return targets;
}

function buildTargetsForAll(): Target[] {
  const files: string[] = [];
  const unscannable: Unscannable[] = [];

  // EACH ROOT IS CLASSIFIED BEFORE IT IS WALKED, and `walk` is entered only at a real
  // directory. `existsSync` is deliberately not used: it FOLLOWS a link, so a DANGLING
  // root answered false and read as merely absent, and a root LINKED AT ANOTHER ROOT
  // answered true and was walked, which let the other root's bytes satisfy the per-root
  // observation rule while this root's corpus was not on disk at all. Both were measured
  // on this repo, and the second was a clean exit 0.
  const rootProblems: Unscannable[] = [];
  for (const root of SCAN_ROOTS) {
    const abs = join(REPO_ROOT, root);
    const st = lstatOrUndefined(abs, root);
    // An ABSENT root is left to the per-root observation rule in `main`, which already
    // names it and refuses: two refusals for one state would only disagree over time.
    if (st === undefined) continue;
    if (!st.isDirectory()) {
      rootProblems.push({ path: root, kind: statKind(st) });
      continue;
    }
    walk(abs, files, unscannable);
  }
  // A ROOT GETS ITS OWN REFUSAL RATHER THAN `refuseUnscannable`'s, because the unmet
  // requirement is different: an ENTRY has to be a regular file, a ROOT has to be a
  // directory. Borrowing the entry wording printed "test (not a regular file)" for a
  // root that was exactly that, which is the opposite of what it found.
  if (rootProblems.length > 0) {
    const lines = rootProblems.map((u) => `  - ${u.path} (${u.kind})`).join("\n");
    const noun = rootProblems.length === 1 ? "scan root is" : "scan roots are";
    throw new InvocationError(
      `refusing the scan: ${String(rootProblems.length)} ${noun} not a directory:\n${lines}\n` +
        `A scan root that is not a directory yields no files, and the per-root observation ` +
        `rule cannot tell that apart from a root that is merely absent. Restore it as a ` +
        `directory, or change SCAN_ROOTS in scripts/phi-scan.ts.`,
    );
  }

  // ONE `git check-ignore` over both lists. An ignored entry is already out of scope
  // for the file route, so applying the same rule to a link keeps a single boundary
  // rather than inventing a second, stricter one for links alone.
  const ignored = gitIgnored([...files.map(normalizePath), ...unscannable.map((u) => u.path)]);

  refuseUnscannable(
    unscannable.filter((u) => !ignored.has(u.path)),
    "The walk can neither read such an entry nor vouch for what is on the other side of it.",
    "Remove it, replace it with a regular file, or (if it is genuinely not part of the " +
      "corpus) untrack it and add it to .gitignore.",
  );

  const tracked = gitTracked();
  if (tracked === null) {
    // FAIL CLOSED, AND SAY SO. All-mode's scope is now partly defined by the index, so a
    // git that cannot answer is a sweep that cannot say what it failed to open. The old
    // behaviour (silently switch the TOCTOU tolerance off) was survivable while the roots
    // were the whole scope; it is not survivable now.
    throw new InvocationError(
      "could not read `git ls-files -s -z`, or it answered with an empty index. All-mode " +
        "reconciles what it walked against what git tracks, so without that answer it " +
        "cannot say which tracked files nothing opened. Refusing rather than reporting an " +
        "OK over an unknown corpus.",
    );
  }

  const walkTargets = files
    .filter((abs) => !ignored.has(normalizePath(abs)))
    .map((abs) => ({
      path: normalizePath(abs),
      read: () => readFileSync(abs),
      absPath: abs,
      tolerateVanish: !tracked.has(normalizePath(abs)),
    }));

  // UNION, IN THIS ORDER, AND THE WALK'S SET IS NEVER FILTERED BY THE SECOND ARM. A
  // tracked file the walk DID reach is already a target; the reconciliation adds the
  // rest. A tracked file that the ignore filter dropped under a root arrives here too,
  // which is the one place the two arms overlap in intent: git carries it, so it is
  // corpus whatever `.gitignore` says.
  const walkedPaths = new Set(walkTargets.map((t) => t.path));
  return [...walkTargets, ...buildTargetsForTracked(walkedPaths, tracked)];
}

function buildTargetsForPaths(paths: string[]): Target[] {
  return paths.map((p) => {
    const abs = isAbsolute(p) ? p : resolve(REPO_ROOT, p);
    if (!existsSync(abs)) throw new InvocationError(`File not found: ${p}`);
    if (!statSync(abs).isFile()) throw new InvocationError(`Not a regular file: ${p}`);
    return { path: normalizePath(abs), read: () => readFileSync(abs) };
  });
}

/** git's file modes for a regular blob. Every other mode is not a file to read. */
const REGULAR_BLOB_MODES: ReadonlySet<string> = new Set(["100644", "100755"]);

/** Closed-set, engine-owned description of a git file mode. Never the link target. */
function gitModeKind(mode: string): string {
  if (mode === "120000") return "a symbolic link";
  if (mode === "160000") return "a gitlink (a nested repository)";
  return `a git mode-${mode} entry`;
}

/**
 * `:<srcmode> <dstmode> <srcsha> <dstsha> <status>`, the info half of a `--raw -z`
 * record. The shas are ABBREVIATED by default (measured: 7 hex chars), so the length
 * is not pinned. The status may carry a numeric similarity score (`R100`), which
 * `--no-renames` prevents but the pattern still admits rather than desyncing over.
 */
const RAW_RECORD = /^:(?:\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ [A-Z]\d*$/;

function buildTargetsForStaged(): Target[] {
  let listBuf: Buffer;
  try {
    // SECURITY: array-form execFileSync, no shell.
    //
    // All three flags are load-bearing, and the SECOND one is the general lesson.
    //
    // `--no-renames`: with rename detection on (the default since git 2.9) a fixture
    // that is `git mv`'d AND edited to add PHI stages as a single `R` entry. This
    // decomposes it into `D` + `A`, so the destination path, the one carrying the new
    // content, is enumerated. It also keeps every record to a SINGLE path, which is
    // what makes the two-field stride below sound: `R` and `C` are the only statuses
    // carrying a second path, and this flag prevents both.
    //
    // `--diff-filter=d` (lower-case: "everything EXCEPT deletions") rather than an
    // upper-case allow-list of status letters. `AM` was that allow-list, and it is the
    // wrong polarity for a safety gate: every letter it does not name is dropped
    // silently, which is how it missed `R` above and `T` (typechange) in `ncpdp`, each
    // found by a separate refuter pass. An exclusion list scans an unfamiliar letter
    // instead of skipping it, so an unknown or future status can only ever cost a
    // wasted scan, never a missed file. Deletions are excluded because there is no blob
    // left to read.
    //
    // `--raw` rather than `--name-only`, because the DESTINATION MODE is the only thing
    // that distinguishes a staged regular file from a staged symlink or gitlink, and
    // `git show :<path>` answers all three without complaint. See "NON-REGULAR ENTRIES"
    // above for what that cost before this flag.
    //
    // IT MOVES A BOUND, AND `gitTracked()` SETS THE PRECEDENT FOR DISCLOSING ONE RATHER
    // THAN HIDING IT. `execFileSync`'s default 1 MiB `maxBuffer` caps this answer, and
    // the info half of a record costs a fixed 32 bytes plus its NUL. Measured over 200
    // staged paths in a throwaway repo: 70.5 bytes/record under `--raw` against 37.5
    // under `--name-only`, so the ceiling falls from roughly 27,900 staged paths to
    // roughly 14,800. It fails CLOSED: an over-long answer throws `ENOBUFS`, lands in
    // the `catch` below, and refuses (exit 2).
    //
    // THE HEADROOM IS RE-DERIVED HERE RATHER THAN COPIED OFF `gitTracked()`, whose
    // "three orders of magnitude" is its own measurement and does not describe this
    // one. Every path this repo tracks is 6,657 bytes, and the widest plausible staged
    // set is all of them, so the worst case is that total plus 33 bytes per record:
    // about 13,900 bytes against 1,048,576, i.e. roughly 75x of headroom: ample, and
    // under two orders of magnitude. The halving is recorded because the next repo to
    // take this change may not have even that.
    listBuf = execFileSync(
      "git",
      ["diff", "--cached", "--no-renames", "--raw", "--diff-filter=d", "-z"],
      {
        encoding: "buffer",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (err) {
    throw new InvocationError(
      `git diff --cached failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // `--raw -z` emits `<info>\0<path>\0` per record, so the stride is two fields (see
  // `--no-renames` above). A record that does not parse REFUSES rather than being
  // skipped: a silently shortened list is exactly the shape this scan must never
  // report clean over, and a desync would shorten it.
  const fields = listBuf.toString("utf8").split("\0");
  const staged: { path: string; mode: string }[] = [];
  let i = 0;
  while (i < fields.length) {
    const info = fields[i];
    if (info === undefined || info.length === 0) {
      i += 1;
      continue;
    }
    const mode = RAW_RECORD.exec(info)?.[1];
    const path = fields[i + 1];
    if (mode === undefined || path === undefined || path.length === 0) {
      throw new InvocationError(
        "could not read the output of `git diff --cached --raw -z`: unrecognized record. " +
          "Refusing rather than scanning a list that may be short.",
      );
    }
    staged.push({ path, mode });
    i += 2;
  }

  // TWO FILTERS, IN THIS ORDER, AND THE ORDER IS THE WHOLE POINT. The non-regular
  // check runs over everything under a scan root; only then does the `.md` exemption
  // narrow what is READ. Running `isScannable` first put a `.md`-named staged link
  // through the exemption and back out as `OK`. See "NON-REGULAR ENTRIES" above.
  const inRoot = staged.filter((s) => inScanRoot(s.path));

  refuseUnscannable(
    inRoot
      .filter((s) => !REGULAR_BLOB_MODES.has(s.mode))
      .map((s) => ({ path: s.path, kind: gitModeKind(s.mode) })),
    // Accurate for every mode this can name, not just `120000`: a symbolic link's blob
    // IS its target path, while a gitlink and an unmerged path have no regular blob at
    // stage 0 at all. Saying "hands back its target path" for all of them was wrong on
    // a real merge conflict, where the mode reads `000000`.
    "`git show :<path>` does not answer with file content for such an entry, for a symbolic link " +
      "it hands back the target path, and otherwise there is no regular blob at stage 0 to read, " +
      "so scanning it would prove nothing about what it stands for.",
    "Unstage it, or replace it with a regular file.",
  );

  return inRoot
    .filter((s) => isScannable(s.path))
    .map(({ path: relPath }) => ({
      path: relPath,
      // SECURITY: array-form execFileSync, no shell. `:<path>` is a git pathspec.
      read: (): Buffer =>
        execFileSync("git", ["show", `:${relPath}`], {
          encoding: "buffer",
          stdio: ["ignore", "pipe", "pipe"],
        }),
    }));
}

// ---------------------------------------------------------------------------
// Cross-cutting shape checks: the format-agnostic FLOOR
// ---------------------------------------------------------------------------

/**
 * Whether a 9-digit SSN (dashes optional) is drawn from an SSA never-issued / reserved space: area
 * `000`, `666`, or `900–999`. This is the one place a *synthetic-data generator's* PHI gate must
 * differ from a parser's: `synth` legitimately emits `900-xx-xxxx` never-issued SSNs and the
 * `987-65-432x` advertising block, and those are *proof of synthetic*, not PHI. A real, issuable SSN
 * (area `001–899`, excluding `666`) is still a hard hit (roadmap §4.1, §4.4).
 */
function isSyntheticSsn(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return false;
  const area = Number(digits.slice(0, 3));
  return area === 0 || area === 666 || area >= 900;
}

function scanCommonShapes(path: string, content: string, allow: AllowList, hits: Hit[]): void {
  // Dashed SSN anywhere, a hit UNLESS it is a provably-synthetic never-issued/reserved SSN.
  for (const m of content.matchAll(/\b\d{3}-\d{2}-\d{4}\b/g)) {
    if (isSyntheticSsn(m[0])) continue;
    hits.push({ path, segment: "(ssn)", value: m[0], reason: "dashed SSN pattern" });
  }
  // Emails whose domain is not an allow-listed reserved / test domain.
  for (const m of content.matchAll(/\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g)) {
    const domain = (m[1] ?? "").toLowerCase();
    if (allow.emails.has(m[0].toLowerCase())) continue;
    if (!allow.emailDomains.has(domain)) {
      hits.push({ path, segment: "(email)", value: m[0], reason: "email with non-test domain" });
    }
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Scan one target. Returns whether the target was OBSERVED, i.e. whether its
 * bytes were actually read. `false` is returned for exactly one case, the
 * tolerated TOCTOU vanish documented on `Target.tolerateVanish`; every other read
 * failure still refuses the whole scan.
 */
function scanTarget(target: Target, allow: AllowList, hits: Hit[]): boolean {
  let buf: Buffer;
  try {
    buf = target.read();
  } catch (err) {
    // TOCTOU, see `Target.tolerateVanish`: an untracked file the walk enumerated
    // itself may be a transient that was deleted before we reached it. Report it as
    // unobserved instead of refusing; every other failure, and any tracked file,
    // still refuses the whole scan.
    if (target.tolerateVanish === true && errorCode(err) === "ENOENT") return false;
    throw new InvocationError(
      `could not read ${target.path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const text = buf.toString("utf8");

  // The format-agnostic floor: dashed SSN (synthetic-area-aware) + non-test email.
  scanCommonShapes(target.path, text, allow, hits);

  // Structured, field-level detection for the format synth actually generates in Phase 1: HL7 v2.
  // A generated fixture is swept at its real PHI loci (PID name / SSN / phone) and every value must be
  // provably synthetic, the executable, format-aware half of the synthetic-safety gate (roadmap §4.4).
  scanHl7(target.path, text, allow, hits);

  // FHIR R4 / US Core (Phase 3). A generated resource (or Bundle) is swept at its real PHI loci:
  // HumanName (`family`/`given`) and ContactPoint (`telecom` phone), against the synthetic sources.
  // Whole-file JSON is walked structurally; anything else that declares a `resourceType` is read
  // textually. A target doing neither falls straight through.
  scanFhir(target.path, text, allow, hits);

  // C-CDA R2.1 (Phase 4 / SYNTH-5). A generated document is swept at its real PHI loci: every
  // `name` (`given` / `family`) and any `telecom` phone, document-wide, against the synthetic sources
  // (roadmap §4.4). Admitted by an `.xml` path or a CDA marker; anything else falls straight through.
  scanCcda(target.path, text, allow, hits);

  // X12 EDI (Phase 5 / SYNTH-6). A generated 837 / 835 / 271 is swept at its real PHI loci: NM1 person
  // names + member ids + provider NPIs, PER contact names + phones, and REF*SY provider SSNs, against
  // the synthetic sources (roadmap §4.4). The X12 identity invariant is the hardest-attacked: a member
  // id must be synthetic-AA-scoped, an XX-qualified NPI must fail the NPI Luhn check (so it can never be
  // a real NPI), and a REF*SY SSN must be in the SSA never-issued range. Non-X12 targets (no ISA header)
  // fall straight through.
  scanX12(target.path, text, allow, hits);

  // NCPDP (Phase 6 / SYNTH-7). Two structurally unrelated standards under one brand, each swept at its
  // real PHI loci against the synthetic sources (roadmap §4.4):
  //   - SCRIPT (XML): patient + prescriber <FirstName>/<LastName>/<MiddleName> must be declared
  //     synthetic; a <NPI> must fail the NPI Luhn check; a <DEANumber> must fail the DEA checksum, so
  //     neither prescriber id can denote a real provider.
  //   - Telecom (FS/GS/RS-framed): keyed off the 2-char field ids, CA/CB/CC/CD (name), CQ (phone),
  //     CY (patient id) / C2 (cardholder id), plus the prescriber DB (NPI) Luhn check. Keying off the
  //     globally-unique field id (not the enclosing segment) is bypass-resistant.
  // Non-NCPDP targets fall straight through.
  scanNcpdpScript(target.path, text, allow, hits);
  scanNcpdpTelecom(target.path, text, allow, hits);

  // ASTM E1394 / E1381 (Phase 6 / SYNTH-8). A generated H/P/O/R/C/L record stream (or its E1381-framed
  // twin) is swept at its real PHI locus, the `P` (patient) record, against the synthetic sources
  // (roadmap §4.4): every name component (field 6, `Last^First^Middle`) must be declared synthetic, and
  // the practice-assigned (field 3) and laboratory-assigned (field 4) patient ids must be recognized as
  // synthetic-AA-scoped. The detector tolerates a leading frame prefix (`<STX><FN>`), so a framed
  // fixture is swept identically to a bare record stream. DOB (field 8) is intentionally not value-gated:
  // a synthetic DOB is seeded and indistinguishable from a real one, and there is no reserved DOB
  // range (roadmap §4.3), matching every other synth arm. Non-ASTM targets fall straight through.
  scanAstm(target.path, text, allow, hits);

  // The bytes were read, so the target was observed: whatever any individual arm
  // decided to do with them.
  return true;
}

/**
 * Whether an ASTM `P`-record patient id (practice- or laboratory-assigned) is a recognized synthetic
 * shape: minted under the synthetic assigning authority (the `PRA` / `LAB` / `ACC` / `MBR`-prefixed
 * forms `synth` emits, roadmap §4.1, there is no reserved patient-id range for ASTM, so the *namespace*
 * is the guarantee). A short all-digit id under the synthetic AA is acceptable; a 9-digit SSN-shaped
 * value must instead be in the SSA never-issued range.
 */
function isSyntheticAstmId(id: string): boolean {
  const v = id.trim().toUpperCase();
  if (v.length === 0) return true;
  if (/^(PRA|LAB|ACC|MBR)[-_]?[0-9A-Z]*$/.test(v)) return true;
  const digits = v.replace(/\D/g, "");
  if (digits.length === 9 && v.length === digits.length) return isSyntheticSsn(v);
  return /^[0-9]{1,8}$/.test(v);
}

/**
 * ASTM structured PHI detection. Over an ASTM record stream, bare (E1394) or framed (E1381), locates
 * each `P` (patient) record and checks its identity loci: every name-component token (len ≥ 2) in field
 * 6 must be a declared-synthetic name, and the practice-assigned (field 3) and laboratory-assigned
 * (field 4) patient ids must be synthetic-AA-scoped. The P-record matcher tolerates an optional leading
 * `<STX><frame-number>` so a framed fixture is swept exactly like a bare stream. A non-ASTM target (no
 * canonical `H|\^&` delimiter declaration) falls straight through.
 */
function scanAstm(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  // The canonical ASTM header delimiter declaration is the reliable, format-unique marker.
  if (!text.includes("H|\\^&")) return;
  // Match each P record (fields up to the next record/frame terminator), tolerating a leading frame prefix.
  for (const m of text.matchAll(/(?:[\r\n]|^|\x02[0-7])P\|([^\r\n\x03\x17]*)/g)) {
    // ASTM fields are 1-based with the record type as field 1, so field K lives at array index K-1
    // (`P|seq|practice|lab|…` → field 3 = index 2, field 6 = index 5).
    const fields = `P|${m[1] ?? ""}`.split("|");
    const field = (n: number): string => fields[n - 1] ?? "";

    // Field 6: patient name (`Last^First^Middle`). Each multi-char component must be declared synthetic.
    for (const token of field(6).split("^")) {
      const t = token.trim();
      if (t.length < 2) continue; // a single-char middle initial is structurally non-identifying.
      if (!allow.names.has(t.toUpperCase())) {
        hits.push({ path, segment: "P-6", value: t, reason: "name not declared synthetic" });
      }
    }

    // Fields 3 + 4: practice- and laboratory-assigned patient ids. Both must be synthetic-AA-scoped.
    for (const [fieldNo, label] of [
      [3, "P-3 (practice id)"],
      [4, "P-4 (lab id)"],
    ] as const) {
      const idValue = field(fieldNo).trim();
      if (idValue.length > 0 && !isSyntheticAstmId(idValue)) {
        hits.push({
          path,
          segment: label,
          value: idValue,
          reason: "patient-id shape not recognized as synthetic-AA-scoped",
        });
      }
    }
  }
}

/**
 * Whether a DEA number (`XX` + 7 digits) is **provably synthetic**: its 7th digit fails the published
 * DEA checksum `(d1+d3+d5) + 2·(d2+d4+d6)`, so it can never be a validly-issued DEA registration. A
 * checksum-valid DEA (which *could* be a real prescriber) is a hit. Mirrors
 * `src/safe/reserved.ts#isSyntheticDea`, kept inline because the scanner is a zero-import Node script.
 */
function isSyntheticDea(value: string): boolean {
  const compact = value.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{7}$/.test(compact)) return false;
  const d = compact
    .slice(2)
    .split("")
    .map((c) => c.charCodeAt(0) - 48);
  const odd = (d[0] ?? 0) + (d[2] ?? 0) + (d[4] ?? 0);
  const even = (d[1] ?? 0) + (d[3] ?? 0) + (d[5] ?? 0);
  return (odd + 2 * even) % 10 !== (d[6] ?? -1);
}

/**
 * Whether an NCPDP member / cardholder / patient id is a recognized synthetic shape: minted under the
 * synthetic assigning authority (the `MBR`-prefixed form `synth` emits; roadmap §4.1, there is no
 * reserved id range so the *namespace* is the guarantee). A 9-digit SSN-shaped value must instead be in
 * the SSA never-issued range.
 */
function isSyntheticNcpdpId(id: string): boolean {
  const v = id.trim().toUpperCase();
  if (/^MBR[-_]?[0-9A-Z]*$/.test(v)) return true;
  const digits = v.replace(/\D/g, "");
  if (digits.length === 9 && v.length === digits.length) return isSyntheticSsn(v);
  // A short all-digit id under the synthetic AA is acceptable; a long bare id is not distinguishable.
  return /^[0-9]{1,8}$/.test(v);
}

/**
 * SCRIPT (XML) structured PHI detection. Over a SCRIPT message, checks the patient + prescriber identity
 * loci: every `<FirstName>` / `<LastName>` / `<MiddleName>` name token must be declared synthetic, every
 * `<NPI>` must fail the NPI Luhn check, and every `<DEANumber>` must fail the DEA checksum. A non-SCRIPT
 * target (no `<Message`/SCRIPT markers) falls straight through; C-CDA `<given>`/`<family>` is handled by
 * {@link scanCcda}, so the two XML arms never collide.
 *
 * THE EXTENSION GATE HERE ADDED NOTHING THE MARKERS DID NOT ALREADY DO. The `<Message>` +
 * transaction/party check immediately below was ALREADY a content gate; the `.xml` test was an
 * ORTHOGONAL condition stacked on top of it, not a narrower one. Removing it widens the arm by exactly
 * `{files matching the markers that are not named .xml}`.
 *
 * BE PRECISE ABOUT WHAT LANDS IN THAT SET, because an earlier draft called it "by construction, a
 * SCRIPT message" and THIS REPO REFUTES THAT: `test/scripts/phi-scan.test.ts` is admitted here. It is
 * a TypeScript test that happens to contain a `<Message>` envelope and a `<Patient>` element inside a
 * fixture string. Reading it is correct: a `<LastName>` spelled out there would be a real hit, but
 * it is a source file, not a SCRIPT message, and the marker set cannot tell the difference. That is
 * the same file-scoped admission cost the header lists, reached by a different arm.
 */
function scanNcpdpScript(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  // SCRIPT markers, a <Message> root and a SCRIPT transaction/party element. Avoids running on C-CDA.
  if (
    !/<Message\b/.test(text) ||
    !/<(NewRx|RxRenewalRequest|RxChangeRequest|Prescriber|Patient)\b/.test(text)
  ) {
    return;
  }
  for (const m of text.matchAll(/<(LastName|FirstName|MiddleName)(?:\s[^>]*)?>([^<]+)<\/\1>/g)) {
    const token = (m[2] ?? "").trim();
    if (token.length === 0) continue;
    if (!allow.names.has(token.toUpperCase())) {
      hits.push({
        path,
        segment: `<${m[1] ?? "Name"}>`,
        value: token,
        reason: "name not declared synthetic",
      });
    }
  }
  for (const m of text.matchAll(/<NPI(?:\s[^>]*)?>([^<]+)<\/NPI>/g)) {
    const value = (m[1] ?? "").trim();
    if (/^\d{10}$/.test(value) && !isSyntheticNpi(value)) {
      hits.push({
        path,
        segment: "<NPI>",
        value,
        reason: "NPI passes the Luhn check, could be a real NPI",
      });
    }
  }
  for (const m of text.matchAll(/<DEANumber(?:\s[^>]*)?>([^<]+)<\/DEANumber>/g)) {
    const value = (m[1] ?? "").trim();
    if (/^[A-Za-z]{2}\d{7}$/.test(value) && !isSyntheticDea(value)) {
      hits.push({
        path,
        segment: "<DEANumber>",
        value,
        reason: "DEA passes the checksum, could be a real DEA registration",
      });
    }
  }
}

/** Telecom 2-char field ids that carry patient / cardholder PHI, keyed to the category to check. */
const TELECOM_PHI_FIELDS: Readonly<Record<string, "name" | "phone" | "id">> = {
  CA: "name", // Patient First Name
  CB: "name", // Patient Last Name
  CC: "name", // Cardholder First Name
  CD: "name", // Cardholder Last Name
  CQ: "phone", // Patient Phone
  CY: "id", // Patient ID
  C2: "id", // Cardholder ID
};

/**
 * Telecom (FS/GS/RS-framed) structured PHI detection. Tokenizes on the union of the three NCPDP
 * separators (each token is a `<2-char field id><value>` pair), and checks the identity-bearing field
 * ids against the synthetic sources: names (CA/CB/CC/CD) must be declared synthetic, phones (CQ) must
 * carry the reserved 555-01xx tail, ids (CY/C2) must be synthetic-AA-scoped, and any prescriber id (DB)
 * that is a 10-digit NPI must fail the Luhn check. A non-Telecom target (no control chars) falls
 * straight through. DOB (C4) is not value-gated: a synthetic DOB is seeded and indistinguishable from
 * a real one, and there is no reserved DOB range (roadmap §4.3), matching every other synth arm.
 */
function scanNcpdpTelecom(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  if (!/[\x1c\x1d\x1e]/.test(text)) return;
  for (const token of text.split(/[\x1c\x1d\x1e]/)) {
    if (token.length < 2) continue;
    const id = token.slice(0, 2);
    const value = token.slice(2);
    if (id === "DB") {
      if (/^\d{10}$/.test(value) && !isSyntheticNpi(value)) {
        hits.push({
          path,
          segment: "DB",
          value,
          reason: "prescriber NPI passes the Luhn check, could be real",
        });
      }
      continue;
    }
    const category = TELECOM_PHI_FIELDS[id];
    if (category === undefined) continue;
    if (category === "name") {
      const t = value.trim();
      if (t.length > 0 && !allow.names.has(t.toUpperCase())) {
        hits.push({ path, segment: id, value: t, reason: "name not declared synthetic" });
      }
    } else if (category === "phone") {
      if (/\d{7,}/.test(value.replace(/\D/g, "")) && !isSyntheticPhone(value)) {
        hits.push({ path, segment: id, value, reason: "phone not in 555-01xx block" });
      }
    } else {
      const t = value.trim();
      if (t.length > 0 && !isSyntheticNcpdpId(t)) {
        hits.push({
          path,
          segment: id,
          value: t,
          reason: "id not recognized as synthetic-AA-scoped",
        });
      }
    }
  }
}

/** Whether a byte string is an X12 interchange: starts with `ISA` and is at least a full ISA wide. */
function isX12(text: string): boolean {
  const t = text.replace(/^\uFEFF/, "");
  return t.startsWith("ISA") && t.length >= 106;
}

/** Split raw X12 into segments → elements using the ISA-declared delimiters (byte 3 / byte 105). */
function splitX12Segments(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, "");
  const elementSep = t.charAt(3);
  const segmentTerm = t.charAt(105);
  return t
    .split(segmentTerm)
    .map((s) => s.replace(/[\r\n]+/g, "").trim())
    .filter((s) => s.length > 0)
    .map((s) => s.split(elementSep));
}

/** Word tokens (len >= 2, alphabetic) inside an X12 name element. */
function x12NameTokens(value: string): string[] {
  return value
    .split(/[\s,.'-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && /[A-Za-z]/.test(t));
}

/**
 * Whether a 10-digit NPI is **provably synthetic**: its check digit fails the CMS NPI Luhn check
 * (`80840` prefix), so it can never be a NPPES-issued NPI. A Luhn-valid NPI (which *could* be a real
 * registered provider) is a hit. Mirrors `src/safe/reserved.ts#isSyntheticNpi`, kept inline because
 * the scanner is a standalone, zero-import Node script.
 */
function isSyntheticNpi(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  const s = `80840${digits}`;
  let sum = 0;
  let double = false; // rightmost digit is never doubled.
  for (let i = s.length - 1; i >= 0; i -= 1) {
    let d = s.charCodeAt(i) - 48;
    if (d < 0 || d > 9) continue;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 !== 0; // non-zero ⇒ invalid check digit ⇒ never a real NPI.
}

/**
 * Whether an X12 member/cardholder id is a recognized synthetic shape: minted under the synthetic
 * assigning authority (the `MBR`-prefixed or all-digit forms `synth` emits; roadmap §4.1, there is no
 * reserved member-id range so the *namespace* is the guarantee).
 */
function isSyntheticMemberId(id: string): boolean {
  const v = id.toUpperCase();
  if (/^MBR[-_]?[0-9A-Z]*$/.test(v)) return true;
  if (/^[0-9]+$/.test(v)) return true;
  return false;
}

/**
 * X12 structured PHI detection. Over an X12 interchange, checks the identity-bearing loci against the
 * synthetic sources:
 *
 * - **NM1**, a person entity (`NM1-02 = 1`): every name token (NM1-03/04/05) must be declared
 *   synthetic; a member id (`NM1-08 = MI`) must be a synthetic shape; an SSN qualifier (`NM1-08 = 34`)
 *   must never appear. Any entity: a 10-digit NPI (`NM1-08 = XX`) must fail the NPI Luhn check.
 * - **PER**, contact name (PER-02) tokens must be declared synthetic; comm numbers (PER-04/06/08) must
 *   carry the reserved `555` fake-exchange convention.
 * - **REF**, a provider SSN (`REF-01 = SY`, 9 digits) must be in the SSA never-issued range.
 *
 * A non-X12 target falls straight through. Dates of birth (DMG) are intentionally NOT value-gated:
 * a synthetic DOB is seeded and structurally indistinguishable from a real one, and (like the HL7 /
 * FHIR / C-CDA arms) there is no reserved DOB range to check against; the synthetic guarantee for a DOB
 * is that it is drawn from the seeded generator, not a value pattern (roadmap §4.3).
 */
function scanX12(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  if (!isX12(text)) return;
  for (const elems of splitX12Segments(text)) {
    const id = elems[0] ?? "";
    if (id === "NM1") {
      const entityType = elems[2] ?? "";
      const qualifier = elems[8] ?? "";
      const idValue = elems[9] ?? "";
      if (qualifier === "34" && idValue.length > 0) {
        hits.push({
          path,
          segment: "NM1",
          value: idValue,
          reason: "SSN (NM1 qualifier 34) in fixture",
        });
      }
      if (entityType === "1") {
        for (const el of [elems[3], elems[4], elems[5]]) {
          if (el === undefined || el.length === 0) continue;
          for (const tok of x12NameTokens(el)) {
            if (!allow.names.has(tok.toUpperCase())) {
              hits.push({
                path,
                segment: "NM1",
                value: tok,
                reason: "name not declared synthetic",
              });
            }
          }
        }
        if (qualifier === "MI" && idValue.length > 0 && !isSyntheticMemberId(idValue)) {
          hits.push({
            path,
            segment: "NM1",
            value: idValue,
            reason: "member-id shape not recognized as synthetic",
          });
        }
      }
      if (qualifier === "XX" && /^[0-9]{10}$/.test(idValue) && !isSyntheticNpi(idValue)) {
        hits.push({
          path,
          segment: "NM1",
          value: idValue,
          reason: "NPI passes the Luhn check, could be a real NPI",
        });
      }
    } else if (id === "PER") {
      const perName = elems[2];
      if (perName !== undefined) {
        for (const tok of x12NameTokens(perName)) {
          if (!allow.names.has(tok.toUpperCase())) {
            hits.push({
              path,
              segment: "PER",
              value: tok,
              reason: "contact-name not declared synthetic",
            });
          }
        }
      }
      for (const idx of [4, 6, 8]) {
        const comm = elems[idx];
        if (comm === undefined) continue;
        const digits = comm.replace(/[^0-9]/g, "");
        if (digits.length >= 10 && !digits.includes("555")) {
          hits.push({
            path,
            segment: "PER",
            value: comm,
            reason: "phone without the 555 fake-exchange convention",
          });
        }
      }
    } else if (id === "REF") {
      const qualifier = elems[1] ?? "";
      const value = elems[2] ?? "";
      if (
        qualifier === "SY" &&
        /^\d{9}$/.test(value.replace(/\D/g, "")) &&
        !isSyntheticSsn(value)
      ) {
        hits.push({
          path,
          segment: "REF*SY",
          value,
          reason: "provider SSN not in synthetic range",
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Format markers: what admits a target to a STRUCTURED arm
//
// Four arms (HL7 v2, X12, ASTM, NCPDP Telecom) always keyed off the bytes: an
// `MSH`, an `ISA`, an `H|\^&`, an FS/GS/RS control char. Three keyed off the FILE
// EXTENSION instead, so byte-identical content was refused as `probe.xml` and
// passed as `probe.ts`, measured, and pinned as a known gap rather than fixed,
// because content-sniffing XML/JSON out of arbitrary TypeScript is its own job
// with its own false-positive surface.
//
// This is that job. Each of the three now admits a target by EITHER its extension
// (unchanged, so nothing previously admitted is refused admission now) OR a format
// marker in the bytes. The markers below are the formats' own required
// discriminators: a CDA root/namespace, a SCRIPT `<Message>` envelope, FHIR's
// `resourceType`, not a guess at "looks XML-ish". That is what keeps the CONTENT
// route from crying wolf over ordinary source.
//
// DO NOT READ THAT AS "NOTHING IS EXAMINED WITHOUT A MARKER": an earlier draft said
// so here and it is false on two routes that predate this change and are unaltered by
// it. An `.xml` path is admitted to the C-CDA arm on its EXTENSION, with no marker at
// all, so a bare name fragment in a `.xml` file is read exactly as it always was. And
// FHIR's STRUCTURAL route runs whenever `JSON.parse` succeeds, with no `resourceType`
// check, so a marker-less JSON object with a `family` key is read exactly as it always
// was. The marker is what the NEW content routes require; it is not a precondition on
// the gate as a whole.
// ---------------------------------------------------------------------------

/** Whether `path` carries `ext`, case-insensitively (`.XML` is an XML file too). */
function hasExtension(path: string, ext: string): boolean {
  return path.toLowerCase().endsWith(ext);
}

/**
 * Whether the bytes declare themselves a CDA document: the `ClinicalDocument` root, the HL7 v3
 * namespace, or a `recordTarget` (the element the patient identity actually hangs off). Namespace
 * prefixes are tolerated HERE, deliberately: the marker only decides whether to LOOK, so being
 * liberal costs nothing. The name loci below are NOT prefix-tolerant, which is a separate
 * pre-existing limit and is listed in the header rather than quietly widened here.
 */
function hasCdaMarker(text: string): boolean {
  return (
    /<(?:[A-Za-z_][\w.-]*:)?ClinicalDocument\b/.test(text) ||
    /<(?:[A-Za-z_][\w.-]*:)?recordTarget\b/.test(text) ||
    text.includes("urn:hl7-org:v3")
  );
}

/**
 * C-CDA structured PHI detection. Over a C-CDA document, checks the name and telecom identity loci
 * DOCUMENT-WIDE: every `<given>` / `<family>` name token must be a declared-synthetic name, and every
 * `<telecom value="tel:…">` phone must carry the reserved `555-01xx` tail. Dashed SSNs and non-test
 * emails are already covered by {@link scanCommonShapes}.
 *
 * ADMITTED BY EITHER ROUTE: a `.xml` path, OR {@link hasCdaMarker} over the bytes. The second route
 * is what reaches a document written as an inline literal in a `.ts` test; the first is kept so the
 * widening is provably ADDITIVE (an `.xml` fixture carrying loci but no `<ClinicalDocument>` root, a
 * fragment, is examined exactly as it always was). A target admitted by neither falls through.
 */
function scanCcda(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  if (!hasExtension(path, ".xml") && !hasCdaMarker(text)) return;

  // Name tokens: the text content of each `given` and `family` element. Each must be declared
  // synthetic. (Written as prose rather than as a sample element on purpose: this file is inside the
  // corpus it sweeps, and a comment that forges a name element is a hit against the scanner itself.)
  //
  // THE LABEL NAMES THE ELEMENT, NOT `recordTarget`, and that is a correction. This regex has always
  // been DOCUMENT-WIDE: it never scoped to `<recordTarget>`, while every hit it raised was reported
  // as `recordTarget/given`. A name in `<author>`, `<informant>` or a participant therefore came back
  // labelled with a location it was not in. Nothing had noticed because the only targets the arm could
  // reach were `.xml` fixtures that are recordTarget-heavy; the first `.ts` document it reached under
  // the widened gate produced exactly that mislabel, on an `<author>` name.
  //
  // The document-wide sweep is KEPT: a clinician's or informant's name in a committed fixture is as
  // real as a patient's, and narrowing a PHI gate as a side effect of relabelling it would be the same
  // quiet trade this change exists to undo. Only the claim about WHERE the hit sits is withdrawn.
  for (const m of text.matchAll(/<(given|family)(?:\s[^>]*)?>([^<]+)<\/\1>/g)) {
    const token = (m[2] ?? "").trim();
    if (token.length === 0) continue;
    if (!allow.names.has(token.toUpperCase())) {
      hits.push({
        path,
        segment: `name/${m[1] ?? "name"}`,
        value: token,
        reason: "name not declared synthetic",
      });
    }
  }

  // Telecom phone: <telecom value="tel:+1..."/>. A phone-shaped value must be reserved 555-01xx.
  // Document-wide for the same reason, and labelled for the same reason.
  for (const m of text.matchAll(/<telecom\b[^>]*\bvalue="tel:([^"]+)"/g)) {
    const value = m[1] ?? "";
    if (/\d{7,}/.test(value.replace(/\D/g, "")) && !isSyntheticPhone(value)) {
      hits.push({
        path,
        segment: "telecom",
        value,
        reason: "phone not in 555-01xx block",
      });
    }
  }
}

/**
 * FHIR structured PHI detection. Parses a JSON fixture and recursively visits every object, checking the
 * two identity-bearing shapes wherever they sit (a standalone resource or a Bundle entry): a `HumanName`
 * (`family` / `given` tokens must be declared-synthetic names) and a phone `ContactPoint`
 * (`{ system: "phone", value }` must carry the reserved `555-01xx` tail). Emails and SSNs are already
 * covered by {@link scanCommonShapes}.
 *
 * TWO ROUTES, and the split is on the BYTES rather than the path. If the whole target parses as JSON
 * it is walked structurally: that is the pass that always existed, minus its `.json` extension gate,
 * because `JSON.parse` succeeding IS the discriminator and a stricter one than the file's name. If it
 * does not parse, {@link scanFhirEmbedded} takes it: a resource inline in a TypeScript test is not
 * JSON (unquoted keys, trailing commas, interpolation) and no amount of extension-checking would have
 * reached it.
 */
function scanFhir(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    // NOT whole-file JSON. This used to be the end of the arm, and combined with the `.json`
    // extension gate it meant a FHIR resource written as an inline literal in a `.ts` test was never
    // read. Hand it to the textual pass, which is marker-gated.
    scanFhirEmbedded(path, text, allow, hits);
    return;
  }

  const checkName = (obj: Record<string, unknown>): void => {
    const tokens: string[] = [];
    if (typeof obj["family"] === "string") tokens.push(obj["family"]);
    if (Array.isArray(obj["given"])) {
      for (const g of obj["given"]) if (typeof g === "string") tokens.push(g);
    }
    for (const t of tokens) {
      const token = t.trim();
      if (token.length > 0 && !allow.names.has(token.toUpperCase())) {
        hits.push({
          path,
          segment: "Patient.name",
          value: token,
          reason: "name not declared synthetic",
        });
      }
    }
  };

  const checkTelecom = (obj: Record<string, unknown>): void => {
    if (obj["system"] === "phone" && typeof obj["value"] === "string") {
      const digits = obj["value"].replace(/\D/g, "");
      if (/\d{7,}/.test(digits) && !isSyntheticPhone(obj["value"])) {
        hits.push({
          path,
          segment: "Patient.telecom",
          value: obj["value"],
          reason: "phone not in 555-01xx block",
        });
      }
    }
  };

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    // A HumanName has `family` and/or `given`; a phone ContactPoint has `system: "phone"` + `value`.
    if ("family" in obj || "given" in obj) checkName(obj);
    if ("system" in obj && "value" in obj) checkTelecom(obj);
    for (const value of Object.values(obj)) visit(value);
  };

  visit(root);
}

/**
 * FHIR's own required discriminator: every resource carries `resourceType: "<Name>"`. Used as the
 * admission marker for the textual pass, so that pass NEVER runs over a file which does not claim to
 * carry a resource. Both spellings are accepted because both occur: `"resourceType"` in a JSON blob
 * pasted into a template literal, `resourceType` in a TypeScript object literal.
 */
const FHIR_RESOURCE_MARKER = /(?:^|[{,\s])"?resourceType"?\s*:\s*["'][A-Za-z]/;

/** The two FHIR identity loci, spelled for JSON (`"family":`) or TypeScript (`family:`) keys. */
const FHIR_NAME_LOCUS = /(?:^|[{,\s])"?(family|given)"?\s*:\s*(\[[^\]]*\]|"[^"]*"|'[^']*')/g;
const FHIR_PHONE_SYSTEM_FIRST =
  /"?system"?\s*:\s*["']phone["']\s*,\s*"?value"?\s*:\s*["']([^"']*)["']/g;
const FHIR_PHONE_VALUE_FIRST =
  /"?value"?\s*:\s*["']([^"']*)["']\s*,\s*"?system"?\s*:\s*["']phone["']/g;

/**
 * FHIR detection for a resource written INLINE in a file that is not itself JSON: the shape a
 * TypeScript test uses, and the shape the `.json` extension gate could never reach. Aims at the same
 * two identity loci as the structural pass: `HumanName` (`family` / `given`) and a phone
 * `ContactPoint`, but does NOT reach them equally, and the two routes are mutually exclusive, so
 * whichever one a target takes is the only one it gets. This route reads a regex over text, not an
 * object graph: it misses a `system`/`value` pair with a key between them, and a value written as a
 * backtick template literal rather than a quoted string. Each is pinned by a test.
 *
 * ADMISSION IS THE WHOLE SAFETY ARGUMENT. The pass runs only when {@link FHIR_RESOURCE_MARKER}
 * matches, so a file must state `resourceType: "…"` before any of its `family:` keys are read. A
 * scanner that read every `family:` in every source file would flag ordinary code and get itself
 * turned off, which is strictly worse than the gap it closes.
 *
 * THE RESIDUAL FALSE-POSITIVE SHAPE, STATED RATHER THAN HIDDEN: admission is FILE-scoped, not
 * object-scoped. A file that declares a `resourceType` anywhere and, elsewhere, writes an undeclared
 * `family: "…"` that is not part of any resource is a hit. Scoping to the enclosing object needs a
 * real JavaScript parser: a dependency this scanner deliberately does not have (it must not share a
 * bug with the code it guards). The trade is accepted because in THIS repo every person-name is
 * supposed to be drawn from the shipped fake-name pool, so the remedy for a false positive is the
 * allow-list: the same positive declaration the rest of the gate already asks for.
 */
function scanFhirEmbedded(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  if (!FHIR_RESOURCE_MARKER.test(text)) return;

  for (const m of text.matchAll(FHIR_NAME_LOCUS)) {
    // `given` is an array in FHIR and `family` a scalar, but read both the same way: pull every
    // quoted token out of whatever the key was assigned. A scalar is a one-token list.
    for (const q of (m[2] ?? "").matchAll(/"([^"]*)"|'([^']*)'/g)) {
      const token = (q[1] ?? q[2] ?? "").trim();
      if (token.length === 0) continue;
      if (!allow.names.has(token.toUpperCase())) {
        hits.push({
          path,
          segment: "Patient.name",
          value: token,
          reason: "name not declared synthetic",
        });
      }
    }
  }

  // A phone ContactPoint, in either ADJACENT key order: `system` then `value`, or `value` then
  // `system`. Object key order is not significant in JSON, so a hand-written literal picks whichever
  // reads better, and both are read.
  //
  // ADJACENCY IS A REAL LIMIT, NOT A ROUNDING ERROR: `{ system: "phone", use: "home", value: … }` is
  // valid, common FHIR and is MISSED here, because a key between the two breaks both regexes. The
  // structural route catches it; this textual one does not. Closing it properly means parsing the
  // object, which is the JavaScript parser this scanner deliberately does not have, so it is stated
  // here and pinned by a test rather than described as parity with the structural pass.
  for (const re of [FHIR_PHONE_SYSTEM_FIRST, FHIR_PHONE_VALUE_FIRST]) {
    for (const m of text.matchAll(re)) {
      const value = m[1] ?? "";
      if (/\d{7,}/.test(value.replace(/\D/g, "")) && !isSyntheticPhone(value)) {
        hits.push({
          path,
          segment: "Patient.telecom",
          value,
          reason: "phone not in 555-01xx block",
        });
      }
    }
  }
}

/** Whether a phone-shaped value carries the NANP reserved `555-01xx` fictional tail. */
function isSyntheticPhone(value: string): boolean {
  const tail = value.replace(/\D/g, "").slice(-7);
  return /^55501\d\d$/.test(tail);
}

/**
 * HL7 v2 structured PID detection. Locates each `PID` segment, derives the field/component delimiters
 * from the message's own `MSH`, and checks the PHI-bearing loci: PID-5 (name), PID-13 (phone), PID-19
 * (SSN), against the synthetic sources. A name token not on the allow-list, a real-area SSN, or a
 * non-reserved phone is a hard hit. Non-HL7 targets fall straight through (no `MSH`).
 */
function scanHl7(path: string, text: string, allow: AllowList, hits: Hit[]): void {
  const segments = text.split(/\r\n|\r|\n/);
  const msh = segments.find((s) => s.startsWith("MSH"));
  if (msh === undefined || msh.length < 5) return;
  const fieldSep = msh.charAt(3); // MSH-1
  const compSep = msh.charAt(4); // MSH-2, first char (component separator)

  for (const seg of segments) {
    if (!seg.startsWith(`PID${fieldSep}`)) continue;
    const fields = seg.split(fieldSep);
    const at = (n: number): string => fields[n] ?? ""; // fields[n] is HL7 field n (0 = "PID").

    // PID-5: patient name (XPN). Each component token must be a declared-synthetic name.
    for (const token of at(5).split(compSep)) {
      const t = token.trim();
      if (t.length === 0) continue;
      if (!allow.names.has(t.toUpperCase())) {
        hits.push({ path, segment: "PID-5", value: t, reason: "name not declared synthetic" });
      }
    }

    // PID-19: SSN. Any SSN-shaped value must be from a never-issued/reserved area.
    const ssnValue = at(19).trim();
    if (/^\d{9}$/.test(ssnValue.replace(/\D/g, "")) && !isSyntheticSsn(ssnValue)) {
      hits.push({ path, segment: "PID-19", value: ssnValue, reason: "SSN not in synthetic range" });
    }

    // PID-13: phone (XTN). A phone-shaped value must carry the reserved 555-01xx tail.
    const phoneValue = at(13).trim();
    if (/\d{7,}/.test(phoneValue.replace(/\D/g, "")) && !isSyntheticPhone(phoneValue)) {
      hits.push({
        path,
        segment: "PID-13",
        value: phoneValue,
        reason: "phone not in 555-01xx block",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function report(hits: Hit[], scanned: number): void {
  // The denominator rides on both SUMMARY lines (the `OK` and the hit total): an
  // `OK` is only meaningful next to the number of files it is an `OK` over. The
  // per-hit detail lines below do not repeat it.
  const denom = `${String(scanned)} file(s) scanned`;
  if (hits.length === 0) {
    process.stdout.write(`[phi-scan] OK, no hits (${denom})\n`);
    return;
  }
  const byPath = new Map<string, Hit[]>();
  for (const h of hits) {
    const arr = byPath.get(h.path);
    if (arr) arr.push(h);
    else byPath.set(h.path, [h]);
  }
  for (const [path, group] of byPath) {
    process.stderr.write(`[phi-scan] HIT: ${path}\n`);
    for (const h of group) {
      process.stderr.write(
        `  segment=${h.segment} value=${JSON.stringify(h.value)} (${h.reason})\n`,
      );
    }
  }
  process.stderr.write(
    `[phi-scan] ${String(hits.length)} hit(s) across ${String(byPath.size)} file(s) (${denom}). ` +
      `If a value is genuinely synthetic, declare it in scripts/phi-allow-list.txt OR ` +
      `run with --allow-fixture <path> AND log it in phi-scan-overrides.md.\n`,
  );
}

// ---------------------------------------------------------------------------
// The observation invariant
// ---------------------------------------------------------------------------

/**
 * Refuse any invocation that would scan nothing, or whose overrides subtract
 * nothing. This is the rule that keeps `OK, no hits` honest: without it, an
 * emptied target set is indistinguishable from a clean corpus, and the gate
 * reports success for a scan it never performed.
 *
 * @param mode - the resolved scan mode.
 * @param enumerated - targets BEFORE `--allow-fixture` subtraction.
 * @param allowed - normalized `--allow-fixture` paths.
 * @returns the surviving targets.
 * @throws InvocationError when the scan would observe nothing, or an override is inert.
 */
function enforceObservation(
  mode: Args["mode"],
  enumerated: Target[],
  allowed: ReadonlySet<string>,
): Target[] {
  const enumeratedPaths = new Set(enumerated.map((t) => t.path));

  // An override that subtracts nothing is inert: it reads as a live bypass in the
  // log while doing nothing, which is how a stale override log drifts unnoticed.
  const inert = [...allowed].filter((p) => !enumeratedPaths.has(p));
  if (inert.length > 0) {
    throw new InvocationError(
      `--allow-fixture matched no scanned file:\n${inert.map((p) => `  - ${p}`).join("\n")}\n` +
        `An override only ever SUBTRACTS a file the scan already covers. Check the path, ` +
        `and remove the entry from phi-scan-overrides.md if the file is gone.`,
    );
  }

  // "Nothing staged" is the one legitimate empty scan (a commit that touches no
  // in-scope file). Every other empty enumeration means the roots went missing.
  if (enumerated.length === 0) {
    if (mode === "staged") return [];
    throw new InvocationError(
      `no files to scan under ${SCAN_ROOTS.join(", ")}. A scan of nothing is not a pass; ` +
        `check the roots in scripts/phi-scan.ts.`,
    );
  }

  const survivors = enumerated.filter((t) => !allowed.has(t.path));
  if (survivors.length === 0) {
    throw new InvocationError(
      `every one of the ${String(enumerated.length)} file(s) in scope was excluded by ` +
        `--allow-fixture: the scan would observe nothing and report OK. Narrow the ` +
        `overrides, or declare the values in scripts/phi-allow-list.txt instead.`,
    );
  }
  return survivors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
    validateAllowFixtures(args.allowFixtures);
  } catch (err) {
    if (err instanceof InvocationError) {
      process.stderr.write(`[phi-scan] ${err.message}\n`);
      return 2;
    }
    throw err;
  }

  const allowed = new Set<string>(args.allowFixtures.map(normalizePath));

  let allow: AllowList;
  let targets: Target[];
  try {
    // Inside the try: a missing allow-list is an invocation error (2), and used to
    // escape as an uncaught throw that exited 1, which reads as "hits found".
    allow = loadAllowList();
    if (args.mode === "staged") targets = buildTargetsForStaged();
    else if (args.mode === "paths") targets = buildTargetsForPaths(args.paths);
    else targets = buildTargetsForAll();
    targets = enforceObservation(args.mode, targets, allowed);
  } catch (err) {
    if (err instanceof InvocationError) {
      process.stderr.write(`[phi-scan] ${err.message}\n`);
      return 2;
    }
    throw err;
  }

  const hits: Hit[] = [];
  const vanished: Target[] = [];
  const observedRoots = new Set<string>();
  let observed = 0;
  for (const t of targets) {
    try {
      if (scanTarget(t, allow, hits)) {
        observed += 1;
        // Attributed through the SAME predicate that decided scope, never a second
        // copy of the prefix rule. A `paths`-mode target can sit outside every root
        // and contribute nothing here; that mode makes no per-root promise.
        const root = rootOf(t.path);
        if (root !== undefined) observedRoots.add(root);
      } else vanished.push(t);
    } catch (err) {
      if (err instanceof InvocationError) {
        process.stderr.write(`[phi-scan] ${err.message}\n`);
        return 2;
      }
      throw err;
    }
  }

  // A tolerated file is never silent, and the tolerance is only good while the file
  // is still gone: if it is back on disk the sweep skipped something that exists,
  // which is an incomplete scan and refuses like any other.
  if (vanished.length > 0) {
    const back = vanished.filter((t) => t.absPath !== undefined && existsSync(t.absPath));
    if (back.length > 0) {
      process.stderr.write(
        `[phi-scan] could not read ${back.map((t) => t.path).join(", ")}: vanished mid-scan and is ` +
          `present again, so the sweep did not observe it. Re-run with the tree at rest.\n`,
      );
      return 2;
    }
    process.stderr.write(
      // "gone" rather than "deleted": a rename leaves the enumerated path just as
      // absent, and the residual on `Target.tolerateVanish` is about exactly that
      // case, so the line must not assert the file was removed.
      `[phi-scan] skipped ${String(vanished.length)} untracked file(s) gone between ` +
        `enumeration and read: ${vanished.map((t) => t.path).join(", ")}\n`,
    );
  }

  // Refuse a sweep that observed nothing UNDER ANY ONE OF ITS ROOTS.
  // `enforceObservation` already refused an empty TARGET SET; this is the same rule one
  // step later, over what was actually READ, so the tolerance above can never decay into
  // a clean report of a tree nothing was read from.
  //
  // PER-ROOT, NOT GLOBAL, AND THAT IS THE WHOLE POINT OF THIS BLOCK. The global form was
  // satisfied by ANY ONE surviving file, so a single `src/` module vouched for the entire
  // corpus. Measured on this repo at `a4b249a`, twice: with `test/` moved away, and with
  // `test` replaced by a DANGLING SYMLINK, the sweep printed `OK - no hits (76 file(s)
  // scanned)` and exited 0 while all 98 files of the test corpus went unobserved. Neither
  // state is even an enumeration error: `walk()` returns early on a root `existsSync`
  // cannot resolve, and the non-regular rule never sees a root at all, because `walk` is
  // entered AT a root and only ever classifies entries INSIDE one. For a package whose
  // entire reason to exist is emitting PHI-shaped bytes, that is the emptiest possible
  // green, and it is the shape a reviewer reads as a pass.
  //
  // THE SUPERSEDED JUSTIFICATION ONLY EVER COVERED ONE ROOT, which is how the global
  // shape survived review here: "all-mode always reaches at least the allow-list itself"
  // is true, and the allow-list lives under `scripts/`. It was an argument that
  // `scripts/` cannot be starved, doing duty as an argument about all three roots.
  //
  // THE ALL-STARVED CASE IS THE GLOBAL RULE, so this REPLACES it rather than sitting
  // beside it: observing zero files names every root here, and the same wording carries.
  //
  // AND THE GRANULARITY IS THE DECLARED ROOT, NOTHING FINER. An absent directory INSIDE
  // a root still goes unobserved under a plausible denominator, a root that is a regular
  // file still exits 1 out of `walk()`, a root symlinked at another root is satisfied by
  // that root's bytes, and one file is enough to satisfy a root of 98. All four are
  // measured in the limits list in the header. Do not read this rule as more than a
  // per-ROOT floor of one, and do not answer any of them by growing this block.
  //
  // (`staged` legitimately has nothing to scan when a commit touches no in-scope file,
  // and `paths` is bounded by the caller's argv. Neither enumerates a root, so neither
  // can make a per-root promise, and neither is subject to this rule.)
  if (args.mode === "all") {
    const starved = SCAN_ROOTS.filter((root) => !observedRoots.has(root));
    if (starved.length > 0) {
      // A REFUSAL MUST NOT SWALLOW A REAL HIT. Whatever the yielding roots turned up is
      // printed first; the exit code is still 2, because an incomplete sweep is not a
      // verdict whatever it found on the way.
      if (hits.length > 0) report(hits, observed);
      process.stderr.write(
        `[phi-scan] refusing: the all-mode sweep observed no files under ` +
          `${String(starved.length)} of its ${String(SCAN_ROOTS.length)} scan roots ` +
          `(${starved.join(", ")}), so it proves nothing about them. The observation rule ` +
          `is PER-ROOT: an OK earned under the other roots says nothing about a root that ` +
          `yielded nothing, and an absent or dangling root yields nothing silently. ` +
          `Restore it, or change SCAN_ROOTS in scripts/phi-scan.ts.\n`,
      );
      return 2;
    }
  }

  // The denominator counts files READ, not files listed: a tolerated skip must
  // shrink the number the `OK` is an `OK` over, never pad it.
  report(hits, observed);
  return hits.length === 0 ? 0 : 1;
}

process.exit(main());
