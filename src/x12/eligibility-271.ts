/**
 * Spec-clean HIPAA 005010X279A1 **271** Health Care Eligibility Benefit Response generation, built
 * through `@cosyte/x12`'s `build271` (roadmap §Phase 5). The 271 carries subscriber identity (name,
 * member id, DOB, address) plus benefit information across the 20→21→22 HL hierarchy; every identity
 * value is drawn from the synthetic-safety providers ({@link ./identity}). Every generated 271
 * round-trips through `@cosyte/x12` with zero warnings (roadmap §6).
 *
 * **Note (coverage tracks the builder — roadmap §3):** `@cosyte/x12` ships a **271** builder but no
 * **270** (request) builder — the 270 is only *read* (as the echoed trace on the 271). Per the
 * through-the-builder discipline (never hand-write bytes around a missing builder), `synth` generates
 * the 271 and **defers 270** until `@cosyte/x12` grows a `build270` (noted in the README + CHANGELOG).
 *
 * @module
 */

import { build271, type Build271Spec, type X12Interchange } from "@cosyte/x12";

import { createRng } from "../rng/rng.js";

import { dec, money } from "./money.js";

import {
  x12Person,
  x12Organization,
  x12Payer,
  x12TradingPartners,
  x12EnvelopeTiming,
} from "./identity.js";
import { SERVICE_TYPE_CODES } from "./example-codes.js";

/** Options for {@link generate271}. */
export interface Generate271Options {
  /** The seed (deterministic — same seed yields a byte-identical interchange). */
  readonly seed: number;
}

/**
 * Generate a spec-clean 005010X279A1 271 eligibility response, built through `@cosyte/x12`'s
 * `build271`: one information source (payer) → one information receiver (provider) → one subscriber
 * with an active-coverage benefit. Every identity value is synthetic-by-construction (roadmap §4); the
 * returned interchange round-trips with zero warnings.
 *
 * @param options - The seed. See {@link Generate271Options}.
 * @returns A frozen `X12Interchange` (feed it to {@link ./round-trip.roundTrip} to verify).
 * @example
 * ```ts
 * import { generate271, roundTrip } from "@cosyte/synth/x12";
 * const { specClean } = roundTrip(generate271({ seed: 3 }));
 * // specClean === true
 * ```
 */
export function generate271(options: Generate271Options): X12Interchange {
  const rng = createRng(options.seed);
  const partners = x12TradingPartners(rng);
  const timing = x12EnvelopeTiming(rng);
  const subscriber = x12Person(rng);
  const providerOrg = x12Organization(rng);
  const payer = x12Payer(rng);

  const serviceTypes = [
    { code: rng.pick(SERVICE_TYPE_CODES) },
    { code: rng.pick(SERVICE_TYPE_CODES) },
  ];

  const spec: Build271Spec = {
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
    informationSources: [
      {
        entity: {
          entityIdentifierCode: "PR",
          entityTypeQualifier: "2",
          name: payer.name,
          idQualifier: "PI",
          idCode: payer.payerId,
        },
        receivers: [
          {
            entity: {
              entityIdentifierCode: "1P",
              entityTypeQualifier: "2",
              name: providerOrg.name,
              idQualifier: "XX",
              idCode: providerOrg.npi,
            },
            subscribers: [
              {
                traces: [{ traceTypeCode: "2", referenceId: `ELIG${rng.digits(10)}` }],
                name: {
                  entityIdentifierCode: "IL",
                  entityTypeQualifier: "1",
                  lastName: subscriber.person.family,
                  firstName: subscriber.person.given,
                  idQualifier: "MI",
                  idCode: subscriber.memberId,
                  address: {
                    lines: [subscriber.address.street],
                    city: subscriber.address.city,
                    state: subscriber.address.state,
                    postalCode: subscriber.address.zip,
                  },
                  dateOfBirth: subscriber.dob,
                  genderCode: subscriber.sex,
                },
                references: [{ qualifier: "6P", value: `GRP${rng.digits(5)}` }],
                dates: [{ qualifier: "307", formatQualifier: "D8", value: timing.serviceDate }],
                benefits: [
                  {
                    eligibilityCode: "1", // active coverage
                    coverageLevelCode: "IND",
                    serviceTypeCodes: serviceTypes,
                    inPlanNetwork: "Y",
                    monetaryAmount: dec(money(rng.int(500, 5000))),
                    percent: dec(String(rng.pick([80, 90, 100] as const))),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  return build271(spec);
}
