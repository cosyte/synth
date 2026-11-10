/**
 * Every value this package exports is **deeply** frozen. The example-code pools, the quirk registries
 * and the fatal-code registry are shared module state: a seed maps to the same bytes only while no
 * caller can change what the generators draw from. A frozen array whose entries stay writable is not
 * that guarantee, because `EXAMPLE_DRUGS[0].ndc = "..."` would then change every later NewRx a seed
 * produces, in every caller of the module.
 */

import { describe, expect, it } from "vitest";

import * as root from "../src/index.js";
import * as hl7 from "../src/hl7/index.js";
import * as fhir from "../src/fhir/index.js";
import * as ccda from "../src/ccda/index.js";
import * as x12 from "../src/x12/index.js";
import * as ncpdp from "../src/ncpdp/index.js";
import * as astm from "../src/astm/index.js";
import * as deid from "../src/deid/index.js";
import { generateAstmResult } from "../src/astm/index.js";
import { generateNewRx } from "../src/ncpdp/index.js";
import { roundTrip as x12RoundTrip, generate837 } from "../src/x12/index.js";

const ENTRY_POINTS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  "@cosyte/synth": root,
  "@cosyte/synth/hl7": hl7,
  "@cosyte/synth/fhir": fhir,
  "@cosyte/synth/ccda": ccda,
  "@cosyte/synth/x12": x12,
  "@cosyte/synth/ncpdp": ncpdp,
  "@cosyte/synth/astm": astm,
  "@cosyte/synth/deid": deid,
};

/** The paths of every object reachable from `value` that is not frozen. Functions are not walked. */
function unfrozenPaths(value: unknown, path: string, seen: Set<object>, out: string[]): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) out.push(path);
  for (const [key, child] of Object.entries(value))
    unfrozenPaths(child, `${path}.${key}`, seen, out);
}

describe("exported data is deeply frozen", () => {
  for (const [entry, mod] of Object.entries(ENTRY_POINTS)) {
    it(`${entry}: no exported object, array or nested entry is writable`, () => {
      const out: string[] = [];
      const seen = new Set<object>();
      for (const [name, value] of Object.entries(mod)) unfrozenPaths(value, name, seen, out);
      expect(out).toEqual([]);
    });
  }

  it("a caller cannot rewrite a pool entry and so change what a seed generates", () => {
    const before = {
      astm: generateAstmResult({ seed: 7 }),
      ncpdp: generateNewRx({ seed: 7 }),
      x12: x12RoundTrip(generate837("P", { seed: 7 })).content,
    };
    // A JavaScript caller is not held to the `readonly` types: each write below throws in strict mode.
    const writes: (() => void)[] = [
      () => Object.assign(astm.EXAMPLE_ASTM_TESTS[0] as object, { units: "" }),
      () => Object.assign(ncpdp.EXAMPLE_DRUGS[0] as object, { ndc: "99999999999" }),
      () => Object.assign(x12.PROFESSIONAL_PROCEDURES[0] as object, { code: "00000" }),
      () => Object.assign(x12.DIAGNOSES[0] as object, { code: "Z00" }),
      () => Object.assign(root.SYNTH_FATAL_CODES, { SYNTH_EMPTY_POOL: "OTHER" }),
    ];
    for (const write of writes) expect(write).toThrow(TypeError);
    expect(generateAstmResult({ seed: 7 })).toBe(before.astm);
    expect(generateNewRx({ seed: 7 })).toBe(before.ncpdp);
    expect(x12RoundTrip(generate837("P", { seed: 7 })).content).toBe(before.x12);
    expect(root.SYNTH_FATAL_CODES.SYNTH_EMPTY_POOL).toBe("SYNTH_EMPTY_POOL");
  });
});
