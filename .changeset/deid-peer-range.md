---
"@cosyte/synth": patch
---

`@cosyte/synth` now installs beside `@cosyte/deid` 0.2. The `@cosyte/deid` peer range is `^0.1.5 || ^0.2.0`, where it was `^0.1.5`, so npm no longer refuses the install with ERESOLVE when a project already has deid 0.2.3. The tests now run against `@cosyte/deid` 0.2.3, and a new workflow installs the lowest and the highest version the range admits and runs the de-identification loop against each.

Generated 837P, 837I and 837D claims now write each ICD-10-CM diagnosis code in `HI` without its decimal point (`HI*ABK:J209`, not `HI*ABK:J20.9`), as the 005010 claim guides transmit it. `@cosyte/deid` 0.2 removes a diagnosis code that has a decimal point, which made the X12 pairing loop report clinical codes as scrubbed. The exported `DIAGNOSES` pool (`@cosyte/synth/x12`) holds the same codes in that form: a caller that compared a generated code with `J20.9` must compare with `J209`, or remove the point first.

Output change: X12. Every generated 837P, 837I and 837D whose diagnosis code has a decimal point, and every X12 corpus that holds one, carries its diagnosis codes without the decimal point; nothing else in them moves. The X12 de-identification loop results move with it and with deid 0.2's X12 pass. An 837 golden file committed from an earlier release has to be regenerated. HL7 v2, FHIR R4 and US Core, C-CDA, NCPDP and ASTM output is byte for byte what it was for the same seed.
