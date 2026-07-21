/**
 * Spec-clean HIPAA 005010 **837** claim generation — Professional (`build837P`, TR3 005010X222A2),
 * Institutional (`build837I`, X223A3), and Dental (`build837D`, X224A2) — built through
 * `@cosyte/x12`'s domain builders so the ISA/GS/ST…SE/GE/IEA envelope, the computed HL spine, and
 * every segment are the parser's own conservative emit (roadmap §Phase 5). Every subscriber, patient,
 * provider, and payer identifier is drawn from the synthetic-safety providers via {@link ./identity};
 * every generated 837 round-trips through `@cosyte/x12` with zero warnings (roadmap §6).
 *
 * @module
 */

import {
  build837P,
  build837I,
  build837D,
  type X12Decimal,
  type Build837Spec,
  type Build837BillingProviderSpec,
  type Build837SubscriberSpec,
  type Build837ClaimSpec,
  type Build837ServiceLineSpec,
  type Build837EnvelopeSpec,
  type X12Interchange,
} from "@cosyte/x12";

import { createRng, type Rng } from "../rng/rng.js";

import { dec } from "./money.js";

import {
  x12Person,
  x12Organization,
  x12ProviderPerson,
  x12Payer,
  x12TradingPartners,
  x12EnvelopeTiming,
} from "./identity.js";
import {
  PROFESSIONAL_PROCEDURES,
  INSTITUTIONAL_PROCEDURES,
  DENTAL_PROCEDURES,
  REVENUE_CODES,
  DIAGNOSES,
  PLACES_OF_SERVICE,
  PROCEDURE_MODIFIERS,
  TOOTH_CODES,
  TOOTH_SURFACES,
} from "./example-codes.js";

/** The 837 variant to generate. */
export type Claim837Variant = "P" | "I" | "D";

/** Options for {@link generate837}. */
export interface Generate837Options {
  /** The seed (deterministic — same seed yields a byte-identical interchange). */
  readonly seed: number;
}

/** A `CCYYMMDD` DTP date shortly before the service base date. */
function serviceDtp(serviceDate: string): {
  qualifier: string;
  formatQualifier: string;
  value: string;
} {
  return { qualifier: "472", formatQualifier: "D8", value: serviceDate };
}

/** Build the shared envelope spec from already-drawn seeded timing + trading partners. */
function envelopeOf(
  partners: ReturnType<typeof x12TradingPartners>,
  timing: ReturnType<typeof x12EnvelopeTiming>,
): Build837EnvelopeSpec {
  return {
    senderId: partners.senderId,
    receiverId: partners.receiverId,
    interchangeDate: timing.interchangeDate,
    interchangeTime: timing.interchangeTime,
    interchangeControlNumber: timing.interchangeControlNumber,
    groupControlNumber: timing.groupControlNumber,
    transactionSetControlNumber: timing.transactionSetControlNumber,
    usageIndicator: "T",
  };
}

/** One professional (SV1) service line + its charge. */
function professionalLine(
  rng: Rng,
  serviceDate: string,
): { line: Build837ServiceLineSpec; charge: X12Decimal } {
  const charge = dec(`${String(rng.int(75, 400))}.00`);
  const line: Build837ServiceLineSpec = {
    variant: "P",
    procedureQualifier: "HC",
    procedureCode: rng.pick(PROFESSIONAL_PROCEDURES).code,
    ...(rng.bool(0.4) ? { modifiers: [rng.pick(PROCEDURE_MODIFIERS)] } : {}),
    charge,
    unitOfMeasure: "UN",
    units: dec("1"),
    placeOfServiceCode: rng.pick(PLACES_OF_SERVICE),
    diagnosisPointers: ["1"],
    dates: [serviceDtp(serviceDate)],
  };
  return { line, charge };
}

