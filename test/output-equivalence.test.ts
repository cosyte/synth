/**
 * Output equivalence: for every seed of the corpus, the package generates exactly what it did
 * before its work on import cost and corpus time.
 *
 * The corpus below records everything a caller can observe of each generator on a
 * fixed set of seeds (every message, resource, document and transaction, every corpus with its
 * manifest and warnings, every round-trip verdict, quirk and de-identification loop, and every
 * exported constant) and hashes it. The digests in `test/fixtures/equivalence/output-digests.json`
 * were captured from the source before that work (`SYNTH_CAPTURE_DIGESTS=1 pnpm exec vitest run
 * test/output-equivalence.test.ts` writes them). This test holds the current source to every one.
 *
 * A digest that moves is an output change. Recapture only for a change that means to move what a
 * caller sees, and name it in the changeset and the pull request.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { serializeCcda } from "@cosyte/ccda";
import { serializeResource, type FhirComplex } from "@cosyte/fhir";
import { serializeX12, type X12Interchange } from "@cosyte/x12";

import * as root from "../src/index.js";
import * as astm from "../src/astm/index.js";
import * as ccda from "../src/ccda/index.js";
import * as deid from "../src/deid/index.js";
import * as fhir from "../src/fhir/index.js";
import * as hl7 from "../src/hl7/index.js";
import * as ncpdp from "../src/ncpdp/index.js";
import * as x12 from "../src/x12/index.js";

/** One labelled observation: what a caller sees, as text, before it is hashed. */
interface Observation {
  readonly label: string;
  readonly text: () => string;
}

/** The seeds every generator is read at: small, large, and the ones the fixtures use. */
const SEEDS: readonly number[] = Object.freeze([
  0, 1, 2, 3, 7, 42, 1001, 2024, 65_535, 2_147_483_647, 4_294_967_295,
]);

/** A smaller seed set for the slow formats (FHIR Bundles, C-CDA, de-identification). */
const FEW_SEEDS: readonly number[] = Object.freeze([0, 1, 42, 4_294_967_295]);

/** Stable JSON: object keys sorted, typed arrays as hex, functions by name. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v instanceof Uint8Array) return `bytes:${Buffer.from(v).toString("hex")}`;
    if (typeof v === "function") return `function:${v.name}`;
    if (typeof v === "bigint") return `bigint:${String(v)}`;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) out[k] = (v as Record<string, unknown>)[k];
      return out;
    }
    return v;
  });
}

/** What a call threw, as a caller sees it, or what it returned through `show`. */
function attempt<T>(call: () => T, show: (value: T) => string): string {
  try {
    return `ok:${show(call())}`;
  } catch (error) {
    const e = error as { name?: string; code?: unknown; message?: string };
    return `threw:${String(e.name)}:${String(e.code)}:${String(e.message)}`;
  }
}

/** A corpus as a caller sees it: seed, manifest, every artifact, and whether it is frozen. */
function showCorpus(corpus: root.Corpus): string {
  return stable({
    seed: corpus.seed,
    manifest: corpus.manifest,
    artifacts: corpus.artifacts,
    frozen: [
      Object.isFrozen(corpus),
      Object.isFrozen(corpus.artifacts),
      corpus.artifacts.every((a) => Object.isFrozen(a) && Object.isFrozen(a.warnings)),
    ],
  });
}

const fhirText = (r: FhirComplex): string => serializeResource(r);
const x12Text = (i: X12Interchange): string => serializeX12(i);

/** Exported values that change with every release; `test/version.test.ts` pins VERSION instead. */
const RELEASE_VALUES: ReadonlySet<string> = new Set(["VERSION"]);

/** Every exported value of an entry that is not a function, as stable JSON. */
function constantsOf(entry: string, mod: Record<string, unknown>): Observation[] {
  return Object.keys(mod)
    .sort()
    .filter((k) => typeof mod[k] !== "function" && !RELEASE_VALUES.has(k))
    .map((k) => ({ label: `const:${entry}:${k}`, text: () => stable(mod[k]) }));
}

