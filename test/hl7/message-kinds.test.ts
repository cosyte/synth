/**
 * The HL7 v2 message kinds added after the first seven: `ACK`, the `ADT` transfer, discharge, cancel
 * and person-information events, `MDM^T02`, `DFT^P03` and `OML^O21`. Each round-trips through
 * `@cosyte/hl7` with zero warnings, carries the segments and the field values its published structure
 * and trigger event call for, and is a pure function of its seed. The committed golden fixtures under
 * `test/fixtures/hl7/` must regenerate byte for byte from their seeds.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { buildMessage, parseHL7, type Hl7Message } from "@cosyte/hl7";

import {
  HL7_MESSAGE_KINDS,
  generateAck,
  generateAdt,
  generateDft,
  generateHl7,
  generateMdm,
  generateOml,
  generateOrm,
  generateOru,
  generateSiu,
  generateVxu,
  hl7Corpus,
  roundTrip,
  type AdtTrigger,
  type Hl7MessageKind,
} from "../../src/hl7/index.js";
import { SYNTH_FATAL_CODES, SynthError } from "../../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX_DIR = join(HERE, "..", "fixtures", "hl7");

/** The kinds this file covers, in the order the subpath lists them. */
const NEW_KINDS: readonly Hl7MessageKind[] = [
  "ACK",
  "ADT^A02",
  "ADT^A03",
  "ADT^A11",
  "ADT^A13",
  "ADT^A28",
  "ADT^A31",
  "MDM^T02",
  "DFT^P03",
  "OML^O21",
];

/** The segment ids of a message, in order. */
function segmentIds(message: Hl7Message): string[] {
  return message
    .toString()
    .split("\r")
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, 3));
}

/** A field of a message read back through the parser, `""` when absent. */
function field(message: Hl7Message, path: string): string {
  return parseHL7(message.toString()).get(path) ?? "";
}

/** Field `n` of every `OBX` in a message's wire text (`OBX-1` is index 1). */
function obxFields(message: Hl7Message, n: number): string[] {
  return message
    .toString()
    .split("\r")
    .filter((line) => line.startsWith("OBX|"))
    .map((line) => line.split("|")[n] ?? "");
}

/** Seconds between two `YYYYMMDDHHMMSS` timestamps. */
function secondsBetween(from: string, to: string): number {
  const at = (ts: string): number =>
    Date.UTC(
      Number(ts.slice(0, 4)),
      Number(ts.slice(4, 6)) - 1,
      Number(ts.slice(6, 8)),
      Number(ts.slice(8, 10)),
      Number(ts.slice(10, 12)),
      Number(ts.slice(12, 14)),
    );
  return (at(to) - at(from)) / 1000;
}

/** The fatal code a thunk throws, or `undefined` when it does not throw a `SynthError`. */
function fatalCode(thunk: () => unknown): string | undefined {
  try {
    thunk();
  } catch (err) {
    return err instanceof SynthError ? err.code : undefined;
  }
  return undefined;
}

describe("the HL7 v2 kind list", () => {
  it("lists the first seven kinds and then every added kind, frozen", () => {
    expect(HL7_MESSAGE_KINDS).toEqual([
      "ADT^A01",
      "ADT^A04",
      "ADT^A08",
      "ORU^R01",
      "ORM^O01",
      "SIU^S12",
      "VXU^V04",
      ...NEW_KINDS,
    ]);
    expect(Object.isFrozen(HL7_MESSAGE_KINDS)).toBe(true);
  });

  it("the default corpus mix is still the first seven kinds, so a seed's corpus is unchanged", () => {
    const first = HL7_MESSAGE_KINDS.slice(0, 7);
    const corpus = hl7Corpus({ seed: 42, count: 14 });
    expect(corpus.artifacts.map((a) => a.kind)).toEqual([...first, ...first]);
  });

  it("a corpus mix of every kind cycles through all of them, each spec-clean", () => {
    const corpus = hl7Corpus({ seed: 9, count: HL7_MESSAGE_KINDS.length, mix: HL7_MESSAGE_KINDS });
    expect(corpus.artifacts.map((a) => a.kind)).toEqual([...HL7_MESSAGE_KINDS]);
    for (const artifact of corpus.artifacts) {
      expect(artifact.warnings, artifact.kind).toEqual([]);
      expect(artifact.content.split("\r")[0]).toContain(`|${artifact.kind}`);
    }
  });

  it("the ADT triggers option accepts every ADT trigger", () => {
    const triggers: readonly AdtTrigger[] = ["A02", "A03", "A11", "A13", "A28", "A31"];
    const corpus = hl7Corpus({ seed: 3, count: 6, triggers });
    expect(corpus.artifacts.map((a) => a.kind)).toEqual(triggers.map((t) => `ADT^${t}`));
  });
});