/** One institutional (SV2) service line + its charge. */
function institutionalLine(
  rng: Rng,
  serviceDate: string,
): { line: Build837ServiceLineSpec; charge: X12Decimal } {
  const charge = dec(`${String(rng.int(500, 5000))}.00`);
  const line: Build837ServiceLineSpec = {
    variant: "I",
    revenueCode: rng.pick(REVENUE_CODES).code,
    procedureQualifier: "HC",
    procedureCode: rng.pick(INSTITUTIONAL_PROCEDURES).code,
    charge,
    unitOfMeasure: "UN",
    units: dec("1"),
    dates: [serviceDtp(serviceDate)],
  };
  return { line, charge };
}

/** One dental (SV3) service line + its charge. */
function dentalLine(
  rng: Rng,
  serviceDate: string,
): { line: Build837ServiceLineSpec; charge: X12Decimal } {
  const charge = dec(`${String(rng.int(80, 900))}.00`);
  const line: Build837ServiceLineSpec = {
    variant: "D",
    procedureQualifier: "AD",
    procedureCode: rng.pick(DENTAL_PROCEDURES).code,
    charge,
    units: dec("1"),
    placeOfServiceCode: "11",
    toothInformation: [
      { qualifier: "JP", toothCode: rng.pick(TOOTH_CODES), surfaces: [rng.pick(TOOTH_SURFACES)] },
    ],
    dates: [serviceDtp(serviceDate)],
  };
  return { line, charge };
}

/** Build one claim of the given variant with 1–2 service lines; `totalCharge` = Σ line charges. */
function claimOf(rng: Rng, variant: Claim837Variant, serviceDate: string): Build837ClaimSpec {
  const lineCount = rng.int(1, 2);
  const built = Array.from({ length: lineCount }, () => {
    if (variant === "P") return professionalLine(rng, serviceDate);
    if (variant === "I") return institutionalLine(rng, serviceDate);
    return dentalLine(rng, serviceDate);
  });
  const total = built.reduce((acc, b) => acc.add(b.charge), dec("0"));
  const diagnosis = rng.pick(DIAGNOSES).code;
  const secondary = rng.pick(DIAGNOSES).code;
  return {
    claimId: `PTACCT${rng.digits(6)}`,
    totalCharge: total,
    placeOfServiceCode: variant === "P" ? rng.pick(PLACES_OF_SERVICE) : "11",
    facilityCodeQualifier: "B",
    claimFrequencyCode: "1",
    providerSignatureOnFile: "Y",
    providerAcceptAssignment: "A",
    benefitsAssignment: "Y",
    releaseOfInformationCode: "Y",
    diagnoses: [
      { qualifier: "ABK", code: diagnosis },
      { qualifier: "ABF", code: secondary },
    ],
    dates: [{ qualifier: "431", formatQualifier: "D8", value: serviceDate }],
    serviceLines: built.map((b) => b.line),
  };
}

