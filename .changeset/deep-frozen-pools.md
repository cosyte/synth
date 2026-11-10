---
"@cosyte/synth": patch
---

The exported example-code pools and the fatal-code registry are now frozen all the way down. `EXAMPLE_ASTM_TESTS` (`@cosyte/synth/astm`), `EXAMPLE_DRUGS` (`@cosyte/synth/ncpdp`) and the X12 pools `PROFESSIONAL_PROCEDURES`, `INSTITUTIONAL_PROCEDURES`, `DENTAL_PROCEDURES`, `REVENUE_CODES` and `DIAGNOSES` (`@cosyte/synth/x12`) froze the array but left each entry writable, so a JavaScript caller could rewrite an entry and change what every later call with the same seed generated. `SYNTH_FATAL_CODES` was not frozen at all, so a caller could change the code a later `SynthError` carried. Each entry and the registry are now frozen, as the other pools already were, and a write to one throws in strict mode.

No generated value, export, warning code or seed mapping changes.
