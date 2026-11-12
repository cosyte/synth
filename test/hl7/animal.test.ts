/**
 * The opt-in animal subject (`subject: "animal"`) on the `ADT` and `ORU` generators. An animal
 * message carries the pet's name in PID-5, a record number and a 15-digit test-range microchip in
 * PID-3, the species in PID-35 and the breed in PID-36 as text under the local code system, a birth
 * date within twenty years of the message date, and the owner in an `NK1` with relationship `OWN`.
 * Each round-trips through `@cosyte/hl7` with zero warnings and is a pure function of its seed, and
 * the default (`subject` left out, or `"person"`) keeps the bytes it had.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseHL7 } from "@cosyte/hl7";

import {
  ANIMAL_CODE_SYSTEM,
  MICROCHIP_TEST_PREFIX,
  SYNTHETIC_ANIMAL_SPECIES,
  SYNTHETIC_ASSIGNING_AUTHORITY,
  SYNTHETIC_FAMILY_NAMES,
  SYNTHETIC_GIVEN_NAMES,
  SYNTHETIC_PET_NAMES,
  SYNTH_FATAL_CODES,
  SynthError,
  isSyntheticMicrochip,
  isSyntheticPhone,
} from "../../src/index.js";
import { adtTriggers } from "../../src/hl7/adt.js";
import {
  generateAdt,
  generateOru,
  roundTrip,
  type AdtTrigger,
  type Hl7Subject,
} from "../../src/hl7/index.js";
import { checkProperty } from "../support/property.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });
const TRIGGERS: readonly AdtTrigger[] = adtTriggers();

/** Each animal message under test, by label. */
function animalMessages(s: number): readonly [string, string][] {
  return [
    ...TRIGGERS.map((t): [string, string] => [
      `ADT^${t}`,
      generateAdt({ seed: s, trigger: t, subject: "animal" }).toString(),
    ]),
    ["ORU^R01", generateOru({ seed: s, subject: "animal" }).toString()],
  ];
}

/** Whole years between two `YYYYMMDD` dates, `from` not after `to`. */
function yearsBetween(from: string, to: string): number {
  const a = Number(from);
  const b = Number(to);
  return Math.floor((b - a) / 10000);
}

