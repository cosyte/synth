import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

import { docSnippetSuite, extractRunnableSnippets } from "@cosyte/vitest-config/snippets";

import { SYNTH_FATAL_CODES, SYNTH_FATAL_MESSAGES } from "../src/index.js";
import { ASTM_QUIRKS } from "../src/astm/index.js";
import { CCDA_QUIRKS } from "../src/ccda/index.js";
import { HL7_QUIRKS } from "../src/hl7/index.js";
import type { QuirkDescriptor } from "../src/index.js";

/**
 * The docs.cosyte.com pages in `docs-content/`, held to the code they describe.
 *
 * - Every TypeScript and JavaScript sample on a hand-written page runs, through the shared sample
 *   runner, against the BUILT package (the bundled `dist/*.mjs`, which is what an installer loads;
 *   the runner executes each block as a standalone module, so it cannot resolve the source's
 *   internal `.js` imports). The shared CI gate runs `test` before `build`, so `dist/` is built here.
 * - Every sample also compiles against the package's types, with the repository's strict settings:
 *   the runner strips types without checking them.
 * - Every link between pages resolves, heading anchor included, and so does every link into the
 *   generated reference under `docs-content/api/`.
 * - No page carries a value shaped like real contact or identity data: `pnpm phi-scan` does not read
 *   Markdown.
 * - The fatal-code and quirk reference pages list exactly what the source defines.
 *
 * The generated `api/` pages are not passed to the runner: their `@example` blocks are fragments
 * written for an editor's tooltip, and `cosyte-docs-reference --check` holds them to the source.
 */
const root = join(import.meta.dirname, "..");
const docsDir = join(root, "docs-content");
const apiDir = join(docsDir, "api");

/** Each import specifier a sample may use, mapped to the built entry point an installer loads. */
const ENTRY_POINTS: Readonly<Record<string, string>> = {
  "@cosyte/synth": join(root, "dist", "index.mjs"),
  "@cosyte/synth/hl7": join(root, "dist", "hl7", "index.mjs"),
  "@cosyte/synth/fhir": join(root, "dist", "fhir", "index.mjs"),
  "@cosyte/synth/ccda": join(root, "dist", "ccda", "index.mjs"),
  "@cosyte/synth/x12": join(root, "dist", "x12", "index.mjs"),
  "@cosyte/synth/ncpdp": join(root, "dist", "ncpdp", "index.mjs"),
  "@cosyte/synth/astm": join(root, "dist", "astm", "index.mjs"),
  "@cosyte/synth/deid": join(root, "dist", "deid", "index.mjs"),
};
/**
 * The entry a sample's specifier imports, as a `file:` URL: on Windows the ES module loader takes
 * no drive-letter path.
 */
const resolve = (specifier: string): string | undefined => {
  const entry = ENTRY_POINTS[specifier];
  return entry === undefined ? undefined : pathToFileURL(entry).href;
};

