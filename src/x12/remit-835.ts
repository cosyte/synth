/**
 * Spec-clean HIPAA 005010X221A1 **835** Health Care Claim Payment/Advice (ERA) generation, built
 * through `@cosyte/x12`'s `build835` (roadmap §Phase 5). The 835 is **balance-checked by construction**:
 * `build835` REFUSES an out-of-balance remit, so `synth` computes amounts that satisfy the three X12
 * balance identities — line (`charge = payment + Σ CAS`), claim (`totalCharge = totalPayment +
 * patientResponsibility`), and remit (`BPR-02 = Σ CLP-04 − Σ PLB`) — before handing them to the
 * builder. Patient, payer, and payee identity is drawn from the synthetic-safety providers
 * ({@link ./identity}); every generated 835 round-trips through `@cosyte/x12` with zero warnings.
 *
 * @module
 */

import {
  build835,
  type Build835Spec,
  type Build835ClaimSpec,
  type Build835ServiceLineSpec,
  type X12Interchange,
} from "@cosyte/x12";

import { createRng } from "../rng/rng.js";

import { dec, money } from "./money.js";

import {
  x12Person,
  x12Organization,
  x12Payer,
  x12TradingPartners,
  x12EnvelopeTiming,
} from "./identity.js";
import { PROFESSIONAL_PROCEDURES, PROCEDURE_MODIFIERS } from "./example-codes.js";

/** Options for {@link generate835}. */
export interface Generate835Options {
  /** The seed (deterministic — same seed yields a byte-identical interchange). */
  readonly seed: number;
}

/**
 * Generate a spec-clean 005010X221A1 835 remittance, built through `@cosyte/x12`'s `build835`. A single
 * balanced claim with one service line: `charge = payment + patientResponsibility`, and the remit
 * total equals the claim payment (no provider-level adjustments). Every identity value is
 * synthetic-by-construction (roadmap §4); the returned interchange round-trips with zero warnings.
 *
 * @param options - The seed. See {@link Generate835Options}.
 * @returns A frozen `X12Interchange` (feed it to {@link ./round-trip.roundTrip} to verify).
 * @example
 * ```ts
 * import { generate835, roundTrip } from "@cosyte/synth/x12";
 * const { specClean } = roundTrip(generate835({ seed: 7 }));
 * // specClean === true
 * ```
 */
export function generate835(options: Generate835Options): X12Interchange {
  const rng = createRng(options.seed);
  const partners = x12TradingPartners(rng);
  const timing = x12EnvelopeTiming(rng);
  const patient = x12Person(rng);
  const org = x12Organization(rng); // the payee (rendering clinic)
  const payer = x12Payer(rng);

  // Balanced amounts: charge = payment + patient responsibility (the single CAS adjustment).
  const chargeN = rng.int(200, 2000);
  const patientRespN = rng.int(10, Math.min(chargeN - 1, 150));
  const paymentN = chargeN - patientRespN;
  const casReason = rng.pick(["1", "2", "3"] as const); // deductible / coinsurance / copay

  const line: Build835ServiceLineSpec = {
    productServiceIdQualifier: "HC",
    productServiceId: rng.pick(PROFESSIONAL_PROCEDURES).code,
    ...(rng.bool(0.4) ? { modifiers: [rng.pick(PROCEDURE_MODIFIERS)] } : {}),
    chargeAmount: dec(money(chargeN)),
    paymentAmount: dec(money(paymentN)),
    serviceDateStart: timing.serviceDate,
    serviceDateEnd: timing.serviceDate,
    adjustments: [{ groupCode: "PR", reasonCode: casReason, amount: dec(money(patientRespN)) }],
    amounts: [{ qualifier: "B6", amount: dec(money(paymentN)) }],
  };

  const claim: Build835ClaimSpec = {
    patientControlNumber: `PTACCT${rng.digits(6)}`,
    claimStatusCode: "1", // processed as primary
    totalChargeAmount: dec(money(chargeN)),
    totalPaymentAmount: dec(money(paymentN)),
    patientResponsibilityAmount: dec(money(patientRespN)),
    claimFilingIndicatorCode: "MB",
    payerClaimControlNumber: `ICN${rng.digits(9)}`,
    facilityTypeCode: "11",
    claimFrequencyCode: "1",
    patient: {
      entityIdentifierCode: "QC",
      lastName: patient.person.family,
      firstName: patient.person.given,
      idQualifier: "MI",
      idCode: patient.memberId,
    },
    serviceProvider: {
      entityIdentifierCode: "82",
      name: org.name,
      idQualifier: "XX",
      idCode: org.npi,
    },
    servicePeriodStart: timing.serviceDate,
    servicePeriodEnd: timing.serviceDate,
    serviceLines: [line],
  };

  const spec: Build835Spec = {
    envelope: {
      senderId: partners.senderId,
      receiverId: partners.receiverId,
      interchangeDate: timing.interchangeDate,
      interchangeTime: timing.interchangeTime,
      interchangeControlNumber: timing.interchangeControlNumber,
      groupControlNumber: timing.groupControlNumber,
      transactionSetControlNumber: timing.transactionSetControlNumber,
      usageIndicator: "T",
    },
    payment: {
      transactionHandlingCode: "I",
      totalActualPayment: dec(money(paymentN)),
      creditDebitFlag: "C",
      method: "ACH",
      paymentDate: timing.serviceDate,
    },
    traces: [
      {
        traceTypeCode: "1",
        referenceId: rng.digits(7),
        originatingCompanyId: `1${rng.digits(9)}`,
      },
    ],
    payer: {
      entityIdentifierCode: "PR",
      name: payer.name,
      address: {
        lines: [org.address.street],
        city: org.address.city,
        state: org.address.state,
        postalCode: org.address.zip,
      },
      additionalIdentifiers: [{ qualifier: "2U", value: payer.payerId }],
    },
    payee: {
      entityIdentifierCode: "PE",
      name: org.name,
      idQualifier: "XX",
      idCode: org.npi,
      address: {
        lines: [org.address.street],
        city: org.address.city,
        state: org.address.state,
        postalCode: org.address.zip,
      },
    },
    claims: [claim],
  };

  return build835(spec);
}
