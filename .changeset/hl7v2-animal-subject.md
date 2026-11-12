---
"@cosyte/synth": patch
---

HL7 v2 `generateAdt` and `generateOru` take a new option, `subject`: `"person"` (the default) or `"animal"`. An animal message carries the pet's name in PID-5 (the owner's family name, then the pet's), the record number and a 15-digit microchip with identifier type `MCN` in PID-3, a birth date from 0 to 20 years before the message date in PID-7, the species in PID-35 and the breed in PID-36 as `code^text^99COSYTE`, and the owner in an `NK1` after the `PID` with relationship `OWN^Owner^HL70063`. PID-19 stays empty. Every trigger and `ORU^R01` read back through `@cosyte/hl7` with zero warnings.

Species and breed come from our own short list (dog, cat, horse and cattle, two or three breeds each) under the local code system `99COSYTE`: no SNOMED CT, VetSCT or VeNom content. Microchips begin `999`, the code summaries of ISO 11784 give to test transponders.

New exports from `@cosyte/synth`: `petName`, `animalBreed`, `microchip`, `animalBirthDate` (also on `safe`), `isSyntheticMicrochip`, `SYNTHETIC_PET_NAMES`, `SYNTHETIC_ANIMAL_SPECIES`, `ANIMAL_CODE_SYSTEM`, `MICROCHIP_TEST_PREFIX`, and the types `AnimalCode`, `AnimalSpecies` and `AnimalBreedDraw`. New exports from `@cosyte/synth/hl7`: `animalIdentity`, `animalPidSegment`, `ownerNk1Segment`, `MICROCHIP_IDENTIFIER_TYPE`, `OWNER_RELATIONSHIP`, and the types `AnimalIdentity`, `AnimalOwner` and `Hl7Subject`.

Output with `subject` left out is unchanged, byte for byte. What a caller changes: nothing, unless your code enumerates the keys of `safe`, which now has four more.
