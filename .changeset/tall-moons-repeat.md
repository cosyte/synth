---
"@cosyte/synth": patch
---

You can now ask for a FHIR fixture by **US Core 6.1.0 profile name** instead of by generator name, and the answer is one of exactly two things: an artifact claiming that profile, or a refusal raised before any artifact exists.

New exports on `@cosyte/synth/fhir`: `usCoreCoverage()` reports one entry for every one of the **49 resource profiles** the adopted implementation guide publishes, each carrying its canonical URL and whether this build generates it; `generateUsCoreProfile({ profile, seed })` resolves the requested name against that closed set before generating anything. `US_CORE_ADOPTED_PROFILES`, `US_CORE_PROFILE_BASE` and the `UsCoreProfileId` / `UsCoreProfileCoverage` types are exported alongside them. Identifiers only, as ever: no implementation-guide content is bundled.

The two refusals are deliberately different codes, because they are different facts about your request. `SYNTH_PROFILE_NOT_GENERATED` (new) says the guide publishes the profile and this build does not generate it yet. `SYNTH_UNSUPPORTED_KIND` says the name is not in the adopted set at all: a typo, a blank, a value that is not a string, or one of the guide's extension definitions, which are not standalone artifacts. Neither quotes your value back, and neither returns a mislabelled artifact.

Coverage moves from 10 profiles to 11: **`generateProvenance()`** generates a US Core `Provenance`, built through `@cosyte/fhir`'s model constructors like every other resource here, and validated against the published `us-core-provenance` StructureDefinition with zero errors over arbitrary seeds. The other 38 adopted profiles are reported as uncovered and refuse: this release closes the contract, not the breadth.

The conformance suite is now driven by the coverage surface rather than by a list kept beside it, so a profile reported as generated with no committed StructureDefinition behind it fails the suite instead of being skipped.
