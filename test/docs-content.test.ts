import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { beforeAll } from "vitest";

import { docSnippetSuite } from "@cosyte/vitest-config/snippets";

/**
 * Doc/code-agreement gate. Every ```` ```ts runnable ```` block in `docs-content/` is extracted,
 * compiled, and executed, and its inline `// =>` assertions are checked — so a documented example can
 * never silently drift from the shipped code (the documentation analog of the conformance runners).
 *
 * Snippets import the package the way a consumer does — against the **built** ESM artifacts, not the
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
    return undefined;
  },
});