describe("every added kind round-trips through @cosyte/hl7 with zero warnings", () => {
  for (const kind of NEW_KINDS) {
    it(`${kind} is spec-clean and byte-stable across many seeds`, () => {
      for (let seed = 0; seed < 150; seed += 1) {
        const result = roundTrip(generateHl7(kind, seed));
        expect(result.warnings, `${kind} seed=${String(seed)}`).toEqual([]);
        expect(result.byteStable, `${kind} seed=${String(seed)}`).toBe(true);
      }
    });

    it(`${kind} is deterministic in its seed and differs between seeds`, () => {
      expect(generateHl7(kind, 77).toString()).toBe(generateHl7(kind, 77).toString());
      expect(generateHl7(kind, 77).toString()).not.toBe(generateHl7(kind, 78).toString());
    });

    it(`${kind} is marked as test data in MSH-11 and stamped 2.5 in MSH-12`, () => {
      const message = generateHl7(kind, 5);
      expect(field(message, "MSH.11")).toBe("T");
      expect(field(message, "MSH.12")).toBe("2.5");
    });
  }
});

describe("ADT transfer, discharge, cancel and person-information events", () => {
  it("each trigger names its event in MSH-9, its structure in MSH-9.3 and its code in EVN-1", () => {
    const structures: Readonly<Record<string, string>> = {
      A02: "ADT_A02",
      A03: "ADT_A03",
      A11: "ADT_A09",
      A13: "ADT_A01",
      A28: "ADT_A05",
      A31: "ADT_A05",
    };
    for (const [trigger, structure] of Object.entries(structures)) {
      const message = generateAdt({ seed: 11, trigger: trigger as AdtTrigger });
      expect(segmentIds(message)).toEqual(["MSH", "EVN", "PID", "PV1"]);
      expect(field(message, "MSH.9.1")).toBe("ADT");
      expect(field(message, "MSH.9.2")).toBe(trigger);
      expect(field(message, "MSH.9.3")).toBe(structure);
      expect(field(message, "EVN.1")).toBe(trigger);
      expect(field(message, "EVN.2")).toBe(field(message, "MSH.7"));
      expect(field(message, "PV1.1")).toBe("1");
    }
  });

  it("the first three triggers keep their two-component MSH-9", () => {
    for (const trigger of ["A01", "A04", "A08"] as const) {
      expect(field(generateAdt({ seed: 11, trigger }), "MSH.9.3")).toBe("");
    }
  });

  it("A02 moves an inpatient from a prior location in PV1-6 to a new one in PV1-3", () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const message = generateAdt({ seed, trigger: "A02" });
      expect(field(message, "PV1.2")).toBe("I");
      expect(field(message, "PV1.3.1")).toBe("SYNTHWARD");
      expect(field(message, "PV1.6.1")).toBe("SYNTHWARD");
      expect(field(message, "PV1.3.2")).toMatch(/^\d{3}$/);
      expect(field(message, "PV1.6.2")).toMatch(/^\d{3}$/);
      expect(field(message, "PV1.3.3")).toBe("01");
      expect(field(message, "PV1.6.3")).toBe("01");
      expect(field(message, "PV1.6.2")).not.toBe(field(message, "PV1.3.2"));
    }
  });

  it("A03 carries an admit time in PV1-44 before the discharge time in PV1-45", () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const message = generateAdt({ seed, trigger: "A03" });
      const admit = field(message, "PV1.44");
      const discharge = field(message, "PV1.45");
      expect(discharge).toBe(field(message, "MSH.7"));
      expect(admit).toMatch(/^\d{14}$/);
      const stay = secondsBetween(admit, discharge);
      expect(stay).toBeGreaterThanOrEqual(3600);
      expect(stay).toBeLessThanOrEqual(14 * 86400);
      expect(["I", "O", "E"]).toContain(field(message, "PV1.2"));
      expect(field(message, "PV1.3.1")).toBe("SYNTHWARD");
    }
  });

  it("A11 and A13 carry a visit with a location, and A13 the admit time it reopens", () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const cancelAdmit = generateAdt({ seed, trigger: "A11" });
      expect(["I", "O", "E"]).toContain(field(cancelAdmit, "PV1.2"));
      expect(field(cancelAdmit, "PV1.3.1")).toBe("SYNTHWARD");
      expect(field(cancelAdmit, "PV1.44")).toBe("");

      const cancelDischarge = generateAdt({ seed, trigger: "A13" });
      expect(field(cancelDischarge, "PV1.2")).toBe("I");
      expect(field(cancelDischarge, "PV1.3.1")).toBe("SYNTHWARD");
      expect(field(cancelDischarge, "PV1.45")).toBe("");
      const admit = field(cancelDischarge, "PV1.44");
      expect(admit).toMatch(/^\d{14}$/);
      expect(secondsBetween(admit, field(cancelDischarge, "MSH.7"))).toBeGreaterThanOrEqual(3600);
    }
  });

  it("A28 and A31 are person-level: the patient class is N (not applicable) and no location", () => {
    for (const trigger of ["A28", "A31"] as const) {
      const message = generateAdt({ seed: 4, trigger });
      expect(field(message, "PV1.2")).toBe("N");
      expect(field(message, "PV1.3")).toBe("");
    }
  });
});

