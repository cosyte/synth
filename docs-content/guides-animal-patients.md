---
id: guides-animal-patients
title: Generate animal patients in HL7 v2
sidebar_label: Animal patients
description: "Generate ADT and ORU messages about a synthetic animal: a pet name, species and breed, a test-range microchip, a birth date, and the owner in NK1."
---

# Generate animal patients in HL7 v2

A veterinary system receives the same ADT and ORU messages a hospital does, about an animal and its
owner. `generateAdt` and `generateOru` write one when you pass `subject: "animal"`. Leave `subject`
out, or pass `"person"`, and a seed gives the same bytes it always has.

## Generate one message

```ts runnable
import { parseHL7 } from "@cosyte/hl7";
import { generateAdt, generateOru, roundTrip } from "@cosyte/synth/hl7";

const admit = generateAdt({ seed: 42, trigger: "A01", subject: "animal" });
const result = generateOru({ seed: 7, subject: "animal" });

const pid = parseHL7(admit.toString());
pid.get("PID.5.2"); // => "Seedpup"
pid.get("PID.35.2"); // => "Horse"
pid.get("PID.36.2"); // => "Thoroughbred"
pid.get("NK1.3.1"); // => "OWN"

roundTrip(result).specClean; // => true
```

Every ADT trigger takes `subject`. Any other value throws a `SynthError` with the code
[`SYNTH_UNSUPPORTED_KIND`](./fatal-codes.md#synth_unsupported_kind).

## What a run writes

`generateAdt({ seed: 42, subject: "animal" })` writes this message (one segment a line here; the
wire separates them with a carriage return):

```text
MSH|^~\&|COSYTE-SYNTH|SYNTH-FAC|RECEIVER|RECV-FAC|20220627005325||ADT^A01|SYNTH3269244188|T|2.5
EVN|A01|20220627005325
PID|1||38781325^^^COSYTE-SYNTH^MR~999817111682964^^^COSYTE-SYNTH^MCN||Examplewood^Seedpup||20071226|F|||7927 Example Boulevard^^Exampleburg^ND^00000||(441) 555-0193||||||||||||||||||||||HORSE^Horse^99COSYTE|HRS-TB^Thoroughbred^99COSYTE
NK1|1|Examplewood^Mocktavia|OWN^Owner^HL70063|7927 Example Boulevard^^Exampleburg^ND^00000|(441) 555-0193
PV1|1|E|SYNTHWARD^902^01
```

| Field  | What it holds                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------- |
| PID-3  | the record number (`MR`), then the microchip with identifier type `MCN`                          |
| PID-5  | the owner's family name, then the pet's name as the given name                                  |
| PID-7  | the birth date, from 0 to 20 years before the message date in MSH-7                             |
| PID-11 | the owner's address, with the ZIP Code `00000`                                                  |
| PID-13 | the owner's phone, in the `555-01xx` block reserved for fiction                                 |
| PID-19 | empty: an animal has no Social Security number                                                  |
| PID-35 | the species as `code^text^99COSYTE`                                                             |
| PID-36 | the breed as `code^text^99COSYTE`                                                               |
| NK1    | the owner: name, relationship `OWN^Owner^HL70063`, address and phone. It follows the `PID`.     |

The birth date is measured from the message date, not the clock, so a seed gives the same message
on any day.

## Where each value comes from

- **Species and breed** come from our own short list: dog (Labrador Retriever, Beagle, mixed breed),
  cat (Domestic Shorthair, Siamese), horse (Quarter Horse, Thoroughbred) and cattle (Holstein,
  Angus). The codes are ours, under the local code system `99COSYTE` (HL7 table 0396 gives local
  systems the form `99` and letters). We use no SNOMED CT, VetSCT or VeNom content.
- **The relationship** `OWN`, owner, is a value of HL7 table 0063 (relationship), as published
  summaries of that table list it, for example
  [Caristix's HL7 v2.5 table 0063](https://hl7-definition.caristix.com/v2/HL7v2.5/Tables/0063).
- **The microchip** is 15 digits beginning `999`. ISO 11784 gives a transponder's first three digits
  as a country code or, from `900`, a manufacturer code; summaries of the standard and of ICAR's
  manufacturer code list give `999` to test transponders, which are not for use in animals.
- **The identifier type** `MCN`, microchip number, is the code HL7 table 0203 carries for it from
  v2.7. These messages declare v2.5, where table 0203 is user-defined.
- **Names** come from invented pools: `SYNTHETIC_PET_NAMES` for the pet, the person-name pools for
  the owner.

## Draw the values yourself

The same providers are on the package root, for a fixture in another format:

```ts runnable
import { animalBirthDate, animalBreed, createRng, isSyntheticMicrochip, microchip, petName } from "@cosyte/synth";

const rng = createRng(5);
const name = petName(rng);
const { species, breed } = animalBreed(rng);
const chip = microchip(rng);
const born = animalBirthDate(rng, "20250601");

name.length > 0; // => true
species.system === breed.system; // => true
isSyntheticMicrochip(chip); // => true
born >= "20050601" && born <= "20250601"; // => true
```

## Related

- [Generate HL7 v2 messages](./guides-hl7.md): the generators and their other options.
- [Draw synthetic values](./draw-synthetic-values.md): every provider on the root.
- Reference: [`AnimalIdentity`](./api/src/hl7.md#animalidentity),
  [`SYNTHETIC_ANIMAL_SPECIES`](./api/src.md#synthetic_animal_species).
