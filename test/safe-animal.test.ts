/**
 * The synthetic animal providers, held to their sources: the species and breed list written out
 * here on its own, the pet-name pool, the microchip range beginning 999, and the birth-date window
 * of 0 to 20 years before a given date, to its exact ends.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  ANIMAL_CODE_SYSTEM,
  MICROCHIP_TEST_PREFIX,
  SYNTHETIC_ANIMAL_SPECIES,
  SYNTHETIC_PET_NAMES,
  animalBirthDate,
  animalBreed,
  createRng,
  isSyntheticMicrochip,
  microchip,
  petName,
  safe,
  type Rng,
} from "../src/index.js";
import { animalCode, animalSpecies } from "../src/safe/animal-code.js";
import { checkProperty } from "./support/property.js";

const anySeed = (): fc.Arbitrary<number> => fc.integer({ min: -(2 ** 31), max: 2 ** 31 - 1 });

/** Our own list, written out: species code, text, then each breed's code and text. */
const OUR_LIST: readonly (readonly [string, string, readonly (readonly [string, string])[]])[] = [
  [
    "DOG",
    "Dog",
    [
      ["DOG-LAB", "Labrador Retriever"],
      ["DOG-BGL", "Beagle"],
      ["DOG-MIX", "Mixed breed dog"],
    ],
  ],
  [
    "CAT",
    "Cat",
    [
      ["CAT-DSH", "Domestic Shorthair"],
      ["CAT-SIA", "Siamese"],
    ],
  ],
  [
    "HORSE",
    "Horse",
    [
      ["HRS-QTR", "Quarter Horse"],
      ["HRS-TB", "Thoroughbred"],
    ],
  ],
  [
    "CATTLE",
    "Cattle",
    [
      ["CTL-HOL", "Holstein"],
      ["CTL-ANG", "Angus"],
    ],
  ],
];

/**
 * An `Rng` whose every `int(min, max)` returns one end of its range: enough to drive
 * {@link animalBirthDate} to its earliest or latest day.
 */
function endRng(end: "min" | "max"): Rng {
  return {
    seed: 0,
    nextUint32: () => 0,
    float: () => 0,
    int: (min: number, max: number) => (end === "min" ? min : max),
    bool: () => false,
    pick: <T>(items: readonly T[]): T => items[0] as T,
    digits: (n: number) => "0".repeat(n),
  };
}

describe("species and breed: our own short list", () => {
  it("is exactly the list written out here, every code under the local system", () => {
    expect(ANIMAL_CODE_SYSTEM).toBe("99COSYTE");
    expect(
      SYNTHETIC_ANIMAL_SPECIES.map((s) => [s.code, s.text, s.breeds.map((b) => [b.code, b.text])]),
    ).toEqual(OUR_LIST);
    for (const s of SYNTHETIC_ANIMAL_SPECIES) {
      expect(s.system).toBe(ANIMAL_CODE_SYSTEM);
      for (const b of s.breeds) expect(b.system).toBe(ANIMAL_CODE_SYSTEM);
    }
  });

  it("draws a breed of the species it draws, and the species carries no breed list", () => {
    checkProperty(
      fc.property(anySeed(), (s) => {
        const { species, breed } = animalBreed(createRng(s));
        const entry = SYNTHETIC_ANIMAL_SPECIES.find((x) => x.code === species.code);
        expect(entry).toBeDefined();
        expect(species).toEqual({ code: entry?.code, text: entry?.text, system: "99COSYTE" });
        expect(entry?.breeds).toContain(breed);
      }),
    );
  });

  it("draws every pair over a sweep of seeds", () => {
    const seen = new Set<string>();
    for (let s = 0; s < 300; s += 1) {
      const { species, breed } = animalBreed(createRng(s));
      seen.add(`${species.code}/${breed.code}`);
    }
    expect(seen.size).toBe(OUR_LIST.reduce((n, [, , breeds]) => n + breeds.length, 0));
  });
});

describe("the two helpers that build the list", () => {
  it("make a frozen code under the local system", () => {
    const made = animalCode("X-1", "Example");
    expect(made).toEqual({ code: "X-1", text: "Example", system: "99COSYTE" });
    expect(Object.isFrozen(made)).toBe(true);
  });

  it("make a frozen species that holds its own frozen copy of the breeds", () => {
    const breeds = [animalCode("X-1", "Example one"), animalCode("X-2", "Example two")];
    const made = animalSpecies("X", "Example", breeds);
    expect(made).toEqual({ code: "X", text: "Example", system: "99COSYTE", breeds });
    expect(Object.isFrozen(made)).toBe(true);
    expect(Object.isFrozen(made.breeds)).toBe(true);
    expect(made.breeds).not.toBe(breeds);
  });
});

