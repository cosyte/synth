#!/usr/bin/env node
/**
 * scripts/attw.mjs — the `attw` publish gate, made to report its own failure.
 *
 * ▶ WHY THIS WRAPPER EXISTS: `attw` PRINTS "This package does not contain types."
 *   AND EXITS 0. That is not a bug in `attw` — an untyped package is a legitimate
 *   npm package, so the CLI treats "no types at all" as a *description*, not a
 *   problem. From this repo's pinned `@arethetypeswrong/cli@0.18.4`,
 *   `node_modules/@arethetypeswrong/cli/dist/getExitCode.js`, first statement:
 *
 *       export function getExitCode(analysis, opts) {
 *           if (!analysis.types) {
 *               return 0;
 *           }
 *
 *   The problem list is consulted only *after* that early return, so no
 *   `--profile`, `--ignore-rules` or config setting can reach it. For a package
 *   that ships types, "does not contain types" does not mean "fine, untyped" —
 *   it means THE TYPES WERE NOT IN THE TARBALL, which is a broken publish. The
 *   gate would say nothing, and its caller would read the 0. A false red costs an
 *   hour; A FALSE GREEN MERGES.
 *
 * ▶ MEASURED HERE, ON THIS PACKAGE, WITH THIS REPO'S OWN ARGUMENTS. The previous
 *   script was `attw --pack . --profile node16`. Both of these, run on a quiet box
 *   with NO concurrency of any kind, printed the untyped sentence and exited 0:
 *
 *       rm -rf dist && pnpm attw                     -> "does not contain types", exit 0
 *       find dist -name '*.d.*ts' -delete && pnpm attw
 *                                                    -> "does not contain types", exit 0
 *
 *   `--profile node16` does not change that and is not the cause; it is forwarded
 *   below and kept, because it is the resolution profile this package is graded on.
 *
 * ▶ THE FALSE GREEN NEEDS *EVERY* ENTRY POINT UNTYPED AT ONCE, AND THE PLAUSIBLE
 *   WRONG STORY IS THAT ATTW MISSES SUBPATHS. IT DOES NOT. This package publishes
 *   eight subpaths, and a fixture with an intact root entry and ONE subpath's
 *   declarations missing was measured to make bare `attw` report
 *   `UntypedResolution` and exit 1 — because `analysis.types` is then truthy and
 *   `getExitCode()` runs past the early return above. So a PARTIAL loss is attw's
 *   own catch. What silences it is the whole declaration set going at once, which
 *   is precisely what `rm -rf dist`, `pnpm clean`, and the build window below all
 *   produce. Net 1 below still earns its keep on the partial case, but for a
 *   different reason: it NAMES the artifact to rebuild, where attw's message says
 *   only that some resolution was untyped. Pinned in `test/scripts/attw-gate.test.ts`.
 *
 * ▶ THE RACE ONLY SUPPLIES THE CONDITION; IT IS NOT THE DEFECT. The second case
 *   above is the realistic one. `tsup` emits JS in one pass and the declaration
 *   files in a later pass, so there is a window in every build of this package
 *   where `dist/` holds `.mjs`/`.cjs` and no `.d.ts`. Measured on three
 *   consecutive clean builds here — first JS written to first declaration written
 *   — at 6.4 s, 8.6 s and 7.4 s, against a whole build of roughly 11 s. That is a
 *   wide window, and this package's build is on the slow end because it emits
 *   declarations for eight entry points. A concurrent build or `pnpm clean` in the
 *   same working tree lands `attw` inside it. Which is why this is NOT answered
 *   with a lock or a build queue: the gate is supposed to be able to tell you its
 *   own inputs were missing, whatever removed them.
 *
 * ▶ TWO NETS, and they catch different things — keep both:
 *
 *   1. PREFLIGHT (structural, no string matching). Every relative artifact path
 *      `package.json` promises — `main`, `module`, `types`, `typings`, and every
 *      string leaf of `exports` — must exist and be non-empty before `attw` runs.
 *      This is the one that catches the window measured above, and it names the
 *      missing file instead of leaving the reader to infer it. Do not write the
 *      number of paths down: this package publishes eight subpaths under
 *      `exports` and the set is derived from the manifest on every run.
 *
 *   2. POST-CHECK. If `attw` still reports an untyped package, fail. The preflight
 *      cannot see this case: the declaration files can be present on disk and
 *      still be absent from the tarball, because `files` (or `.npmignore`) left
 *      them out. No instance of that is on record in this repo — it is the case
 *      `attw --pack` exists to catch, and the whole point here is that it catches
 *      it silently.
 *
 *   The post-check matches `attw`'s untyped sentence, which is a plain, un-chalked
 *   string in `dist/render/untyped.js`. That makes it blindable, so the arguments
 *   and config that would blind it are REFUSED rather than tolerated — see
 *   BLINDING below. `test/scripts/attw-gate.test.ts` pins both nets against the
 *   real binary, so if an `attw` upgrade reworks the wording or fixes the exit
 *   code, the suite reds and tells you to revisit this file rather than letting the
 *   net go quietly slack.
 *
 * ▶ BLINDING, AND WHY THE ARGUMENT GUARD IS AN ALLOW-LIST RATHER THAN A DENY-LIST.
 *   Each of these was measured HERE, against this repo's pinned binary and with
 *   `--profile node16` present, on a package whose tarball carries no types: each
 *   one restores the exact false green by making the untyped sentence absent from
 *   what this script can read, while `attw` still exits 0.
 *
 *       --quiet / -q            sentence absent, exit 0
 *       --format json / -f json sentence absent, exit 0   (also `--format=json`)
 *       .attw.json {"quiet":true} or {"format":"json"}
 *                               sentence absent, exit 0   (readConfig() applies it after argv)
 *
 *   THE DENY-LIST THIS WAS PORTED WITH DID NOT HOLD, AND A REFUTER MEASURED THE
 *   HOLE. It refused a set of spellings by `arg.split("=")[0]`, which is token
 *   equality, not option-name matching — and commander accepts a value fused to a
 *   short flag, so `-fjson` is neither `-f` nor `--format`, walked straight
 *   through, and handed back exit 0 with the sentence gone. `-q` in a cluster was
 *   caught only by the empty-transcript net below, which cannot backstop `-f` at
 *   all because JSON output is not empty. Enumerating spellings buys exactly one
 *   more per round, which is the failure mode `scripts/check-test-selection.ts`
 *   records at length for a different guard in this repo.
 *
 *   So the guard is total instead: an ALLOW-LIST of the arguments this gate needs.
 *   `--profile` is the resolution profile this package is graded on;
 *   `--no-definitely-typed` is what keeps the test suite's runs offline. Everything
 *   else is refused, including a `--format table-flipped` that would blind nothing
 *   — "harmless" is a judgement this script cannot make from an option name, and
 *   being over-strict about an argument nobody passes to a repo's own publish gate
 *   costs less than a route back to a false green. `--config-path` falls out of
 *   this for free rather than needing its own line. Widening the set is a
 *   deliberate one-line edit.
 *
 *   The `.attw.json` refusal stays, because it is not an argument: `readConfig()`
 *   applies it after argv, so no argument guard of any shape can reach it.
 *
 * ▶ WHAT THE PREFLIGHT DOES *NOT* DEPEND ON, because this package looks like it
 *   might. `@cosyte/synth` carries seven `file:vendor/*.tgz` devDependencies (every
 *   sibling parser plus `deid`). They have no bearing on either net: `files` is
 *   `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, so `npm pack` produces a
 *   tarball with no `vendor/` and no `node_modules/` in it, and `attw` does not
 *   resolve bare external specifiers at all — measured on a fixture whose only
 *   declaration imports a package that does not exist anywhere, which `attw`
 *   reports as "No problems found". So a STALE vendored tarball cannot make this
 *   gate red, and cannot make it green either. A MISSING one is a different thing
 *   and is not covered by that sentence: `pnpm install` and `pnpm build` fail
 *   first, and this gate then reds at the preflight, or at `could not run …/attw`.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ATTW_BIN = fileURLToPath(new URL("../node_modules/.bin/attw", import.meta.url));
const UNTYPED = "This package does not contain types.";
const DECLARATION = /\.d\.[cm]?ts$/;
const args = process.argv.slice(2);

const die = (msg) => {
  process.stderr.write(`\n✗ attw gate: ${msg}\n`);
  process.exit(1);
};

// ---- Only arguments this gate can vouch for are forwarded -------------------
// ALLOW-LIST, NOT A DENY-LIST, AND THAT IS THE WHOLE POINT — see BLINDING above.
const ALLOWED = new Set(["--profile", "--no-definitely-typed"]);
const forwarded = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const name = arg.split("=")[0];
  if (!ALLOWED.has(name)) {
    die(
      `${arg} is not an argument this gate accepts.\n` +
        `  It forwards an ALLOW-LIST — ${[...ALLOWED].join(", ")} — rather than refusing a\n` +
        `  list of spellings. This gate reads attw's printed output and attw exits 0 on an\n` +
        `  untyped package, so anything that changes what attw prints can hide the one\n` +
        `  sentence net 2 reads. Widening this set is a deliberate one-line edit; check\n` +
        `  first that the option cannot suppress or reformat attw's output.`,
    );
  }
  forwarded.push(arg);
  // `--profile` takes a value. A fused `--profile=node16` carries its own; a
  // separated one must claim the next argument, or that value would be read as an
  // option on the next turn of this loop and refused.
  if (name === "--profile" && !arg.includes("=")) {
    const value = args[++i];
    if (value === undefined) die(`--profile was given with no value.`);
    forwarded.push(value);
  }
}
try {
  const config = JSON.parse(readFileSync(".attw.json", "utf8"));
  const set = ["quiet", "format"].filter((k) => k in config);
  if (set.length > 0) {
    die(
      `.attw.json sets ${set.join(", ")}. These keys are refused wholesale, by name and\n` +
        `  not by value: readConfig() applies them after argv, this gate reads attw's\n` +
        `  printed output, and attw exits 0 on an untyped package.`,
    );
  }
} catch {
  // No .attw.json, or unreadable/invalid — attw itself reports the latter.
}

/** Every relative path `package.json` promises to ship, deduped. */
function declaredArtifacts(pkg) {
  const found = new Set();
  const add = (v) => {
    if (typeof v !== "string") return;
    // Skip wildcard subpath patterns (they name a set, not a file) and the
    // manifest itself, which is always in the tarball by definition.
    if (!v.startsWith(".") || v.includes("*") || v === "./package.json") return;
    found.add(v);
  };
  for (const key of ["main", "module", "types", "typings"]) add(pkg[key]);
  const walk = (node) => {
    if (typeof node === "string") add(node);
    else if (node && typeof node === "object") for (const v of Object.values(node)) walk(v);
  };
  walk(pkg.exports);
  return [...found];
}

