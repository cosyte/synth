---
id: generator-options
title: Generator options, kinds and profiles
sidebar_label: Options, kinds and profiles
description: "Every option each generator and corpus takes, with its default, every kind a corpus accepts, and every profile: synth's own and the parsers' it names."
---

# Generator options, kinds and profiles

This page lists every option the generators, corpora, quirk generators and pairing loops take, with
its default; every kind a corpus `mix` accepts; and every profile `@cosyte/synth` defines or names.
The [API reference](./api/README.md) holds the full signatures, generated from the source.

## Options every format shares

### Seeds

| Where                                    | `seed`                                  |
| ---------------------------------------- | --------------------------------------- |
| HL7 v2, FHIR and C-CDA generators        | optional, defaults to `0`               |
| `generateHl7(kind, seed)`                | required, the second argument           |
| X12, NCPDP and ASTM generators           | required                                |
| Quirk generators                         | optional, defaults to `0`               |
| `@cosyte/synth/deid` pairing loops       | optional, defaults to `0`               |
| Every corpus and quirk corpus            | required                                |

The same seed gives the same bytes on the same versions of `@cosyte/synth` and the parser that
builds the format.

### Corpus options

Every format's corpus (`hl7Corpus`, `fhirCorpus`, `ccdaCorpus`, `x12Corpus`, `ncpdpCorpus`,
`astmCorpus`) takes these options:

| Option   | Type      | Default                       | Meaning                                                                                                                  |
| -------- | --------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `seed`   | `number`  | required                      | The corpus seed. Each artifact gets its own seed, drawn in order from a generator seeded with it.                        |
| `count`  | `number`  | see [Kinds](#kinds)           | How many artifacts to generate.                                                                                          |
| `mix`    | kinds     | every kind of the format      | The kinds to cycle through, in order: artifact `i` is `mix[i % mix.length]`. Each entry is checked before anything is generated. |
| `verify` | `boolean` | `true`                        | Read each artifact back through its parser and record the codes it reports as the artifact's `warnings`. `false` skips the read, and every `warnings` is then empty without having been checked. |

A `mix` entry outside the format's kinds throws
[`SYNTH_UNSUPPORTED_KIND`](./fatal-codes.md#synth_unsupported_kind).

An empty `mix` (`mix: []`) throws [`SYNTH_EMPTY_POOL`](./fatal-codes.md#synth_empty_pool) in every
format, whatever the `count`, before anything is generated. It names no kind to cycle through, so it
is never read as the default mix and never filled with a kind you did not ask for. Leave `mix` out
for the default.

### Quirk corpus options

`hl7QuirkCorpus`, `ccdaQuirkCorpus` and `astmQuirkCorpus` take these options:

| Option    | Type           | Default                                | Meaning                                                    |
| --------- | -------------- | -------------------------------------- | ---------------------------------------------------------- |
| `seed`    | `number`       | required                               | The corpus seed.                                           |
| `count`   | `number`       | the number of quirks in use            | How many quirk artifacts to generate.                      |
| `quirks`  | quirk names    | every quirk in the format's registry   | The quirks to cycle through.                               |
| `profile` | `SynthProfile` | none                                   | A profile whose `quirks` drive the corpus. When given, `quirks` is ignored. |

`hl7QuirkCorpus` also takes `kind` (default `"ORU^R01"`), and `ccdaQuirkCorpus` takes `documentType`
(default `"ccd"`): the clean base each quirk is put into. A quirk name outside the format's registry
throws [`SYNTH_UNSUPPORTED_QUIRK`](./fatal-codes.md#synth_unsupported_quirk).

An empty `quirks` list, or a `profile` whose `quirks` list is empty, throws
[`SYNTH_EMPTY_POOL`](./fatal-codes.md#synth_empty_pool), whatever the `count`, before anything is
generated. It is never read as every quirk: leave `quirks` and `profile` out for that.

## Kinds

The kinds each corpus accepts in `mix`, which are also the `kind` label on each artifact.

| Format | Corpus        | Kinds, in default order                                                                                                                                                | Default `count`     |
| ------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| HL7 v2 | `hl7Corpus`   | `ADT^A01`, `ADT^A04`, `ADT^A08`, `ORU^R01`, `ORM^O01`, `SIU^S12`, `VXU^V04`                                                                                             | `1`                 |
| FHIR   | `fhirCorpus`  | `USCorePatient`, `Condition`, `ObservationLab`, `VitalSign`, `MedicationRequest`, `Encounter`, `Immunization`, `AllergyIntolerance`, `Procedure`, `DiagnosticReport`, `Bundle` | `1`                 |
| C-CDA  | `ccdaCorpus`  | `ccd`, `referralNote`                                                                                                                                                  | `1`                 |
| X12    | `x12Corpus`   | `837P`, `837I`, `837D`, `835`, `271`                                                                                                                                   | the length of `mix` |
| NCPDP  | `ncpdpCorpus` | `NewRx`, `RxRenewalRequest`, `RxChangeRequest`, `B1`, `B2`, `B3`                                                                                                       | the length of `mix` |
| ASTM   | `astmCorpus`  | `Result`, `Order`                                                                                                                                                      | the length of `mix` |

`hl7Corpus` also accepts ten kinds that are not in its default mix, so a seed's default corpus does
not change as kinds are added: `ACK`, `ADT^A02`, `ADT^A03`, `ADT^A11`, `ADT^A13`, `ADT^A28`,
`ADT^A31`, `MDM^T02`, `DFT^P03` and `OML^O21`. `HL7_MESSAGE_KINDS` lists all seventeen; pass it as
`mix` to cycle through every one.

`fhirCorpus` also accepts two kinds that are not in its default mix: `Patient` (a base R4 Patient
with no US Core profile) and `DocumentBundle` (a `document` Bundle). `Bundle` is a `collection`
Bundle.

`hl7Corpus` also takes `triggers`, a list of ADT trigger events (any `trigger` `generateAdt`
accepts). When given, it takes the place of `mix` and the corpus holds only `ADT` messages. An empty `triggers` list throws
[`SYNTH_EMPTY_POOL`](./fatal-codes.md#synth_empty_pool), as an empty `mix` does.

## HL7 v2 options

Subpath `@cosyte/synth/hl7`, built through `@cosyte/hl7`.

| Generator          | Options                    | Defaults           | Returns      |
| ------------------ | -------------------------- | ------------------ | ------------ |
| `generateAdt`      | `seed`, `trigger`          | `0`, `"A01"`       | `Hl7Message` |
| `generateOru`      | `seed`                     | `0`                | `Hl7Message` |
| `generateOrm`      | `seed`                     | `0`                | `Hl7Message` |
| `generateSiu`      | `seed`                     | `0`                | `Hl7Message` |
| `generateVxu`      | `seed`                     | `0`                | `Hl7Message` |
| `generateMdm`      | `seed`                     | `0`                | `Hl7Message` |
| `generateDft`      | `seed`                     | `0`                | `Hl7Message` |
| `generateOml`      | `seed`                     | `0`                | `Hl7Message` |
| `generateAck`      | `seed`, `inbound`, `code`  | `0`, the `ADT^A01` from `seed`, `"AA"` | `Hl7Message` |
| `generateHl7`      | `(kind, seed)`             | none               | `Hl7Message` |
| `generateHl7Quirk` | `seed`, `quirk`, `kind`    | `0`, required, `"ORU^R01"` | `QuirkArtifact` |

`trigger` is `"A01"`, `"A02"`, `"A03"`, `"A04"`, `"A08"`, `"A11"`, `"A13"`, `"A28"` or `"A31"`.
`code` is `"AA"`, `"AE"` or `"AR"`. `generateHl7`'s `kind` is any HL7 v2 kind in the
[Kinds](#kinds) table; `generateHl7Quirk`'s is one of the seven in the default mix.
Quirk names are in the [quirk catalog](./quirk-catalog.md#hl7-v2).

## FHIR options

Subpath `@cosyte/synth/fhir`, built through `@cosyte/fhir`. Every generator returns `@cosyte/fhir`'s
resource model.

| Generator                    | Options                                    | Defaults                                                     |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `generatePatient`            | `seed`, `profile`                          | `0`, `"base"`                                                |
| `generateCondition`          | `seed`, `subject`, `usCore`                | `0`, `"Patient/syn-patient-1"`, `true`                       |
| `generateObservationLab`     | `seed`, `subject`, `usCore`                | `0`, `"Patient/syn-patient-1"`, `true`                       |
| `generateVitalSign`          | `seed`, `subject`, `usCore`                | `0`, `"Patient/syn-patient-1"`, `true`                       |
| `generateMedicationRequest`  | `seed`, `subject`, `requester`, `usCore`   | `0`, `"Patient/syn-patient-1"`, `"Practitioner/syn-practitioner-1"`, `true` |
| `generateEncounter`          | `seed`, `subject`, `usCore`                | `0`, `"Patient/syn-patient-1"`, `true`                       |
| `generateDiagnosticReport`   | `seed`, `subject`, `results`, `usCore`     | `0`, `"Patient/syn-patient-1"`, `[]`, `true`                 |
| `generateImmunization`       | `seed`, `patient`, `usCore`                | `0`, `"Patient/syn-patient-1"`, `true`                       |
| `generateAllergyIntolerance` | `seed`, `patient`, `usCore`                | `0`, `"Patient/syn-patient-1"`, `true`                       |
| `generateProcedure`          | `seed`, `subject`, `usCore`                | `0`, `"Patient/syn-patient-1"`, `true`                       |
| `generateProvenance`         | `seed`, `target`, `usCore`                 | `0`, `"Patient/syn-patient-1"`, `true`                       |
| `generateBundle`             | `seed`, `type`                             | `0`, `"collection"`                                          |
| `generateUsCoreProfile`      | `profile`, `seed`                          | required, `0`                                                |

- `profile` on `generatePatient` is `"base"` (a base R4 Patient) or `"us-core"` (adds the US Core
  `meta.profile` and the race, ethnicity and birth sex extensions).
- `usCore` adds the resource's US Core profile to `meta.profile` when `true`.
- `subject`, `patient`, `requester` and `target` are reference strings, such as
  `"Patient/syn-patient-1"` or a `urn:uuid:` full URL.
- `results` is a list of references to the report's `Observation`s; empty leaves `result` out.
- `type` on `generateBundle` is `"collection"`, `"transaction"` or `"document"`.
- `roundTrip(resource, { profiles })` takes the `StructureDefinition`s to validate against. None is
  bundled.

## C-CDA options

Subpath `@cosyte/synth/ccda`, built through `@cosyte/ccda`. Every generator returns `@cosyte/ccda`'s
document model, except the quirk generator.

| Generator              | Options                            | Defaults               | Returns         |
| ---------------------- | ---------------------------------- | ---------------------- | --------------- |
| `generateCcd`          | `seed`                             | `0`                    | `CcdaDocument`  |
| `generateReferralNote` | `seed`                             | `0`                    | `CcdaDocument`  |
| `generateCcda`         | `seed`, `documentType`             | `0`, `"ccd"`           | `CcdaDocument`  |
| `generateCcdaQuirk`    | `seed`, `quirk`, `documentType`    | `0`, required, `"ccd"` | `QuirkArtifact` |

`documentType` is `"ccd"` or `"referralNote"`. Quirk names are in the
[quirk catalog](./quirk-catalog.md#c-cda).

## X12 options

Subpath `@cosyte/synth/x12`, built through `@cosyte/x12`. Every generator returns `@cosyte/x12`'s
interchange model, and every option object holds only `seed`, which is required.

| Generator                  | Transaction                                   |
| -------------------------- | --------------------------------------------- |
| `generate837P`             | 837 professional claim                        |
| `generate837I`             | 837 institutional claim                       |
| `generate837D`             | 837 dental claim                              |
| `generate837(variant, …)`  | the 837 named by `variant`: `"P"`, `"I"` or `"D"` |
| `generate835`              | 835 remittance                                |
| `generate271`              | 271 eligibility response                      |

## NCPDP options

Subpath `@cosyte/synth/ncpdp`, built through `@cosyte/ncpdp`. Every generator returns the serialized
message as a string, and every option object holds only `seed`, which is required.

| Generator                    | Message                                                |
| ---------------------------- | ------------------------------------------------------ |
| `generateNewRx`              | SCRIPT NewRx                                           |
| `generateRxRenewalRequest`   | SCRIPT RxRenewalRequest                                |
| `generateRxChangeRequest`    | SCRIPT RxChangeRequest                                 |
| `generateB1`                 | Telecom billing                                        |
| `generateB2`                 | Telecom reversal                                       |
| `generateB3`                 | Telecom rebill                                         |
| `generateTelecom(code, …)`   | the Telecom transaction named by `code`: `"B1"`, `"B2"` or `"B3"` |

## ASTM options

Subpath `@cosyte/synth/astm`, built through `@cosyte/astm`.

| Generator                  | Options                         | Defaults                         | Returns         |
| -------------------------- | ------------------------------- | -------------------------------- | --------------- |
| `generateAstmResult`       | `seed`, `resultCount`, `comment` | required, 1 to 4 from the seed, `true` | `string`  |
| `generateAstmOrder`        | `seed`                          | required                         | `string`        |
| `generateAstmResultFramed` | `seed`, `resultCount`, `comment` | required, 1 to 4 from the seed, `true` | `Uint8Array` |
| `generateAstmQuirk`        | `seed`, `quirk`, `kind`         | `0`, required, `"Result"`        | `QuirkArtifact` |

- `resultCount` is the number of `R` records; `comment` adds a `C` record after them.
- `generateAstmOrder` takes the same options type and ignores `resultCount` and `comment`: an order
  has no results and no comment.
- `kind` on `generateAstmQuirk` admits only `"Result"`: both ASTM quirks change records only a
  result report carries.

Quirk names are in the [quirk catalog](./quirk-catalog.md#astm).

## Pairing loop options

Subpath `@cosyte/synth/deid`, run through `@cosyte/deid`.

| Loop                   | Options                     | Defaults            | Values                                    |
| ---------------------- | --------------------------- | ------------------- | ----------------------------------------- |
| `hl7DeidLoop`          | `seed`, `kind`              | `0`, `"ORU^R01"`    | any HL7 v2 kind                           |
| `fhirDeidLoop`         | `seed`                      | `0`                 |                                           |
| `x12DeidLoop`          | `seed`, `variant`           | `0`, `"837P"`       | `"837P"`, `"837I"`, `"837D"`, `"271"`, `"835"` |
| `ncpdpTelecomDeidLoop` | `seed`, `transaction`       | `0`, `"B1"`         | `"B1"`, `"B2"`, `"B3"`                    |
| `ccdaDeidLoop`         | `seed`, `documentType`      | `0`, `"ccd"`        | `"ccd"`, `"referral"`                     |

The loops do not check `variant`, `transaction` or `documentType` against their sets the way the
generators do. [What it does and does not do](./limitations.md#the-synthetic-safety-posture-the-floors)
says what each does with a value outside its set.

## Profiles

Three different things are called a profile. Each is listed here.

### Synth profiles

A synth profile names a set of quirks once, for a quirk corpus. `defineSynthProfile(spec)` returns
a frozen `SynthProfile`.

| Field         | Type       | Required | Meaning                                                                                     |
| ------------- | ---------- | -------- | ------------------------------------------------------------------------------------------- |
| `name`        | `string`   | yes      | The profile's name. A missing or blank name throws [`SYNTH_INVALID_PROFILE`](./fatal-codes.md#synth_invalid_profile). |
| `quirks`      | `string[]` | no       | The quirks a quirk corpus applies. Checked against the format's registry when a corpus uses the profile. Left out, the corpus uses its own `quirks` option or every quirk; an empty list throws [`SYNTH_EMPTY_POOL`](./fatal-codes.md#synth_empty_pool). |
| `givenNames`  | `string[]` | no       | Stored on the profile. No generator reads it in this release.                               |
| `familyNames` | `string[]` | no       | Stored on the profile. No generator reads it in this release.                               |

The built-in synth profiles, one per format with quirks, each naming every quirk in its registry:

| Profile            | `name`               | Subpath              |
| ------------------ | -------------------- | -------------------- |
| `hl7QuirkProfile`  | `cosyte-hl7-quirks`  | `@cosyte/synth/hl7`  |
| `ccdaQuirkProfile` | `cosyte-ccda-quirks` | `@cosyte/synth/ccda` |
| `astmQuirkProfile` | `cosyte-astm-quirks` | `@cosyte/synth/astm` |

### Parser profiles

A parser profile belongs to the parser, not to `@cosyte/synth`: it tells the parser which
deviations to tolerate. A quirk round trip parses the fixture twice, once with no profile and once
under the built-in public profile that tolerates the quirk, and reports both.

| Parser          | Profile           | Tolerates                                          | How        |
| --------------- | ----------------- | -------------------------------------------------- | ---------- |
| `@cosyte/hl7`   | `visage`          | `unknown-zsegment`                                 | suppressed |
| `@cosyte/ccda`  | `legacyR11`       | `template-extension-absent`                        | re-badged  |
| `@cosyte/ccda`  | `smartScorecard`  | `deprecated-loinc`, `deprecated-code-system`       | re-badged  |
| `@cosyte/astm`  | `referenceCorpus` | `unknown-escape`                                   | re-badged  |

Suppressed means the warning is dropped; re-badged means it is replaced by `PROFILE_QUIRK_APPLIED`.
The HL7 v2 `unknown-escape` and ASTM `unknown-record-type` quirks have no tolerating profile.

### US Core profiles

The FHIR subpath generates 11 of the 49 resource profiles US Core 6.1.0 publishes. Ask for one by
its id with `generateUsCoreProfile({ profile, seed })`; `usCoreCoverage()` lists all 49, each with
its `profile` id, its `canonical` URL and whether this build has it `generated`.

| Profile id                                   | Generated by                |
| -------------------------------------------- | --------------------------- |
| `us-core-allergyintolerance`                 | `generateAllergyIntolerance` |
| `us-core-condition-problems-health-concerns` | `generateCondition`         |
| `us-core-diagnosticreport-lab`               | `generateDiagnosticReport`  |
| `us-core-encounter`                          | `generateEncounter`         |
| `us-core-immunization`                       | `generateImmunization`      |
| `us-core-medicationrequest`                  | `generateMedicationRequest` |
| `us-core-observation-lab`                    | `generateObservationLab`    |
| `us-core-patient`                            | `generatePatient`           |
| `us-core-procedure`                          | `generateProcedure`         |
| `us-core-provenance`                         | `generateProvenance`        |
| `us-core-vital-signs`                        | `generateVitalSign`         |

Another profile the guide publishes throws
[`SYNTH_PROFILE_NOT_GENERATED`](./fatal-codes.md#synth_profile_not_generated); a name it does not
publish throws [`SYNTH_UNSUPPORTED_KIND`](./fatal-codes.md#synth_unsupported_kind).

```ts runnable
import { usCoreCoverage } from "@cosyte/synth/fhir";

const generated = usCoreCoverage().filter((entry) => entry.generated);

generated.map((entry) => entry.profile); // => ["us-core-allergyintolerance", "us-core-condition-problems-health-concerns", "us-core-diagnosticreport-lab", "us-core-encounter", "us-core-immunization", "us-core-medicationrequest", "us-core-observation-lab", "us-core-patient", "us-core-procedure", "us-core-provenance", "us-core-vital-signs"]
```

## Related

- Reference: [`Hl7CorpusOptions`](./api/src/hl7.md#hl7corpusoptions),
  [`FhirCorpusOptions`](./api/src/fhir.md#fhircorpusoptions),
  [`CcdaCorpusOptions`](./api/src/ccda.md#ccdacorpusoptions),
  [`X12CorpusOptions`](./api/src/x12.md#x12corpusoptions),
  [`NcpdpCorpusOptions`](./api/src/ncpdp.md#ncpdpcorpusoptions),
  [`AstmCorpusOptions`](./api/src/astm.md#astmcorpusoptions),
  [`GenerateAstmOptions`](./api/src/astm.md#generateastmoptions),
  [`defineSynthProfile`](./api/src.md#definesynthprofile), and
  [`generateUsCoreProfile`](./api/src/fhir.md#generateuscoreprofile).
- [Quirk catalog](./quirk-catalog.md): every quirk, its warning and its profile.
- [Glossary](./glossary.md): what a kind, a quirk and a profile are.
