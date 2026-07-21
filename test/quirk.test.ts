/**
 * Unit tests for the **quirk core** (`src/quirk.ts`) — the format-agnostic contract machinery: exact
 * intended-warning comparison, fail-closed quirk resolution (`SYNTH_UNSUPPORTED_QUIRK`), the
 * suppressed-vs-rebadged profile disposition logic, and `defineSynthProfile` quirk validation.
 */

import { describe, it, expect } from "vitest";

import {
  resolveQuirk,
  sameCodeSet,
  profileTolerated,
  validateProfileQuirks,
  assertIntendedWarnings,
  PROFILE_QUIRK_APPLIED,
  defineSynthProfile,
  SynthError,
  SYNTH_FATAL_CODES,
  type QuirkDescriptor,
} from "../src/index.js";

const REGISTRY: Readonly<Record<string, QuirkDescriptor>> = Object.freeze({
  "demo-quirk": Object.freeze({
    name: "demo-quirk",
    format: "hl7v2",
    intendedWarnings: Object.freeze(["DEMO_CODE"]),
    grounding: "a public spec clause",
    toleratingProfile: "demo",
    disposition: "rebadged",
  }),
});

describe("sameCodeSet — exact multiset equality", () => {
  it("is order-independent", () => {
    expect(sameCodeSet(["A", "B"], ["B", "A"])).toBe(true);
  });
  it("respects multiplicity", () => {
    expect(sameCodeSet(["A", "A"], ["A"])).toBe(false);
    expect(sameCodeSet(["A"], ["A", "A"])).toBe(false);
    expect(sameCodeSet(["A", "A"], ["A", "A"])).toBe(true);
  });
  it("rejects a superset, a subset, and a disjoint set", () => {
    expect(sameCodeSet(["A"], ["A", "B"])).toBe(false);
    expect(sameCodeSet(["A", "B"], ["A"])).toBe(false);
    expect(sameCodeSet(["A"], ["B"])).toBe(false);
  });
  it("treats two empty sets as equal", () => {
    expect(sameCodeSet([], [])).toBe(true);
  });
});

describe("resolveQuirk — fail-closed on an unsupported quirk", () => {
  it("returns the descriptor for a known quirk", () => {
    expect(resolveQuirk(REGISTRY, "hl7v2", "demo-quirk").name).toBe("demo-quirk");
  });
  it("throws SYNTH_UNSUPPORTED_QUIRK for an unknown quirk, listing the supported ones", () => {
    try {
      resolveQuirk(REGISTRY, "hl7v2", "no-such");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SynthError);
      expect((err as SynthError).code).toBe(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_QUIRK);
      expect((err as SynthError).message).toContain("demo-quirk");
    }
  });
});

describe("profileTolerated — suppressed vs rebadged vs bare", () => {
  it("suppressed ⇒ tolerated iff the intended code is gone", () => {
    expect(profileTolerated("suppressed", ["X"], [])).toBe(true);
    expect(profileTolerated("suppressed", ["X"], ["X"])).toBe(false);
  });
  it("rebadged ⇒ tolerated iff the intended code is gone AND PROFILE_QUIRK_APPLIED is present", () => {
    expect(profileTolerated("rebadged", ["X"], [PROFILE_QUIRK_APPLIED])).toBe(true);
    expect(profileTolerated("rebadged", ["X"], ["X", PROFILE_QUIRK_APPLIED])).toBe(false);
    expect(profileTolerated("rebadged", ["X"], [])).toBe(false);
  });
  it("bare ⇒ never tolerated by a built-in", () => {
    expect(profileTolerated("bare", ["X"], [])).toBe(false);
    expect(profileTolerated("bare", ["X"], [PROFILE_QUIRK_APPLIED])).toBe(false);
  });
});

describe("assertIntendedWarnings — the generation-time contract self-check", () => {
  it("passes when the bare parse produced exactly the intended code(s)", () => {
    expect(() => assertIntendedWarnings("q", ["A"], ["A"])).not.toThrow();
  });
  it("throws when the bare parse produced no warning (a mislabeled fixture)", () => {
    expect(() => assertIntendedWarnings("q", ["A"], [])).toThrow(/intended-warning contract/);
  });
  it("throws when the bare parse produced a different or additional code", () => {
    expect(() => assertIntendedWarnings("q", ["A"], ["B"])).toThrow();
    expect(() => assertIntendedWarnings("q", ["A"], ["A", "B"])).toThrow();
  });
});

describe("validateProfileQuirks — a SynthProfile's quirks are checked against the registry", () => {
  it("returns the quirk names when all are supported", () => {
    const profile = defineSynthProfile({ name: "ok", quirks: ["demo-quirk"] });
    expect(validateProfileQuirks(profile, REGISTRY, "hl7v2")).toEqual(["demo-quirk"]);
  });
  it("throws SYNTH_UNSUPPORTED_QUIRK on the first unsupported quirk", () => {
    const profile = defineSynthProfile({ name: "bad", quirks: ["demo-quirk", "nope"] });
    expect(() => validateProfileQuirks(profile, REGISTRY, "hl7v2")).toThrowError(SynthError);
  });
  it("accepts a profile with no quirks", () => {
    const profile = defineSynthProfile({ name: "empty" });
    expect(validateProfileQuirks(profile, REGISTRY, "hl7v2")).toEqual([]);
  });
});
