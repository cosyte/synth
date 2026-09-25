import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { docSnippetSuite, extractRunnableSnippets } from "@cosyte/vitest-config/snippets";

/**
 * Doc/code-agreement gate. Every ```` ```ts runnable ```` block in `docs-content/` is extracted,
 * compiled, and executed, and its inline `// =>` assertions are checked, so a documented example can
 * never silently drift from the shipped code (the documentation analog of the conformance runners).
 *
 * Snippets import the package the way a consumer does, against the **built** ESM artifacts, not the
 * source tree: the harness runs each block as a standalone ES module, so it cannot resolve the source's
 * internal `.js`→`.ts` imports, but the bundled `dist/*.mjs` are self-contained (and are exactly what
 * an installer loads). The shared CI gate runs `test` before `build`, so `dist/` is provisioned on
 * demand here rather than assuming build order.
 */
const root = join(import.meta.dirname, "..");
const rootEntry = join(root, "dist", "index.mjs");
const hl7Entry = join(root, "dist", "hl7", "index.mjs");
const fhirEntry = join(root, "dist", "fhir", "index.mjs");
const ccdaEntry = join(root, "dist", "ccda", "index.mjs");
const x12Entry = join(root, "dist", "x12", "index.mjs");
const ncpdpEntry = join(root, "dist", "ncpdp", "index.mjs");
const astmEntry = join(root, "dist", "astm", "index.mjs");
const deidEntry = join(root, "dist", "deid", "index.mjs");

beforeAll(() => {
  execFileSync("pnpm", ["build"], { cwd: root, stdio: "inherit" });
}, 120_000);

docSnippetSuite({
  docsDir: join(root, "docs-content"),
  resolve: (specifier) => {
    if (specifier === "@cosyte/synth") return rootEntry;
    if (specifier === "@cosyte/synth/hl7") return hl7Entry;
    if (specifier === "@cosyte/synth/fhir") return fhirEntry;
    if (specifier === "@cosyte/synth/ccda") return ccdaEntry;
    if (specifier === "@cosyte/synth/x12") return x12Entry;
    if (specifier === "@cosyte/synth/ncpdp") return ncpdpEntry;
    if (specifier === "@cosyte/synth/astm") return astmEntry;
    if (specifier === "@cosyte/synth/deid") return deidEntry;
    return undefined;
  },
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
    const quickstart = readFileSync(join(root, "docs-content", "quickstart.md"), "utf8");
    const pageFirst = extractRunnableSnippets(quickstart)[0]?.code;

    expect(readme.includes("\n## Install\n")).toBe(true);
    expect(readmeFirst).toBeDefined();
    expect(pageFirst).toBe(readmeFirst);
  });
});
