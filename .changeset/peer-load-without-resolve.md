---
"@cosyte/synth": patch
---

A generator now loads its parser where `import.meta.resolve` throws or answers with a URL that is not a `file:` URL, as inside Deno's test runner.

Before, the first generator call that needed a parser threw there (`TypeError: Invalid arguments` under Deno's test runner). Now the ES module build loads the parser by name through `require` instead, the same fallback it already takes where Node.js cannot `require` an ES module, so a returned value is an instance of the CommonJS copy of the parser's classes. Nothing changes on Node.js 22.12 or later, and no output changes. A caller changes nothing.
