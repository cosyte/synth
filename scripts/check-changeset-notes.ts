#!/usr/bin/env tsx
/**
 * scripts/check-changeset-notes.ts
 *
 * WHAT THIS GUARDS. The release pipeline derives the GitHub release body from the changesets a
 * "Version Packages" commit consumed, and it refuses the release when that body cannot be derived:
 * most often when a changeset's opening sentence, which becomes a release bullet, is longer than the
 * bullet cap. That refusal runs on the version commit, after the Version Packages pull request has
 * merged and consumed the changesets, so the only way back is to revert the version commit, fix the
 * changeset and version again. Version 0.1.10 stopped there: one opening sentence was a bullet of
 * 436 characters against a cap of 400.
 *
 * WHAT THIS DOES. It runs the release tooling's own rule against every PENDING changeset, on a pull
 * request, before anything is consumed. It does not restate the rule: it loads `release-notes.mjs`
 * from the cosyte/.github commit that `.github/workflows/release.yml` pins, and calls the functions
 * the release run calls (`collectHeadlines`, `renderNotes`, `assertPublishableNotes`). So the cap,
 * the sentence splitting and the internal-reference translation are the release's, at the same
 * commit, and they move together when the release pin moves.
 *
 * The tooling exposes those functions as exports, not as a pull request command: its CLI has only
 * `prepare`, which reads a version commit, and `assert`, which reads a finished body. This script is
 * the small adapter that feeds it the pending changesets instead.
 *
 * Every pending changeset is measured on its own, so one refusal does not hide another, and then the
 * whole set is rendered into the body the next patch release would publish and that body is checked.
 *
 * Usage:
 *   tsx scripts/check-changeset-notes.ts ref [--workflow <release.yml>]
 *   tsx scripts/check-changeset-notes.ts check --tooling <release-notes.mjs> [--dir <.changeset>]
 *
 * Exit codes: 0 fit to release (or nothing pending), 1 a changeset the release would refuse,
 * 2 the check could not run.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** The package every changeset here releases. */
export const PACKAGE_NAME = "@cosyte/synth";

/** One changeset file: its name in `.changeset/` and its raw text. */
export interface ChangesetFile {
  id: string;
  text: string;
}

/** The part of the release tooling's `release-notes.mjs` this check calls. */
export interface ReleaseNotesTooling {
  collectHeadlines(
    files: ChangesetFile[],
    packageName: string,
  ): { kept: string[]; dropped: { id: string; headline: string }[] };
  renderNotes(input: {
    packageName: string;
    version: string;
    headlines: string[];
    dropped?: { id: string; headline: string }[];
  }): string;
  assertPublishableNotes(
    body: string,
    expect: { expectVersion: string; expectPackage: string },
  ): string[];
}

/** Thrown when the check itself cannot run: exit 2, never 1. */
export class CheckSetupError extends Error {}

const RELEASE_PIN = /uses:\s*cosyte\/\.github\/\.github\/workflows\/release\.yml@([0-9a-f]{40})\b/g;

/**
 * The cosyte/.github commit the release workflow calls, read from `release.yml`'s text.
 *
 * @param workflow The text of `.github/workflows/release.yml`.
 * @returns The 40-character commit.
 */
export function releaseToolingRef(workflow: string): string {
  const refs = new Set([...workflow.matchAll(RELEASE_PIN)].map((m) => m[1] as string));
  if (refs.size !== 1) {
    throw new CheckSetupError(
      `release.yml must call cosyte/.github's release.yml at exactly one 40-character commit; ` +
        `found ${refs.size}`,
    );
  }
  return [...refs][0] as string;
}

/**
 * The pending changesets in a directory, sorted by name: every `.md` file but `README.md`.
 *
 * @param dir The `.changeset` directory.
 * @returns The files with their text.
 */
export function pendingChangesets(dir: string): ChangesetFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort()
    .map((id) => ({ id, text: readFileSync(join(dir, id), "utf8") }));
}

/**
 * The next patch version: every Cosyte release is a patch.
 *
 * @param version A `major.minor.patch` version.
 * @returns The version with its patch number one higher.
 */
export function nextPatch(version: string): string {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (parts === null)
    throw new CheckSetupError(`not a release version: ${JSON.stringify(version)}`);
  return `${parts[1]}.${parts[2]}.${Number(parts[3]) + 1}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Every reason the release tooling would refuse to release these changesets.
 *
 * @param input The pending changesets, the version they would release as, and the tooling.
 * @returns One line per problem; empty means the release could describe itself.
 */
export function checkPendingNotes(input: {
  files: ChangesetFile[];
  version: string;
  tooling: ReleaseNotesTooling;
  packageName?: string;
}): string[] {
  const { files, version, tooling } = input;
  const packageName = input.packageName ?? PACKAGE_NAME;
  if (files.length === 0) return [];

  const problems: string[] = [];
  for (const file of files) {
    try {
      tooling.collectHeadlines([file], packageName);
    } catch (error) {
      problems.push(messageOf(error));
    }
  }
  if (problems.length > 0) return problems;

  try {
    const { kept, dropped } = tooling.collectHeadlines(files, packageName);
    const body = tooling.renderNotes({ packageName, version, headlines: kept, dropped });
    for (const problem of tooling.assertPublishableNotes(body, {
      expectVersion: version,
      expectPackage: packageName,
    })) {
      problems.push(`the release body for ${packageName}@${version}: ${problem}`);
    }
  } catch (error) {
    problems.push(messageOf(error));
  }
  return problems;
}

function option(argv: string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

/**
 * Run the command line.
 *
 * @param argv Arguments after the script path.
 * @param out Where to write the report.
 * @param root The repository root.
 * @returns The exit code.
 */
export async function main(
  argv: string[],
  out: (line: string) => void,
  root: string = process.cwd(),
): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === "ref") {
      const workflow = option(rest, "--workflow") ?? join(root, ".github/workflows/release.yml");
      out(releaseToolingRef(readFileSync(workflow, "utf8")));
      return 0;
    }
    if (command === "check") {
      const toolingPath = option(rest, "--tooling");
      if (toolingPath === undefined) throw new CheckSetupError("check needs --tooling <file>");
      const dir = option(rest, "--dir") ?? join(root, ".changeset");
      const tooling = (await import(
        pathToFileURL(resolve(root, toolingPath)).href
      )) as ReleaseNotesTooling;
      const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
        version: string;
      };
      const version = nextPatch(manifest.version);
      const files = pendingChangesets(resolve(root, dir));
      const problems = checkPendingNotes({ files, version, tooling });
      if (problems.length > 0) {
        out(`${problems.length} problem(s) the release would refuse:`);
        for (const problem of problems) out(`- ${problem}`);
        return 1;
      }
      out(
        `${files.length} pending changeset(s) fit the release notes for ${PACKAGE_NAME}@${version}.`,
      );
      return 0;
    }
    throw new CheckSetupError(`unknown command ${JSON.stringify(command ?? "")}: use ref or check`);
  } catch (error) {
    out(messageOf(error));
    return 2;
  }
}

/* v8 ignore next 3 -- the command-line entry, run by the workflow rather than the tests */
if (process.argv[1] !== undefined && resolve(process.argv[1]) === import.meta.filename) {
  process.exitCode = await main(process.argv.slice(2), (line) => console.log(line));
}
