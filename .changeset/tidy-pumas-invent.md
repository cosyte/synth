---
"@cosyte/synth": patch
---

Generated FHIR R4 output is now graded by a validator that is not ours. Until now, every "spec-clean" claim this package made was the sibling parser reading back what the sibling parser wrote: a strong structural property, and one that cannot see a misreading of a standard that the builder and the reader share. On every change, the HL7-maintained FHIR validator, pinned by version and by content digest, now validates a seeded corpus of generated FHIR R4 resources against US Core 6.1.0, and any issue it reports at severity `error` or `fatal` fails the build. There is no severity downgrade, no warning-only mode and no suppression list.

The run publishes a coverage declaration alongside its verdict. It names every format the library generates and marks each one either independently graded, with the grader named, or ungraded, with a reason, and it is built from the set of formats the generators actually emit rather than from a hand-kept list, so a format cannot ship without that judgement being made. Today FHIR R4 is the graded one; HL7 v2, C-CDA, X12, NCPDP and ASTM carry only the sibling parser's round-trip, and the declaration says so in those words. The verdict also records the validator version, the package version, and every external endpoint the run was configured to contact.

`docs-content/limitations.md` gains the distinction a consumer needs to read the promise correctly: which formats carry an independent external verdict, which carry only a round-trip, and what the external verdict deliberately leaves out (it runs with no terminology server, so code membership in a value set is not part of it).

Nothing about what the generator emits changed. Same seeds, same bytes.
