---
"@cosyte/synth": patch
---

Generated C-CDA documents change: the parser peers are bounded to their 0.1 releases, and `@cosyte/ccda` 0.1 builds each CCD and Referral Note differently for the same seed.

What changes for a consumer:

- **C-CDA output, for every seed.** The documents are built by `@cosyte/ccda` 0.1, whose builder writes more of what C-CDA R2.1 asks for. Against the same seed on the previous release: the patient gains `raceCode` and `ethnicGroupCode` with `nullFlavor="UNK"`; the author gains a `representedOrganization`; a CCD gains a `documentationOf` service event and a Referral Note an `informationRecipient`, each with unknown values; problem and allergy concern acts gain the `CONC` code; allergy reaction observations gain an `id`, which shifts the generated ids after them; the Medications section's templateIds move to the 2014-06-09 extension; the vital signs organizer is coded with LOINC 74728-7 instead of SNOMED CT 46680005; immunizations carry `negationInd="false"`; results organizers carry an `effectiveTime` interval with an unknown end; and the Social History section moves earlier in the document. A C-CDA golden file committed from an earlier release no longer matches and has to be regenerated. Every value stays synthetic.
- **The other formats are unchanged.** HL7 v2, FHIR R4 and US Core, X12, NCPDP, and ASTM documents are byte-identical for the seeds the determinism baseline records, and their committed golden files still match.
- **Peer ranges.** `@cosyte/hl7`, `@cosyte/fhir`, `@cosyte/ccda`, `@cosyte/x12`, `@cosyte/ncpdp`, `@cosyte/astm` and `@cosyte/deid` move from `>=0.0.0` (or `>=0.0.1`) to `^0.1.0`, the releases this package is tested against. A project that pins one of them to a 0.0.x release has to move it to 0.1 to install this version.
