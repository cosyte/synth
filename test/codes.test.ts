import { describe, expect, it } from "vitest";

import { SYNTH_FATAL_CODES, SynthError } from "../src/index.js";

describe("SYNTH_FATAL_CODES + SynthError", () => {
  it("every code is key === value (survives Object.values into a tripwire)", () => {
    for (const [key, value] of Object.entries(SYNTH_FATAL_CODES)) {
      expect(key).toBe(value);
    }
  });

  it("SynthError carries a stable code branchable without message matching", () => {
    const err = new SynthError(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_FORMAT, "astm not generable");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("SynthError");
    expect(err.code).toBe(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_FORMAT);
    expect(err.message).toContain("astm");
  });

  it("exposes both fatal codes", () => {
    expect(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_FORMAT).toBe("SYNTH_UNSUPPORTED_FORMAT");
    expect(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_QUIRK).toBe("SYNTH_UNSUPPORTED_QUIRK");
  });
});
