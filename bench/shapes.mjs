// The shapes the synth bench measures, shared by bench/synth.bench.mjs, bench/profile.mjs and
// test/perf/scaling-gate.perf.ts. Every input is a seed and a count: what this package is handed is
// a number, and what it costs is in what it generates, so a size is how many artifacts one call
// builds and its bytes are the bytes those artifacts hold. Every value it produces is synthetic by
// construction, from the package's own reserved ranges and name pool.
//
// A suite is handed the root entry it measures (`--target dist/index.mjs`), and each format lives
// on its own subpath. `formatOf` finds that subpath next to the root it was handed, so one suite
// measures a base build and a head build, each with its own generators.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/** The formats this package generates, each with its subpath and its corpus function. */
export const FORMATS = Object.freeze({
  hl7: "hl7Corpus",
  fhir: "fhirCorpus",
  ccda: "ccdaCorpus",
  x12: "x12Corpus",
  ncpdp: "ncpdpCorpus",
  astm: "astmCorpus",
});

/**
 * The file a root entry was loaded from: the file of the first stack frame a fatal from inside it
 * has. `resolveKind` with an empty list always throws `SynthError`, which is built in that file.
 */
function rootFile(root) {
  const original = Error.prepareStackTrace;
  Error.prepareStackTrace = (_error, frames) => frames;
  let frames = [];
  try {
    root.resolveKind([], "");
  } catch (error) {
    frames = error.stack;
  } finally {
    Error.prepareStackTrace = original;
  }
  const file = Array.isArray(frames) ? frames[0]?.getFileName() : undefined;
  if (typeof file !== "string") {
    throw new TypeError("bench: could not find the file the root entry was loaded from");
  }
  return file.startsWith("file:") ? file : `file://${file}`;
}

const subpaths = new WeakMap();

/**
 * The `format` subpath of the build whose root entry is `root`: `dist/<format>/index.mjs` beside
 * `dist/index.mjs`, loaded through `require` of an ES module (Node 22.12 and later), since a
 * benchmark's `bind` is synchronous.
 */
export function formatOf(root, format) {
  let loaded = subpaths.get(root);
  if (loaded === undefined) {
    loaded = new Map();
    subpaths.set(root, loaded);
  }
  let mod = loaded.get(format);
  if (mod === undefined) {
    mod = require(fileURLToPath(new URL(`./${format}/index.mjs`, rootFile(root))));
    loaded.set(format, mod);
  }
  return mod;
}

/**
 * One synthetic patient identity from a seed, through the root's synthetic-safety providers: a
 * name, a birth date, an address, an SSN outside every issued range, a 555-01xx phone, an email at
 * a reserved domain and a medical record number under the synthetic assigning authority.
 */
export function patientIdentity(synth, seed) {
  const rng = synth.createRng(seed);
  const person = synth.name(rng);
  return {
    name: person,
    birthDate: synth.dateYmd(rng),
    address: synth.address(rng),
    ssn: synth.ssn(rng),
    phone: synth.phone(rng),
    email: synth.email(rng, person),
    mrn: synth.identifier(rng, "MR"),
  };
}

/** `count` patient identities, each from a seed drawn from one stream seeded with `seed`. */
export function patients(synth, { seed, count }) {
  const stream = synth.createRng(seed);
  return Array.from({ length: count }, () => patientIdentity(synth, stream.nextUint32()));
}

/** Seed one stream for each seed and draw once from it: what every artifact pays for its seed. */
export function seedStreams(synth, seeds) {
  let sum = 0;
  for (const seed of seeds) sum += synth.createRng(seed).nextUint32() & 1;
  return sum + seeds.length;
}

/** `n` draws from one stream seeded once: the cost a seed is set against. */
export function drawFromOneStream(synth, { seed, n }) {
  const rng = synth.createRng(seed);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += rng.nextUint32() & 1;
  return sum + n;
}

/** This checkout's own build, for the byte counts a size reports. */
function own(format) {
  return format === undefined ? require("@cosyte/synth") : require(`@cosyte/synth/${format}`);
}

/** The bytes a corpus's artifacts hold, as UTF-8. */
export function corpusBytes(corpus) {
  let bytes = 0;
  for (const artifact of corpus.artifacts) bytes += Buffer.byteLength(artifact.content);
  return bytes;
}

/**
 * The bytes a set of inputs generates, from this checkout's build. A size's bytes are what one
 * pass generates, which a seed fixes, so they are the same for a base build and a head build that
 * keep the determinism contract; the comparison times both sides against the same count.
 */
export function bytesOf(kind, inputs) {
  if (kind.format === "patients") {
    const synth = own();
    return inputs.reduce((n, x) => n + Buffer.byteLength(JSON.stringify(patients(synth, x))), 0);
  }
  const corpusOf = own(kind.format)[FORMATS[kind.format]];
  return inputs.reduce((n, x) => n + corpusBytes(corpusOf({ ...x, ...kind.options })), 0);
}
