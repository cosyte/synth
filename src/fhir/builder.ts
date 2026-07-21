/**
 * Shared FHIR model-construction helpers — the small vocabulary every Phase-3 resource generator uses
 * to build **through `@cosyte/fhir`'s own model constructors** (`complex` / `list` / `primitive` /
 * `decimal`). A generated resource is a `FhirComplex` tree assembled here and serialized by
 * `@cosyte/fhir`'s conservative writer, so it is **spec-clean by construction** — the same mechanism
 * that makes the parser's emit side spec-clean (roadmap §1, §Phase 3). Nothing here hand-writes JSON
 * bytes.
 *
 * Identity fields (`name`, `identifier`, `birthDate`, `telecom`, `address`) are minted from the
 * synthetic-safety providers in `../safe`, so no value a resource carries can be real or plausibly-real
 * PHI (roadmap §4). The `fhirPatientIdentity` bundle draws them in a **fixed order** for the
 * reproducibility contract (roadmap §5).
 *
 * @module
 */

import { complex, decimal, list, primitive } from "@cosyte/fhir";
import type { FhirComplex, FhirNode } from "@cosyte/fhir";

import type { Rng } from "../rng/rng.js";
import {
  safe,
  type SyntheticName,
  type SyntheticAddress,
  type SyntheticIdentifier,
} from "../safe/index.js";

import { SYSTEM } from "./us-core.js";

/** A named FHIR property (`{ name, value }`) — the shape `complex` consumes. */
export type Prop = { readonly name: string; readonly value: FhirNode };

/**
 * Build a named FHIR property.
 *
 * @param name - The property name.
 * @param value - The property's node value.
 * @returns A {@link Prop}.
 * @example
 * ```ts
 * import { prop, str } from "@cosyte/synth/fhir";
 * prop("gender", str("female"));
 * ```
 */
export function prop(name: string, value: FhirNode): Prop {
  return { name, value };
}

/**
 * A `string`/`code`/`uri`/`date` primitive leaf.
 *
 * @param value - The lexical string value.
 * @returns A primitive `FhirNode`.
 * @example
 * ```ts
 * import { str } from "@cosyte/synth/fhir";
 * str("final");
 * ```
 */
export function str(value: string): FhirNode {
  return primitive(value);
}

/**
 * A `decimal` primitive leaf, precision-preserving via `@cosyte/fhir`'s string-backed `FhirDecimal`.
 *
 * @param raw - The exact decimal lexical form (never routed through a JS `number`).
 * @returns A primitive `FhirNode`.
 * @example
 * ```ts
 * import { dec } from "@cosyte/synth/fhir";
 * dec("6.3");
 * ```
 */
export function dec(raw: string): FhirNode {
  return primitive(decimal(raw));
}

/**
 * A `boolean` primitive leaf.
 *
 * @param value - The boolean value.
 * @returns A primitive `FhirNode`.
 * @example
 * ```ts
 * import { bool } from "@cosyte/synth/fhir";
 * bool(true);
 * ```
 */
export function bool(value: boolean): FhirNode {
  return primitive(value);
}

/**
 * A single `Coding` element (`system` + `code` + `display`).
 *
 * @param concept - The coding's `system`, `code`, and `display`.
 * @returns A `Coding` `FhirComplex`.
 * @example
 * ```ts
 * import { coding } from "@cosyte/synth/fhir";
 * coding({ system: "http://loinc.org", code: "2345-7", display: "Glucose" });
 * ```
 */
export function coding(concept: { system: string; code: string; display: string }): FhirComplex {
  return complex([
    prop("system", str(concept.system)),
    prop("code", str(concept.code)),
    prop("display", str(concept.display)),
  ]);
}

/**
 * A `CodeableConcept` wrapping a single `Coding`.
 *
 * @param concept - The coding's `system`, `code`, and `display`.
 * @returns A `CodeableConcept` `FhirComplex`.
 * @example
 * ```ts
 * import { codeableConcept } from "@cosyte/synth/fhir";
 * codeableConcept({ system: "http://snomed.info/sct", code: "59621000", display: "Essential hypertension" });
 * ```
 */
export function codeableConcept(concept: {
  system: string;
  code: string;
  display: string;
}): FhirComplex {
  return complex([prop("coding", list([coding(concept)]))]);
}

/**
 * A literal `Reference` element (`{ reference: "<Type>/<id>" }` or a `urn:uuid:` fullUrl).
 *
 * @param ref - The reference string.
 * @returns A `Reference` `FhirComplex`.
 * @example
 * ```ts
 * import { reference } from "@cosyte/synth/fhir";
 * reference("Patient/syn-patient-1");
 * ```
 */
export function reference(ref: string): FhirComplex {
  return complex([prop("reference", str(ref))]);
}

