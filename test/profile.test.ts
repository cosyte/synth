import { describe, expect, it } from "vitest";

import { defineSynthProfile, SynthError, SYNTH_FATAL_CODES } from "../src/index.js";

describe("defineSynthProfile: the growth-loop skeleton", () => {
  it("leaves quirks out of a profile whose spec leaves them out", () => {
    // An omitted `quirks` field is not an empty list: the first leaves the quirk selection to the
    // corpus default, the second selects nothing.
    const p = defineSynthProfile({ name: "acme-hospital" });
    expect(p.name).toBe("acme-hospital");
    expect("quirks" in p).toBe(false);
    expect(p.quirks).toBeUndefined();
    expect(Object.isFrozen(p)).toBe(true);
  });

  it("keeps an empty quirks list as an empty list, frozen", () => {
    const p = defineSynthProfile({ name: "acme-hospital", quirks: [] });
    expect(p.quirks).toEqual([]);
    expect(Object.isFrozen(p.quirks)).toBe(true);
  });

  it("carries value-pool overrides and quirks, frozen", () => {
    const p = defineSynthProfile({
      name: "site-b",
      givenNames: ["Testina"],
      familyNames: ["Testerson"],
      quirks: ["non-standard-delimiters"],
    });
    expect(p.givenNames).toEqual(["Testina"]);
    expect(p.familyNames).toEqual(["Testerson"]);
    expect(p.quirks).toEqual(["non-standard-delimiters"]);
    expect(Object.isFrozen(p.quirks)).toBe(true);
    expect(Object.isFrozen(p.givenNames)).toBe(true);
  });

  it("rejects a missing or blank name with a coded SynthError", () => {
    for (const name of ["", "   "]) {
      expect(() => defineSynthProfile({ name })).toThrow(SynthError);
      try {
        defineSynthProfile({ name });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect((err as SynthError).code).toBe(SYNTH_FATAL_CODES.SYNTH_INVALID_PROFILE);
      }
    }
  });

  it("hands a caller-authored name straight back, unvalidated beyond being non-blank", () => {
    // A profile name is the caller's own label, not a value this package derives, so it is carried
    // rather than bounded. What matters is that no code path interpolates it into a diagnostic,
    // which test/phi/diagnostic-surface.test.ts asserts per position.
    expect(defineSynthProfile({ name: "acme-hospital/site 3" }).name).toBe("acme-hospital/site 3");
  });
});
