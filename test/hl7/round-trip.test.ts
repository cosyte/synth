import { describe, expect, it } from "vitest";

import {
  generateAdt,
  roundTrip,
  hl7Corpus,
  componentsField,
  type AdtTrigger,
} from "../../src/hl7/index.js";
import { isSyntheticSsn, isSyntheticPhone } from "../../src/index.js";

const TRIGGERS: readonly AdtTrigger[] = ["A01", "A04", "A08"];

describe("HL7 v2 ADT generation — the round-trip harness proof", () => {
  it("every trigger round-trips through @cosyte/hl7 with zero warnings", () => {
    for (const trigger of TRIGGERS) {
      for (let seed = 0; seed < 200; seed += 1) {
        const result = roundTrip(generateAdt({ seed, trigger }));
        expect(result.warnings, `${trigger} seed=${String(seed)}`).toEqual([]);
        expect(result.byteStable).toBe(true);
        expect(result.specClean).toBe(true);
      }
    }
  });

  it("the generated message actually carries the intended structure", () => {
    const result = roundTrip(generateAdt({ seed: 7, trigger: "A01" }));
    expect(result.content).toContain("MSH|^~\\&|COSYTE-SYNTH|");
    expect(result.content).toContain("\rEVN|A01|");
    expect(result.content).toContain("\rPID|1||");
    expect(result.content).toContain("\rPV1|1|");
    expect(result.content).toContain("ADT^A01");
  });

  it("PHI-bearing fields are drawn from synthetic sources (structured sweep)", async () => {
    const { parseHL7 } = await import("@cosyte/hl7");
    for (let seed = 0; seed < 200; seed += 1) {
      const msg = parseHL7(generateAdt({ seed }).toString());
      const ssnField = msg.get("PID.19");
      const phoneField = msg.get("PID.13");
      const aa = msg.get("PID.3.4");
      expect(ssnField).toBeDefined();
      expect(isSyntheticSsn(ssnField ?? "")).toBe(true);
      expect(phoneField).toBeDefined();
      expect(isSyntheticPhone(phoneField ?? "")).toBe(true);
      expect(aa).toBe("COSYTE-SYNTH");
    }
  });

  it("is deterministic — same seed yields byte-identical output", () => {
    const a = generateAdt({ seed: 999, trigger: "A08" }).toString();
    const b = generateAdt({ seed: 999, trigger: "A08" }).toString();
    expect(a).toBe(b);
  });

  it("hl7Corpus builds a reproducible, spec-clean corpus", () => {
    const c1 = hl7Corpus({ seed: 42, count: 9 });
    const c2 = hl7Corpus({ seed: 42, count: 9 });
    expect(c1.artifacts.map((a) => a.content)).toEqual(c2.artifacts.map((a) => a.content));
    expect(c1.artifacts).toHaveLength(9);
    for (const artifact of c1.artifacts) {
      expect(artifact.warnings).toEqual([]);
      expect(artifact.format).toBe("hl7v2");
    }
    expect(c1.manifest.counts).toEqual({ "ADT^A01": 3, "ADT^A04": 3, "ADT^A08": 3 });
    expect(hl7Corpus({ seed: 1 }).artifacts).toHaveLength(1);
  });

  it("componentsField lays out HL7 components without escaping", () => {
    const field = componentsField(["Family", "Given"]);
    expect(field.repetitions[0]?.components).toHaveLength(2);
  });

  it("defaults seed to 0 and trigger to A01 when options are omitted", () => {
    const a = generateAdt().toString();
    const b = generateAdt({ seed: 0, trigger: "A01" }).toString();
    expect(a).toBe(b);
    expect(a).toContain("ADT^A01");
  });

  it("roundTrip surfaces the parser's warning codes on a non-spec-clean message", async () => {
    // An ADT with no PV1 (visit group) is a deliberately-incomplete message: the parser reports the
    // missing group. This exercises the harness's warning-mapping path — the first head of the
    // two-headed hazard (a false spec-clean claim would be caught here).
    const { buildMessage } = await import("@cosyte/hl7");
    const incomplete = buildMessage({
      type: "ADT^A01",
      controlId: "CID0000000001",
      timestamp: "20250101000000",
    }).addSegment("PID", ["1"]);
    const result = roundTrip(incomplete);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.specClean).toBe(false);
  });
});
