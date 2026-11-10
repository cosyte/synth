/**
 * The round-trip harnesses are a gate, so they have to say "not spec-clean" when that is the truth. The
 * generated corpora are spec-clean by construction and never exercise that side, so each harness here
 * is handed an off-spec input a caller could pass it (hand-edited wire text, a corrupted frame, an
 * invalid resource) and must report the parser's own warning codes and `specClean: false`.
 */

import { describe, expect, it } from "vitest";
import { composeAstmFrames } from "@cosyte/astm";
import { parseResource } from "@cosyte/fhir";
import { parseX12 } from "@cosyte/x12";

import {
  astmRoundTrip,
  astmFramedRoundTrip,
  generateAstmResult,
  generateAstmResultFramed,
} from "../src/astm/index.js";
import { roundTrip as fhirRoundTrip } from "../src/fhir/index.js";
import {
  scriptRoundTrip,
  telecomRoundTrip,
  generateNewRx,
  generateB1,
} from "../src/ncpdp/index.js";
import { roundTrip as x12RoundTrip, generate837 } from "../src/x12/index.js";

/** ASTM E1381 frame control bytes. */
const ETX = 0x03;
const CR = 0x0d;
const LF = 0x0a;

describe("astmRoundTrip on an off-spec record stream", () => {
  it("reports the parser's warning code and is not spec-clean", () => {
    const clean = generateAstmResult({ seed: 1 });
    // A site-defined Z record in place of the comment record.
    const raw = clean.replace("\rC|", "\rZ|");
    expect(raw).not.toBe(clean);
    const rt = astmRoundTrip(raw);
    expect(rt.content).toBe(raw);
    expect(rt.warnings).toEqual(["ASTM_RECORD_UNKNOWN_TYPE"]);
    expect(rt.byteStable).toBe(true);
    expect(rt.specClean).toBe(false);
  });
});

describe("astmFramedRoundTrip on an off-spec framed stream", () => {
  it("a frame with a wrong checksum is flagged and does not re-frame to the same bytes", () => {
    const bytes = generateAstmResultFramed({ seed: 1 }).slice();
    // The checksum is the two characters after the last frame's ETX: change the first one.
    const at = bytes.lastIndexOf(ETX) + 1;
    bytes[at] = bytes[at] === 0x30 ? 0x31 : 0x30;
    const rt = astmFramedRoundTrip(bytes);
    expect(rt.warnings).toEqual(["ASTM_FRAME_BAD_CHECKSUM"]);
    expect(rt.byteStable).toBe(false);
    expect(rt.specClean).toBe(false);
  });

  it("lowercase checksum digits parse cleanly but do not re-frame to the same bytes", () => {
    const clean = generateAstmResultFramed({ seed: 1 });
    const bytes = clean.slice();
    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] !== ETX) continue;
      for (const at of [i + 1, i + 2]) {
        const c = bytes[at] ?? 0;
        if (c >= 0x41 && c <= 0x46) bytes[at] = c + 0x20; // A-F to a-f
      }
    }
    expect(bytes).not.toEqual(clean);
    const rt = astmFramedRoundTrip(bytes);
    expect(rt.warnings).toEqual([]);
    expect(rt.byteStable).toBe(false);
    expect(rt.specClean).toBe(false);
  });

  it("folds record-layer warnings into the same list as frame-layer ones", () => {
    const records = generateAstmResult({ seed: 1 }).replace("\rC|", "\rZ|");
    const lines = records
      .split("\r")
      .filter((line) => line.length > 0)
      .map((line) => `${line}\r`);
    const rt = astmFramedRoundTrip(composeAstmFrames(lines));
    expect(rt.warnings).toEqual(["ASTM_RECORD_UNKNOWN_TYPE"]);
    expect(rt.byteStable).toBe(true);
    expect(rt.specClean).toBe(false);
  });

  it("trailing bytes after the last frame make the stream not byte-stable", () => {
    const clean = generateAstmResultFramed({ seed: 1 });
    const bytes = new Uint8Array(clean.length + 2);
    bytes.set(clean);
    bytes.set([CR, LF], clean.length);
    const rt = astmFramedRoundTrip(bytes);
    expect(rt.warnings).toEqual([]);
    expect(rt.byteStable).toBe(false);
    expect(rt.specClean).toBe(false);
    // `content` is a lossless latin1 view of exactly the bytes passed.
    expect(rt.content.length).toBe(bytes.length);
    expect(rt.content.endsWith("\r\n")).toBe(true);
  });
});

describe("FHIR roundTrip on an invalid resource", () => {
  it("lists each error code in both errors and warnings and is not valid", () => {
    const { resource } = parseResource(
      '{"resourceType":"Patient","gender":"robot","birthDate":"1990-13-45"}',
    );
    const rt = fhirRoundTrip(resource);
    expect(rt.valid).toBe(false);
    expect([...rt.errors].sort()).toEqual(["CODE_INVALID", "PRIMITIVE_INVALID"]);
    expect([...rt.warnings].sort()).toEqual(["CODE_INVALID", "PRIMITIVE_INVALID"]);
    expect(rt.byteStable).toBe(true);
    expect(rt.specClean).toBe(false);
  });
});

describe("NCPDP round trips on off-spec wire text", () => {
  it("scriptRoundTrip reports a SCRIPT message without its version attribute", () => {
    const xml = generateNewRx({ seed: 1 }).replace(' version="2017071"', "");
    const rt = scriptRoundTrip(xml);
    expect(rt.content).toBe(xml);
    expect(rt.warnings).toEqual(["NCPDP_SCRIPT_VERSION_ABSENT"]);
    expect(rt.specClean).toBe(false);
  });

  it("telecomRoundTrip reports a segment id the standard does not define", () => {
    const clean = generateB1({ seed: 1 });
    const wire = clean.replace("\u001eAM04", "\u001eAM99");
    expect(wire).not.toBe(clean);
    const rt = telecomRoundTrip(wire);
    expect(rt.warnings).toEqual(["NCPDP_TELECOM_UNKNOWN_SEGMENT"]);
    expect(rt.specClean).toBe(false);
  });
});

describe("X12 roundTrip on an off-spec interchange", () => {
  it("reports a GE transaction count that does not match the group", () => {
    const clean = x12RoundTrip(generate837("P", { seed: 1 })).content;
    const edited = clean.replace(/GE\*1\*/, "GE*9*");
    expect(edited).not.toBe(clean);
    const rt = x12RoundTrip(parseX12(edited));
    expect(rt.warnings).toEqual(["X12_TRANSACTION_COUNT_MISMATCH"]);
    expect(rt.byteStable).toBe(true);
    expect(rt.specClean).toBe(false);
  });
});