/** The names each entry exports, so an export added or removed moves a digest. */
function surfaceOf(entry: string, mod: Record<string, unknown>): Observation {
  return {
    label: `surface:${entry}`,
    text: () =>
      stable(
        Object.keys(mod)
          .sort()
          .map((k) => `${k}:${typeof mod[k]}`),
      ),
  };
}

function rootObservations(): Observation[] {
  const out: Observation[] = [];
  for (const seed of SEEDS) {
    out.push({
      label: `root:providers:${String(seed)}`,
      text: () => {
        const rng = root.createRng(seed);
        const person = root.name(rng);
        return stable({
          draws: [rng.nextUint32(), rng.float(), rng.int(0, 1000), rng.bool(), rng.digits(5)],
          person,
          ssn: root.ssn(rng),
          advertising: root.ssn(rng, "advertising"),
          phone: root.phone(rng),
          email: root.email(rng, person),
          email2: root.email(rng),
          ipv4: root.ipv4(rng),
          ipv6: root.ipv6(rng),
          uuid: root.uuid(rng),
          npi: root.npi(rng),
          dea: root.dea(rng, person),
          id: root.identifier(rng, "MR"),
          address: root.address(rng),
          date: root.dateYmd(rng),
          safe: root.safe.name(rng),
          split: root.splitmix32(seed)(),
        });
      },
    });
  }
  return out;
}

function hl7Observations(): Observation[] {
  const out: Observation[] = [];
  const kinds: readonly hl7.Hl7MessageKind[] = [
    "ADT^A01",
    "ADT^A04",
    "ADT^A08",
    "ORU^R01",
    "ORM^O01",
    "SIU^S12",
    "VXU^V04",
  ];
  for (const seed of SEEDS) {
    for (const kind of kinds) {
      out.push({
        label: `hl7:${kind}:${String(seed)}`,
        text: () => stable(hl7.roundTrip(hl7.generateHl7(kind, seed))),
      });
    }
    out.push({
      label: `hl7:direct:${String(seed)}`,
      text: () =>
        [
          hl7.generateAdt({ seed }),
          hl7.generateAdt({ seed, trigger: "A08" }),
          hl7.generateOru({ seed }),
          hl7.generateOrm({ seed }),
          hl7.generateSiu({ seed }),
          hl7.generateVxu({ seed }),
        ]
          .map((m) => m.toString())
          .join("\n--\n"),
    });
    out.push({
      label: `hl7:corpus:${String(seed)}`,
      text: () => showCorpus(hl7.hl7Corpus({ seed, count: 15 })),
    });
    out.push({
      label: `hl7:parts:${String(seed)}`,
      text: () => {
        const rng = root.createRng(seed);
        const id = hl7.patientIdentity(rng);
        const scaffold = hl7.mshScaffold(rng, "ORU^R01");
        return stable({
          id,
          ts: hl7.seededTimestamp(rng),
          pid: hl7.pidSegment(id),
          scaffold: { ...scaffold, message: scaffold.message.toString() },
        });
      },
    });
    for (const quirk of Object.keys(hl7.HL7_QUIRKS) as hl7.Hl7QuirkName[]) {
      out.push({
        label: `hl7:quirk:${quirk}:${String(seed)}`,
        text: () => {
          const artifact = hl7.generateHl7Quirk({ seed, quirk });
          return stable({ artifact, rt: hl7.hl7QuirkRoundTrip(artifact) });
        },
      });
    }
    out.push({
      label: `hl7:quirk-corpus:${String(seed)}`,
      text: () => showCorpus(hl7.hl7QuirkCorpus({ seed, count: 5 })),
    });
  }
  for (const mix of kinds) {
    out.push({
      label: `hl7:corpus-mix:${mix}`,
      text: () => showCorpus(hl7.hl7Corpus({ seed: 9, count: 3, mix: [mix] })),
    });
  }
  out.push({
    label: "hl7:corpus-triggers",
    text: () => showCorpus(hl7.hl7Corpus({ seed: 5, count: 4, triggers: ["A04", "A08"] })),
  });
  out.push({
    label: "hl7:corpus-default-count",
    text: () => showCorpus(hl7.hl7Corpus({ seed: 5 })),
  });
  out.push({
    label: "hl7:quirk-profile",
    text: () =>
      stable({
        p: hl7.hl7QuirkProfile,
        c: showCorpus(hl7.hl7QuirkCorpus({ seed: 3, count: 4, profile: hl7.hl7QuirkProfile })),
      }),
  });
  out.push({
    label: "hl7:errors",
    text: () =>
      [
        attempt(
          () => hl7.generateHl7("XYZ" as hl7.Hl7MessageKind, 1),
          (m) => m.toString(),
        ),
        attempt(
          () => hl7.hl7Corpus({ seed: 1, count: 1, mix: [] }),
          (c) => showCorpus(c),
        ),
      ].join("\n"),
  });
  return out;
}

