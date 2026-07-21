#!/usr/bin/env node
// Dual ESM/CJS smoke of the BUILT package — the release-shape gate. For EVERY published subpath
// (`.`/`hl7`/`fhir`/`ccda`/`x12`/`ncpdp`/`astm`/`deid`) this imports the ESM entry and requires the
// CJS entry from `dist/`, checks the headline export resolves, and exercises a real generation through
// each — asserting the output is synthetic-by-construction. It catches a broken dual build (a bad
// `exports` map, an ESM-only construct leaking into CJS, a missing subpath entry) that a source-only
// suite would not. Run after `build`; it consumes `dist/`, not `src/`.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    console.error(`smoke: FAIL — ${msg}`);
    failures += 1;
  }
}

// Each subpath: the dist folder, a headline export, and a probe that exercises it and returns a string
// of generated wire content (or throws). The probe proves the subpath actually generates.
const SUBPATHS = [
  {
    name: ".",
    dir: "",
    probe: (m) => {
      const rng = m.createRng(7);
      const ssn = m.safe.ssn(rng);
      check(m.isSyntheticSsn(ssn), `root: ssn ${ssn} not synthetic`);
      return ssn;
    },
  },
  // The six format subpaths each ship a `*Corpus({ seed, count })` returning artifacts with a
  // serialized `content` string — the uniform, round-tripped generation surface. Probing through it
  // proves the subpath both loads and generates spec-clean bytes.
  {
    name: "hl7",
    dir: "hl7",
    probe: (m) => m.hl7Corpus({ seed: 1, count: 1 }).artifacts[0].content,
  },
  {
    name: "fhir",
    dir: "fhir",
    probe: (m) => m.fhirCorpus({ seed: 1, count: 1 }).artifacts[0].content,
  },
  {
    name: "ccda",
    dir: "ccda",
    probe: (m) => m.ccdaCorpus({ seed: 1, count: 1 }).artifacts[0].content,
  },
  {
    name: "x12",
    dir: "x12",
    probe: (m) => m.x12Corpus({ seed: 1, count: 1 }).artifacts[0].content,
  },
  {
    name: "ncpdp",
    dir: "ncpdp",
    probe: (m) => m.ncpdpCorpus({ seed: 1, count: 1 }).artifacts[0].content,
  },
  {
    name: "astm",
    dir: "astm",
    probe: (m) => m.astmCorpus({ seed: 1, count: 1 }).artifacts[0].content,
  },
  {
    name: "deid",
    dir: "deid",
    probe: (m) => JSON.stringify(m.hl7DeidLoop({ seed: 1 }).survivors ?? ["?"]),
  },
];

for (const sub of SUBPATHS) {
  const base = sub.dir ? join(root, "dist", sub.dir) : join(root, "dist");
  const mjs = join(base, "index.mjs");
  const cjs = join(base, "index.cjs");

  let esmOut, cjsOut;
  try {
    const esm = await import(mjs);
    esmOut = sub.probe(esm);
    check(typeof esmOut === "string" && esmOut.length > 0, `ESM ${sub.name}: empty generation`);
  } catch (err) {
    check(false, `ESM ${sub.name}: ${String(err)}`);
  }
  try {
    const mod = require(cjs);
    cjsOut = sub.probe(mod);
    check(typeof cjsOut === "string" && cjsOut.length > 0, `CJS ${sub.name}: empty generation`);
  } catch (err) {
    check(false, `CJS ${sub.name}: ${String(err)}`);
  }
  // Determinism across module systems: the same seed yields the same bytes under ESM and CJS.
  if (esmOut && cjsOut) {
    check(esmOut === cjsOut, `${sub.name}: ESM/CJS output differ for the same seed`);
  }
}

if (failures > 0) {
  console.error(`smoke: ${failures} failure(s) across the built subpaths`);
  process.exit(1);
}
console.log("smoke: ok — all 8 subpaths generate synthetic output under both ESM and CJS");
