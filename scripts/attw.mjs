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
 * ▶ BLINDING. Each of these was measured HERE, against this repo's pinned binary
 *   and with `--profile node16` present, on a package whose tarball carries no
 *   types: each one restores the exact false green by making the untyped sentence
 *   absent from what this script can read, while `attw` still exits 0.
 *
 *       --quiet / -q            sentence absent, exit 0
 *       --format json / -f json sentence absent, exit 0   (also `--format=json`)
 *       .attw.json {"quiet":true} or {"format":"json"}
 *                               sentence absent, exit 0   (readConfig() applies it after argv)
 *
 *   All are refused below, along with `--config-path`, which would move the config
 *   file out of view — that one by inference, not because it was measured. Bare
 *   `attw` exits 0 in the measured cases too, so refusing is not a regression
 *   against the old script — it is the difference between a gate and a gate-shaped
 *   thing.
 *
 *   The refusal is BY OPTION NAME, WHOLESALE, not by value. `--format table-flipped`
 *   still prints the sentence and blinds nothing, and is refused anyway. That is
 *   the deliberate trade: value-parsing these would be a third moving part in the
 *   guard, and being over-strict about an argument nobody passes to a repo's own
 *   publish gate costs less than a route back to a false green.
 *
 * ▶ WHAT THE PREFLIGHT DOES *NOT* DEPEND ON, because this package looks like it
 *   might. `@cosyte/synth` carries seven `file:vendor/*.tgz` devDependencies (every
 *   sibling parser plus `deid`). They have no bearing on either net: `files` is
 *   `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, so `npm pack` produces a
 *   tarball with no `vendor/` and no `node_modules/` in it, and `attw` does not
 *   resolve bare external specifiers at all — measured on a fixture whose only
 *   declaration imports a package that does not exist anywhere, which `attw`
 *   reports as "No problems found". So a missing or stale vendored tarball cannot
 *   make this gate red, and cannot make it green either.
 *
 * Other arguments are forwarded, so `--profile node16` and friends still work.
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

// ---- Refuse what would blind the post-check --------------------------------
const BLINDING = new Set(["-q", "--quiet", "-f", "--format", "--config-path"]);
const blinding = args.filter((a) => BLINDING.has(a.split("=")[0]));
if (blinding.length > 0) {
  die(
    `${blinding.join(", ")} is refused wholesale, by option name and not by value.\n` +
      `  This gate reads attw's printed output, attw exits 0 on an untyped package,\n` +
      `  and some values of these options hide that output. Run it without them.`,
  );
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
const broken = [];
for (const rel of declaredArtifacts(pkg)) {
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
  // Only claim the exit-0 counterfactual when a DECLARATION file is among the
  // casualties. With the declarations intact and only JS missing, attw reports
  // no problems at all and still exits 0 — a different silence, not this one.
  const declarationsHit = broken.some(({ rel }) => DECLARATION.test(rel));
  die(
    `package.json promises files the build has not produced:\n` +
      broken.map(({ rel, why }) => `    ${rel} (${why})\n`).join("") +
      `\n  Run the build first. If you DID build, something removed or truncated the\n` +
      `  output underneath this run — a concurrent build or \`clean\` in the same\n` +
      `  working tree will do it, and \`tsup\` writes JS before declarations, so there\n` +
      `  is a multi-second window in every build here where the .d.ts files do not\n` +
      `  exist yet.\n` +
      (declarationsHit
        ? `  attw would have reported "${UNTYPED}" and EXITED 0 on this tree.\n`
        : `  attw does not gate these: it analyses types, and exits 0 here.\n`),
  );
}

// ---- Run attw ---------------------------------------------------------------
const res = spawnSync(ATTW_BIN, ["--pack", ".", ...args], {
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
