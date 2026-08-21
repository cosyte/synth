---
"@cosyte/synth": patch
---

Synthetic SSNs now clear both federal authorities that share the SSN number space, not just SSA's. An IRS ITIN is itself an SSN-format number beginning with `9`, so the never-issued `900-999` area alone never ruled one out: 44 of the 100 group values placed a generated value inside a published ITIN group range, and the fixed advertising block sat inside one for every seed. `safe.ssn()` now draws its group only from values outside every published ITIN group range (and outside the two the IRS reserves for other programs), and its fixed block is `987-00-4320` through `987-00-4329`. No draw can produce an ITIN-shaped candidate, so generation still returns a value for every seed.

New exports: `isItinFormatted(value)` and `ITIN_GROUP_RANGES`, so a consumer can assert the second half of the guarantee directly (`isSyntheticSsn(v) && !isItinFormatted(v)`). The synthetic-safety sweeps for HL7 v2, FHIR, C-CDA, X12 and the cross-format suite now fail on an ITIN-formatted value at an SSN-bearing locus, over arbitrary seeds.

If you pin a golden corpus: this changes the seed-to-value mapping wherever a generated SSN appears, so an affected fixture regenerates with different bytes.
