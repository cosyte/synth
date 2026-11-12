import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  examplePrintFindings,
  readPrintConfig,
  readReadme,
  samplePrintFindings,
} from "@cosyte/script-utils/docs-content";

/**
 * No example prints a value that identifies a person, synthetic or not: a name, a record or member
 * number, a date of birth, an address, a phone number, an email, a free-text note, or a whole
 * message, segment or resource. A reader copies what an example does into code that runs on real
 * messages, so an example that logs a patient's name teaches a reader to log one.
 *
 * `cosyte-docs-content` holds the README and the pages at the top of `docs-content/` to that rule,
 * and only once `cosyte-docs-content.config.json` makes it required. This suite holds the rest of
 * what a reader sees as an example: the runnable programs in `examples/` and the `@example` blocks
 * in the TSDoc that `docs-content/api/` is generated from. Each finding names the file and the
 * line, never the value.
 */
const root = join(import.meta.dirname, "..");
const settings = readPrintConfig(root);
const extra = {
  accessors: settings.accessors,
  wholeValues: settings.wholeValues,
  printers: settings.printers,
};

/** Every `.ts` file under a directory, recursively, as a path relative to the repository root. */
function tsFiles(dir: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
    .sort();
}

/**
 * The fenced code of each `@example` block in a source file's doc comments, each with the 1-based
 * file line of its first code line.
 */
function exampleBlocks(text: string): { line: number; code: string }[] {
  const lines = text.split("\n");
  const blocks: { line: number; code: string }[] = [];
  let inExample = false;
  let fence: { line: number; code: string[] } | undefined;
  lines.forEach((raw, index) => {
    const line = raw.replace(/^\s*\*\s?/, "");
    if (fence !== undefined) {
      if (line.startsWith("```")) {
        blocks.push({ line: fence.line, code: fence.code.join("\n") });
        fence = undefined;
      } else {
        fence.code.push(line);
      }
      return;
    }
    if (line.startsWith("@example")) inExample = true;
    else if (line.startsWith("@") || raw.includes("*/")) inExample = false;
    if (inExample && line.startsWith("```")) fence = { line: index + 2, code: [] };
  });
  return blocks;
}

describe("no example prints a value that identifies a person", () => {
  it("the docs-content check holds the rule as required", () => {
    expect(settings.required).toBe(true);
  });

  it("no sample in the README or a docs-content page prints one", () => {
    const docsDir = join(root, "docs-content");
    const pages = readdirSync(docsDir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => ({
        name: name.slice(0, -".md".length),
        text: readFileSync(join(docsDir, name), "utf8"),
      }));
    expect(pages.length).toBeGreaterThan(0);
    const findings = examplePrintFindings({ pages, readme: readReadme(root) }, extra);
    expect(findings.map((f) => `${f.file}:${String(f.line)} ${f.message}`)).toEqual([]);
  });

  it("no runnable example in examples/ prints one", () => {
    const files = tsFiles("examples");
    expect(files.length).toBeGreaterThan(0);
    const findings = files.flatMap((file) =>
      samplePrintFindings(readFileSync(join(root, file), "utf8"), extra).map(
        (f) => `${file}:${String(f.line)} ${f.message}`,
      ),
    );
    expect(findings).toEqual([]);
  });

  it("no @example block in the TSDoc the API reference is generated from prints one", () => {
    const blocks = tsFiles("src").flatMap((file) =>
      exampleBlocks(readFileSync(join(root, file), "utf8")).map((block) => ({ file, ...block })),
    );
    expect(blocks.length).toBeGreaterThan(0);
    const findings = blocks.flatMap(({ file, line, code }) =>
      samplePrintFindings(code, extra).map(
        (f) => `${file}:${String(line + f.line - 1)} ${f.message}`,
      ),
    );
    expect(findings).toEqual([]);
  });
});
