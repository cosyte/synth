---
"@cosyte/synth": patch
---

Type declarations are now bundled by tsup 9; the JavaScript is unchanged and the bytes every seed
produces are unchanged. Each declaration file lists its type-only exports in a separate
`export type` statement and the shared declaration chunks have new file names. Every subpath
exports the same names with the same types as before. The source maps of the `hl7`, `ccda` and
`deid` subpaths embed source that was reformatted, with no change to the code.
