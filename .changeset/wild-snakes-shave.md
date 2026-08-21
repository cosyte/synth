---
"@cosyte/synth": patch
---

Synthetic SSNs now clear both federal authorities that share the SSN number space, not just SSA's. An IRS ITIN is itself an SSN-format number beginning with `9`, so the never-issued `900-999` area alone never ruled one out: 44 of the 100 group values placed a generated value inside a published ITIN group range, and the fixed advertising block sat inside one for every seed. `safe.ssn()` now draws its group only from values outside every published ITIN group range (and outside the two the IRS reserves for other programs), and its fixed block is `987-00-4320` through `987-00-4329`. No draw can produce an ITIN-shaped candidate, so generation still returns a value for every seed.

New exports: `isItinFormatted(value)` and `ITIN_GROUP_RANGES`, so a consumer can assert the second half of the guarantee directly (`isSyntheticSsn(v) && !isItinFormatted(v)`). The synthetic-safety sweeps for HL7 v2, FHIR, C-CDA, X12, the cross-format suite and the de-identification pairing loop now fail on an ITIN-formatted value at an SSN-bearing locus, over arbitrary seeds.

`ssn(rng, "advertising")` keeps its name and its shape (a fixed ten-value display block) but loses one property: its old value was the block the Social Security Administration itself prints in advertising, and that block is ITIN-formatted, so it could not stay. If you chose that option because the number is the one SSA publishes, it no longer is. The option name is unchanged so no call site breaks.

If you pin a golden corpus: this changes more than the SSN field. The default block now takes one random draw fewer than before (a single pick from the safe group pool replaced two independent group digits), so **every value drawn after an SSN in the same seeded stream moves too**: identifiers, codes, amounts and timestamps in an affected artifact all regenerate with different bytes, not only its SSN.
