---
"@cosyte/synth": patch
---

Each format subpath now imports without loading its parser, and a corpus checks its artifacts in less time.

- Importing `@cosyte/synth/hl7`, `/fhir`, `/ccda`, `/x12`, `/ncpdp`, `/astm` or `/deid` no longer loads the sibling parser it builds through. The parser loads on the first call that needs it, synchronously, so every function keeps its signature. It is the same build an `import` or a `require` of the parser gives you, so a returned message, resource, document or interchange is an instance of the parser classes your own code imports. One thing moves: when an optional parser is not installed, the error that names it now comes from the first call that needs it, not from the import of the subpath. Install the parser for each format you generate, as before.
- Every corpus generator (`hl7Corpus`, `fhirCorpus`, `ccdaCorpus`, `x12Corpus`, `ncpdpCorpus`, `astmCorpus`) takes a new `verify` option. It defaults to `true`, which reads each artifact back through its parser and records the parser's findings as its `warnings`, as before. A corpus now reads each artifact back once and no longer serializes it a second time, since a corpus never reported byte stability; `roundTrip` and the other round-trip functions still check it. `verify: false` skips the read, a large share of a corpus's time, and leaves every artifact's `warnings` empty without checking it. Pass it when the corpus feeds a load test and the parser's verdict is not needed.
- The sibling parsers move to their latest releases: `@cosyte/hl7` 0.1.8, `@cosyte/fhir` 0.1.8, `@cosyte/ccda` 0.1.6, `@cosyte/x12` 0.1.10, `@cosyte/ncpdp` 0.1.6, `@cosyte/astm` 0.1.6 and `@cosyte/deid` 0.1.5, and each optional peer range now starts at that release.

Output change: X12. Every generated 271 now carries the BHT segment the 005010X279A1 guide requires right after its ST, because `@cosyte/x12` 0.1.10 writes it; its SE segment count is one higher, and the X12 271 de-identification loop result moves with it. A 271 golden file committed from an earlier release has to be regenerated. Every other generated artifact is byte for byte what it was for the same seed.
