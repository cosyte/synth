// Benchmarks for @cosyte/synth, on @cosyte/bench, against the built entry a consumer imports.
//
// A reading of this build (throughput, latency p50/p95/p99, allocations, peak heap, a long run for
// leaks, and the cold import with every file it loads and its gzip size):
//   pnpm build && pnpm bench:reading --out bench-results/reading.json
// One benchmark or one case only (as `<benchmark> / <size>` in the results):
//   pnpm bench:reading --only "hl7Corpus: HL7 v2 messages"
// A base against head comparison, the base built in another checkout:
//   pnpm bench:compare --base <base checkout>/dist/index.mjs --head dist/index.mjs
// The budgets, read from a reading, and the profile (single-call time and peak memory of the large
// sizes, throughput from each shape's smallest size to its largest, the cost of a seed, the cold
// import of each subpath, and a CPU and heap profile of the hottest paths):
//   node bench/budgets.mjs bench-results/reading.json
//   pnpm bench:profile --out bench-results/profile
// On a pull request CI runs the comparison in its bench-compare job, and the Bench workflow takes a
// reading and a profile on a GitHub-hosted runner. Both are advisory: they post their numbers and
// fail nothing.
//
// The suite is handed the root entry under test rather than importing it, and finds each format's
// subpath beside it (bench/shapes.mjs), so one file measures both builds. Every input is a seed and
// a count, and every value generated is synthetic: no file is read.

import { defineBenchmark, defineSuite } from "@cosyte/bench";

import { bytesOf, drawFromOneStream, FORMATS, formatOf, patients, seedStreams } from "./shapes.mjs";

/** A size: `count` artifacts a call, `inputs` calls a pass, each from its own seed. */
function size(label, count, inputs, compare = false) {
  return { label, count, inputs, compare };
}

// Each shape at the size a caller asks for most (one artifact, many seeds, so a pass is not one
// artifact repeated) and at the sizes a test suite or a load test asks for: hundreds to tens of
// thousands of artifacts in one call. The pull request comparison runs only the first size of each
// shape: it runs every case in 24 fresh processes inside a 600 second budget, and a call of a
// thousand artifacts takes a fifth of a second to several seconds. A reading measures every size.
export const SHAPES = [
  {
    // The identities every generator draws from, built from the root's synthetic-safety providers
    // alone: no parser is loaded.
    name: "patient identities",
    fn: "patients",
    format: "patients",
    sizes: [
      size("1 patient", 1, 64, true),
      size("1,000 patients", 1_000, 1),
      size("100,000 patients", 100_000, 1),
    ],
  },
  {
    // Every message family in turn: ADT A01, A04 and A08, ORU, ORM, SIU and VXU.
    name: "HL7 v2 messages",
    fn: "hl7Corpus",
    format: "hl7",
    sizes: [
      size("1 message", 1, 64, true),
      size("100 messages", 100, 4),
      size("1,000 messages", 1_000, 1),
      size("10,000 messages", 10_000, 1),
    ],
  },
  {
    // The US Core clinical spine and a collection Bundle, in turn.
    name: "FHIR resources",
    fn: "fhirCorpus",
    format: "fhir",
    sizes: [
      size("1 resource", 1, 64, true),
      size("100 resources", 100, 4),
      size("1,000 resources", 1_000, 1),
      size("10,000 resources", 10_000, 1),
    ],
  },
  {
    // A US Core Patient for each of thousands of patients.
    name: "FHIR US Core Patients",
    fn: "fhirCorpus",
    format: "fhir",
    options: { mix: ["USCorePatient"] },
    sizes: [
      size("1 patient", 1, 64, true),
      size("1,000 patients", 1_000, 1),
      size("10,000 patients", 10_000, 1),
    ],
  },
  {
    // A document Bundle: a Composition and the clinical spine it cites.
    name: "FHIR document Bundles",
    fn: "fhirCorpus",
    format: "fhir",
    options: { mix: ["DocumentBundle"] },
    sizes: [
      size("1 Bundle", 1, 16, true),
      size("100 Bundles", 100, 1),
      size("1,000 Bundles", 1_000, 1),
    ],
  },
  {
    // A CCD and a Referral Note in turn, about 15 KiB each.
    name: "C-CDA documents",
    fn: "ccdaCorpus",
    format: "ccda",
    sizes: [
      size("1 document", 1, 8, true),
      size("10 documents", 10, 2),
      size("100 documents", 100, 1),
      size("1,000 documents", 1_000, 1),
    ],
  },
  {
    // 837P, 837I, 837D, 835 and 271 in turn, each its own interchange.
    name: "X12 transactions",
    fn: "x12Corpus",
    format: "x12",
    sizes: [
      size("1 transaction", 1, 64, true),
      size("100 transactions", 100, 4),
      size("1,000 transactions", 1_000, 1),
      size("10,000 transactions", 10_000, 1),
    ],
  },
  {
    // SCRIPT NewRx, RxRenewalRequest and RxChangeRequest, and Telecom B1, B2 and B3, in turn.
    name: "NCPDP transactions",
    fn: "ncpdpCorpus",
    format: "ncpdp",
    sizes: [
      size("1 transaction", 1, 64, true),
      size("100 transactions", 100, 4),
      size("1,000 transactions", 1_000, 1),
    ],
  },
  {
    // A result message and an order message in turn.
    name: "ASTM messages",
    fn: "astmCorpus",
    format: "astm",
    sizes: [
      size("1 message", 1, 64, true),
      size("100 messages", 100, 4),
      size("1,000 messages", 1_000, 1),
    ],
  },
];