function fhirObservations(): Observation[] {
  const out: Observation[] = [];
  const kinds: readonly fhir.FhirResourceKind[] = [
    "Patient",
    "USCorePatient",
    "Condition",
    "ObservationLab",
    "VitalSign",
    "MedicationRequest",
    "Encounter",
    "Immunization",
    "AllergyIntolerance",
    "Procedure",
    "DiagnosticReport",
    "Bundle",
    "DocumentBundle",
  ];
  for (const seed of SEEDS) {
    out.push({
      label: `fhir:direct:${String(seed)}`,
      text: () =>
        [
          fhir.generatePatient({ seed }),
          fhir.generatePatient({ seed, profile: "us-core" }),
          fhir.generateCondition({ seed }),
          fhir.generateObservationLab({ seed }),
          fhir.generateVitalSign({ seed }),
          fhir.generateMedicationRequest({ seed }),
          fhir.generateEncounter({ seed }),
          fhir.generateImmunization({ seed }),
          fhir.generateAllergyIntolerance({ seed }),
          fhir.generateProcedure({ seed }),
          fhir.generateDiagnosticReport({ seed }),
          fhir.generateProvenance({ seed }),
        ]
          .map(fhirText)
          .join("\n--\n"),
    });
    out.push({
      label: `fhir:roundtrip:${String(seed)}`,
      text: () => stable(fhir.roundTrip(fhir.generateObservationLab({ seed }))),
    });
    out.push({
      label: `fhir:corpus:${String(seed)}`,
      text: () => showCorpus(fhir.fhirCorpus({ seed, count: 11 })),
    });
  }
  for (const seed of FEW_SEEDS) {
    for (const type of ["collection", "transaction", "document"] as const) {
      out.push({
        label: `fhir:bundle:${type}:${String(seed)}`,
        text: () => stable(fhir.roundTrip(fhir.generateBundle({ seed, type }))),
      });
    }
    for (const row of fhir.usCoreCoverage().filter((r) => r.generated)) {
      out.push({
        label: `fhir:us-core:${row.profile}:${String(seed)}`,
        text: () => fhirText(fhir.generateUsCoreProfile({ profile: row.profile, seed })),
      });
    }
    out.push({
      label: `fhir:parts:${String(seed)}`,
      text: () => {
        const rng = root.createRng(seed);
        const id = fhir.fhirPatientIdentity(rng);
        return stable({
          id,
          mrn: fhirText(fhir.mrnIdentifier(id.mrn)),
          date: fhir.toFhirDate("20240131"),
          composition: fhirText(
            fhir.buildComposition(rng, {
              subject: "urn:uuid:p",
              organization: "urn:uuid:o",
              date: "2024-01-31",
              sections: [{ code: "11450-4", title: "Problems", entries: ["urn:uuid:c"] }],
            }),
          ),
        });
      },
    });
  }
  for (const mix of kinds) {
    out.push({
      label: `fhir:corpus-mix:${mix}`,
      text: () => showCorpus(fhir.fhirCorpus({ seed: 9, count: 2, mix: [mix] })),
    });
  }
  out.push({ label: "fhir:coverage", text: () => stable(fhir.usCoreCoverage()) });
  out.push({
    label: "fhir:corpus-default-count",
    text: () => showCorpus(fhir.fhirCorpus({ seed: 5 })),
  });
  return out;
}

