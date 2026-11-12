/**
 * Tests for `scripts/check-changeset-notes.ts`, the pull request check that runs the release
 * tooling's own release-notes rule against every pending changeset.
 *
 * The rule itself lives in cosyte/.github and is fetched by the workflow at the commit
 * `release.yml` pins, so it is not on disk here. These cases hold the adapter around it to its
 * contract with a stand-in tooling module that refuses the same way the real one does (it throws on
 * an opening sentence over 400 characters): every changeset is measured on its own, every refusal is
 * reported, the next patch version is the one rendered, and the exit codes separate a refusal (1)
 * from a check that could not run (2). The workflow then runs the real tooling against an over-cap
 * fixture and requires a refusal before it checks `.changeset/`.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkPendingNotes,
  main,
  nextPatch,
  PACKAGE_NAME,
  pendingChangesets,
  releaseToolingRef,
  type ChangesetFile,
  type ReleaseNotesTooling,
} from "../../scripts/check-changeset-notes.js";

const ROOT = join(import.meta.dirname, "..", "..");
const FIXTURES = join(ROOT, "test", "fixtures", "changeset-notes");

/** The stand-in for `release-notes.mjs`, as module source so `main` can import it from a file. */
const FAKE_TOOLING = `
export function collectHeadlines(files, packageName) {
  const kept = [];
  for (const file of files) {
    const summary = file.text.replace(/^---[\\s\\S]*?---\\s*/, "").trim();
    const headline = (/^(.+?[.!?])(\\s|$)/.exec(summary.split(/\\s+/).join(" ")) ?? [summary])[1];
    if (headline.length > 400) throw new Error(file.id + ": over the cap for " + packageName);
    kept.push(headline);
  }
  return { kept, dropped: [] };
}
export function renderNotes({ packageName, version, headlines }) {
  return headlines.map((h) => "- " + h).join("\\n") + "\\nnpm install " + packageName + "@" + version;
}
export function assertPublishableNotes(body, { expectVersion, expectPackage }) {
  return body.includes(expectPackage + "@" + expectVersion) ? [] : ["wrong version"];
}
`;

function fakeToolingFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "changeset-notes-"));
  const file = join(dir, "release-notes.mjs");
  writeFileSync(file, FAKE_TOOLING);
  return file;
}

function changeset(id: string, summary: string): ChangesetFile {
  return { id, text: `---\n"${PACKAGE_NAME}": patch\n---\n\n${summary}\n` };
}

/** A stand-in that records what it was given and refuses any id listed in `refuse`. */
function recordingTooling(refuse: string[] = [], bodyProblems: string[] = []) {
  const calls: { ids: string[]; packageName: string }[] = [];
  const rendered: { version: string; headlines: string[] }[] = [];
  const tooling: ReleaseNotesTooling = {
    collectHeadlines(files, packageName) {
      calls.push({ ids: files.map((f) => f.id), packageName });
      const refused = files.find((f) => refuse.includes(f.id));
      if (refused) throw new Error(`${refused.id}: refused`);
      return { kept: files.map((f) => f.id), dropped: [] };
    },
    renderNotes({ version, headlines }) {
      rendered.push({ version, headlines });
      return `body ${version}`;
    },
    assertPublishableNotes: () => bodyProblems,
  };
  return { tooling, calls, rendered };
}

describe("releaseToolingRef", () => {
  it("reads the commit release.yml calls the shared release workflow at", () => {
    const workflow = readFileSync(join(ROOT, ".github", "workflows", "release.yml"), "utf8");
    const ref = releaseToolingRef(workflow);
    expect(ref).toMatch(/^[0-9a-f]{40}$/);
    expect(workflow).toContain(`release.yml@${ref}`);
  });

  it("refuses a workflow with no pinned call, or with two different ones", () => {
    expect(() =>
      releaseToolingRef("uses: cosyte/.github/.github/workflows/release.yml@main"),
    ).toThrow(/found 0/);
    const a = "a".repeat(40);
    const b = "b".repeat(40);
    expect(() =>
      releaseToolingRef(
        `uses: cosyte/.github/.github/workflows/release.yml@${a}\n` +
          `uses: cosyte/.github/.github/workflows/release.yml@${b}\n`,
      ),
    ).toThrow(/found 2/);
  });
});

describe("pendingChangesets", () => {
  it("reads every .md file but README.md, sorted by name", () => {
    const dir = mkdtempSync(join(tmpdir(), "changeset-dir-"));
    writeFileSync(join(dir, "README.md"), "not a changeset");
    writeFileSync(join(dir, "config.json"), "{}");
    writeFileSync(join(dir, "b.md"), "B");
    writeFileSync(join(dir, "a.md"), "A");
    mkdirSync(join(dir, "nested.md.d"));
    expect(pendingChangesets(dir)).toEqual([
      { id: "a.md", text: "A" },
      { id: "b.md", text: "B" },
    ]);
  });
});

describe("nextPatch", () => {
  it("raises the patch number by one", () => {
    expect(nextPatch("0.1.9")).toBe("0.1.10");
    expect(nextPatch("1.0.0")).toBe("1.0.1");
  });

  it("refuses a version that is not major.minor.patch", () => {
    expect(() => nextPatch("0.1.9-next.1")).toThrow(/not a release version/);
  });
});

