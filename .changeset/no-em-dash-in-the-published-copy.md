---
"@cosyte/synth": patch
---

The package description, the README, the documentation pages and the exported quirk-registry prose no longer use the em dash, matching the cosyte house voice.

**Nothing about generation changed.** No export was added, removed or renamed, no warning or fatal
code moved, and a given seed still produces byte-identical output for every format. The rewrite is
punctuation in prose: an em dash became a colon or a comma in almost every case, and elsewhere a
period, a semicolon, a pair of parentheses, a connecting word, or nothing at all, whichever the
sentence wanted. Every value this package emits is still drawn from the same reserved
and synthetic sources it always was, and no fixture byte moved.

Two of those surfaces are worth naming because they are read outside the repository.
`package.json`'s `description` is what npm shows on the package page and in every search result,
and the fourteen pages under `docs-content/` are what ships to the documentation site. The two
runtime-visible strings are the `grounding` notes on the HL7 v2 and ASTM quirk descriptors, which
are frozen registry text a consumer can read but which nothing is keyed on.

The hand-maintained changelog history below `## Released before this file was generated` is
deliberately untouched. Those entries were accurate when they were written, and a dated record is
corrected above itself rather than edited.
