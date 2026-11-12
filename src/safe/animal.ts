/**
 * The synthetic **animal** providers: a pet's name, its species and breed, its microchip, and its
 * birth date. Like every provider in `../safe`, each is a pure function of an explicit seeded
 * generator and draws only from a source this module ships or a range no real animal holds.
 *
 * - **Species and breed** come from a short list of our own: plain text, with codes in a local
 *   code system ({@link ANIMAL_CODE_SYSTEM}). No SNOMED CT, VetSCT or VeNom content is used.
 * - **Pet names** come from a clearly invented pool, like the person-name pool.
 * - **Microchips** are 15 digits that begin with `999`, the code ISO 11784 summaries give for test
 *   transponders rather than a country or a manufacturer, so no value here is a chip implanted in an
 *   animal (see {@link MICROCHIP_TEST_PREFIX}).
 *
 * `# synthetic: true`
 *
 * @module
 */

import type { Rng } from "../rng/rng.js";

/**
 * The local code system for species and breed codes, in the HL7 table 0396 form for a local
 * system (`99` followed by letters). The codes under it are ours and name nothing outside this
 * package.
 */
// Stryker disable all: a module-level value is built once, at import, so per-test coverage cannot
// attribute it to the tests that check it; test/safe-animal.test.ts asserts its exact value.
export const ANIMAL_CODE_SYSTEM = "99COSYTE";
// Stryker restore all

/** A species or breed: our own code, its plain text, and the local code system. */
export interface AnimalCode {
  /** Our own short code, for example `DOG` or `DOG-BGL`. */
  readonly code: string;
  /** The plain text, for example `Dog` or `Beagle`. */
  readonly text: string;
  /** Always {@link ANIMAL_CODE_SYSTEM}. */
  readonly system: string;
}

/** A species and the breeds this package draws for it. */
export interface AnimalSpecies extends AnimalCode {
  /** The breeds of this species, at least one. */
  readonly breeds: readonly AnimalCode[];
}

/** A species and one of its breeds, as {@link animalBreed} draws them. */
export interface AnimalBreedDraw {
  /** The species. */
  readonly species: AnimalCode;
  /** A breed of that species. */
  readonly breed: AnimalCode;
}

// Stryker disable all: these two build the table below and run only at import, with it; the tests
// that check the table are the tests that check them.
function code(value: string, text: string): AnimalCode {
  return Object.freeze({ code: value, text, system: ANIMAL_CODE_SYSTEM });
}

function species(value: string, text: string, breeds: readonly AnimalCode[]): AnimalSpecies {
  return Object.freeze({ ...code(value, text), breeds: Object.freeze([...breeds]) });
}
// Stryker restore all

/**
 * The species and breeds the animal subject draws from: our own short list, in plain text, under
 * {@link ANIMAL_CODE_SYSTEM}. Small on purpose: structural coverage, not a breed registry.
 *
 * @example
 * ```ts
 * import { SYNTHETIC_ANIMAL_SPECIES } from "@cosyte/synth";
 * SYNTHETIC_ANIMAL_SPECIES.map((s) => s.text); // ["Dog", "Cat", "Horse", "Cattle"]
 * ```
 */
// Stryker disable all: a module-level table runs once, at import, so per-test coverage cannot
// attribute it to the tests that check it; test/safe-animal.test.ts asserts every entry.
export const SYNTHETIC_ANIMAL_SPECIES: readonly AnimalSpecies[] = Object.freeze([
  species("DOG", "Dog", [
    code("DOG-LAB", "Labrador Retriever"),
    code("DOG-BGL", "Beagle"),
    code("DOG-MIX", "Mixed breed dog"),
  ]),
  species("CAT", "Cat", [code("CAT-DSH", "Domestic Shorthair"), code("CAT-SIA", "Siamese")]),
  species("HORSE", "Horse", [code("HRS-QTR", "Quarter Horse"), code("HRS-TB", "Thoroughbred")]),
  species("CATTLE", "Cattle", [code("CTL-HOL", "Holstein"), code("CTL-ANG", "Angus")]),
]);

/** Clearly invented pet names. None is a name a reader would take for a real animal's record. */
export const SYNTHETIC_PET_NAMES: readonly string[] = Object.freeze([
  "Fixturepaw",
  "Mockwhisker",
  "Stubtail",
  "Seedpup",
  "Testbiscuit",
  "Placepurr",
  "Synthfur",
  "Dummymane",
  "Examplehoof",
  "Fauxfluff",
  "Samplesnout",
  "Voidwag",
]);
// Stryker restore all

