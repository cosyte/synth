---
"@cosyte/synth": patch
---

Three generated values now follow their standards: the X12 271 benefit percent, the NCPDP Telecom Quantity Dispensed and the ASTM header sender.

- X12 271: EB-08 (benefit percent) is a decimal fraction, so it is now written as `.8`, `.9` or `1` instead of `80`, `90` or `100`.
- NCPDP Telecom: 442-E7 (Quantity Dispensed) carries three implied decimals, so a quantity of 37 is now written as `37000` instead of `37`. It reads back through `@cosyte/ncpdp` as `37.000`.
- ASTM: the sender name now sits in H.5 (Sender Name or ID). Before, the sender went to H.3 (Message Control ID) and the analyzer string to H.4 (Access Password). H.3 and H.4 are now empty, and the analyzer string is no longer written to the header. `astmHeaderIdentity` still returns both strings.

Output change: X12, NCPDP and ASTM. For the same seed, every generated 271, every B1 and B3 Telecom claim, and every ASTM result, order, framed and quirk message changes in the values above, and so do the corpora and de-identification loop results built from them. Every other generated artifact is byte for byte what it was for the same seed. If you commit golden files from an earlier release, regenerate each 271, B1, B3 and ASTM golden file from its seed with this release and commit the new bytes.