let pkg;
try {
  pkg = JSON.parse(readFileSync("package.json", "utf8"));
} catch (err) {
  die(`cannot read ./package.json from ${process.cwd()} — ${err.message}`);
}

// ---- Net 1: preflight -------------------------------------------------------
const declared = declaredArtifacts(pkg);
const broken = [];
for (const rel of declared) {
  let size;
  try {
    size = statSync(rel).size;
  } catch {
    broken.push({ rel, why: "missing" });
    continue;
  }
  if (size === 0) broken.push({ rel, why: "empty" });
}
if (broken.length > 0) {
  // ▶ WHAT attw WOULD HAVE DONE IS SEVERAL DIFFERENT ANSWERS, AND SAYING SO IS THE
  //   POINT OF THE LINE. TWO VERSIONS OF THIS CONDITION HAVE NOW BEEN MEASURED
  //   FALSE, BOTH IN THE SAME DIRECTION — OVERCLAIMING EXIT 0. Do not re-derive it
  //   from the shape of the code.
  //
  //   (a) The first keyed it on `broken.some(isDeclaration)` — ANY declaration
  //       among the casualties — which is false whenever some declarations survive:
  //       attw then finds types, runs past the early return, reports
  //       UntypedResolution and exits 1.
  //   (b) The second keyed it on "every declared declaration is in `broken`". Also
  //       false, because `broken` counts EMPTY as broken and A ZERO-BYTE `.d.ts`
  //       STILL RESOLVES. It types the package even though it declares nothing, so
  //       `analysis.types` is truthy and the early return is not taken. Measured:
  //       root declarations zero-byte + a subpath's missing gave attw exit 1 with
  //       UntypedResolution; ALL declarations zero-byte gave "No problems found"
  //       and exit 0 — neither of which is the untyped sentence.
  //
  //   So an EMPTY declaration among the casualties means this script cannot say
  //   what attw would have done, and it says that instead of guessing. Below that
  //   guard, every remaining declaration casualty is MISSING, which is the only
  //   state `getExitCode()`'s early return actually keys on. A gate that reds
  //   correctly and then explains itself with a falsehood teaches the next reader
  //   the wider, wrong story — and this file gets copied to sixteen more manifests.
  const declaredDeclarations = declared.filter((rel) => DECLARATION.test(rel));
  const brokenDeclarations = broken.filter(({ rel }) => DECLARATION.test(rel));
  const emptyDeclaration = brokenDeclarations.some(({ why }) => why === "empty");
  const everyDeclarationGone =
    declaredDeclarations.length > 0 && brokenDeclarations.length === declaredDeclarations.length;
  const counterfactual = emptyDeclaration
    ? // A zero-byte declaration resolves, so it types the package. Which way attw
      // lands then depends on the other entry points; no exit code is claimed.
      `  What attw would have done here is deliberately not stated: a zero-byte\n` +
      `  declaration file still RESOLVES, so it types the package while declaring\n` +
      `  nothing, and the early return in getExitCode() is not taken.\n`
    : everyDeclarationGone
      ? // Every declared declaration is missing, so attw finds no types at all.
        `  attw would have reported "${UNTYPED}" and EXITED 0 on this tree.\n`
      : brokenDeclarations.length > 0
        ? // Some declarations survive, so attw DOES find types, runs past the early
          // return, and enumerates the untyped resolutions itself. It reds — it just
          // does not tell you which artifact to rebuild, which is what this does.
          `  attw would have reported an untyped resolution and EXITED 1 here: some\n` +
          `  declarations survive, so it finds types and never takes the early return.\n` +
          `  What this adds is the name of the artifact to rebuild, which attw omits.\n`
        : // Only JS missing. attw analyses types, not JavaScript, so it exits 0 here
          // whether or not this package declares any — which is why the casualties
          // above are worth printing even though attw would not have complained.
          `  attw does not gate these: it analyses types, not JavaScript, and exits 0\n` +
          `  here.\n`;
  die(
    `package.json promises files the build has not produced:\n` +
      broken.map(({ rel, why }) => `    ${rel} (${why})\n`).join("") +
      `\n  Run the build first. If you DID build, something removed or truncated the\n` +
      `  output underneath this run — a concurrent build or \`clean\` in the same\n` +
      `  working tree will do it, and \`tsup\` writes JS before declarations, so there\n` +
      `  is a multi-second window in every build here where the .d.ts files do not\n` +
      `  exist yet.\n` +
      counterfactual,
  );
}

// ---- Run attw ---------------------------------------------------------------
const res = spawnSync(ATTW_BIN, ["--pack", ".", ...forwarded], {
  encoding: "utf8",
  stdio: ["inherit", "pipe", "pipe"],
});
if (res.error) die(`could not run ${ATTW_BIN} — ${res.error.message}`);
const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;
process.stdout.write(res.stdout ?? "");
process.stderr.write(res.stderr ?? "");
if (res.status !== 0) process.exit(res.status ?? 1);

// ---- Net 2: post-check ------------------------------------------------------
// An empty transcript means the post-check read nothing, by some route not listed
// under BLINDING above. Treat that as a failure rather than as a pass: this gate
// is only as good as the output it got to see.
if (output.trim() === "") {
  die(`attw exited 0 but printed nothing, so nothing was checked.`);
}
if (output.includes(UNTYPED)) {
  die(
    `attw reported "${UNTYPED}" and exited 0.\n` +
      `  This package ships types, so that means the tarball did not carry them —\n` +
      `  check the "files" field and .npmignore. Reported as a failure here because\n` +
      `  attw's own exit code cannot: getExitCode() returns 0 whenever the analysis\n` +
      `  found no types at all, before it ever looks at the problem list.`,
  );
}