/**
 * The three digits a synthetic microchip begins with. ISO 11784 gives a transponder's first three
 * digits as a country code (ISO 3166 numeric) or, from `900`, a manufacturer code; summaries of
 * the standard and of ICAR's manufacturer code list give `999` to test transponders, which are not
 * for use in animals. So a `999` number names no animal's chip.
 */
// Stryker disable all: a module-level value is built once, at import, so per-test coverage cannot
// attribute it to the tests that check it; test/safe-animal.test.ts asserts its exact value.
export const MICROCHIP_TEST_PREFIX = "999";
// Stryker restore all

/**
 * A **synthetic pet name** from {@link SYNTHETIC_PET_NAMES}.
 *
 * @param rng - The seeded generator.
 * @returns A clearly invented pet name.
 * @example
 * ```ts
 * import { createRng, petName } from "@cosyte/synth";
 * petName(createRng(1)); // e.g. "Stubtail"
 * ```
 */
export function petName(rng: Rng): string {
  return rng.pick(SYNTHETIC_PET_NAMES);
}

/**
 * A **species and breed** from {@link SYNTHETIC_ANIMAL_SPECIES}: the species first, then one of its
 * breeds.
 *
 * @param rng - The seeded generator.
 * @returns An {@link AnimalBreedDraw}.
 * @example
 * ```ts
 * import { animalBreed, createRng } from "@cosyte/synth";
 * const { species, breed } = animalBreed(createRng(1));
 * ```
 */
export function animalBreed(rng: Rng): AnimalBreedDraw {
  const picked = rng.pick(SYNTHETIC_ANIMAL_SPECIES);
  const { breeds, ...bare } = picked;
  return { species: Object.freeze(bare), breed: rng.pick(breeds) };
}

/**
 * A **synthetic microchip**: 15 digits, {@link MICROCHIP_TEST_PREFIX} then twelve seeded digits, in
 * the ISO 11784 test-transponder range.
 *
 * @param rng - The seeded generator.
 * @returns A 15-digit string beginning `999`.
 * @example
 * ```ts
 * import { createRng, isSyntheticMicrochip, microchip } from "@cosyte/synth";
 * isSyntheticMicrochip(microchip(createRng(1))); // true
 * ```
 */
export function microchip(rng: Rng): string {
  return `${MICROCHIP_TEST_PREFIX}${rng.digits(12)}`;
}

/**
 * Whether a value is a synthetic microchip: exactly 15 digits beginning with
 * {@link MICROCHIP_TEST_PREFIX}.
 *
 * @param value - The value to test.
 * @returns `true` when the value is in the test-transponder range.
 * @example
 * ```ts
 * import { isSyntheticMicrochip } from "@cosyte/synth";
 * isSyntheticMicrochip("999000000000001"); // true
 * ```
 */
export function isSyntheticMicrochip(value: string): boolean {
  return /^999\d{12}$/.test(value);
}

/**
 * A **synthetic animal birth date** in `YYYYMMDD` form, from 0 to 20 years before `onDate`, both
 * ends included. `onDate` is a date the caller supplies (the generators pass the message date), never
 * the clock, so the same seed and date give the same birth date.
 *
 * @param rng - The seeded generator.
 * @param onDate - The reference date, `YYYYMMDD` (only its first eight digits are read).
 * @returns A `YYYYMMDD` date no later than `onDate` and no more than 20 years before it.
 * @example
 * ```ts
 * import { animalBirthDate, createRng } from "@cosyte/synth";
 * animalBirthDate(createRng(1), "20250101"); // between "20050101" and "20250101"
 * ```
 */
export function animalBirthDate(rng: Rng, onDate: string): string {
  const year = Number(onDate.slice(0, 4));
  const month = Number(onDate.slice(4, 6)) - 1;
  const day = Number(onDate.slice(6, 8));
  const latest = Date.UTC(year, month, day);
  // Twenty years back on the same month and day. A 29 February with no match twenty years
  // earlier rolls to 1 March, which is still inside the window.
  const earliest = Date.UTC(year - 20, month, day);
  const span = Math.round((latest - earliest) / 86_400_000);
  const born = new Date(latest - rng.int(0, span) * 86_400_000);
  // `toISOString` writes `YYYY-MM-DDTHH:mm:ss.sssZ` with the year in four digits for 0000 to 9999.
  return born.toISOString().slice(0, 10).replace(/-/g, "");
}