/**
 * A generated `Narrative` (`text`) with `status: "generated"` and an XHTML `div` carrying only
 * synthetic text — satisfies the base `dom-6` best-practice constraint so a generated resource is
 * robust as well as valid. The `div` is XHTML-namespaced and carries no markup beyond a paragraph, so
 * it round-trips byte-for-byte through `@cosyte/fhir`'s codec.
 *
 * @param text - The plain synthetic summary text (no PHI — it is composed from synthetic values).
 * @returns A `Narrative` `FhirComplex`.
 * @example
 * ```ts
 * import { narrative } from "@cosyte/synth/fhir";
 * narrative("Synthetic patient summary.");
 * ```
 */
export function narrative(text: string): FhirComplex {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return complex([
    prop("status", str("generated")),
    prop("div", str(`<div xmlns="http://www.w3.org/1999/xhtml"><p>${escaped}</p></div>`)),
  ]);
}

/**
 * A `meta.profile` element pinning the resource to one or more canonical profile URLs (US Core
 * conformance is claimed via `meta.profile`). No version is pinned, so validating against any supplied
 * version of the named profile never raises a version-mismatch.
 *
 * @param profiles - The canonical profile URLs to claim.
 * @returns A `meta` `FhirComplex`.
 * @example
 * ```ts
 * import { meta, US_CORE_PROFILE } from "@cosyte/synth/fhir";
 * meta([US_CORE_PROFILE.PATIENT]);
 * ```
 */
export function meta(profiles: readonly string[]): FhirComplex {
  return complex([prop("profile", list(profiles.map((p) => str(p))))]);
}

/** A synthetic FHIR patient identity — every field drawn from `../safe` (roadmap §4). */
export interface FhirPatientIdentity {
  /** A synthetic resource `id` (a seeded UUID) — never a real record key. */
  readonly id: string;
  /** Name from the shipped fake-name pool. */
  readonly person: SyntheticName;
  /** Medical-record identifier scoped to the synthetic assigning authority. */
  readonly mrn: SyntheticIdentifier;
  /** Date of birth as a FHIR `date` (`YYYY-MM-DD`) from the seeded generator. */
  readonly birthDate: string;
  /** FHIR administrative-gender code. */
  readonly gender: "male" | "female";
  /** Synthetic postal address (reserved non-real ZIP). */
  readonly address: SyntheticAddress;
  /** Reserved `555-01xx` phone number. */
  readonly phone: string;
  /** Synthetic email at a reserved (`example.*`) domain. */
  readonly email: string;
}

/**
 * Reformat a `YYYYMMDD` synthetic date (from `safe.dateYmd`) as a FHIR `date` (`YYYY-MM-DD`).
 *
 * @param ymd - The `YYYYMMDD` date string.
 * @returns The `YYYY-MM-DD` FHIR date string.
 * @example
 * ```ts
 * import { toFhirDate } from "@cosyte/synth/fhir";
 * toFhirDate("19700131"); // "1970-01-31"
 * ```
 */
export function toFhirDate(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

/**
 * Mint a complete synthetic {@link FhirPatientIdentity}. Every value comes from a synthetic-safety
 * provider — no code path here can return a real or plausibly-real identifier (roadmap §4). The draw
 * order is fixed (id → name → MRN → DOB → gender → address → phone → email) so the same seed yields the
 * same identity (roadmap §5).
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link FhirPatientIdentity}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * // const id = fhirPatientIdentity(createRng(1)); // id.person, id.mrn, …
 * ```
 */
export function fhirPatientIdentity(rng: Rng): FhirPatientIdentity {
  const id = safe.uuid(rng);
  const person = safe.name(rng);
  const mrn = safe.identifier(rng, "MR");
  const birthDate = toFhirDate(safe.dateYmd(rng, 1930, 2010));
  const gender = rng.pick(["male", "female"] as const);
  const address = safe.address(rng);
  const phone = safe.phone(rng);
  const email = safe.email(rng, person);
  return { id, person, mrn, birthDate, gender, address, phone, email };
}

/**
 * The US Core Patient `identifier` element for a synthetic MRN — `type` (`MR`), the synthetic
 * assigning-authority OID as `system`, and the synthetic value. Satisfies US Core Patient's required
 * `identifier.system` + `identifier.value` (roadmap §Phase 3).
 *
 * @param mrn - The synthetic identifier from `safe.identifier`.
 * @returns An `Identifier` `FhirComplex`.
 * @example
 * ```ts
 * import { createRng, safe } from "@cosyte/synth";
 * import { mrnIdentifier } from "@cosyte/synth/fhir";
 * mrnIdentifier(safe.identifier(createRng(1), "MR"));
 * ```
 */
export function mrnIdentifier(mrn: SyntheticIdentifier): FhirComplex {
  return complex([
    prop(
      "type",
      complex([
        prop(
          "coding",
          list([
            coding({
              system: SYSTEM.IDENTIFIER_TYPE,
              code: "MR",
              display: "Medical Record Number",
            }),
          ]),
        ),
      ]),
    ),
    prop("system", str(`urn:oid:${mrn.assigningAuthorityOid}`)),
    prop("value", str(mrn.value)),
  ]);
}
