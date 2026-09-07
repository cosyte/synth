#!/usr/bin/env tsx
/**
 * scripts/determinism/check-window.ts
 *
 * THE COMPATIBILITY-WINDOW CHECK. Reached by `pnpm run check:determinism-window`.
 *
 * A changed committed baseline means some seed maps to different bytes than it did on the default
 * branch. A consumer is invited to commit a golden fixture and diff against it, so that is a
 * BREAKING CHANGE and it has to be declared as one in the changeset whose summary becomes the
 * changelog entry for the release.
 *
 * This file is the impure half: it resolves the default branch, reads two files out of git, lists
 * the changesets, and hands all of it to `decideWindow`, which is where the decision lives and
 * where it is tested. `git` is the only subprocess, always through `execFileSync` with array
 * arguments and never a shell.
 *
 * RESOLVING THE DEFAULT BRANCH FAILS CLOSED. If none of the candidate refs exists, this REFUSES
 * rather than passing: "the mapping did not change" and "we could not find out" must never look
 * the same. The continuous-integration job fetches `main` explicitly for exactly this reason.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { decideWindow, type ChangesetFile } from "./window.js";
import { BASELINE_GIT_PATH, BASELINE_PATH, readPackageFacts, REPO_ROOT } from "./policy.js";

/** The refs this check will accept as "the default branch", in order of preference. */
const BASE_REF_CANDIDATES = ["origin/main", "main"] as const;

/** Refuse loudly. */
function refuse(message: string): never {
  process.stderr.write(`\ndeterminism-window: REFUSING TO REPORT\n  ${message}\n`);
  process.exit(1);
}

/** Run git, returning its stdout, or `undefined` when it exited non-zero. */
function git(args: readonly string[]): string | undefined {
  try {
    return execFileSync("git", [...args], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return undefined;
  }
}

/** The first candidate ref that resolves, or `undefined`. */
function resolveBaseRef(): string | undefined {
  for (const ref of BASE_REF_CANDIDATES) {
    if (git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]) !== undefined) return ref;
  }
  return undefined;
}

/** Every changeset in the working tree, excluding the directory's own README and config. */
function readChangesets(): readonly ChangesetFile[] {
  const directory = join(REPO_ROOT, ".changeset");
  let names: string[];
  try {
    names = readdirSync(directory);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md")
    .sort()
    .map((name) => ({ name, text: readFileSync(join(directory, name), "utf8") }));
}

/** The working tree's baseline, or `null` when there is none. */
function currentBaseline(): string | null {
  try {
    return readFileSync(BASELINE_PATH, "utf8");
  } catch {
    return null;
  }
}

function main(): void {
  if (process.argv.length > 2) {
    process.stderr.write("determinism-window: this check takes no arguments.\n");
    process.exit(2);
  }

  const baseRef = resolveBaseRef();
  if (baseRef === undefined) {
    refuse(
      `none of [${BASE_REF_CANDIDATES.join(", ")}] resolves in this checkout, so this check ` +
        "cannot read the baseline the seed-to-bytes mapping is being compared against. It " +
        "refuses rather than passing: a mapping that did not change and one nobody could look up " +
        "must never look the same. In continuous integration, fetch the default branch first " +
        "(`git fetch --no-tags --depth=1 origin +refs/heads/main:refs/remotes/origin/main`).",
    );
  }

  const facts = readPackageFacts();
  const verdict = decideWindow({
    current: currentBaseline(),
    previous: git(["show", `${baseRef}:${BASELINE_GIT_PATH}`]) ?? null,
    baseRef,
    changesets: readChangesets(),
    packageName: facts.name,
  });

  if (verdict.status === "pass") {
    process.stdout.write(`determinism-window: OK\n  ${verdict.message}\n`);
    return;
  }
  process.stderr.write(`\ndeterminism-window: FAILED\n\n  ${verdict.message}\n`);
  process.exit(1);
}

main();