describe("MDM^T02: original document notification and content", () => {
  it("carries EVN, PID, PV1, TXA and the document body in OBX", () => {
    const message = generateMdm({ seed: 21 });
    const ids = segmentIds(message);
    expect(ids.slice(0, 5)).toEqual(["MSH", "EVN", "PID", "PV1", "TXA"]);
    expect(ids.slice(5).every((id) => id === "OBX")).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(6);
    expect(field(message, "MSH.9")).toBe("MDM");
    expect(field(message, "MSH.9.2")).toBe("T02");
    expect(field(message, "MSH.9.3")).toBe("MDM_T02");
    expect(field(message, "EVN.1")).toBe("T02");
    expect(field(message, "EVN.2")).toBe(field(message, "MSH.7"));
  });

  it("fills the required TXA fields, and the parser reads the document back", () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const message = generateMdm({ seed });
      expect(field(message, "TXA.1")).toBe("1");
      expect(["CN", "DS", "HP", "PN"]).toContain(field(message, "TXA.2"));
      expect(field(message, "TXA.3")).toBe("TX");
      expect(field(message, "TXA.4")).toBe(field(message, "MSH.7"));
      expect(field(message, "TXA.12.1")).toMatch(/^SYNTHDOC\d{10}$/);
      expect(field(message, "TXA.12.2")).toBe("COSYTE-SYNTH");
      expect(field(message, "TXA.17")).toBe("DO");
      expect(["I", "O", "E"]).toContain(field(message, "PV1.2"));

      const obx = obxFields(message, 5);
      expect(obx.length).toBeGreaterThanOrEqual(1);
      expect(obx.length).toBeLessThanOrEqual(3);
      expect(obxFields(message, 1)).toEqual(obx.map((_line, i) => String(i + 1)));
      expect(new Set(obxFields(message, 2))).toEqual(new Set(["TX"]));
      expect(new Set(obxFields(message, 11))).toEqual(new Set(["F"]));
      expect(new Set(obxFields(message, 3))).toEqual(new Set(["SYNTHNOTE^Synthetic note^99SYN"]));
      for (const line of obx) expect(line).toMatch(/^Synthetic /);
    }
  });

  it("the document type and the body vary with the seed", () => {
    const types = new Set<string>();
    const lengths = new Set<number>();
    for (let seed = 0; seed < 80; seed += 1) {
      const message = generateMdm({ seed });
      types.add(field(message, "TXA.2"));
      lengths.add(obxFields(message, 5).length);
    }
    expect(types).toEqual(new Set(["CN", "DS", "HP", "PN"]));
    expect(lengths).toEqual(new Set([1, 2, 3]));
  });
});

