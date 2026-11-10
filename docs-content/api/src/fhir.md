# src/fhir

`@cosyte/synth/fhir`: the FHIR R4 / US Core generation surface, exposed as its own subpath so
importing the package root does **not** pull `@cosyte/fhir`. This is the **lazy, per-format**
boundary: a consumer who only needs FHIR fixtures imports `@cosyte/synth/fhir`; one who needs only
the core primitives never loads a parser. `@cosyte/fhir` is an **optional peer dependency**: present only
for this subpath.

This subpath ships the US Core clinical set: `Patient` (base + US Core), `Condition`, `Observation`
(US Core Laboratory Result + US Core Vital Signs), `MedicationRequest`, `Encounter`,
`DiagnosticReport` (Laboratory), `Immunization`, `AllergyIntolerance`, `Procedure`, `Provenance`,
plus the `collection`, `transaction` and `document` Bundle shapes (the last a `Composition` + the
wired spine). Each is built through `@cosyte/fhir`'s
model constructors so it is **spec-clean by construction**, validating clean under
`@cosyte/fhir.validateResource` and, against caller-supplied (BYO) US Core `StructureDefinition`s,
conformant to US Core 6.1.0. Quirk generation is deferred.

A fixture can also be addressed **by US Core 6.1.0 profile name** rather than by generator name:
`generateUsCoreProfile` resolves the requested profile against the adopted set before generating
anything, and `usCoreCoverage` reports, for every profile the guide publishes, whether this build
generates it. See `./coverage.js`.

## Interfaces

### BuildCompositionInput