/** The function a shape measures, bound to the build whose root entry is `synth`. */
export function bindShape(synth, shape) {
  if (shape.format === "patients") return (x) => patients(synth, x);
  const corpusOf = formatOf(synth, shape.format)[FORMATS[shape.format]];
  const options = shape.options ?? {};
  return (x) => corpusOf({ ...x, ...options });
}

/** The seeds of one size: `inputs` corpora of `count` artifacts each, seeds 1, 2, 3 and on. */
export function inputsOf(sz) {
  return Array.from({ length: sz.inputs }, (_v, i) => ({ seed: i + 1, count: sz.count }));
}

/** The sizes of a shape as @cosyte/bench takes them, each with the bytes one pass generates. */
function sizes(shape) {
  return shape.sizes.map((sz) => ({
    label: sz.label,
    compare: sz.compare,
    build: () => {
      const inputs = inputsOf(sz);
      return { inputs, bytes: bytesOf(shape, inputs) };
    },
  }));
}

const benchmarks = SHAPES.map((shape) =>
  defineBenchmark({
    name: `${shape.fn}: ${shape.name}`,
    sizes: sizes(shape),
    bind: (synth) => bindShape(synth, shape),
    weigh: (result) => (Array.isArray(result) ? result.length : result.artifacts.length),
  }),
);

// The determinism cost of a seed: every artifact is built from its own seed, drawn from the
// corpus's stream, and seeding a stream runs a splitmix32 expansion and eight warm-up rounds. These
// two read what a seed costs against what a draw costs. They have no bytes, so their throughput is
// in calls a second.
benchmarks.push(
  defineBenchmark({
    name: "createRng: seed a stream and draw once",
    sizes: [
      {
        label: "1 seed",
        compare: true,
        build: () => ({ inputs: Array.from({ length: 64 }, (_v, i) => [i + 1]) }),
      },
      {
        label: "10,000 seeds",
        build: () => ({ inputs: [Array.from({ length: 10_000 }, (_v, i) => i + 1)] }),
      },
    ],
    bind: (synth) => (seeds) => seedStreams(synth, seeds),
    weigh: (n) => n,
  }),
  defineBenchmark({
    name: "nextUint32: draw from one stream",
    sizes: [
      {
        label: "10,000 draws",
        compare: true,
        build: () => ({ inputs: [{ seed: 1, n: 10_000 }] }),
      },
    ],
    bind: (synth) => (x) => drawFromOneStream(synth, x),
    weigh: (n) => n,
  }),
);

export default defineSuite({ name: "@cosyte/synth", benchmarks });
