---
id: draw-synthetic-values
title: Draw synthetic values for your own fixtures
sidebar_label: Draw synthetic values
description: "Use the seeded generator and value providers to fill your own fixtures with names, identifiers, phones, and addresses that cannot be real."
---

# Draw synthetic values for your own fixtures

When you build a fixture by hand, or in a format `@cosyte/synth` does not generate, the package root
gives you the same seeded generator and value providers the format generators use. None of them
needs a parser installed.

## Create a seeded generator

`createRng(seed)` returns a generator. Every provider takes it as its first argument, so the values
you draw depend only on the seed and the order you draw them in:

```ts runnable
import { createRng, safe } from "@cosyte/synth";

const first = createRng(42);
const second = createRng(42);

safe.ssn(first) === safe.ssn(second); // => true
safe.phone(first) === safe.phone(second); // => true
```

The generator also has `int(min, max)`, `pick(items)`, `bool(p)`, `float()`, and `nextUint32()`
for your own choices. Draw from one generator in a fixed order, and a fixture regenerates the same
way.

## Draw the values

The providers are exported by name and grouped on `safe`:

| Provider                    | Returns                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `ssn(rng)`                  | a dashed SSN with an area from 900 to 999 and a group outside every ITIN range           |
| `ssn(rng, "advertising")`   | one of the ten values `987-00-4320` to `987-00-4329`                                     |
| `phone(rng)`                | `(AAA) 555-01NN`, in the block reserved for fiction                                      |
| `email(rng, person?)`       | an address at `example.com`, `example.org`, or `example.net`                             |
| `name(rng)`                 | `{ given, family }` from the invented-name pool                                          |
| `address(rng)`              | `{ street, city, state, zip }` with an invented street and city and the ZIP Code `00000` |
| `identifier(rng, type?)`    | an ID of type `MR` (the default), `AN`, or `MB` under the assigning authority `COSYTE-SYNTH` |
| `npi(rng)`                  | 10 digits whose check digit fails the NPI Luhn check                                     |
| `dea(rng, person?)`         | a DEA-shaped number whose check digit fails the DEA checksum                             |
| `dateYmd(rng, min?, max?)`  | a `YYYYMMDD` date between 1930 and 2010 by default                                       |
| `ipv4(rng)`, `ipv6(rng)`    | an address in a range reserved for documentation                                         |
| `uuid(rng)`                 | a version 4 UUID drawn from the seed                                                     |
| `petName(rng)`              | an invented pet name from `SYNTHETIC_PET_NAMES`                                          |
| `animalBreed(rng)`          | `{ species, breed }` from our own short list, under the local code system `99COSYTE`      |
| `microchip(rng)`            | 15 digits beginning `999` (a range we have not verified against ISO 11784)                |
| `animalBirthDate(rng, on)`  | a `YYYYMMDD` date from 0 to 20 years before the `YYYYMMDD` date `on`                      |

```ts runnable
import { createRng, isSyntheticEmail, safe } from "@cosyte/synth";

const rng = createRng(7);
const person = safe.name(rng);
const mrn = safe.identifier(rng, "MR");
const home = safe.address(rng);

mrn.assigningAuthority; // => "COSYTE-SYNTH"
home.zip; // => "00000"
isSyntheticEmail(safe.email(rng, person)); // => true
```

[The floor table](./limitations.md#the-synthetic-safety-posture-the-floors) cites the authority
behind each range, and says where no authority reserves one.

## Check a value

The checks tell you whether a value falls in a synthetic range. Use them to assert that a fixture you
built, or one a colleague committed, holds no value that could be real:

```ts runnable
import { createRng, isItinFormatted, isSyntheticNpi, isSyntheticPhone, isSyntheticSsn, safe } from "@cosyte/synth";

const rng = createRng(1);
const nationalId = safe.ssn(rng);

isSyntheticSsn(nationalId); // => true
isItinFormatted(nationalId); // => false
isSyntheticNpi(safe.npi(rng)); // => true
isSyntheticPhone("555-0100"); // => true
isSyntheticPhone("555-1212"); // => false
```

The other checks are `isSyntheticEmail`, `isSyntheticIp`, `isSyntheticDea`, and
`isSyntheticMicrochip`. `npiCheckDigit`, `deaCheckDigit`, and `luhnMod10` compute the check digits
behind them.

## Use the name pools directly

The invented names are exported as `SYNTHETIC_GIVEN_NAMES`, `SYNTHETIC_FAMILY_NAMES`,
`SYNTHETIC_STREET_NAMES`, and `SYNTHETIC_CITY_NAMES`, frozen arrays you can draw from with
`rng.pick`:

```ts runnable
import { SYNTHETIC_FAMILY_NAMES, createRng } from "@cosyte/synth";

const family = createRng(3).pick(SYNTHETIC_FAMILY_NAMES);

SYNTHETIC_FAMILY_NAMES.includes(family); // => true
```

## Related

- Reference: [`createRng`](./api/src.md#createrng), [`safe`](./api/src.md#safe),
  [`isSyntheticSsn`](./api/src.md#issyntheticssn), and [`Rng`](./api/src.md#rng).
- [How it works](./concepts-archetype.md#determinism-a-seed-gives-the-same-bytes): why a seed gives
  the same values.