describe("checkPendingNotes", () => {
  it("passes with nothing pending, without calling the tooling", () => {
    const { tooling, calls } = recordingTooling();
    expect(checkPendingNotes({ files: [], version: "0.1.10", tooling })).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("measures every changeset on its own and reports every refusal", () => {
    const { tooling, calls, rendered } = recordingTooling(["a.md", "c.md"]);
    const files = ["a.md", "b.md", "c.md"].map((id) => changeset(id, "Text."));
    expect(checkPendingNotes({ files, version: "0.1.10", tooling })).toEqual([
      "a.md: refused",
      "c.md: refused",
    ]);
    expect(calls).toEqual(
      ["a.md", "b.md", "c.md"].map((id) => ({ ids: [id], packageName: PACKAGE_NAME })),
    );
    expect(rendered).toEqual([]);
  });

  it("renders the whole set at the given version and checks that body", () => {
    const { tooling, calls, rendered } = recordingTooling();
    const files = ["a.md", "b.md"].map((id) => changeset(id, "Text."));
    expect(checkPendingNotes({ files, version: "0.1.10", tooling })).toEqual([]);
    expect(calls.at(-1)).toEqual({ ids: ["a.md", "b.md"], packageName: PACKAGE_NAME });
    expect(rendered).toEqual([{ version: "0.1.10", headlines: ["a.md", "b.md"] }]);
  });

  it("reports what the body check finds, naming the release", () => {
    const { tooling } = recordingTooling([], ["the body is empty"]);
    expect(
      checkPendingNotes({ files: [changeset("a.md", "Text.")], version: "0.1.10", tooling }),
    ).toEqual([`the release body for ${PACKAGE_NAME}@0.1.10: the body is empty`]);
  });

  it("reports a refusal thrown while rendering, and one that is not an Error", () => {
    const { tooling } = recordingTooling();
    const throwing: ReleaseNotesTooling = {
      ...tooling,
      renderNotes: () => {
        throw new Error("no changes to report");
      },
    };
    const files = [changeset("a.md", "Text.")];
    expect(checkPendingNotes({ files, version: "0.1.10", tooling: throwing })).toEqual([
      "no changes to report",
    ]);
    const odd: ReleaseNotesTooling = {
      ...tooling,
      collectHeadlines: () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- a tooling that throws a bare string
        throw "bare refusal";
      },
    };
    expect(checkPendingNotes({ files, version: "0.1.10", tooling: odd })).toEqual(["bare refusal"]);
  });

  it("takes another package name when given one", () => {
    const { tooling, calls } = recordingTooling();
    checkPendingNotes({
      files: [changeset("a.md", "Text.")],
      version: "1.0.1",
      tooling,
      packageName: "@cosyte/example",
    });
    expect(calls.every((c) => c.packageName === "@cosyte/example")).toBe(true);
  });
});

describe("main", () => {
  async function run(argv: string[]): Promise<{ code: number; out: string[] }> {
    const out: string[] = [];
    const code = await main(argv, (line) => out.push(line), ROOT);
    return { code, out };
  }

  it("prints the release tooling commit", async () => {
    const { code, out } = await run(["ref"]);
    expect(code).toBe(0);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^[0-9a-f]{40}$/);
  });

  it("reads another workflow file when named", async () => {
    const dir = mkdtempSync(join(tmpdir(), "changeset-ref-"));
    const file = join(dir, "release.yml");
    writeFileSync(
      file,
      `uses: cosyte/.github/.github/workflows/release.yml@${"c".repeat(40)} # x\n`,
    );
    expect(await run(["ref", "--workflow", file])).toEqual({ code: 0, out: ["c".repeat(40)] });
  });

  it("exits 1 and lists the refusal for a changeset over the cap", async () => {
    const tooling = fakeToolingFile();
    const { code, out } = await run([
      "check",
      "--tooling",
      tooling,
      "--dir",
      join(FIXTURES, "over-cap"),
    ]);
    expect(code).toBe(1);
    expect(out[0]).toBe("1 problem(s) the release would refuse:");
    expect(out[1]).toMatch(/^- opening-sentence-too-long\.md: over the cap for @cosyte\/synth$/);
  });

  it("exits 0 for changesets that fit, naming the next patch release", async () => {
    const tooling = fakeToolingFile();
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      version: string;
    };
    const { code, out } = await run([
      "check",
      "--tooling",
      tooling,
      "--dir",
      join(FIXTURES, "fits"),
    ]);
    expect(code).toBe(0);
    expect(out).toEqual([
      `1 pending changeset(s) fit the release notes for ${PACKAGE_NAME}@${nextPatch(pkg.version)}.`,
    ]);
  });

  it("exits 2 when it cannot run", async () => {
    expect((await run(["check"])).code).toBe(2);
    expect((await run(["check"])).out).toEqual(["check needs --tooling <file>"]);
    expect((await run([])).code).toBe(2);
    expect((await run(["publish"])).out).toEqual(['unknown command "publish": use ref or check']);
    const missing = await run(["check", "--tooling", join(FIXTURES, "no-such-tooling.mjs")]);
    expect(missing.code).toBe(2);
  });
});
