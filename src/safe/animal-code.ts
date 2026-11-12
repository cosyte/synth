/**
 * The two helpers that build the animal species and breed list in `./animal.ts`. They live in a
 * module of their own, which the package does not export, so a test can call them directly and
 * every mutant in them meets a test of its own.
 *
 * @module
 */

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

/**
 * The local code system for species and breed codes, in the HL7 table 0396 form for a local
 * system (`99` followed by letters). The codes under it are ours and name nothing outside this
 * package.
 */
// Stryker disable all: a module-level value is built once, at import, so per-test coverage cannot
// attribute it to the tests that check it; test/safe-animal.test.ts asserts its exact value.
export const ANIMAL_CODE_SYSTEM = "99COSYTE";
// Stryker restore all

/**
 * A frozen species or breed code under {@link ANIMAL_CODE_SYSTEM}.
 *
 * @param value - Our own short code.
 * @param text - Its plain text.
 * @returns The frozen code.
 * @example
 * ```ts
 * animalCode("DOG", "Dog"); // { code: "DOG", text: "Dog", system: "99COSYTE" }
 * ```
 */
export function animalCode(value: string, text: string): AnimalCode {
  return Object.freeze({ code: value, text, system: ANIMAL_CODE_SYSTEM });
}

/**
 * A frozen species under {@link ANIMAL_CODE_SYSTEM}, holding its own frozen copy of its breeds.
 *
 * @param value - Our own short code.
 * @param text - Its plain text.
 * @param breeds - The breeds of this species.
 * @returns The frozen species.
 * @example
 * ```ts
 * animalSpecies("DOG", "Dog", [animalCode("DOG-BGL", "Beagle")]).breeds.length; // 1
 * ```
 */
export function animalSpecies(
  value: string,
  text: string,
  breeds: readonly AnimalCode[],
): AnimalSpecies {
  return Object.freeze({ ...animalCode(value, text), breeds: Object.freeze([...breeds]) });
}
