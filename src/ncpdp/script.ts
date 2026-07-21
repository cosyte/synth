/**
 * Spec-clean NCPDP **SCRIPT** (XML ePrescribing) generation — `NewRx`, `RxRenewalRequest`, and
 * `RxChangeRequest` — built through `@cosyte/ncpdp`'s own emit surface so the XML is spec-clean by the
 * same mechanism that makes the parser's serializer spec-clean (roadmap §1, §Phase 6):
 *
 * - **NewRx** is built through the validated `buildNewRx` builder (it refuses a NewRx with no
 *   medication description) and serialized by `serializeScript`.
 * - **RxRenewalRequest / RxChangeRequest** have no dedicated builder in `@cosyte/ncpdp` (its builders
 *   cover NewRx + the Status/Error/Verify responses), so — exactly as the X12 generator constructs a
 *   typed model and lets `serializeX12` emit it — these are built as the parser's **public, typed
 *   `ScriptMessage` model** (the same immutable model `buildNewRx` returns) and serialized by
 *   `serializeScript`. No byte is hand-written; the round-trip harness ({@link ./round-trip.scriptRoundTrip})
 *   re-parses every message through `parseScript` and asserts **zero warnings**, so spec-cleanliness is
 *   the parser's judgment, not `synth`'s (roadmap §4.5, §6).
 *
 * Every patient / prescriber / pharmacy identifier is drawn from the synthetic-safety providers via
 * {@link ./identity}; the prescriber NPI is invalid-Luhn and the **DEA is invalid-checksum**, so
 * neither can denote a real provider (roadmap §4).
 *
 * @module
 */

import {
  buildNewRx,
  serializeScript,
  ScriptMessage,
  type MedicationPrescribed,
  type Patient,
  type Pharmacy,
  type Prescriber,
  type ScriptHeader,
  type RxRenewalRequest,
  type RxChangeRequest,
} from "@cosyte/ncpdp/script";
import { decimalValue, codedValue } from "@cosyte/ncpdp/common";

import { createRng, type Rng } from "../rng/rng.js";
import {
  ncpdpPatient,
  ncpdpPrescriber,
  ncpdpPharmacy,
  ncpdpScriptRouting,
  type NcpdpScriptRouting,
} from "./identity.js";
import { EXAMPLE_DRUGS, EXAMPLE_SIG_TEXT } from "./example-codes.js";

/** The SCRIPT version `synth` stamps generated messages with (a version `@cosyte/ncpdp` reads clean). */
const SCRIPT_VERSION = "2017071";

/** Options for the SCRIPT generators. */
export interface GenerateScriptOptions {
  /** The seed (deterministic — same seed yields a byte-identical message). */
  readonly seed: number;
}

/** Build the typed `Patient` model from a synthetic patient. */
function patientModel(rng: Rng): Patient {
  const p = ncpdpPatient(rng);
  return {
    name: { lastName: p.person.family, firstName: p.person.given },
    gender: p.gender,
    dateOfBirth: p.dob,
  };
}

/** Build the typed `Pharmacy` model from a synthetic pharmacy. */
function pharmacyModel(rng: Rng): Pharmacy {
  const rx = ncpdpPharmacy(rng);
  return {
    businessName: rx.businessName,
    identification: { npi: rx.npi, ncpdpId: rx.ncpdpId },
  };
}

/** Build the typed `Prescriber` model — NPI invalid-Luhn, DEA invalid-checksum (roadmap §4). */
function prescriberModel(rng: Rng): Prescriber {
  const dr = ncpdpPrescriber(rng);
  return {
    name: { lastName: dr.person.family, firstName: dr.person.given },
    identification: { npi: dr.npi, deaNumber: dr.dea },
  };
}

/** Build the typed `MedicationPrescribed` model from the license-clean example pool. */
function medicationModel(rng: Rng, routing: NcpdpScriptRouting): MedicationPrescribed {
  const drug = rng.pick(EXAMPLE_DRUGS);
  const written = `${routing.date.slice(0, 4)}-${routing.date.slice(4, 6)}-${routing.date.slice(6, 8)}`;
  return {
    description: drug.description,
    coded: { productCode: codedValue(drug.ndc, "ND") },
    quantity: {
      value: decimalValue(String(rng.int(30, 90))),
      unitOfMeasure: drug.form,
      codeListQualifier: "38",
    },
    daysSupply: decimalValue(String(rng.pick([30, 60, 90] as const))),
    numberOfRefills: String(rng.int(0, 5)),
    substitutions: rng.pick(["0", "1"] as const),
    writtenDate: written,
    sigText: rng.pick(EXAMPLE_SIG_TEXT),
  };
}