function ccdaObservations(): Observation[] {
  const out: Observation[] = [];
  for (const seed of FEW_SEEDS) {
    out.push({
      label: `ccda:ccd:${String(seed)}`,
      text: () => stable(ccda.roundTrip(ccda.generateCcd({ seed }))),
    });
    out.push({
      label: `ccda:referral:${String(seed)}`,
      text: () => serializeCcda(ccda.generateReferralNote({ seed })),
    });
    out.push({
      label: `ccda:corpus:${String(seed)}`,
      text: () => showCorpus(ccda.ccdaCorpus({ seed, count: 2 })),
    });
    for (const quirk of Object.keys(ccda.CCDA_QUIRKS) as ccda.CcdaQuirkName[]) {
      out.push({
        label: `ccda:quirk:${quirk}:${String(seed)}`,
        text: () => {
          const artifact = ccda.generateCcdaQuirk({ seed, quirk });
          return stable({ artifact, rt: ccda.ccdaQuirkRoundTrip(artifact) });
        },
      });
    }
    out.push({
      label: `ccda:identity:${String(seed)}`,
      text: () => stable(ccda.ccdaPatientIdentity(root.createRng(seed))),
    });
  }
  out.push({
    label: "ccda:quirk-corpus",
    text: () => showCorpus(ccda.ccdaQuirkCorpus({ seed: 4, count: 3 })),
  });
  out.push({
    label: "ccda:corpus-mix",
    text: () =>
      showCorpus(ccda.ccdaCorpus({ seed: 8, count: 2, mix: ["referralNote"] })) +
      showCorpus(ccda.ccdaCorpus({ seed: 8 })),
  });
  out.push({
    label: "ccda:generate-type",
    text: () => serializeCcda(ccda.generateCcda({ seed: 3, documentType: "referralNote" })),
  });
  return out;
}

function x12Observations(): Observation[] {
  const out: Observation[] = [];
  const kinds: readonly x12.X12CorpusKind[] = ["837P", "837I", "837D", "835", "271"];
  for (const seed of SEEDS) {
    out.push({
      label: `x12:direct:${String(seed)}`,
      text: () =>
        [
          x12.generate837P({ seed }),
          x12.generate837I({ seed }),
          x12.generate837D({ seed }),
          x12.generate835({ seed }),
          x12.generate271({ seed }),
        ]
          .map((i) => stable(x12.roundTrip(i)))
          .join("\n--\n"),
    });
    out.push({
      label: `x12:corpus:${String(seed)}`,
      text: () => showCorpus(x12.x12Corpus({ seed, count: 10 })),
    });
    out.push({
      label: `x12:identity:${String(seed)}`,
      text: () => {
        const rng = root.createRng(seed);
        return stable([
          x12.x12Person(rng),
          x12.x12Organization(rng),
          x12.x12ProviderPerson(rng),
          x12.x12Payer(rng),
          x12.x12TradingPartners(rng),
          x12.x12EnvelopeTiming(rng),
          x12.money(seed % 100_000),
          x12.dec("12.50").toString(),
        ]);
      },
    });
  }
  for (const mix of kinds) {
    out.push({
      label: `x12:corpus-mix:${mix}`,
      text: () => showCorpus(x12.x12Corpus({ seed: 9, count: 2, mix: [mix] })),
    });
  }
  out.push({ label: "x12:837", text: () => x12Text(x12.generate837("I", { seed: 4 })) });
  out.push({
    label: "x12:corpus-default-count",
    text: () => showCorpus(x12.x12Corpus({ seed: 5 })),
  });
  return out;
}