/** Assemble the full nested 837 spec (billing provider → subscriber → claim) from synthetic identity. */
function specOf(rng: Rng, variant: Claim837Variant): Build837Spec {
  const partners = x12TradingPartners(rng);
  const timing = x12EnvelopeTiming(rng);
  const envelope = envelopeOf(partners, timing);
  const org = x12Organization(rng);
  const subscriberPerson = x12Person(rng);
  const rendering = x12ProviderPerson(rng);
  const payer = x12Payer(rng);

  const claim = claimOf(rng, variant, timing.serviceDate);

  const subscriber: Build837SubscriberSpec = {
    info: {
      payerResponsibilityCode: "P",
      individualRelationshipCode: "18", // self
      groupNumber: `GRP${rng.digits(5)}`,
      claimFilingIndicator: "MB",
    },
    subscriber: {
      entityIdentifierCode: "IL",
      entityTypeQualifier: "1",
      name: subscriberPerson.person.family,
      firstName: subscriberPerson.person.given,
      idQualifier: "MI",
      idCode: subscriberPerson.memberId,
      address: {
        lines: [subscriberPerson.address.street],
        city: subscriberPerson.address.city,
        state: subscriberPerson.address.state,
        postalCode: subscriberPerson.address.zip,
      },
    },
    payer: {
      entityIdentifierCode: "PR",
      entityTypeQualifier: "2",
      name: payer.name,
      idQualifier: "PI",
      idCode: payer.payerId,
    },
    claims: [
      {
        ...claim,
        // Rendering provider (Loop 2310B, NM1 fields round-trip) — a person with an invalid-Luhn NPI.
        providers: [
          {
            entityIdentifierCode: "82",
            entityTypeQualifier: "1",
            name: rendering.person.family,
            firstName: rendering.person.given,
            idQualifier: "XX",
            idCode: rendering.npi,
          },
        ],
      },
    ],
  };

  const billingProvider: Build837BillingProviderSpec = {
    provider: {
      entityIdentifierCode: "85",
      entityTypeQualifier: "2",
      name: org.name,
      idQualifier: "XX",
      idCode: org.npi,
      address: {
        lines: [org.address.street],
        city: org.address.city,
        state: org.address.state,
        postalCode: org.address.zip,
      },
      // Provider tax id as a never-issued (900-range) SSN at REF*SY — provably synthetic (roadmap §4.1).
      references: [{ qualifier: "SY", value: org.taxIdSsn }],
    },
    subscribers: [subscriber],
  };

  return {
    envelope,
    submitter: {
      entityIdentifierCode: "41",
      entityTypeQualifier: "2",
      name: org.name,
      idQualifier: "46",
      idCode: envelope.senderId,
    },
    receiver: {
      entityIdentifierCode: "40",
      entityTypeQualifier: "2",
      name: payer.name,
      idQualifier: "46",
      idCode: envelope.receiverId,
    },
    billingProviders: [billingProvider],
  };
}

/**
 * Generate a spec-clean 005010 837 claim of the given `variant`, built through `@cosyte/x12`'s
 * `build837P` / `build837I` / `build837D`. Every identity value is synthetic-by-construction
 * (roadmap §4); the returned interchange round-trips through `@cosyte/x12` with zero warnings.
 *
 * @param variant - `"P"` professional, `"I"` institutional, or `"D"` dental.
 * @param options - The seed. See {@link Generate837Options}.
 * @returns A frozen `X12Interchange` (feed it to {@link ./round-trip.roundTrip} to verify).
 * @example
 * ```ts
 * import { generate837, roundTrip } from "@cosyte/synth/x12";
 * const { specClean } = roundTrip(generate837("P", { seed: 42 }));
 * // specClean === true
 * ```
 */
export function generate837(variant: Claim837Variant, options: Generate837Options): X12Interchange {
  const rng = createRng(options.seed);
  const spec = specOf(rng, variant);
  if (variant === "P") return build837P(spec);
  if (variant === "I") return build837I(spec);
  return build837D(spec);
}

/**
 * Generate a spec-clean 837**P** (Professional) claim.
 *
 * @param options - The seed.
 * @returns A frozen `X12Interchange`.
 * @example
 * ```ts
 * import { generate837P } from "@cosyte/synth/x12";
 * const ix = generate837P({ seed: 1 });
 * ```
 */
export function generate837P(options: Generate837Options): X12Interchange {
  return generate837("P", options);
}

/**
 * Generate a spec-clean 837**I** (Institutional) claim.
 *
 * @param options - The seed.
 * @returns A frozen `X12Interchange`.
 * @example
 * ```ts
 * import { generate837I } from "@cosyte/synth/x12";
 * const ix = generate837I({ seed: 1 });
 * ```
 */
export function generate837I(options: Generate837Options): X12Interchange {
  return generate837("I", options);
}

/**
 * Generate a spec-clean 837**D** (Dental) claim.
 *
 * @param options - The seed.
 * @returns A frozen `X12Interchange`.
 * @example
 * ```ts
 * import { generate837D } from "@cosyte/synth/x12";
 * const ix = generate837D({ seed: 1 });
 * ```
 */
export function generate837D(options: Generate837Options): X12Interchange {
  return generate837("D", options);
}