/** The routing header (with SCRIPT version) shared by every generated SCRIPT message. */
function headerModel(routing: NcpdpScriptRouting): ScriptHeader {
  return {
    version: SCRIPT_VERSION,
    from: "SYNTHPRESCRIBER",
    to: "SYNTHPHARMACY",
    messageId: routing.messageId,
    sentTime: routing.sentTime,
    prescriberOrderNumber: routing.prescriberOrderNumber,
  };
}

/**
 * Generate a spec-clean SCRIPT **NewRx** ePrescription, built through `@cosyte/ncpdp`'s validated
 * `buildNewRx` and serialized by `serializeScript`. Every identity value is synthetic-by-construction
 * (roadmap §4); the message round-trips through `parseScript` with zero warnings.
 *
 * @param options - The seed. See {@link GenerateScriptOptions}.
 * @returns The serialized SCRIPT XML.
 * @example
 * ```ts
 * import { generateNewRx } from "@cosyte/synth/ncpdp";
 * const xml = generateNewRx({ seed: 42 });
 * ```
 */
export function generateNewRx(options: GenerateScriptOptions): string {
  const rng = createRng(options.seed);
  const routing = ncpdpScriptRouting(rng);
  const patient = patientModel(rng);
  const pharmacy = pharmacyModel(rng);
  const prescriber = prescriberModel(rng);
  const medication = medicationModel(rng, routing);
  const message = buildNewRx({
    header: headerModel(routing),
    patient,
    pharmacy,
    prescriber,
    medication,
  });
  return serializeScript(message);
}

/** Assemble the shared lifecycle-request fields (request ref, parties, medication) from a seed. */
function lifecycleFields(rng: Rng): {
  requestReferenceNumber: string;
  patient: Patient;
  pharmacy: Pharmacy;
  prescriber: Prescriber;
  medicationPrescribed: MedicationPrescribed;
  header: ScriptHeader;
} {
  const routing = ncpdpScriptRouting(rng);
  return {
    requestReferenceNumber: `REQ${rng.digits(9)}`,
    patient: patientModel(rng),
    pharmacy: pharmacyModel(rng),
    prescriber: prescriberModel(rng),
    medicationPrescribed: medicationModel(rng, routing),
    header: headerModel(routing),
  };
}

/**
 * Generate a spec-clean SCRIPT **RxRenewalRequest** (a pharmacy-initiated renewal), built as
 * `@cosyte/ncpdp`'s public typed `ScriptMessage` model and serialized by `serializeScript`. Every
 * identity value is synthetic-by-construction; the message round-trips through `parseScript` with zero
 * warnings (verified by {@link ./round-trip.scriptRoundTrip}).
 *
 * @param options - The seed. See {@link GenerateScriptOptions}.
 * @returns The serialized SCRIPT XML.
 * @example
 * ```ts
 * import { generateRxRenewalRequest } from "@cosyte/synth/ncpdp";
 * const xml = generateRxRenewalRequest({ seed: 7 });
 * ```
 */
export function generateRxRenewalRequest(options: GenerateScriptOptions): string {
  const rng = createRng(options.seed);
  const { header, ...fields } = lifecycleFields(rng);
  const body: RxRenewalRequest = { kind: "RxRenewalRequest", ...fields };
  return serializeScript(new ScriptMessage({ header, body, warnings: [] }));
}

/**
 * Generate a spec-clean SCRIPT **RxChangeRequest** (a pharmacy-initiated change request), built as
 * `@cosyte/ncpdp`'s public typed `ScriptMessage` model and serialized by `serializeScript`. Every
 * identity value is synthetic-by-construction; the message round-trips through `parseScript` with zero
 * warnings.
 *
 * @param options - The seed. See {@link GenerateScriptOptions}.
 * @returns The serialized SCRIPT XML.
 * @example
 * ```ts
 * import { generateRxChangeRequest } from "@cosyte/synth/ncpdp";
 * const xml = generateRxChangeRequest({ seed: 7 });
 * ```
 */
export function generateRxChangeRequest(options: GenerateScriptOptions): string {
  const rng = createRng(options.seed);
  const { header, ...fields } = lifecycleFields(rng);
  const body: RxChangeRequest = { kind: "RxChangeRequest", ...fields };
  return serializeScript(new ScriptMessage({ header, body, warnings: [] }));
}