function ncpdpObservations(): Observation[] {
  const out: Observation[] = [];
  const kinds: readonly ncpdp.NcpdpCorpusKind[] = [
    "NewRx",
    "RxRenewalRequest",
    "RxChangeRequest",
    "B1",
    "B2",
    "B3",
  ];
  for (const seed of SEEDS) {
    out.push({
      label: `ncpdp:direct:${String(seed)}`,
      text: () =>
        stable([
          ncpdp.scriptRoundTrip(ncpdp.generateNewRx({ seed })),
          ncpdp.scriptRoundTrip(ncpdp.generateRxRenewalRequest({ seed })),
          ncpdp.scriptRoundTrip(ncpdp.generateRxChangeRequest({ seed })),
          ncpdp.telecomRoundTrip(ncpdp.generateB1({ seed })),
          ncpdp.telecomRoundTrip(ncpdp.generateB2({ seed })),
          ncpdp.telecomRoundTrip(ncpdp.generateB3({ seed })),
        ]),
    });
    out.push({
      label: `ncpdp:corpus:${String(seed)}`,
      text: () => showCorpus(ncpdp.ncpdpCorpus({ seed, count: 12 })),
    });
    out.push({
      label: `ncpdp:identity:${String(seed)}`,
      text: () => {
        const rng = root.createRng(seed);
        return stable([
          ncpdp.ncpdpPatient(rng),
          ncpdp.ncpdpPrescriber(rng),
          ncpdp.ncpdpPharmacy(rng),
          ncpdp.ncpdpCardholder(rng),
          ncpdp.ncpdpScriptRouting(rng),
        ]);
      },
    });
  }
  for (const mix of kinds) {
    out.push({
      label: `ncpdp:corpus-mix:${mix}`,
      text: () => showCorpus(ncpdp.ncpdpCorpus({ seed: 9, count: 2, mix: [mix] })),
    });
  }
  out.push({
    label: "ncpdp:corpus-default-count",
    text: () => showCorpus(ncpdp.ncpdpCorpus({ seed: 5 })),
  });
  return out;
}

function astmObservations(): Observation[] {
  const out: Observation[] = [];
  for (const seed of SEEDS) {
    out.push({
      label: `astm:direct:${String(seed)}`,
      text: () =>
        stable([
          astm.astmRoundTrip(astm.generateAstmResult({ seed })),
          astm.astmRoundTrip(astm.generateAstmResult({ seed, resultCount: 3, comment: true })),
          astm.astmRoundTrip(astm.generateAstmOrder({ seed })),
          astm.astmFramedRoundTrip(astm.generateAstmResultFramed({ seed })),
          astm.generateAstmResultFramed({ seed }),
        ]),
    });
    out.push({
      label: `astm:corpus:${String(seed)}`,
      text: () => showCorpus(astm.astmCorpus({ seed, count: 6 })),
    });
    out.push({
      label: `astm:identity:${String(seed)}`,
      text: () => {
        const rng = root.createRng(seed);
        return stable([astm.astmPatient(rng), astm.astmOrder(rng), astm.astmHeaderIdentity(rng)]);
      },
    });
    for (const quirk of Object.keys(astm.ASTM_QUIRKS) as astm.AstmQuirkName[]) {
      out.push({
        label: `astm:quirk:${quirk}:${String(seed)}`,
        text: () => {
          const artifact = astm.generateAstmQuirk({ seed, quirk });
          return stable({ artifact, rt: astm.astmQuirkRoundTrip(artifact) });
        },
      });
    }
  }
  out.push({
    label: "astm:quirk-corpus",
    text: () =>
      showCorpus(astm.astmQuirkCorpus({ seed: 4, count: 4 })) + stable(astm.astmQuirkProfile),
  });
  out.push({
    label: "astm:corpus-mix",
    text: () =>
      showCorpus(astm.astmCorpus({ seed: 9, count: 2, mix: ["Order"] })) +
      showCorpus(astm.astmCorpus({ seed: 9 })),
  });
  return out;
}

function deidObservations(): Observation[] {
  const out: Observation[] = [];
  for (const seed of FEW_SEEDS) {
    out.push({ label: `deid:hl7:${String(seed)}`, text: () => stable(deid.hl7DeidLoop({ seed })) });
    out.push({
      label: `deid:fhir:${String(seed)}`,
      text: () => stable(deid.fhirDeidLoop({ seed })),
    });
    for (const variant of ["837P", "837I", "837D", "271", "835"] as const) {
      out.push({
        label: `deid:x12:${variant}:${String(seed)}`,
        text: () => stable(deid.x12DeidLoop({ seed, variant })),
      });
    }
    for (const variant of ["B1", "B2", "B3"] as const) {
      out.push({
        label: `deid:ncpdp:${variant}:${String(seed)}`,
        text: () => stable(deid.ncpdpTelecomDeidLoop({ seed, transaction: variant })),
      });
    }
    for (const documentType of ["ccd", "referral"] as const) {
      out.push({
        label: `deid:ccda:${documentType}:${String(seed)}`,
        text: () => stable(deid.ccdaDeidLoop({ seed, documentType })),
      });
    }
  }
  out.push({
    label: "deid:summary",
    text: () =>
      stable(
        deid.summarizeDeidCoverage([
          deid.hl7DeidLoop({ seed: 1 }),
          deid.x12DeidLoop({ seed: 1 }),
          deid.ccdaDeidLoop({ seed: 1 }),
        ]),
      ),
  });
  out.push({ label: "deid:policy", text: () => stable(deid.deidLoopPolicy()) });
  return out;
}

