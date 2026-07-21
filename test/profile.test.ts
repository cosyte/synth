import { describe, expect, it } from "vitest";

import { defineSynthProfile } from "../src/index.js";

describe("defineSynthProfile — the growth-loop skeleton", () => {
  it("returns a frozen profile with defaulted quirks", () => {
    const p = defineSynthProfile({ name: "acme-hospital" });
    expect(p.name).toBe("acme-hospital");
    expect(p.quirks).toEqual([]);
    expect(Object.isFrozen(p)).toBe(true);
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

  it("rejects a missing or blank name", () => {
    expect(() => defineSynthProfile({ name: "" })).toThrow(TypeError);
    expect(() => defineSynthProfile({ name: "   " })).toThrow(TypeError);
  });
});
