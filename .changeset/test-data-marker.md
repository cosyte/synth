---
"@cosyte/synth": patch
---

Every artifact now says it is test data, in the field its standard gives for that, so a generated fixture that ends up somewhere real can be told apart from production data. HL7 v2 messages declared processing ID `P` (production) in MSH-11; X12 already set ISA-15 to `T`.

Output change: HL7 v2 messages set MSH-11 to `T` where it was `P`. Every FHIR resource, every resource inside a Bundle and the Bundle itself carry `meta.security` with the `HTEST` ("test health data") code from `http://terminology.hl7.org/CodeSystem/v3-ActReason`, so a resource built with `usCore: false` and a base Patient now carry a `meta` too, and the document Bundle's Organization and Composition carry one. ASTM messages set the header's processing ID (H.12) to `T`, so the `H` record gains the empty fields H.6 to H.11 before it. C-CDA, X12 and NCPDP output is unchanged. A golden file committed from an earlier release for HL7 v2, FHIR or ASTM has to be regenerated.

The marker is always on: there is no option to turn it off. The exported `meta(profiles)` helper in `@cosyte/synth/fhir` now adds the `HTEST` label as well, and accepts an empty list, which leaves `meta.profile` out. If your code reads `meta` from a generated resource and expected only `profile`, read `meta.profile` by name.
