---
"@cosyte/synth": patch
---

An empty selection list is now refused with `SYNTH_EMPTY_POOL`, in every format, before anything is generated and whatever the `count`. That covers an empty `mix` in `hl7Corpus`, `fhirCorpus`, `ccdaCorpus`, `x12Corpus`, `ncpdpCorpus` and `astmCorpus`, an empty `triggers` list in `hl7Corpus`, and an empty `quirks` list, or a `profile` whose `quirks` is an empty list, in `hl7QuirkCorpus`, `ccdaQuirkCorpus` and `astmQuirkCorpus`. Before, an empty `mix` with a count above zero quietly filled the corpus with one hard-coded kind (`hl7Corpus({ seed, mix: [] })` returned one `ADT^A01`), an empty `mix` with no count in the X12, NCPDP and ASTM corpora returned an empty corpus, and an empty `quirks` list was read as every quirk. What a caller changes: leave `mix`, `triggers`, `quirks` and `profile` out to get the default, instead of passing an empty list. Output for every non-empty selection is unchanged, byte for byte.
