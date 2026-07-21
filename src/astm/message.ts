/**
 * Spec-clean ASTM (E1394 / CLSI LIS02) message generation — the `H`/`P`/`O`/`R`/`C`/`L` record report —
 * built through `@cosyte/astm`'s `buildAstmMessage` so the delimiter declaration (`H|\^&`), the record
 * type letters, the per-type sequence counters, the `L` terminator, and every escape are the parser's
 * own conservative emit (roadmap §Phase 6, the ASTM arm — SYNTH-8). Nothing clinical is defaulted: a
 * result's status/flag/units/value are supplied from the example pool, never invented by the builder.
 *
 * A framed **E1381 / CLSI LIS01** variant is also offered ({@link generateAstmResultFramed}) via
 * `composeAstmFrames`, which frames each record into `<STX> FN text <ETB|ETX> CS <CR><LF>` with the
 * **modulo-256 checksum and the `0`–`7` frame number computed by the parser** — never faked. Both round
 * trip through `@cosyte/astm` cleanly (`parseAstmRecords` / `parseFramedAstm` — see `./round-trip`).
 *
 * Every value at a PHI-bearing locus (the `P` record's name / DOB / practice+lab IDs, roadmap §4) is
 * drawn from the synthetic-safety providers via `./identity`, so no output can be real or plausibly-real
 * PHI. `synth` is a **format/conformance generator, not a clinical simulator** (roadmap §2): a generated
 * result pairs a code and a value with no claim of clinical coherence.
 *
 * @module
 */

import {
  buildAstmMessage,
  composeAstmFrames,
  type AstmRecordInput,
  type MessageInput,
} from "@cosyte/astm";

import { createRng, type Rng } from "../rng/rng.js";
import { astmPatient, astmOrder, astmHeaderIdentity } from "./identity.js";
import { EXAMPLE_ASTM_TESTS, ASTM_ABNORMAL_FLAGS, ASTM_COMMENT_TEXT } from "./example-codes.js";

/** Options for the ASTM message generators. */
export interface GenerateAstmOptions {
  /** The seed (deterministic — same seed yields a byte-identical message). */
  readonly seed: number;
  /** How many `R` (result) records to emit. Defaults to a seeded 1–4. */
  readonly resultCount?: number;
  /** Whether to append a `C` (comment) record after the results. Defaults to `true`. */
  readonly comment?: boolean;
}

/** Render a seeded synthetic numeric result value with the analyte's decimal precision. */
function resultValue(rng: Rng, low: number, high: number, decimals: number): string {
  const raw = rng.int(low, high);
  if (decimals === 0) return String(raw);
  const scale = 10 ** decimals;
  return (raw / scale).toFixed(decimals);
}

/**
 * Assemble the typed record inputs (P → O → R… → C?) for a result message from a seeded generator. The
 * header and terminator are added by {@link buildAstmMessage}; this builds the body plus the header
 * fields so both the record and framed emitters share one construction (roadmap §5 determinism).
 */
function buildResultInput(options: GenerateAstmOptions): MessageInput {
  const rng = createRng(options.seed);
  const head = astmHeaderIdentity(rng);
  const patient = astmPatient(rng);
  const order = astmOrder(rng);
  const resultCount = options.resultCount ?? rng.int(1, 4);

  const records: AstmRecordInput[] = [
    {
      type: "P",
      practiceAssignedId: patient.practiceAssignedId,
      laboratoryAssignedId: patient.laboratoryAssignedId,
      name: { last: patient.person.family, first: patient.person.given, middle: patient.middle },
      birthDate: patient.birthDate,
      sex: patient.sex,
    },
    {
      type: "O",
      specimenId: order.specimenId,
      universalTestId: ["", "", "", "ALL"],
      priority: order.priority,
      actionCode: "N",
      reportType: "F",
    },
  ];

  for (let i = 0; i < resultCount; i += 1) {
    const test = rng.pick(EXAMPLE_ASTM_TESTS);
    records.push({
      type: "R",
      universalTestId: ["", "", "", test.localCode, test.name, test.loinc],
      value: resultValue(rng, test.valueLow, test.valueHigh, test.decimals),
      units: test.units,
      referenceRange: test.referenceRange,
      abnormalFlags: rng.pick(ASTM_ABNORMAL_FLAGS),
      resultStatus: "F",
    });
  }

  if (options.comment ?? true) {
    records.push({ type: "C", source: "L", text: rng.pick(ASTM_COMMENT_TEXT), commentType: "G" });
  }

  return {
    header: { fields: [head.sender, head.analyzer] },
    records,
    terminationCode: "N",
  };
}

/**
 * Generate a spec-clean ASTM **result message** — an `H`/`P`/`O`/`R`…/`C`/`L` record stream — built
 * through `@cosyte/astm`'s `buildAstmMessage`. Every identity value is synthetic-by-construction
 * (roadmap §4); the message round-trips through `parseAstmRecords` with zero warnings and re-serializes
 * byte-identically (see `./round-trip`).
 *
 * @param options - The seed, optional result count, and whether to append a comment.
 * @returns The `CR`-terminated ASTM record stream.
 * @example
 * ```ts
 * import { generateAstmResult } from "@cosyte/synth/astm";
 * const raw = generateAstmResult({ seed: 42 });
 * ```
 */
export function generateAstmResult(options: GenerateAstmOptions): string {
  return buildAstmMessage(buildResultInput(options));
}

/**
 * Generate a spec-clean ASTM **order message** — an `H`/`P`/`O`/`L` record stream with no results, for
 * the order side of the flow. Built through `buildAstmMessage`; synthetic-by-construction; round-trips
 * clean.
 *
 * @param options - The seed.
 * @returns The `CR`-terminated ASTM record stream.
 * @example
 * ```ts
 * import { generateAstmOrder } from "@cosyte/synth/astm";
 * const raw = generateAstmOrder({ seed: 7 });
 * ```
 */
export function generateAstmOrder(options: GenerateAstmOptions): string {
  return generateAstmResult({ ...options, resultCount: 0, comment: false });
}

/**
 * Generate a spec-clean **framed** ASTM result message — the same `H`/`P`/`O`/`R`…/`C`/`L` records,
 * wrapped in the **E1381 / CLSI LIS01** frame envelope (`<STX> FN text <ETB|ETX> CS <CR><LF>`) via
 * `@cosyte/astm`'s `composeAstmFrames`. The **modulo-256 checksum and the `0`–`7` frame number are
 * computed by the parser** (never hand-written), and a record over 240 bytes is split across frames —
 * so the bytes round-trip through `parseFramedAstm` with zero frame **and** record warnings (see
 * `./round-trip`). Each record is framed independently (one `ETX`-closed run per record), mirroring what
 * `decodeAstmFrames` reassembles.
 *
 * @param options - The seed, optional result count, and whether to append a comment.
 * @returns The framed byte stream.
 * @example
 * ```ts
 * import { generateAstmResultFramed } from "@cosyte/synth/astm";
 * const bytes = generateAstmResultFramed({ seed: 42 }); // Uint8Array — E1381 framed
 * ```
 */
export function generateAstmResultFramed(options: GenerateAstmOptions): Uint8Array {
  const raw = generateAstmResult(options);
  // Split the built stream into its per-record `CR`-terminated lines and frame each independently, so
  // decode reassembles exactly one record per frame run (mirrors `@cosyte/astm`'s `serializeFramedAstm`).
  const recordLines = raw
    .split("\r")
    .filter((line) => line.length > 0)
    .map((line) => `${line}\r`);
  return composeAstmFrames(recordLines);
}