describe("the animal subject on ADT and ORU", () => {
  it("round-trips through @cosyte/hl7 with zero warnings for every trigger and ORU", () => {
    for (const s of [0, 1, 7, 42, 12345]) {
      for (const t of TRIGGERS) {
        const rt = roundTrip(generateAdt({ seed: s, trigger: t, subject: "animal" }));
        expect(rt.warnings, `ADT^${t} seed ${String(s)}`).toEqual([]);
        expect(rt.specClean).toBe(true);
      }
      const oru = roundTrip(generateOru({ seed: s, subject: "animal" }));
      expect(oru.warnings, `ORU seed ${String(s)}`).toEqual([]);
      expect(oru.specClean).toBe(true);
    }
  });

  it("writes the pet, its microchip, species, breed, birth date and owner where they belong", () => {
    checkProperty(
      fc.property(seed(), (s) => {
        for (const [label, content] of animalMessages(s)) {
          const msg = parseHL7(content);

          // PID-5: the owner's family name, the pet's name as the given name.
          expect(SYNTHETIC_FAMILY_NAMES, label).toContain(msg.get("PID.5.1"));
          expect(SYNTHETIC_PET_NAMES, label).toContain(msg.get("PID.5.2"));

          // PID-3: the record number first, then the microchip with its own identifier type.
          expect(msg.get("PID.3[0].4"), label).toBe(SYNTHETIC_ASSIGNING_AUTHORITY.namespaceId);
          expect(msg.get("PID.3[0].5"), label).toBe("MR");
          const chip = msg.get("PID.3[1].1") ?? "";
          expect(chip, label).toMatch(/^\d{15}$/);
          expect(chip.startsWith(MICROCHIP_TEST_PREFIX), label).toBe(true);
          expect(isSyntheticMicrochip(chip), label).toBe(true);
          expect(msg.get("PID.3[1].5"), label).toBe("MCN");

          // PID-35 species and PID-36 breed: text under the local code system, from the list.
          const speciesCode = msg.get("PID.35.1");
          const species = SYNTHETIC_ANIMAL_SPECIES.find((x) => x.code === speciesCode);
          expect(species, label).toBeDefined();
          expect(msg.get("PID.35.2"), label).toBe(species?.text);
          expect(msg.get("PID.35.3"), label).toBe(ANIMAL_CODE_SYSTEM);
          const breed = species?.breeds.find((b) => b.code === msg.get("PID.36.1"));
          expect(breed, label).toBeDefined();
          expect(msg.get("PID.36.2"), label).toBe(breed?.text);
          expect(msg.get("PID.36.3"), label).toBe(ANIMAL_CODE_SYSTEM);

          // PID-7: within 0 to 20 years before the message date (MSH-7).
          const runDate = (msg.get("MSH.7") ?? "").slice(0, 8);
          const dob = msg.get("PID.7") ?? "";
          expect(dob <= runDate, `${label} ${dob} after ${runDate}`).toBe(true);
          expect(yearsBetween(dob, runDate), `${label} ${dob} ${runDate}`).toBeLessThanOrEqual(20);

          // PID-8: the animal's sex, M or F.
          expect(["M", "F"], label).toContain(msg.get("PID.8"));

          // A person's SSN never rides on an animal.
          expect(msg.get("PID.19") ?? "", label).toBe("");

          // NK1: the owner, relationship OWN from HL7 table 0063.
          expect(msg.get("NK1.1"), label).toBe("1");
          expect(msg.get("NK1.2.1"), label).toBe(msg.get("PID.5.1"));
          expect(SYNTHETIC_GIVEN_NAMES, label).toContain(msg.get("NK1.2.2"));
          expect(msg.get("NK1.3.1"), label).toBe("OWN");
          expect(msg.get("NK1.3.2"), label).toBe("Owner");
          expect(msg.get("NK1.3.3"), label).toBe("HL70063");
          expect(msg.get("NK1.4.5"), label).toBe("00000");
          expect(isSyntheticPhone(msg.get("NK1.5") ?? ""), label).toBe(true);
          expect(msg.get("PID.11.1"), label).toBe(msg.get("NK1.4.1"));
        }
      }),
    );
  });

  it("writes these exact PID and NK1 segments for seed 42", () => {
    const lines = generateAdt({ seed: 42, subject: "animal" }).toString().split("\r");
    expect(lines.find((l) => l.startsWith("PID|"))).toBe(
      "PID|1||38781325^^^COSYTE-SYNTH^MR~999817111682964^^^COSYTE-SYNTH^MCN||Examplewood^Seedpup||" +
        "20071226|F|||7927 Example Boulevard^^Exampleburg^ND^00000||(441) 555-0193" +
        "|".repeat(22) +
        "HORSE^Horse^99COSYTE|HRS-TB^Thoroughbred^99COSYTE",
    );
    expect(lines.find((l) => l.startsWith("NK1|"))).toBe(
      "NK1|1|Examplewood^Mocktavia|OWN^Owner^HL70063|" +
        "7927 Example Boulevard^^Exampleburg^ND^00000|(441) 555-0193",
    );
  });

  it("puts NK1 right after PID", () => {
    for (const [label, content] of animalMessages(3)) {
      const ids = content
        .split("\r")
        .filter((line) => line.length > 0)
        .map((line) => line.slice(0, 3));
      expect(ids[ids.indexOf("PID") + 1], label).toBe("NK1");
    }
  });

  it("is a pure function of its seed", () => {
    checkProperty(
      fc.property(seed(), (s) => {
        expect(animalMessages(s)).toEqual(animalMessages(s));
      }),
    );
  });

  it("draws both sexes over a sweep of seeds", () => {
    const sexes = new Set<string>();
    for (let s = 0; s < 40; s += 1) {
      sexes.add(parseHL7(generateOru({ seed: s, subject: "animal" }).toString()).get("PID.8") ?? "");
    }
    expect([...sexes].sort()).toEqual(["F", "M"]);
  });

  it("draws every species and every breed over a sweep of seeds", () => {
    const seen = new Set<string>();
    for (let s = 0; s < 400; s += 1) {
      const msg = parseHL7(generateAdt({ seed: s, subject: "animal" }).toString());
      seen.add(`${msg.get("PID.35.1") ?? ""}/${msg.get("PID.36.1") ?? ""}`);
    }
    const all = SYNTHETIC_ANIMAL_SPECIES.flatMap((x) => x.breeds.map((b) => `${x.code}/${b.code}`));
    expect([...seen].sort()).toEqual([...all].sort());
  });

  it("leaves the default output byte for byte as it was", () => {
    for (const s of [0, 1, 99, 2024]) {
      for (const t of TRIGGERS) {
        const plain = generateAdt({ seed: s, trigger: t }).toString();
        expect(generateAdt({ seed: s, trigger: t, subject: "person" }).toString()).toBe(plain);
        expect(plain).not.toContain("\rNK1|");
      }
      expect(generateOru({ seed: s, subject: "person" }).toString()).toBe(
        generateOru({ seed: s }).toString(),
      );
    }
  });

  it("refuses a subject it does not know, quoting nothing", () => {
    const bad = "unicorn" as Hl7Subject;
    for (const call of [
      () => generateAdt({ seed: 1, subject: bad }),
      () => generateOru({ seed: 1, subject: bad }),
    ]) {
      let caught: unknown;
      try {
        call();
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(SynthError);
      expect((caught as SynthError).code).toBe(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_KIND);
      expect((caught as SynthError).message).not.toContain("unicorn");
    }
  });
});