describe("DFT^P03: post detail financial transactions", () => {
  it("carries EVN, PID, PV1 and one FT1 charge", () => {
    const message = generateDft({ seed: 31 });
    expect(segmentIds(message)).toEqual(["MSH", "EVN", "PID", "PV1", "FT1"]);
    expect(field(message, "MSH.9")).toBe("DFT");
    expect(field(message, "MSH.9.2")).toBe("P03");
    expect(field(message, "MSH.9.3")).toBe("DFT_P03");
    expect(field(message, "EVN.1")).toBe("P03");
    expect(field(message, "EVN.2")).toBe(field(message, "MSH.7"));
  });

  it("fills the required FT1 fields with a plainly fake local charge code", () => {
    const codes = new Set<string>();
    for (let seed = 0; seed < 60; seed += 1) {
      const message = generateDft({ seed });
      expect(field(message, "FT1.1")).toBe("1");
      expect(field(message, "FT1.2")).toMatch(/^SYNTHTXN\d{8}$/);
      expect(field(message, "FT1.4")).toBe(field(message, "MSH.7"));
      expect(field(message, "FT1.6")).toBe("CG");
      expect(field(message, "FT1.7.1")).toMatch(/^SYNTHCHG\d{2}$/);
      expect(field(message, "FT1.7.2")).toMatch(/^Synthetic /);
      expect(field(message, "FT1.7.3")).toBe("99SYN");
      expect(field(message, "FT1.10")).toMatch(/^[1-3]$/);
      expect(["I", "O", "E"]).toContain(field(message, "PV1.2"));
      codes.add(field(message, "FT1.7.1"));
    }
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("OML^O21: laboratory order", () => {
  it("carries PID, ORC and a matching OBR", () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const message = generateOml({ seed });
      expect(segmentIds(message)).toEqual(["MSH", "PID", "ORC", "OBR"]);
      expect(field(message, "MSH.9")).toBe("OML");
      expect(field(message, "MSH.9.2")).toBe("O21");
      expect(field(message, "MSH.9.3")).toBe("OML_O21");
      expect(field(message, "ORC.1")).toBe("NW");
      expect(field(message, "ORC.2")).toMatch(/^\d{8}$/);
      expect(field(message, "ORC.3")).toMatch(/^\d{8}$/);
      expect(field(message, "ORC.9")).toMatch(/^\d{14}$/);
      expect(field(message, "OBR.1")).toBe("1");
      expect(field(message, "OBR.2")).toBe(field(message, "ORC.2"));
      expect(field(message, "OBR.3")).toBe(field(message, "ORC.3"));
      expect(field(message, "OBR.4.3")).toBe("LN");
      expect(field(message, "OBR.4.1")).not.toBe("");
    }
  });
});

describe("ACK: an acknowledgment of any generated message", () => {
  it("answers the inbound message: senders swapped, MSA-2 its control id, MSH-9 its trigger", () => {
    const inbound = generateOru({ seed: 41 });
    const ack = generateAck({ seed: 41, inbound });
    expect(segmentIds(ack)).toEqual(["MSH", "MSA"]);
    expect(field(ack, "MSH.3")).toBe(field(inbound, "MSH.5"));
    expect(field(ack, "MSH.4")).toBe(field(inbound, "MSH.6"));
    expect(field(ack, "MSH.5")).toBe(field(inbound, "MSH.3"));
    expect(field(ack, "MSH.6")).toBe(field(inbound, "MSH.4"));
    expect(field(ack, "MSH.9")).toBe("ACK");
    expect(field(ack, "MSH.9.2")).toBe("R01");
    expect(field(ack, "MSH.9.3")).toBe("ACK");
    expect(field(ack, "MSH.11")).toBe("T");
    expect(field(ack, "MSA.1")).toBe("AA");
    expect(field(ack, "MSA.2")).toBe(field(inbound, "MSH.10"));
    expect(field(ack, "MSH.10")).toMatch(/^SYNTHACK\d{10}$/);
  });

  it("is sent one to fifty-nine seconds after the inbound message", () => {
    const offsets = new Set<number>();
    for (let seed = 0; seed < 200; seed += 1) {
      const inbound = generateHl7("SIU^S12", seed);
      const ack = generateAck({ seed, inbound });
      const offset = secondsBetween(field(inbound, "MSH.7"), field(ack, "MSH.7"));
      expect(offset).toBeGreaterThanOrEqual(1);
      expect(offset).toBeLessThanOrEqual(59);
      offsets.add(offset);
    }
    expect(offsets.size).toBeGreaterThan(30);
  });

  it("carries the time across a minute, hour, day and year boundary", () => {
    const inbound = buildMessage({
      type: "ADT^A01",
      controlId: "SYNTHIN0001",
      timestamp: "20251231235959",
      version: "2.5",
      processingId: "T",
    });
    const ack = generateAck({ seed: 1, inbound });
    const sent = field(ack, "MSH.7");
    expect(sent.startsWith("202601010000")).toBe(true);
    expect(secondsBetween("20251231235959", sent)).toBeGreaterThanOrEqual(1);
  });

  it("acknowledges every generated kind, echoing its trigger and control id", () => {
    for (const kind of HL7_MESSAGE_KINDS) {
      const inbound = generateHl7(kind, 8);
      const ack = generateAck({ seed: 8, inbound });
      expect(roundTrip(ack).warnings, kind).toEqual([]);
      expect(field(ack, "MSH.9.2"), kind).toBe(field(inbound, "MSH.9.2"));
      expect(field(ack, "MSA.2"), kind).toBe(field(inbound, "MSH.10"));
    }
  });

  it("AE and AR carry one ERR naming HL7 table 0357 condition 207 with severity E", () => {
    const inbound = generateOrm({ seed: 2 });
    for (const code of ["AE", "AR"] as const) {
      const ack = generateAck({ seed: 2, inbound, code });
      expect(segmentIds(ack)).toEqual(["MSH", "MSA", "ERR"]);
      expect(field(ack, "MSA.1")).toBe(code);
      expect(field(ack, "ERR.1")).toBe("");
      expect(field(ack, "ERR.2")).toBe("");
      expect(field(ack, "ERR.3.1")).toBe("207");
      expect(field(ack, "ERR.3.2")).toBe("Application internal error");
      expect(field(ack, "ERR.3.3")).toBe("HL70357");
      expect(field(ack, "ERR.4")).toBe("E");
      expect(roundTrip(ack).warnings).toEqual([]);
    }
  });

  it("defaults to an AA for an ADT^A01 generated from the same seed", () => {
    const ack = generateAck({ seed: 6 });
    expect(ack.toString()).toBe(
      generateAck({ seed: 6, inbound: generateAdt({ seed: 6 }) }).toString(),
    );
    expect(ack.toString()).toBe(generateHl7("ACK", 6).toString());
    expect(generateAck().toString()).toBe(generateAck({ seed: 0 }).toString());
    expect(field(ack, "MSA.1")).toBe("AA");
    expect(field(ack, "MSH.9.2")).toBe("A01");
  });

  it("echoes the inbound version, and says 2.5 when the inbound names none", () => {
    const older = buildMessage({
      type: "ADT^A01",
      controlId: "SYNTHIN0002",
      timestamp: "20240101120000",
      version: "2.3",
      processingId: "T",
    });
    expect(field(generateAck({ seed: 1, inbound: older }), "MSH.12")).toBe("2.3");

    const unversioned = parseHL7(
      "MSH|^~\\&|A|B|C|D|20240101120000||ADT^A01|SYNTHIN0003|T\rPID|1\r",
    );
    expect(field(generateAck({ seed: 1, inbound: unversioned }), "MSH.12")).toBe("2.5");
  });

  it("stays marked as test data even when the inbound says production", () => {
    const production = buildMessage({
      type: "ADT^A01",
      controlId: "SYNTHIN0004",
      timestamp: "20240101120000",
      version: "2.5",
      processingId: "P",
    });
    expect(field(generateAck({ seed: 1, inbound: production }), "MSH.11")).toBe("T");
  });

  it("draws its own time when the inbound MSH-7 is not exactly YYYYMMDDHHMMSS", () => {
    // Too short, a zone offset after it, and one digit too many: none is shifted.
    for (const time of ["202401011200", "20240101120000+0500", "120240101120000"]) {
      const inbound = parseHL7(`MSH|^~\\&|A|B|C|D|${time}||ADT^A01|SYNTHIN0005|T|2.5\rPID|1\r`);
      const sent = field(generateAck({ seed: 3, inbound }), "MSH.7");
      expect(sent, time).toMatch(/^202[0-5]\d{10}$/);
      expect(sent.startsWith("202401011200"), time).toBe(false);
      expect(generateAck({ seed: 3, inbound }).toString()).toBe(
        generateAck({ seed: 3, inbound }).toString(),
      );
    }
  });

  it("draws its own time when the inbound has no MSH-7", () => {
    const inbound = parseHL7("MSH|^~\\&|A|B|C|D|||ADT^A01|SYNTHIN0008|T|2.5\r");
    expect(field(generateAck({ seed: 3, inbound }), "MSH.7")).toMatch(/^202[0-5]\d{10}$/);
  });

  it("leaves the senders empty when the inbound names none", () => {
    const inbound = parseHL7("MSH|^~\\&|||||20240101120000||ADT^A01|SYNTHIN0007|T|2.5\r");
    const ack = generateAck({ seed: 2, inbound });
    for (const path of ["MSH.3", "MSH.4", "MSH.5", "MSH.6"])
      expect(field(ack, path), path).toBe("");
    expect(roundTrip(ack).warnings).toEqual([]);
  });

  it("answers an inbound with no trigger event with a bare ACK", () => {
    const inbound = parseHL7("MSH|^~\\&|A|B|C|D|20240101120000||ADT|SYNTHIN0006|T|2.5\r");
    const ack = generateAck({ seed: 3, inbound });
    expect(field(ack, "MSH.9")).toBe("ACK");
    expect(field(ack, "MSH.9.2")).toBe("");
    expect(ack.toString()).toContain("||ACK|SYNTHACK");
  });

  it("refuses an inbound with no control id, which an ACK cannot be correlated to", () => {
    const inbound = parseHL7("MSH|^~\\&|A|B|C|D|20240101120000||ADT^A01||T|2.5\r");
    expect(fatalCode(() => generateAck({ seed: 1, inbound }))).toBe(
      SYNTH_FATAL_CODES.SYNTH_ACK_UNCORRELATED,
    );
  });

  it("refuses an acknowledgment code outside AA, AE and AR", () => {
    expect(fatalCode(() => generateAck({ seed: 1, code: "CA" as never }))).toBe(
      SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_KIND,
    );
  });
});

describe("every family defaults its seed to 0", () => {
  it("the added generators match generateHl7 at seed 0", () => {
    expect(generateMdm().toString()).toBe(generateHl7("MDM^T02", 0).toString());
    expect(generateDft().toString()).toBe(generateHl7("DFT^P03", 0).toString());
    expect(generateOml().toString()).toBe(generateHl7("OML^O21", 0).toString());
  });
});

describe("HL7 v2 golden fixtures regenerate byte for byte (reproducibility contract)", () => {
  const FIXTURES: Readonly<Record<string, () => Hl7Message>> = {
    "adt-a01-seed1001.hl7": () => generateAdt({ seed: 1001, trigger: "A01" }),
    "adt-a04-seed1002.hl7": () => generateAdt({ seed: 1002, trigger: "A04" }),
    "adt-a08-seed1003.hl7": () => generateAdt({ seed: 1003, trigger: "A08" }),
    "adt-a02-seed1004.hl7": () => generateAdt({ seed: 1004, trigger: "A02" }),
    "adt-a03-seed1005.hl7": () => generateAdt({ seed: 1005, trigger: "A03" }),
    "adt-a11-seed1006.hl7": () => generateAdt({ seed: 1006, trigger: "A11" }),
    "adt-a13-seed1007.hl7": () => generateAdt({ seed: 1007, trigger: "A13" }),
    "adt-a28-seed1008.hl7": () => generateAdt({ seed: 1008, trigger: "A28" }),
    "adt-a31-seed1009.hl7": () => generateAdt({ seed: 1009, trigger: "A31" }),
    "oru-r01-seed2001.hl7": () => generateOru({ seed: 2001 }),
    "orm-o01-seed2002.hl7": () => generateOrm({ seed: 2002 }),
    "siu-s12-seed2003.hl7": () => generateSiu({ seed: 2003 }),
    "vxu-v04-seed2004.hl7": () => generateVxu({ seed: 2004 }),
    "mdm-t02-seed2005.hl7": () => generateMdm({ seed: 2005 }),
    "dft-p03-seed2006.hl7": () => generateDft({ seed: 2006 }),
    "oml-o21-seed2007.hl7": () => generateOml({ seed: 2007 }),
    "ack-aa-seed3001.hl7": () =>
      generateAck({ seed: 3001, inbound: generateAdt({ seed: 1001, trigger: "A01" }) }),
    "ack-ae-seed3002.hl7": () =>
      generateAck({ seed: 3002, inbound: generateOru({ seed: 2001 }), code: "AE" }),
  };

  it("every committed clean fixture has a generator here, and every generator a fixture", () => {
    const committed = readdirSync(FIX_DIR).filter((name) => name.endsWith(".hl7"));
    expect(committed.sort()).toEqual(Object.keys(FIXTURES).sort());
  });

  for (const [file, make] of Object.entries(FIXTURES)) {
    it(`${file} matches its committed golden output and reads back clean`, () => {
      const expected = readFileSync(join(FIX_DIR, file), "utf8");
      const message = make();
      expect(message.toString()).toBe(expected);
      expect(roundTrip(message).warnings).toEqual([]);
    });
  }
});