beforeAll(() => {
  // Through a shell on Windows only, where `pnpm` is a `.cmd` file a process cannot start without
  // one. The command and its arguments are fixed here, so the shell reads nothing from outside.
  execFileSync("pnpm", ["build"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}, 120_000);

/** The hand-written pages: every `.md` file at the top of `docs-content/`, not the generated `api/`. */
const pages = readdirSync(docsDir)
  .filter((name) => name.endsWith(".md"))
  .sort()
  .map((name) => join(docsDir, name));

/** A page's text, by its file name. */
const page = (name: string): string => readFileSync(join(docsDir, name), "utf8");

/** A page's name relative to `docs-content/`, for a failure message. */
const shortName = (path: string): string => path.slice(docsDir.length + 1);

/**
 * `every` runs each TypeScript and JavaScript sample whether or not it is tagged `runnable`, and
 * lists a `no-run` sample as skipped with its reason. It reaches the runner through a variable
 * rather than a literal so the line compiles against a `@cosyte/vitest-config` that predates the
 * option; such a runner ignores it and runs the `runnable` blocks, which is every sample here that
 * can run, as the test below holds.
 */
const suiteOptions = { files: pages, every: true, resolve };
docSnippetSuite(suiteOptions);

/** One fenced block of a page: its language, the words after it, its body, and its line. */
interface Fence {
  readonly lang: string;
  readonly tags: readonly string[];
  readonly body: string;
  readonly line: number;
}

/** Every fenced block in a page, in order. */
function fences(markdown: string): Fence[] {
  const lines = markdown.split(/\r?\n/);
  const found: Fence[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const open = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(lines[i] ?? "");
    if (open === null) continue;
    const [, indent = "", marker = "", info = ""] = open;
    const words = info.trim().split(/\s+/).filter(Boolean);
    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const line = lines[j] ?? "";
      const close = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
      if (close !== null && (close[1] ?? "").startsWith(marker[0] ?? "`")) break;
      body.push(line.startsWith(indent) ? line.slice(indent.length) : line);
    }
    found.push({ lang: words[0] ?? "", tags: words.slice(1), body: body.join("\n"), line: i + 1 });
    i = j;
  }
  return found;
}

/** A page with its fenced blocks blanked out, so prose checks do not read code. */
function prose(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*(`{3,}|~{3,})/.test(line)) {
        inFence = !inFence;
        return "";
      }
      return inFence ? "" : line;
    })
    .join("\n");
}

/** The fence languages that make a block a code sample, as the docs-content standard names them. */
const SAMPLE_LANGS: ReadonlySet<string> = new Set([
  "ts",
  "typescript",
  "tsx",
  "js",
  "javascript",
  "mjs",
]);

/** Every sample on every hand-written page. */
const samples = pages.flatMap((path) =>
  fences(readFileSync(path, "utf8"))
    .filter((fence) => SAMPLE_LANGS.has(fence.lang))
    .map((fence) => ({ ...fence, page: shortName(path) })),
);

describe("every sample on a hand-written page", () => {
  it("runs, or names in its fence why it cannot", () => {
    const unaccounted: string[] = [];
    for (const sample of samples) {
      const noRun = sample.tags.indexOf("no-run");
      const reason = noRun === -1 ? "" : sample.tags.slice(noRun + 1).join(" ");
      if (sample.tags.includes("runnable") ? noRun !== -1 : reason === "") {
        unaccounted.push(`${sample.page}:${String(sample.line)}`);
      }
    }
    expect(samples.length).toBeGreaterThan(40);
    expect(unaccounted).toEqual([]);
  });

  it(
    "compiles against the package's types, with the repository's strict settings",
    { timeout: 120_000 },
    () => {
      // The examples' compiler settings: the repository's own, with each published specifier
      // mapped to the source entry point the bundler compiles into that specifier's types.
      const configPath = join(root, "examples", "tsconfig.json");
      const parsed = ts.getParsedCommandLineOfConfigFile(
        configPath,
        { noEmit: true, moduleDetection: ts.ModuleDetectionKind.Force },
        { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
      );
      if (parsed === undefined) throw new Error(`${configPath} could not be read`);

      const virtual = new Map<string, string>();
      for (const sample of samples) {
        const name = `${sample.page.replace(/\.md$/, "")}-${String(sample.line)}.ts`;
        // With forward slashes, as the compiler host names every file it reads, so the lookups
        // below find each sample on Windows too.
        virtual.set(
          join(root, "examples", `.docs-sample-${name}`).split(sep).join("/"),
          sample.body,
        );
      }
      const host = ts.createCompilerHost(parsed.options, true);
      const getSourceFile = host.getSourceFile.bind(host);
      host.getSourceFile = (file, language, onError, create) => {
        const text = virtual.get(file);
        return text === undefined
          ? getSourceFile(file, language, onError, create)
          : ts.createSourceFile(file, text, language, true);
      };
      const fileExists = host.fileExists.bind(host);
      host.fileExists = (file) => virtual.has(file) || fileExists(file);
      const readFile = host.readFile.bind(host);
      host.readFile = (file) => virtual.get(file) ?? readFile(file);

      const program = ts.createProgram([...virtual.keys()], parsed.options, host);
      const errors = ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.file !== undefined && virtual.has(d.file.fileName))
        .map((d) => {
          const at = d.file?.getLineAndCharacterOfPosition(d.start ?? 0).line ?? 0;
          const text = ts.flattenDiagnosticMessageText(d.messageText, " ");
          return `${d.file?.fileName ?? ""}:${String(at + 1)} TS${String(d.code)} ${text}`;
        });
      expect(virtual.size).toBe(samples.length);
      expect(errors).toEqual([]);
    },
  );
});

/**
 * The anchor the docs site gives a heading, as github-slugger computes it: lower-cased, every
 * character that is not a letter, a digit, `_`, a space or a hyphen dropped (code ticks and
 * parentheses included), and each space made a hyphen. A repeated one is numbered from `-1`.
 */
function anchors(markdown: string): Set<string> {
  const seen = new Map<string, number>();
  const result = new Set<string>();
  for (const line of prose(markdown).split("\n")) {
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading === null) continue;
    const base = (heading[1] ?? "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_ -]/gu, "")
      .replace(/ /g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    result.add(count === 0 ? base : `${base}-${String(count)}`);
  }
  return result;
}

/** What is wrong with one link target on a page, or null when it resolves. */
function linkFault(from: string, target: string): string | null {
  if (/^https:\/\//.test(target)) return null;
  if (target.startsWith("#")) {
    return anchors(page(from)).has(target.slice(1)) ? null : "names no heading on this page";
  }
  const shaped = /^\.\/((?:api\/(?:[^/#.][^/#]*\/)*)?[^/#]+\.md)(?:#(.+))?$/.exec(target);
  if (shaped === null) return "is not written as ./<page>.md, ./api/<page>.md or #<anchor>";
  const file = join(docsDir, shaped[1] ?? "");
  if (!existsSync(file)) return "resolves to no page";
  const anchor = shaped[2];
  if (anchor !== undefined && !anchors(readFileSync(file, "utf8")).has(anchor)) {
    return "names no heading on that page";
  }
  return null;
}

describe("every link on a hand-written page", () => {
  it("resolves to a page, and to a heading on it when it names one", () => {
    const broken: string[] = [];
    let checked = 0;
    for (const path of pages) {
      const name = shortName(path);
      for (const match of prose(readFileSync(path, "utf8")).matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = match[1] ?? "";
        checked += 1;
        const fault = linkFault(name, target);
        if (fault !== null) broken.push(`${name}: ${target} ${fault}`);
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(broken).toEqual([]);
  });

  it("reaches the generated reference, which exists", () => {
    expect(existsSync(join(apiDir, "README.md"))).toBe(true);
    expect(linkFault("intro.md", "./api/src/hl7.md#generateadt")).toBeNull();
    expect(linkFault("intro.md", "./api/src/hl7.md#no-such-export")).not.toBeNull();
    expect(linkFault("intro.md", "./no-such-page.md")).not.toBeNull();
    expect(linkFault("intro.md", "./quickstart")).not.toBeNull();
  });
});

/** A dashed SSN; only the 900 series is invalid, so any other area could be a real number. */
const SSN = /\b(\d{3})-\d{2}-\d{4}\b/g;
/** A full NANP phone number; only `555-0100` to `555-0199` is reserved for fiction. */
const PHONE = /(?:\(\d{3}\)\s?|\b\d{3}-)(\d{3})-(\d{4})\b/g;
/** An email address. */
const EMAIL = /[\w.+-]+@((?:[\w-]+\.)+[a-z]{2,})\b/gi;
/** The domains reserved for examples and testing (RFC 2606, RFC 6761). */
const RESERVED_DOMAIN = /^(?:example\.(?:com|net|org)|.*\.(?:test|example|invalid|localhost))$/i;

/** Every value on a page shaped like real contact or identity data. */
function sampleDataFindings(name: string, text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(SSN)) {
    if (!(m[1] ?? "").startsWith("9")) found.push(`${name}: SSN ${m[0]}`);
  }
  for (const m of text.matchAll(PHONE)) {
    if (m[1] !== "555" || !(m[2] ?? "").startsWith("01")) found.push(`${name}: phone ${m[0]}`);
  }
  for (const m of text.matchAll(EMAIL)) {
    if (!RESERVED_DOMAIN.test(m[1] ?? "")) found.push(`${name}: email ${m[0]}`);
  }
  return found;
}

describe("the sample data on the pages", () => {
  it("holds no SSN, phone number or email address outside the reserved ranges", () => {
    const found = pages.flatMap((path) =>
      sampleDataFindings(shortName(path), readFileSync(path, "utf8")),
    );
    expect(found).toEqual([]);
  });

  it("would refuse a value outside them", () => {
    // The refused values are assembled at run time so this file holds no literal the repository's
    // own PHI scan would flag; each is shaped like real data on purpose, and none is anyone's.
    const dash = (...parts: string[]): string => parts.join("-");
    expect(sampleDataFindings("x", dash("123", "45", "6789"))).toHaveLength(1);
    expect(sampleDataFindings("x", "(212) 555-1212")).toHaveLength(1);
    expect(sampleDataFindings("x", "212-867-0100")).toHaveLength(1);
    expect(sampleDataFindings("x", ["someone", "mail.invalid-domain.org"].join("@"))).toHaveLength(
      1,
    );
    expect(sampleDataFindings("x", "987-00-4320 (528) 555-0105 a@example.org")).toEqual([]);
  });
});

describe("the fatal codes page", () => {
  const text = page("fatal-codes.md");

  it("has a heading and the exact message for every code, and no other code", () => {
    const headed = [...text.matchAll(/^### `(SYNTH_[A-Z_]+)`$/gm)].map((m) => m[1]);
    expect([...headed].sort()).toEqual(Object.keys(SYNTH_FATAL_CODES).sort());
    for (const [code, message] of Object.entries(SYNTH_FATAL_MESSAGES)) {
      const section = text.slice(text.indexOf(`### \`${code}\``));
      const next = section.indexOf("\n### ", 1);
      expect(section.slice(0, next === -1 ? undefined : next)).toContain(`Message: "${message}"`);
    }
  });
});

