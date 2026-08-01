import { describe, expect, it } from "vitest";

import { SYNTH_FATAL_CODES, SYNTH_FATAL_MESSAGES, SynthError } from "../src/index.js";

describe("SYNTH_FATAL_CODES + SynthError", () => {
  it("every code is key === value (survives Object.values into a tripwire)", () => {
    for (const [key, value] of Object.entries(SYNTH_FATAL_CODES)) {
      expect(key).toBe(value);
    }
  });

  it("SynthError carries a stable code branchable without message matching", () => {
    const err = new SynthError(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_FORMAT);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("SynthError");
    expect(err.code).toBe(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_FORMAT);
  });

  it("takes no value parameter: the message is the registry entry, verbatim", () => {
    for (const code of Object.values(SYNTH_FATAL_CODES)) {
      expect(new SynthError(code).message).toBe(SYNTH_FATAL_MESSAGES[code]);
    }
  });

  it("exposes the fatal codes it documents", () => {
    expect(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_FORMAT).toBe("SYNTH_UNSUPPORTED_FORMAT");
    expect(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_QUIRK).toBe("SYNTH_UNSUPPORTED_QUIRK");
    expect(SYNTH_FATAL_CODES.SYNTH_QUIRK_ANCHOR_ABSENT).toBe("SYNTH_QUIRK_ANCHOR_ABSENT");
    expect(SYNTH_FATAL_CODES.SYNTH_INTENDED_WARNING_MISMATCH).toBe(
      "SYNTH_INTENDED_WARNING_MISMATCH",
    );
    expect(SYNTH_FATAL_CODES.SYNTH_UNMAPPED_CODE_SYSTEM).toBe("SYNTH_UNMAPPED_CODE_SYSTEM");
    expect(SYNTH_FATAL_CODES.SYNTH_INVALID_DECIMAL).toBe("SYNTH_INVALID_DECIMAL");
    expect(SYNTH_FATAL_CODES.SYNTH_INVALID_RANGE).toBe("SYNTH_INVALID_RANGE");
    expect(SYNTH_FATAL_CODES.SYNTH_EMPTY_POOL).toBe("SYNTH_EMPTY_POOL");
    expect(SYNTH_FATAL_CODES.SYNTH_INVALID_PROFILE).toBe("SYNTH_INVALID_PROFILE");
  });
});