/**
 * A seed sweep of every corpus generator: blocks of ten consecutive seeds drawn from one stream,
 * each block one digest, so a change that moves one artifact of one seed is caught.
 */
function sweepObservations(): Observation[] {
  const corpora: [string, (o: { seed: number; count: number }) => root.Corpus, number, number][] = [
    ["hl7", hl7.hl7Corpus, 20, 7],
    ["x12", x12.x12Corpus, 20, 5],
    ["ncpdp", ncpdp.ncpdpCorpus, 20, 6],
    ["astm", astm.astmCorpus, 20, 2],
    ["fhir", fhir.fhirCorpus, 5, 13],
    ["ccda", ccda.ccdaCorpus, 2, 2],
  ];
  const out: Observation[] = [];
  for (const [format, corpusOf, blocks, count] of corpora) {
    const stream = root.createRng(0x5eed);
    for (let block = 0; block < blocks; block += 1) {
      const seeds = Array.from({ length: 10 }, () => stream.nextUint32());
      out.push({
        label: `sweep:${format}:${String(block)}`,
        text: () => seeds.map((seed) => showCorpus(corpusOf({ seed, count }))).join("\n"),
      });
    }
  }
  return out;
}

/** Every observation of the corpus, in a fixed order. */
function observations(): Observation[] {
  const entries: [string, Record<string, unknown>][] = [
    ["root", root],
    ["hl7", hl7],
    ["fhir", fhir],
    ["ccda", ccda],
    ["x12", x12],
    ["ncpdp", ncpdp],
    ["astm", astm],
    ["deid", deid],
  ];
  return [
    ...entries.flatMap(([entry, mod]) => [surfaceOf(entry, mod), ...constantsOf(entry, mod)]),
    ...rootObservations(),
    ...hl7Observations(),
    ...fhirObservations(),
    ...ccdaObservations(),
    ...x12Observations(),
    ...ncpdpObservations(),
    ...astmObservations(),
    ...deidObservations(),
    ...sweepObservations(),
  ];
}

/** The digest of one observation: SHA-256 of its text, or of what it threw. */
function digestOf(observation: Observation): string {
  return createHash("sha256")
    .update(
      attempt(
        () => observation.text(),
        (t) => t,
      ),
    )
    .digest("hex");
}

const DIGESTS = fileURLToPath(
  new URL("./fixtures/equivalence/output-digests.json", import.meta.url),
);

const capture = process.env["SYNTH_CAPTURE_DIGESTS"] === "1";

/** Every digest of the corpus, keyed by its label, in corpus order. */
function digests(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const observation of observations()) {
    if (Object.hasOwn(out, observation.label)) {
      throw new Error(`duplicate corpus label ${observation.label}`);
    }
    out[observation.label] = digestOf(observation);
  }
  return out;
}

describe("output equivalence against the digests captured before the work", () => {
  it("generates every observation of the corpus exactly as before", () => {
    const head = digests();
    if (capture) {
      writeFileSync(DIGESTS, `${JSON.stringify(head, null, 2)}\n`);
      return;
    }
    const base = JSON.parse(readFileSync(DIGESTS, "utf8")) as Record<string, string>;
    expect(Object.keys(head)).toEqual(Object.keys(base));
    const moved = Object.keys(base).filter((label) => head[label] !== base[label]);
    expect(moved).toEqual([]);
    // A shrunken corpus cannot pass quietly.
    expect(Object.keys(base).length).toBeGreaterThan(650);
  }, 300_000);
});