describe("the quirk catalog", () => {
  const text = page("quirk-catalog.md");

  /** The table rows of one `## <format>` section, keyed by the quirk name in the first cell. */
  function rows(heading: string): Map<string, string> {
    const start = text.indexOf(`\n## ${heading}\n`);
    expect(start).toBeGreaterThan(-1);
    const end = text.indexOf("\n## ", start + 1);
    const found = new Map<string, string>();
    for (const line of text.slice(start, end).split("\n")) {
      const cell = /^\| `([a-z-]+)` +\|/.exec(line);
      if (cell !== null) found.set(cell[1] ?? "", line);
    }
    return found;
  }

  const DISPOSITION = { suppressed: "suppressed", rebadged: "re-badged", bare: "bare" } as const;

  it.each([
    ["HL7 v2", HL7_QUIRKS],
    ["C-CDA", CCDA_QUIRKS],
    ["ASTM", ASTM_QUIRKS],
  ] as const)(
    "lists exactly the %s registry, with each warning, profile and disposition",
    (heading, registry) => {
      const table = rows(heading);
      const entries = Object.values(registry) as readonly QuirkDescriptor[];
      expect([...table.keys()].sort()).toEqual(entries.map((q) => q.name).sort());
      for (const quirk of entries) {
        const cells = (table.get(quirk.name) ?? "").split("|").map((c) => c.trim());
        expect(cells[2]).toBe(quirk.intendedWarnings.map((w) => `\`${w}\``).join(", "));
        expect(cells[3]).toBe(
          quirk.toleratingProfile === undefined ? "none" : `\`${quirk.toleratingProfile}\``,
        );
        expect(cells[4]).toBe(DISPOSITION[quirk.disposition]);
      }
    },
  );
});

/**
 * The README's quickstart (the first TypeScript block after `## Install`) is what a reader runs from
 * npm, and the Quickstart page is what the same reader runs from the docs site. Two first programs
 * that disagree send a reader two ways at once, so the page must open with the README's program,
 * byte for byte, and the sweep above is what executes it.
 */
describe("the Quickstart page opens with the README's quickstart program", () => {
  it("carries the README's first TypeScript block after ## Install as its first runnable block", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const afterInstall = readme.slice(readme.indexOf("\n## Install\n"));
    const readmeFirst = /\n```ts\n([\s\S]*?)\n```\n/.exec(afterInstall)?.[1];
    const pageFirst = extractRunnableSnippets(page("quickstart.md"))[0]?.code;

    expect(readme.includes("\n## Install\n")).toBe(true);
    expect(readmeFirst).toBeDefined();
    expect(pageFirst).toBe(readmeFirst);
  });
});
