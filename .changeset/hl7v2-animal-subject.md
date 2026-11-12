---
"@cosyte/synth": patch
---

HL7 v2 `generateAdt` and `generateOru` take a new option, `subject`: `"person"` (the default) or `"animal"`. An animal message carries the pet's name in PID-5 (the owner's family name, then the pet's), the record number and a 15-digit microchip with identifier type `MCN` in PID-3, a birth date from 0 to 20 years before the message date in PID-7, the species in PID-35 and the breed in PID-36 as `code^text^99COSYTE`, and the owner in an `NK1` after the `PID` with relationship `OWN^Owner^HL70063`. PID-19 stays empty. Every trigger and `ORU^R01` read back through `@cosyte/hl7` with zero warnings.

Species and breed come from our own short list (dog, cat, horse and cattle, two or three breeds each) under the local code system `99COSYTE`: no SNOMED CT, VetSCT or VeNom content. Microchips begin `999`. We have not verified three things against the standards: that `999` is outside every country and manufacturer code ISO 11784 gives a real chip, that `MCN` is the HL7 table 0203 identifier type for a microchip, and that `OWN` is a value of HL7 table 0063. We emit them as written; the how-to marks each as not verified.

New exports from `@cosyte/synth`: `petName`, `animalBreed`, `microchip`, `animalBirthDate` (also on `safe`), `isSyntheticMicrochip`, `SYNTHETIC_PET_NAMES`, `SYNTHETIC_ANIMAL_SPECIES`, `ANIMAL_CODE_SYSTEM`, `MICROCHIP_TEST_PREFIX`, and the types `AnimalCode`, `AnimalSpecies` and `AnimalBreedDraw`. New exports from `@cosyte/synth/hl7`: `animalIdentity`, `animalPidSegment`, `ownerNk1Segment`, `MICROCHIP_IDENTIFIER_TYPE`, `OWNER_RELATIONSHIP`, and the types `AnimalIdentity`, `AnimalOwner` and `Hl7Subject`. The animal identity is exported from the package root and `@cosyte/synth/hl7` because synth has no `./arbitraries` subpath yet; adding one, with a fast-check arbitrary for the animal identity, is left for a later change.

Output with `subject` left out is unchanged, byte for byte. What a caller changes: nothing, unless your code enumerates the keys of `safe`, which now has four more.