describe("pet names", () => {
  it("come only from the invented pool, and the sweep draws every one", () => {
    const seen = new Set<string>();
    for (let s = 0; s < 300; s += 1) {
      const value = petName(createRng(s));
      expect(SYNTHETIC_PET_NAMES).toContain(value);
      seen.add(value);
    }
    expect(seen.size).toBe(SYNTHETIC_PET_NAMES.length);
    expect(SYNTHETIC_PET_NAMES.length).toBe(12);
  });

  it("are each declared synthetic to the PHI scan, which reads PID-5", () => {
    const allowList = readFileSync(
      join(import.meta.dirname, "..", "scripts", "phi-allow-list.txt"),
      "utf8",
    ).split(/\r?\n/);
    for (const value of SYNTHETIC_PET_NAMES) {
      expect(allowList, value).toContain(`NAME ${value.toUpperCase()}`);
    }
  });
});

describe("microchips: 15 digits beginning 999", () => {
  it("are 15 digits beginning 999", () => {
    expect(MICROCHIP_TEST_PREFIX).toBe("999");
    checkProperty(
      fc.property(anySeed(), (s) => {
        const value = microchip(createRng(s));
        expect(value).toMatch(/^999[0-9]{12}$/);
        expect(isSyntheticMicrochip(value)).toBe(true);
      }),
    );
  });

  it("the predicate refuses everything else", () => {
    expect(isSyntheticMicrochip("999000000000000")).toBe(true);
    expect(isSyntheticMicrochip("999999999999999")).toBe(true);
    for (const bad of [
      "99900000000000", // 14 digits
      "9990000000000000", // 16 digits
      "998000000000000", // a manufacturer code
      "840000000000000", // a country code
      "x999000000000000", // 15 test-range digits after a letter
      "999000000000000x", // 15 test-range digits before a letter
      "999 00000000000",
      "99900000000000a",
      "",
    ]) {
      expect(isSyntheticMicrochip(bad), bad).toBe(false);
    }
  });
});

describe("animal birth dates: 0 to 20 years before the given date", () => {
  it("reach exactly the given date and exactly twenty years before it", () => {
    expect(animalBirthDate(endRng("min"), "20250714")).toBe("20250714");
    expect(animalBirthDate(endRng("max"), "20250714")).toBe("20050714");
    expect(animalBirthDate(endRng("max"), "20250714093000")).toBe("20050714");
    expect(animalBirthDate(endRng("min"), "20230105")).toBe("20230105");
    expect(animalBirthDate(endRng("max"), "20230105")).toBe("20030105");
    // 29 February with no match twenty years before rolls to 1 March, inside the window.
    expect(animalBirthDate(endRng("max"), "20240229")).toBe("20040229");
    expect(animalBirthDate(endRng("max"), "20200229")).toBe("20000229");
    expect(animalBirthDate(endRng("max"), "19200229")).toBe("19000301");
  });

  it("stay inside the window for every seed, and are a function of the seed", () => {
    checkProperty(
      fc.property(
        anySeed(),
        fc.integer({ min: 2000, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (s, y, m, d) => {
          const on = `${String(y)}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
          const dob = animalBirthDate(createRng(s), on);
          expect(dob).toMatch(/^\d{8}$/);
          expect(dob <= on).toBe(true);
          expect(dob >= `${String(y - 20)}${on.slice(4)}`).toBe(true);
          expect(animalBirthDate(createRng(s), on)).toBe(dob);
        },
      ),
    );
  });
});

describe("the safe namespace carries the animal providers", () => {
  it("is the same functions", () => {
    expect(safe.petName).toBe(petName);
    expect(safe.animalBreed).toBe(animalBreed);
    expect(safe.microchip).toBe(microchip);
    expect(safe.animalBirthDate).toBe(animalBirthDate);
  });
});

describe("the how-to states only what we emit about its codes", () => {
  const howTo = readFileSync(
    join(import.meta.dirname, "..", "docs-content", "guides-animal-patients.md"),
    "utf8",
  );

  it("cites no page for OWN, MCN or the 999 range", () => {
    expect(howTo).not.toMatch(/caristix/i);
    expect(howTo).not.toMatch(/ICAR/);
  });

  it("says each of the three is not verified against the standard", () => {
    const section = howTo.slice(howTo.indexOf("## Where each value comes from"));
    for (const subject of ["`OWN`", "`MCN`", "`999`"]) {
      const bullet = section.split("\n- ").find((b) => b.includes(subject)) ?? "";
      expect(bullet, subject).toMatch(/not verified/);
    }
  });
});