Inputs for [buildComposition](#buildcomposition).

#### Properties

##### date

> `readonly` **date**: `string`

The document date (`YYYY-MM-DD`).

##### organization

> `readonly` **organization**: `string`

The `author` + `custodian` reference (an in-bundle Organization fullUrl).

##### sections

> `readonly` **sections**: readonly [`CompositionSection`](#compositionsection)[]

The document sections.

##### subject

> `readonly` **subject**: `string`

The `subject` reference (the patient's in-bundle fullUrl).

***

### CodeConcept

A coded concept: a `system` URI, a `code`, and its human-readable `display`.

#### Extended by

- [`QuantConcept`](#quantconcept)

#### Properties

##### code

> `readonly` **code**: `string`

The code value (`Coding.code`).

##### display

> `readonly` **display**: `string`

The human-readable display text (`Coding.display`).

##### system

> `readonly` **system**: `string`

The code-system URI (`Coding.system`).

***

### CompositionSection

A document section: a LOINC section code, a human title, and the entry references it summarizes.

#### Properties

##### code

> `readonly` **code**: `string`

The LOINC section code.

##### entries

> `readonly` **entries**: readonly `string`[]

In-bundle `urn:uuid:` references to the resources the section summarizes.

##### title

> `readonly` **title**: `string`

The section's human title / display.

***

### FhirCorpusOptions

Options for [fhirCorpus](#fhircorpus).

#### Properties

##### count?

> `readonly` `optional` **count?**: `number`

How many resources to generate. Defaults to `1`.

##### mix?

> `readonly` `optional` **mix?**: readonly [`FhirResourceKind`](#fhirresourcekind)[]

The resource kinds to cycle through. Defaults to the full US Core clinical spine + a Bundle.

##### seed

> `readonly` **seed**: `number`

The seed for the whole corpus (deterministic).

***

### FhirPatientIdentity

A synthetic FHIR patient identity: every field drawn from `../safe`.

#### Properties

##### address

> `readonly` **address**: [`SyntheticAddress`](../src.md#syntheticaddress)

Synthetic postal address (reserved non-real ZIP).

##### birthDate

> `readonly` **birthDate**: `string`

Date of birth as a FHIR `date` (`YYYY-MM-DD`) from the seeded generator.

##### email

> `readonly` **email**: `string`

Synthetic email at a reserved (`example.*`) domain.

##### gender

> `readonly` **gender**: `"male"` \| `"female"`

FHIR administrative-gender code.

##### id

> `readonly` **id**: `string`

A synthetic resource `id` (a seeded UUID), never a real record key.

##### mrn

> `readonly` **mrn**: [`SyntheticIdentifier`](../src.md#syntheticidentifier)

Medical-record identifier scoped to the synthetic assigning authority.

##### person

> `readonly` **person**: [`SyntheticName`](../src.md#syntheticname)

Name from the shipped fake-name pool.

##### phone

> `readonly` **phone**: `string`

Reserved `555-01xx` phone number.

***

### GenerateAllergyIntoleranceOptions

Options for [generateAllergyIntolerance](#generateallergyintolerance).

#### Properties

##### patient?

> `readonly` `optional` **patient?**: `string`

The `patient` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl).

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

##### usCore?

> `readonly` `optional` **usCore?**: `boolean`

Whether to claim US Core via `meta.profile`. Defaults to `true`.

***

### GenerateBundleOptions

Options for [generateBundle](#generatebundle).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

##### type?

> `readonly` `optional` **type?**: [`FhirBundleType`](#fhirbundletype)

The Bundle shape. Defaults to `"collection"`.

***

### GenerateConditionOptions

Options for [generateCondition](#generatecondition).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

##### subject?

> `readonly` `optional` **subject?**: `string`

The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl).

##### usCore?

> `readonly` `optional` **usCore?**: `boolean`

Whether to claim US Core via `meta.profile`. Defaults to `true`.

***

### GenerateDiagnosticReportOptions

Options for [generateDiagnosticReport](#generatediagnosticreport).

#### Properties

##### results?

> `readonly` `optional` **results?**: readonly `string`[]

`result` references to the report's `Observation`s (empty ⇒ omitted).

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

##### subject?

> `readonly` `optional` **subject?**: `string`

The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl).

##### usCore?

> `readonly` `optional` **usCore?**: `boolean`

Whether to claim US Core via `meta.profile`. Defaults to `true`.

***

### GenerateEncounterOptions

Options for [generateEncounter](#generateencounter).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

##### subject?

> `readonly` `optional` **subject?**: `string`

The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl).

##### usCore?

> `readonly` `optional` **usCore?**: `boolean`

Whether to claim US Core via `meta.profile`. Defaults to `true`.

***

### GenerateImmunizationOptions

Options for [generateImmunization](#generateimmunization).

#### Properties

##### patient?

> `readonly` `optional` **patient?**: `string`

The `patient` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl).

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

##### usCore?

> `readonly` `optional` **usCore?**: `boolean`

Whether to claim US Core via `meta.profile`. Defaults to `true`.

***

### GenerateMedicationRequestOptions

Options for [generateMedicationRequest](#generatemedicationrequest).

#### Properties

##### requester?

> `readonly` `optional` **requester?**: `string`

The `requester` reference. Defaults to a synthetic `Practitioner` reference.

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

##### subject?

> `readonly` `optional` **subject?**: `string`

The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl).

##### usCore?

> `readonly` `optional` **usCore?**: `boolean`

Whether to claim US Core via `meta.profile`. Defaults to `true`.

***

### GenerateObservationOptions

Options for [generateObservationLab](#generateobservationlab) / [generateVitalSign](#generatevitalsign).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

##### subject?

> `readonly` `optional` **subject?**: `string`

The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl).

##### usCore?

> `readonly` `optional` **usCore?**: `boolean`

Whether to claim US Core via `meta.profile`. Defaults to `true`.

***

### GeneratePatientOptions

Options for [generatePatient](#generatepatient).

#### Properties

##### profile?

> `readonly` `optional` **profile?**: `"base"` \| `"us-core"`

The profile posture. `"base"` (default) emits a spec-clean base-R4 `Patient`; `"us-core"` adds the
US Core `meta.profile` and the race/ethnicity/birthsex must-support extensions (the required
elements, identifier/name/gender, are always present).

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

***

### GenerateProcedureOptions

Options for [generateProcedure](#generateprocedure).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

##### subject?

> `readonly` `optional` **subject?**: `string`

The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl).

##### usCore?

> `readonly` `optional` **usCore?**: `boolean`

Whether to claim US Core via `meta.profile`. Defaults to `true`.

***

### GenerateProvenanceOptions

Options for [generateProvenance](#generateprovenance).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

##### target?

> `readonly` `optional` **target?**: `string`

The `target` reference this provenance is about (e.g. `"Patient/syn-patient-1"`).

##### usCore?

> `readonly` `optional` **usCore?**: `boolean`

Whether to claim US Core via `meta.profile`. Defaults to `true`.

***

### GenerateUsCoreProfileOptions

Options for [generateUsCoreProfile](#generateuscoreprofile).

#### Properties

##### profile

> `readonly` **profile**: `"head-occipital-frontal-circumference-percentile"` \| `"pediatric-bmi-for-age"` \| `"pediatric-weight-for-height"` \| `"us-core-allergyintolerance"` \| `"us-core-blood-pressure"` \| `"us-core-bmi"` \| `"us-core-body-height"` \| `"us-core-body-temperature"` \| `"us-core-body-weight"` \| `"us-core-careplan"` \| `"us-core-careteam"` \| `"us-core-condition-encounter-diagnosis"` \| `"us-core-condition-problems-health-concerns"` \| `"us-core-coverage"` \| `"us-core-diagnosticreport-lab"` \| `"us-core-diagnosticreport-note"` \| `"us-core-documentreference"` \| `"us-core-encounter"` \| `"us-core-goal"` \| `"us-core-head-circumference"` \| `"us-core-heart-rate"` \| `"us-core-immunization"` \| `"us-core-implantable-device"` \| `"us-core-location"` \| `"us-core-medication"` \| `"us-core-medicationdispense"` \| `"us-core-medicationrequest"` \| `"us-core-observation-clinical-result"` \| `"us-core-observation-lab"` \| `"us-core-observation-occupation"` \| `"us-core-observation-pregnancyintent"` \| `"us-core-observation-pregnancystatus"` \| `"us-core-observation-screening-assessment"` \| `"us-core-observation-sexual-orientation"` \| `"us-core-organization"` \| `"us-core-patient"` \| `"us-core-practitioner"` \| `"us-core-practitionerrole"` \| `"us-core-procedure"` \| `"us-core-provenance"` \| `"us-core-pulse-oximetry"` \| `"us-core-questionnaireresponse"` \| `"us-core-relatedperson"` \| `"us-core-respiratory-rate"` \| `"us-core-servicerequest"` \| `"us-core-simple-observation"` \| `"us-core-smokingstatus"` \| `"us-core-specimen"` \| `"us-core-vital-signs"`

The US Core 6.1.0 profile id to generate. Resolved against the adopted set **before** anything is
generated; there is deliberately no default, so a blank or absent name refuses rather than
falling through to some other profile's artifact.

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic). Defaults to `0`.

***

### QuantConcept

A quantitative observation concept: a LOINC code plus the UCUM unit and a plausible synthetic value
range the seeded generator draws within. The range implies **no** real measurement: it only keeps a
generated result inside a structurally-sane band.

#### Extends

- [`CodeConcept`](#codeconcept)

#### Properties

##### code

> `readonly` **code**: `string`

The code value (`Coding.code`).

###### Inherited from

[`CodeConcept`](#codeconcept).[`code`](#code)

##### decimals

> `readonly` **decimals**: `number`

Decimal places to render (keeps the emitted `decimal` lexical form stable and realistic).

##### display

> `readonly` **display**: `string`

The human-readable display text (`Coding.display`).

###### Inherited from

[`CodeConcept`](#codeconcept).[`display`](#display)

##### high

> `readonly` **high**: `number`

Inclusive upper bound of the synthetic value (in `unit`).

##### low

> `readonly` **low**: `number`

Inclusive lower bound of the synthetic value (in `unit`).

##### system

> `readonly` **system**: `string`

The code-system URI (`Coding.system`).

###### Inherited from

[`CodeConcept`](#codeconcept).[`system`](#system)

##### unit

> `readonly` **unit**: `string`

The UCUM unit code (`Quantity.code` and, as text, `Quantity.unit`).

***

### RoundTripOptions

Options for [roundTrip](#roundtrip).

#### Properties

##### profiles?

> `readonly` `optional` **profiles?**: readonly `StructureDefinition`[]

US Core / vendor profiles (`StructureDefinition`s) to validate against. **None is bundled**: a
caller supplies them (BYO), matching `@cosyte/fhir`'s content-free posture.

***

### RoundTripResult

The verdict of one round-trip through `@cosyte/fhir`.

#### Properties

##### byteStable

> `readonly` **byteStable**: `boolean`

Whether re-serializing the re-parsed resource is byte-identical to `content`.

##### content

> `readonly` **content**: `string`

The serialized FHIR JSON text (the parser's own conservative emit).

##### errors

> `readonly` **errors**: readonly `string`[]

The validation issue codes at `error`/`fatal` severity (empty ⇒ valid). `information`/`warning`
findings (e.g. `MUST_SUPPORT_ABSENT`, `INVARIANT_UNCHECKED`, base `dom-6`) are advisory and are
excluded here: they never make a resource invalid.

##### specClean

> `readonly` **specClean**: `boolean`

`true` iff the artifact is spec-clean: **valid** (zero errors) **and** byte-stable.

##### valid

> `readonly` **valid**: `boolean`

Whether `@cosyte/fhir.validateResource` reported no `error`/`fatal` findings.

##### warnings

> `readonly` **warnings**: readonly `string`[]

All non-informational issue codes (errors **and** warnings), for the `Corpus` artifact record.

***

### UsCoreProfileCoverage

One adopted US Core 6.1.0 resource profile, and whether this build generates a fixture for it.

#### Properties

##### canonical

> `readonly` **canonical**: `string`

The profile's canonical URL: the value a generated artifact's `meta.profile` claims.

##### generated

> `readonly` **generated**: `boolean`

`true` when [generateUsCoreProfile](#generateuscoreprofile) returns an artifact for this profile.

##### profile

> `readonly` **profile**: `"head-occipital-frontal-circumference-percentile"` \| `"pediatric-bmi-for-age"` \| `"pediatric-weight-for-height"` \| `"us-core-allergyintolerance"` \| `"us-core-blood-pressure"` \| `"us-core-bmi"` \| `"us-core-body-height"` \| `"us-core-body-temperature"` \| `"us-core-body-weight"` \| `"us-core-careplan"` \| `"us-core-careteam"` \| `"us-core-condition-encounter-diagnosis"` \| `"us-core-condition-problems-health-concerns"` \| `"us-core-coverage"` \| `"us-core-diagnosticreport-lab"` \| `"us-core-diagnosticreport-note"` \| `"us-core-documentreference"` \| `"us-core-encounter"` \| `"us-core-goal"` \| `"us-core-head-circumference"` \| `"us-core-heart-rate"` \| `"us-core-immunization"` \| `"us-core-implantable-device"` \| `"us-core-location"` \| `"us-core-medication"` \| `"us-core-medicationdispense"` \| `"us-core-medicationrequest"` \| `"us-core-observation-clinical-result"` \| `"us-core-observation-lab"` \| `"us-core-observation-occupation"` \| `"us-core-observation-pregnancyintent"` \| `"us-core-observation-pregnancystatus"` \| `"us-core-observation-screening-assessment"` \| `"us-core-observation-sexual-orientation"` \| `"us-core-organization"` \| `"us-core-patient"` \| `"us-core-practitioner"` \| `"us-core-practitionerrole"` \| `"us-core-procedure"` \| `"us-core-provenance"` \| `"us-core-pulse-oximetry"` \| `"us-core-questionnaireresponse"` \| `"us-core-relatedperson"` \| `"us-core-respiratory-rate"` \| `"us-core-servicerequest"` \| `"us-core-simple-observation"` \| `"us-core-smokingstatus"` \| `"us-core-specimen"` \| `"us-core-vital-signs"`

The profile id, as the guide's artifact index spells it.

## Type Aliases

### FhirBundleType

> **FhirBundleType** = `"collection"` \| `"transaction"` \| `"document"`

The Bundle shapes `@cosyte/synth` supports.

***

### FhirResourceKind

> **FhirResourceKind** = `"Patient"` \| `"USCorePatient"` \| `"Condition"` \| `"ObservationLab"` \| `"VitalSign"` \| `"MedicationRequest"` \| `"Encounter"` \| `"Immunization"` \| `"AllergyIntolerance"` \| `"Procedure"` \| `"DiagnosticReport"` \| `"Bundle"` \| `"DocumentBundle"`

A FHIR resource kind the [fhirCorpus](#fhircorpus) can generate.

***

### Prop

> **Prop** = `object`

A named FHIR property (`{ name, value }`): the shape `complex` consumes.

#### Properties

##### name

> `readonly` **name**: `string`

##### value

> `readonly` **value**: `FhirNode`

***

### UsCoreProfileId

> **UsCoreProfileId** = *typeof* [`US_CORE_ADOPTED_PROFILES`](#us_core_adopted_profiles)\[`number`\]

One profile id from the adopted US Core 6.1.0 set. Erased at run time, so it is resolved, not trusted.

***

### UsCoreProfileUrl

> **UsCoreProfileUrl** = *typeof* [`US_CORE_PROFILE`](#us_core_profile)\[keyof *typeof* [`US_CORE_PROFILE`](#us_core_profile)\]

A US Core profile canonical URL.

## Variables

### EXAMPLE\_ALLERGENS

> `const` **EXAMPLE\_ALLERGENS**: readonly [`CodeConcept`](#codeconcept)[]

Allergen-substance example codes (for a US Core `AllergyIntolerance.code`). Public RxNorm / SNOMED CT
identifiers used as structural fillers; no terminology content is bundled.

***

### EXAMPLE\_ALLERGY\_MANIFESTATIONS

> `const` **EXAMPLE\_ALLERGY\_MANIFESTATIONS**: readonly [`CodeConcept`](#codeconcept)[]

Allergy-reaction manifestation example codes (for `AllergyIntolerance.reaction.manifestation`).
Public SNOMED CT clinical-finding identifiers used as structural fillers.

***

### EXAMPLE\_CONDITIONS

> `const` **EXAMPLE\_CONDITIONS**: readonly [`CodeConcept`](#codeconcept)[]

SNOMED CT problem/condition example codes (for a US Core `Condition.code`). Public SNOMED identifiers
used as structural fillers; `@cosyte/synth` bundles no SNOMED content.

***

### EXAMPLE\_DIAGNOSTIC\_REPORTS

> `const` **EXAMPLE\_DIAGNOSTIC\_REPORTS**: readonly [`CodeConcept`](#codeconcept)[]

LOINC diagnostic-report example codes (for a US Core Laboratory `DiagnosticReport.code`). Public LOINC
panel identifiers used as structural fillers.

***

### EXAMPLE\_ENCOUNTER\_CLASSES

> `const` **EXAMPLE\_ENCOUNTER\_CLASSES**: readonly [`CodeConcept`](#codeconcept)[]

HL7 v3 `ActCode` encounter-class example codes (for `Encounter.class`, a single `Coding`). Public
ActCode identifiers used as structural fillers.

***

### EXAMPLE\_ENCOUNTER\_TYPES

> `const` **EXAMPLE\_ENCOUNTER\_TYPES**: readonly [`CodeConcept`](#codeconcept)[]

SNOMED CT encounter-type example codes (for a US Core `Encounter.type`). Public SNOMED identifiers
used as structural fillers.

***

### EXAMPLE\_ETHNICITY\_CATEGORIES

> `const` **EXAMPLE\_ETHNICITY\_CATEGORIES**: readonly [`CodeConcept`](#codeconcept)[]

OMB ethnicity categories (US Core `us-core-ethnicity` `ombCategory`): the two OMB categories, public
code facts from the CDC Race &amp; Ethnicity code system.

***

### EXAMPLE\_LAB\_OBSERVATIONS

> `const` **EXAMPLE\_LAB\_OBSERVATIONS**: readonly [`QuantConcept`](#quantconcept)[]

LOINC laboratory-result example codes (for a US Core Laboratory Result `Observation`). Public LOINC
identifiers used purely as illustrative structural fillers, with UCUM units and synthetic value bands.

***

### EXAMPLE\_MEDICATIONS

> `const` **EXAMPLE\_MEDICATIONS**: readonly [`CodeConcept`](#codeconcept)[]

RxNorm medication example codes (for a US Core `MedicationRequest.medicationCodeableConcept`). Public
RxNorm identifiers used as structural fillers; `@cosyte/synth` bundles no RxNorm content.

***

### EXAMPLE\_PROCEDURES

> `const` **EXAMPLE\_PROCEDURES**: readonly [`CodeConcept`](#codeconcept)[]

SNOMED CT procedure example codes (for a US Core `Procedure.code`). Public SNOMED identifiers used as
structural fillers, **not** CPT (which is never bundled).

***

### EXAMPLE\_RACE\_CATEGORIES

> `const` **EXAMPLE\_RACE\_CATEGORIES**: readonly [`CodeConcept`](#codeconcept)[]

OMB race categories (US Core `us-core-race` `ombCategory`): the five OMB categories, public code
facts from the CDC Race &amp; Ethnicity code system (`urn:oid:2.16.840.1.113883.6.238`).

***

### EXAMPLE\_VACCINES

> `const` **EXAMPLE\_VACCINES**: readonly [`CodeConcept`](#codeconcept)[]

CVX vaccine-administered example codes (for a US Core `Immunization.vaccineCode`). Public CDC CVX
identifiers used as structural fillers; `@cosyte/synth` bundles no CVX content.

***

### EXAMPLE\_VITAL\_SIGNS

> `const` **EXAMPLE\_VITAL\_SIGNS**: readonly [`QuantConcept`](#quantconcept)[]

LOINC vital-sign example codes (for a US Core Vital Signs `Observation`). Public LOINC identifiers
with their required UCUM units and synthetic value bands. Simple single-value vitals only:
multi-component vitals (e.g. blood-pressure panel `85354-9`) are not generated.

***

### SYSTEM

> `const` **SYSTEM**: `Readonly`\<\{ `ADMINISTRATIVE_GENDER`: `"http://hl7.org/fhir/administrative-gender"`; `ALLERGY_CLINICAL`: `"http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical"`; `ALLERGY_VERIFICATION`: `"http://terminology.hl7.org/CodeSystem/allergyintolerance-verification"`; `CONDITION_CATEGORY`: `"http://terminology.hl7.org/CodeSystem/condition-category"`; `CONDITION_CLINICAL`: `"http://terminology.hl7.org/CodeSystem/condition-clinical"`; `CONDITION_VER_STATUS`: `"http://terminology.hl7.org/CodeSystem/condition-ver-status"`; `CVX`: `"http://hl7.org/fhir/sid/cvx"`; `DIAGNOSTIC_SERVICE_SECTION`: `"http://terminology.hl7.org/CodeSystem/v2-0074"`; `IDENTIFIER_TYPE`: `"http://terminology.hl7.org/CodeSystem/v2-0203"`; `LOINC`: `"http://loinc.org"`; `OBSERVATION_CATEGORY`: `"http://terminology.hl7.org/CodeSystem/observation-category"`; `OMB_RACE_ETHNICITY`: `"urn:oid:2.16.840.1.113883.6.238"`; `PROVENANCE_PARTICIPANT_TYPE`: `"http://terminology.hl7.org/CodeSystem/provenance-participant-type"`; `RXNORM`: `"http://www.nlm.nih.gov/research/umls/rxnorm"`; `SNOMED`: `"http://snomed.info/sct"`; `UCUM`: `"http://unitsofmeasure.org"`; `US_CORE_PROVENANCE_PARTICIPANT_TYPE`: `"http://hl7.org/fhir/us/core/CodeSystem/us-core-provenance-participant-type"`; `V3_ACT_CODE`: `"http://terminology.hl7.org/CodeSystem/v3-ActCode"`; \}\>

The code-system `system` URIs the generators reference. Public identity URIs (HL7-published),
never the code-system *content*, no SNOMED/LOINC/RxNorm table is bundled.

***

### US\_CORE\_ADOPTED\_PROFILES

> `const` **US\_CORE\_ADOPTED\_PROFILES**: readonly \[`"head-occipital-frontal-circumference-percentile"`, `"pediatric-bmi-for-age"`, `"pediatric-weight-for-height"`, `"us-core-allergyintolerance"`, `"us-core-blood-pressure"`, `"us-core-bmi"`, `"us-core-body-height"`, `"us-core-body-temperature"`, `"us-core-body-weight"`, `"us-core-careplan"`, `"us-core-careteam"`, `"us-core-condition-encounter-diagnosis"`, `"us-core-condition-problems-health-concerns"`, `"us-core-coverage"`, `"us-core-diagnosticreport-lab"`, `"us-core-diagnosticreport-note"`, `"us-core-documentreference"`, `"us-core-encounter"`, `"us-core-goal"`, `"us-core-head-circumference"`, `"us-core-heart-rate"`, `"us-core-immunization"`, `"us-core-implantable-device"`, `"us-core-location"`, `"us-core-medication"`, `"us-core-medicationdispense"`, `"us-core-medicationrequest"`, `"us-core-observation-clinical-result"`, `"us-core-observation-lab"`, `"us-core-observation-occupation"`, `"us-core-observation-pregnancyintent"`, `"us-core-observation-pregnancystatus"`, `"us-core-observation-screening-assessment"`, `"us-core-observation-sexual-orientation"`, `"us-core-organization"`, `"us-core-patient"`, `"us-core-practitioner"`, `"us-core-practitionerrole"`, `"us-core-procedure"`, `"us-core-provenance"`, `"us-core-pulse-oximetry"`, `"us-core-questionnaireresponse"`, `"us-core-relatedperson"`, `"us-core-respiratory-rate"`, `"us-core-servicerequest"`, `"us-core-simple-observation"`, `"us-core-smokingstatus"`, `"us-core-specimen"`, `"us-core-vital-signs"`\]

The **adopted set**: the profile ids of every US Core 6.1.0 **resource profile** the implementation
guide publishes, transcribed from the guide's own artifact index ("Structures: Resource Profiles").
This is the closed set a profile-addressed request is resolved against, and it is *identifiers
only*, never IG content, exactly like [US\_CORE\_PROFILE](#us_core_profile).

`45 CFR 170.215` adopts FHIR R4.0.1 and US Core STU 6.1.0, so this is the profile set a developer
building to `45 CFR 170.315(g)(10)` addresses. It is **not** the count of
`StructureDefinition-us-core-*.json` files in the guide's source tree: that directory also holds
the guide's extension definitions and omits profiles the guide publishes.

The guide's 10 **extension definitions** (`us-core-race`, `us-core-birthsex`, …) are deliberately
absent: an extension is not a standalone artifact, so a request naming one is refused like any
other name outside this set.

#### Example

```ts
import { US_CORE_ADOPTED_PROFILES } from "@cosyte/synth/fhir";
US_CORE_ADOPTED_PROFILES.includes("us-core-provenance"); // true
```

***

### US\_CORE\_BIRTHSEX\_EXTENSION

> `const` **US\_CORE\_BIRTHSEX\_EXTENSION**: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex"` = `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex"`

The US Core `us-core-birthsex` extension URL (a Patient must-support extension).

***

### US\_CORE\_ETHNICITY\_EXTENSION

> `const` **US\_CORE\_ETHNICITY\_EXTENSION**: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity"` = `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity"`

The US Core `us-core-ethnicity` extension URL (a Patient must-support extension).

***

### US\_CORE\_PROFILE

> `const` **US\_CORE\_PROFILE**: `Readonly`\<\{ `ALLERGY_INTOLERANCE`: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"`; `CONDITION`: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns"`; `DIAGNOSTIC_REPORT_LAB`: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab"`; `ENCOUNTER`: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter"`; `IMMUNIZATION`: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization"`; `MEDICATION_REQUEST`: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest"`; `OBSERVATION_LAB`: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab"`; `PATIENT`: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"`; `PROCEDURE`: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure"`; `PROVENANCE`: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-provenance"`; `VITAL_SIGNS`: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs"`; \}\>

The canonical `meta.profile` URLs for the US Core 6.1.0 profiles `@cosyte/synth` generates.

***

### US\_CORE\_PROFILE\_BASE

> `const` **US\_CORE\_PROFILE\_BASE**: `"http://hl7.org/fhir/us/core/StructureDefinition/"` = `"http://hl7.org/fhir/us/core/StructureDefinition/"`

The canonical prefix every US Core 6.1.0 resource profile's `url` shares. A profile's canonical is
this prefix followed by its profile id.

#### Example

```ts
import { US_CORE_PROFILE_BASE } from "@cosyte/synth/fhir";
`${US_CORE_PROFILE_BASE}us-core-provenance`;
```

***

### US\_CORE\_RACE\_EXTENSION

> `const` **US\_CORE\_RACE\_EXTENSION**: `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-race"` = `"http://hl7.org/fhir/us/core/StructureDefinition/us-core-race"`

The US Core `us-core-race` extension URL (a Patient must-support extension).

## Functions

### bool()

> **bool**(`value`): `FhirNode`

A `boolean` primitive leaf.

#### Parameters

##### value

`boolean`

The boolean value.

#### Returns

`FhirNode`

A primitive `FhirNode`.

#### Example

```ts
import { bool } from "@cosyte/synth/fhir";
bool(true);
```

***

### buildComposition()

> **buildComposition**(`rng`, `input`): `FhirComplex`

Build a spec-clean synthetic base-R4 `Composition` for a `document` Bundle, through `@cosyte/fhir`.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator (for the resource id).

##### input

[`BuildCompositionInput`](#buildcompositioninput)

Subject/organization references, date, and sections. See [BuildCompositionInput](#buildcompositioninput).

#### Returns

`FhirComplex`

The `Composition` resource model (a `FhirComplex`).

#### Example

```ts
import { createRng } from "@cosyte/synth";
import { buildComposition } from "@cosyte/synth/fhir";
// buildComposition(createRng(1), { subject, organization, date: "2020-01-01", sections: [] });
```

***

### codeableConcept()

> **codeableConcept**(`concept`): `FhirComplex`

A `CodeableConcept` wrapping a single `Coding`.

#### Parameters

##### concept

The coding's `system`, `code`, and `display`.

###### code

`string`

###### display

`string`

###### system

`string`

#### Returns

`FhirComplex`

A `CodeableConcept` `FhirComplex`.

#### Example

```ts
import { codeableConcept } from "@cosyte/synth/fhir";
codeableConcept({ system: "http://snomed.info/sct", code: "59621000", display: "Essential hypertension" });
```

***

### coding()

> **coding**(`concept`): `FhirComplex`

A single `Coding` element (`system` + `code` + `display`).

#### Parameters

##### concept

The coding's `system`, `code`, and `display`.

###### code

`string`

###### display

`string`

###### system

`string`

#### Returns

`FhirComplex`

A `Coding` `FhirComplex`.

#### Example

```ts
import { coding } from "@cosyte/synth/fhir";
coding({ system: "http://loinc.org", code: "2345-7", display: "Glucose" });
```

***

### dec()

> **dec**(`raw`): `FhirNode`

A `decimal` primitive leaf, precision-preserving via `@cosyte/fhir`'s string-backed `FhirDecimal`.

#### Parameters

##### raw

`string`

The exact decimal lexical form (never routed through a JS `number`).

#### Returns

`FhirNode`

A primitive `FhirNode`.

#### Example

```ts
import { dec } from "@cosyte/synth/fhir";
dec("6.3");
```

***

### fhirCorpus()

> **fhirCorpus**(`options`): [`Corpus`](../src.md#corpus)

Build a reproducible [Corpus](../src.md#corpus) of spec-clean FHIR resources across the supported kinds. Each
resource is generated from a distinct sub-seed derived from the corpus seed and round-tripped through
`@cosyte/fhir`; the per-artifact `warnings` record the validator's non-informational findings (empty
⇒ spec-clean, no US Core profiles supplied). Pass US Core `StructureDefinition`s to a per-resource
[roundTrip](#roundtrip) call to additionally assert profile conformance (BYO, none is bundled).

#### Parameters

##### options

[`FhirCorpusOptions`](#fhircorpusoptions)

Seed, count, and the resource mix. See [FhirCorpusOptions](#fhircorpusoptions).

#### Returns

[`Corpus`](../src.md#corpus)

A deep-frozen [Corpus](../src.md#corpus).

#### Example

```ts
import { fhirCorpus } from "@cosyte/synth/fhir";
const corpus = fhirCorpus({ seed: 42, count: 6 });
corpus.artifacts.every((a) => a.warnings.length === 0); // spec-clean (structural)
```

***

### fhirPatientIdentity()

> **fhirPatientIdentity**(`rng`): [`FhirPatientIdentity`](#fhirpatientidentity)

Mint a complete synthetic [FhirPatientIdentity](#fhirpatientidentity). Every value comes from a synthetic-safety
provider, no code path here can return a real or plausibly-real identifier. The draw
order is fixed (id → name → MRN → DOB → gender → address → phone → email) so the same seed yields the
same identity.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

[`FhirPatientIdentity`](#fhirpatientidentity)

A synthetic [FhirPatientIdentity](#fhirpatientidentity).

#### Example

```ts
import { createRng } from "@cosyte/synth";
// const id = fhirPatientIdentity(createRng(1)); // id.person, id.mrn, …
```

***

### generateAllergyIntolerance()

> **generateAllergyIntolerance**(`options?`): `FhirComplex`

Generate a spec-clean synthetic US Core `AllergyIntolerance`, built through `@cosyte/fhir`.

#### Parameters

##### options?

[`GenerateAllergyIntoleranceOptions`](#generateallergyintoleranceoptions) = `{}`

Seed, patient reference, and US Core posture. See
  [GenerateAllergyIntoleranceOptions](#generateallergyintoleranceoptions).

#### Returns

`FhirComplex`

The `AllergyIntolerance` resource model (a `FhirComplex`).

#### Example

```ts
import { generateAllergyIntolerance } from "@cosyte/synth/fhir";
const allergy = generateAllergyIntolerance({ seed: 15, patient: "Patient/syn-patient-1" });
```

***

### generateBundle()

> **generateBundle**(`options?`): `FhirComplex`

Generate a spec-clean synthetic FHIR `Bundle` (`collection`, `transaction`, or `document`) built
through `@cosyte/fhir`, containing a US Core `Patient` and its full clinical spine wired by
`urn:uuid:` references so every reference resolves in-bundle.

#### Parameters

##### options?

[`GenerateBundleOptions`](#generatebundleoptions) = `{}`

Seed and Bundle shape. See [GenerateBundleOptions](#generatebundleoptions).

#### Returns

`FhirComplex`

The `Bundle` resource model (a `FhirComplex`).

#### Example

```ts
import { generateBundle } from "@cosyte/synth/fhir";
const bundle = generateBundle({ seed: 42, type: "document" });
```

***

### generateCondition()

> **generateCondition**(`options?`): `FhirComplex`

Generate a spec-clean synthetic US Core `Condition` (problem-list item), built through `@cosyte/fhir`.

#### Parameters

##### options?

[`GenerateConditionOptions`](#generateconditionoptions) = `{}`

Seed, subject reference, and US Core posture. See [GenerateConditionOptions](#generateconditionoptions).

#### Returns

`FhirComplex`

The `Condition` resource model (a `FhirComplex`).

#### Example

```ts
import { generateCondition } from "@cosyte/synth/fhir";
const condition = generateCondition({ seed: 7, subject: "Patient/syn-patient-1" });
```

***

### generateDiagnosticReport()

> **generateDiagnosticReport**(`options?`): `FhirComplex`

Generate a spec-clean synthetic US Core Laboratory `DiagnosticReport`, built through `@cosyte/fhir`.

#### Parameters

##### options?

[`GenerateDiagnosticReportOptions`](#generatediagnosticreportoptions) = `{}`

Seed, subject, result references, US Core posture. See
  [GenerateDiagnosticReportOptions](#generatediagnosticreportoptions).

#### Returns

`FhirComplex`

The `DiagnosticReport` resource model (a `FhirComplex`).

#### Example

```ts
import { generateDiagnosticReport } from "@cosyte/synth/fhir";
const report = generateDiagnosticReport({ seed: 19, subject: "Patient/syn-patient-1" });
```

***

### generateEncounter()

> **generateEncounter**(`options?`): `FhirComplex`

Generate a spec-clean synthetic US Core `Encounter`, built through `@cosyte/fhir`.

#### Parameters

##### options?

[`GenerateEncounterOptions`](#generateencounteroptions) = `{}`

Seed, subject reference, and US Core posture. See [GenerateEncounterOptions](#generateencounteroptions).

#### Returns

`FhirComplex`

The `Encounter` resource model (a `FhirComplex`).

#### Example

```ts
import { generateEncounter } from "@cosyte/synth/fhir";
const encounter = generateEncounter({ seed: 11, subject: "Patient/syn-patient-1" });
```

***

### generateImmunization()

> **generateImmunization**(`options?`): `FhirComplex`

Generate a spec-clean synthetic US Core `Immunization`, built through `@cosyte/fhir`.

#### Parameters

##### options?

[`GenerateImmunizationOptions`](#generateimmunizationoptions) = `{}`

Seed, patient reference, and US Core posture. See [GenerateImmunizationOptions](#generateimmunizationoptions).

#### Returns

`FhirComplex`

The `Immunization` resource model (a `FhirComplex`).

#### Example

```ts
import { generateImmunization } from "@cosyte/synth/fhir";
const imm = generateImmunization({ seed: 13, patient: "Patient/syn-patient-1" });
```

***

### generateMedicationRequest()

> **generateMedicationRequest**(`options?`): `FhirComplex`

Generate a spec-clean synthetic US Core `MedicationRequest`, built through `@cosyte/fhir`.

#### Parameters

##### options?

[`GenerateMedicationRequestOptions`](#generatemedicationrequestoptions) = `{}`

Seed, subject/requester references, US Core posture.

#### Returns

`FhirComplex`

The `MedicationRequest` resource model (a `FhirComplex`).

#### Example

```ts
import { generateMedicationRequest } from "@cosyte/synth/fhir";
const mr = generateMedicationRequest({ seed: 9, subject: "Patient/syn-patient-1" });
```

***

### generateObservationLab()

> **generateObservationLab**(`options?`): `FhirComplex`

Generate a spec-clean synthetic US Core **Laboratory Result** `Observation`.

#### Parameters

##### options?

[`GenerateObservationOptions`](#generateobservationoptions) = `{}`

Seed, subject reference, US Core posture. See [GenerateObservationOptions](#generateobservationoptions).

#### Returns

`FhirComplex`

The `Observation` resource model (a `FhirComplex`).

#### Example

```ts
import { generateObservationLab } from "@cosyte/synth/fhir";
const obs = generateObservationLab({ seed: 3, subject: "Patient/syn-patient-1" });
```

***

### generatePatient()

> **generatePatient**(`options?`): `FhirComplex`

Generate a spec-clean synthetic FHIR R4 `Patient` (base or US Core), built through `@cosyte/fhir`.

#### Parameters

##### options?

[`GeneratePatientOptions`](#generatepatientoptions) = `{}`

Seed and profile posture. See [GeneratePatientOptions](#generatepatientoptions).

#### Returns

`FhirComplex`

The `Patient` resource model (a `FhirComplex`).

#### Example

```ts
import { generatePatient } from "@cosyte/synth/fhir";
import { serializeResource } from "@cosyte/fhir";
const patient = generatePatient({ seed: 42, profile: "us-core" });
serializeResource(patient);
```

***

### generateProcedure()

> **generateProcedure**(`options?`): `FhirComplex`

Generate a spec-clean synthetic US Core `Procedure`, built through `@cosyte/fhir`.

#### Parameters

##### options?

[`GenerateProcedureOptions`](#generateprocedureoptions) = `{}`

Seed, subject reference, and US Core posture. See [GenerateProcedureOptions](#generateprocedureoptions).

#### Returns

`FhirComplex`

The `Procedure` resource model (a `FhirComplex`).

#### Example

```ts
import { generateProcedure } from "@cosyte/synth/fhir";
const procedure = generateProcedure({ seed: 17, subject: "Patient/syn-patient-1" });
```

***

### generateProvenance()

> **generateProvenance**(`options?`): `FhirComplex`

Generate a spec-clean synthetic US Core `Provenance`, built through `@cosyte/fhir`.

#### Parameters

##### options?

[`GenerateProvenanceOptions`](#generateprovenanceoptions) = `{}`

Seed, target reference, and US Core posture. See [GenerateProvenanceOptions](#generateprovenanceoptions).

#### Returns

`FhirComplex`

The `Provenance` resource model (a `FhirComplex`).

#### Example

```ts
import { generateProvenance } from "@cosyte/synth/fhir";
const provenance = generateProvenance({ seed: 19, target: "Patient/syn-patient-1" });
```

***

### generateUsCoreProfile()

> **generateUsCoreProfile**(`options`): `FhirComplex`

Generate a fixture **by US Core 6.1.0 profile name**, or fail closed before anything is generated.

#### Parameters

##### options

[`GenerateUsCoreProfileOptions`](#generateuscoreprofileoptions)

The profile name and seed. See [GenerateUsCoreProfileOptions](#generateuscoreprofileoptions).

#### Returns

`FhirComplex`

The resource model (a `FhirComplex`) claiming that profile in `meta.profile`.

#### Throws

SynthError `SYNTH_UNSUPPORTED_KIND` when the name is not in the adopted set.

#### Throws

SynthError `SYNTH_PROFILE_NOT_GENERATED` when the profile is adopted and not generated here.

#### Example

```ts
import { generateUsCoreProfile } from "@cosyte/synth/fhir";
const provenance = generateUsCoreProfile({ profile: "us-core-provenance", seed: 42 });
```

***

### generateVitalSign()

> **generateVitalSign**(`options?`): `FhirComplex`

Generate a spec-clean synthetic US Core **Vital Signs** `Observation` (a single-value vital such as
heart rate or body weight; `effectiveDateTime` is required by the vital-signs profile).

#### Parameters

##### options?

[`GenerateObservationOptions`](#generateobservationoptions) = `{}`

Seed, subject reference, US Core posture. See [GenerateObservationOptions](#generateobservationoptions).

#### Returns

`FhirComplex`

The `Observation` resource model (a `FhirComplex`).

#### Example

```ts
import { generateVitalSign } from "@cosyte/synth/fhir";
const vs = generateVitalSign({ seed: 5, subject: "Patient/syn-patient-1" });
```

***

### meta()

> **meta**(`profiles`): `FhirComplex`

A `meta.profile` element pinning the resource to one or more canonical profile URLs (US Core
conformance is claimed via `meta.profile`). No version is pinned, so validating against any supplied
version of the named profile never raises a version-mismatch.

#### Parameters

##### profiles

readonly `string`[]

The canonical profile URLs to claim.

#### Returns

`FhirComplex`

A `meta` `FhirComplex`.

#### Example

```ts
import { meta, US_CORE_PROFILE } from "@cosyte/synth/fhir";
meta([US_CORE_PROFILE.PATIENT]);
```

***

### mrnIdentifier()

> **mrnIdentifier**(`mrn`): `FhirComplex`

The US Core Patient `identifier` element for a synthetic MRN: `type` (`MR`), the synthetic
assigning-authority OID as `system`, and the synthetic value. Satisfies US Core Patient's required
`identifier.system` + `identifier.value`.

#### Parameters

##### mrn

[`SyntheticIdentifier`](../src.md#syntheticidentifier)

The synthetic identifier from `safe.identifier`.

#### Returns

`FhirComplex`

An `Identifier` `FhirComplex`.

#### Example

```ts
import { createRng, safe } from "@cosyte/synth";
import { mrnIdentifier } from "@cosyte/synth/fhir";
mrnIdentifier(safe.identifier(createRng(1), "MR"));
```

***

### narrative()

> **narrative**(`text`): `FhirComplex`

A generated `Narrative` (`text`) with `status: "generated"` and an XHTML `div` carrying only
synthetic text, satisfies the base `dom-6` best-practice constraint so a generated resource is
robust as well as valid. The `div` is XHTML-namespaced and carries no markup beyond a paragraph, so
it round-trips byte-for-byte through `@cosyte/fhir`'s codec.

#### Parameters

##### text

`string`

The plain synthetic summary text (no PHI: it is composed from synthetic values).

#### Returns

`FhirComplex`

A `Narrative` `FhirComplex`.

#### Example

```ts
import { narrative } from "@cosyte/synth/fhir";
narrative("Synthetic patient summary.");
```

***

### prop()

> **prop**(`name`, `value`): [`Prop`](#prop)

Build a named FHIR property.

#### Parameters

##### name

`string`

The property name.

##### value

`FhirNode`

The property's node value.

#### Returns

[`Prop`](#prop)

A [Prop](#prop).

#### Example

```ts
import { prop, str } from "@cosyte/synth/fhir";
prop("gender", str("female"));
```

***

### reference()

> **reference**(`ref`): `FhirComplex`

A literal `Reference` element (`{ reference: "<Type>/<id>" }` or a `urn:uuid:` fullUrl).

#### Parameters

##### ref

`string`

The reference string.

#### Returns

`FhirComplex`

A `Reference` `FhirComplex`.

#### Example

```ts
import { reference } from "@cosyte/synth/fhir";
reference("Patient/syn-patient-1");
```

***

### roundTrip()

> **roundTrip**(`resource`, `options?`): [`RoundTripResult`](#roundtripresult)

Round-trip a generated FHIR resource through serialize → parse → validate → serialize and report the
verdict. A spec-clean artifact validates with **zero errors** and re-serializes byte-identically.

#### Parameters

##### resource

`FhirComplex`

The resource model to check (typically from a `generate*` function).

##### options?

[`RoundTripOptions`](#roundtripoptions) = `{}`

Optional US Core / vendor profiles to validate against. See [RoundTripOptions](#roundtripoptions).

#### Returns

[`RoundTripResult`](#roundtripresult)

The [RoundTripResult](#roundtripresult).

#### Example

```ts
import { generatePatient, roundTrip } from "@cosyte/synth/fhir";
const { specClean, errors } = roundTrip(generatePatient({ seed: 1 }));
// specClean === true, errors.length === 0
```

***

### str()

> **str**(`value`): `FhirNode`

A `string`/`code`/`uri`/`date` primitive leaf.

#### Parameters

##### value

`string`

The lexical string value.

#### Returns

`FhirNode`

A primitive `FhirNode`.

#### Example

```ts
import { str } from "@cosyte/synth/fhir";
str("final");
```

***

### toFhirDate()

> **toFhirDate**(`ymd`): `string`

Reformat a `YYYYMMDD` synthetic date (from `safe.dateYmd`) as a FHIR `date` (`YYYY-MM-DD`).

#### Parameters

##### ymd

`string`

The `YYYYMMDD` date string.

#### Returns

`string`

The `YYYY-MM-DD` FHIR date string.

#### Example

```ts
import { toFhirDate } from "@cosyte/synth/fhir";
toFhirDate("19700131"); // "1970-01-31"
```

***

### usCoreCoverage()

> **usCoreCoverage**(): readonly [`UsCoreProfileCoverage`](#uscoreprofilecoverage)[]

Report this build's US Core 6.1.0 coverage: one entry per **adopted** resource profile, in the
guide's own order, each carrying its canonical URL and whether this build generates it.

The report is exhaustive over the adopted set by construction, so a profile the guide publishes and
this build does not generate is *named* here rather than being indistinguishable from a typo.

#### Returns

readonly [`UsCoreProfileCoverage`](#uscoreprofilecoverage)[]

One frozen [UsCoreProfileCoverage](#uscoreprofilecoverage) entry per adopted profile.

#### Example

```ts
import { usCoreCoverage } from "@cosyte/synth/fhir";
usCoreCoverage().filter((entry) => !entry.generated).map((entry) => entry.profile);
```
