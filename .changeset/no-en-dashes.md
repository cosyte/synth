---
"@cosyte/synth": patch
---

Doc comments that ship in the type declarations now write a range with "to" instead of an en dash, for example "the `0` to `7` frame number" and "a seeded 1 to 4".

No generated value, export, warning code or seed mapping changes. The README and the documentation pages get the same edit, and the repository's dash check now refuses the en dash, literal or encoded, as it already refused the em dash.
