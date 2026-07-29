#!/usr/bin/env node
/**
 * Dual ESM/CJS smoke of the BUILT package, the release-shape gate.
 *
 * For EVERY published subpath this imports the ESM entry and requires the CJS entry, checks the
 * headline export resolves, exercises a real generation through each, and asserts the two module
 * systems produce byte-identical output for the same seed. It catches a broken dual build (a bad
 * `exports` map, an ESM-only construct leaking into CJS, a missing subpath entry) that a
 * source-only suite would not. Run after `build`; it consumes `dist/`, not `src/`.
 *
 * WHY THIS FILE NOW RUNS IN A JOB. It ran in NO CI job: only on the meta-repo's local
 * `scripts/verify.sh` ladder, which a contributor is not obliged to run and CI never runs at all. So
 * no required check covered the eight published subpaths, and a green PR said nothing about whether
 * they load.
 *
 * BE PRECISE ABOUT WHAT THE DOCS SAID, because an earlier draft of this paragraph was not and a
 * refuter caught it. It claimed the docs had described this as a CI gate, making them "assert a
 * protection nothing provides". FALSE HERE. Every surface that described this file said `run by
 * verify.sh` (CHANGELOG.md, CLAUDE.md, the release-hardening changeset) and its own header said only
 * "Run after `build`". The docs were accurate; the gap was that a local-only ladder is not a gate.
 * That sentence was ported from the sibling `deid`, where it IS true (its CHANGELOG records the line
 * that claimed CI and did not run), and porting it here without re-measuring it is exactly the
 * failure this repo's other gate header warns about.
 *
 * WHY THE SUBPATH SET IS NOT A LIST IN THIS FILE. It is read from `package.json`'s `exports` at run
 * time, and this script REFUSES to run if the per-subpath probe map below and that `exports` map
 * disagree in either direction. A hand-written array here would be a second, quietly-editable lever
 * on what this gate covers: drop an entry and the smoke goes on printing OK over whatever subset
 * someone last remembered. Note there is no exclusion LIST either: `"./package.json"` drops out
 * because its target is structurally DATA (a bare string that is not a `dist/` entry), not because
 * a key was named somewhere.
 *
 * THE MODULE PATHS ARE THE EXPORTS TARGETS THEMSELVES, not `dist/<name>/index.mjs` rebuilt by hand.
 * That way this loads exactly what a consumer's resolver would load, so an `exports` entry pointing
 * at a path the build does not emit fails here rather than in someone else's install.
 *
 * `scripts/check-test-selection.ts` derives its headline test subject from the same `exports` map.
 * The two gates interlock deliberately: dropping a subpath to shrink that gate's subject is caught
 * here, because the probe map below would then disagree with `exports`.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    console.error(`smoke: FAIL - ${msg}`);
    failures += 1;
  }
}

/**
 * A refusal is not a failure. A failure means the build is wrong; a refusal means this script could
 * not do its job, and an OK from a run that did not cover what it claims to cover is the worst of
 * the three outcomes.
 */
function refuse(message) {
  console.error(`smoke: REFUSING TO REPORT\n  ${message}`);
  process.exit(1);
}

/**
 * The probe for each published subpath: its headline export and a call that exercises it, returning
 * a string of generated content (or throwing). The probe proves the subpath actually generates
 * rather than merely loading. Keyed by the `exports` key so the comparison below is direct.
 */
const PROBES = {
  // PHI hygiene: this asserts on the SSN but never prints it. The value cannot be real (900-range,
  // drawn from this package's own seeded PRNG), but this job's output is a public Actions log now
  // rather than a developer's terminal, and a generator whose failure mode is emitting something that
  // looks real should not be teaching anyone to read a plausible SSN out of CI output. The seed and
  // the predicate are what a reader needs to reproduce it.
  ".": (m) => {
    const seed = 7;
    const rng = m.createRng(seed);
    const ssn = m.safe.ssn(rng);
    check(m.isSyntheticSsn(ssn), `root: isSyntheticSsn(safe.ssn(createRng(${seed}))) was false`);
    return ssn;
  },
  // The six format subpaths each ship a `*Corpus({ seed, count })` returning artifacts with a
  // serialized `content` string, the uniform round-tripped generation surface. Probing through it
  // proves the subpath both loads and generates spec-clean bytes.
  "./hl7": (m) => m.hl7Corpus({ seed: 1, count: 1 }).artifacts[0].content,
  "./fhir": (m) => m.fhirCorpus({ seed: 1, count: 1 }).artifacts[0].content,
  "./ccda": (m) => m.ccdaCorpus({ seed: 1, count: 1 }).artifacts[0].content,
  "./x12": (m) => m.x12Corpus({ seed: 1, count: 1 }).artifacts[0].content,
  "./ncpdp": (m) => m.ncpdpCorpus({ seed: 1, count: 1 }).artifacts[0].content,
  "./astm": (m) => m.astmCorpus({ seed: 1, count: 1 }).artifacts[0].content,
  // Returns the DE-IDENTIFIED DOCUMENT, not the survivor list. The survivor list is empty in the
  // expected-good case, so comparing it across module systems compared the constant `"[]"` and the
  // byte-identity assertion carried no information for this subpath. The document does.
  "./deid": (m) => m.hl7DeidLoop({ seed: 1 }).deidentified,
};

/** Walk an `exports` condition tree to the runtime target for one condition. */
function resolveCondition(target, condition) {
  if (typeof target === "string") return target;
  if (typeof target !== "object" || target === null) return undefined;
  for (const key of [condition, "default"]) {
    if (key in target) {
      const hit = resolveCondition(target[key], condition);
      if (typeof hit === "string") return hit;
    }
  }
  return undefined;
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (typeof pkg.exports !== "object" || pkg.exports === null) {
  refuse("package.json has no `exports` object, so there is no published subpath set to smoke.");
}

/** The published subpaths, derived. A target that is not a `dist/` entry is data, not an entry. */
const isEntry = (p) => typeof p === "string" && p.replace(/^\.\//, "").startsWith("dist/");
const published = [];
for (const [subpath, target] of Object.entries(pkg.exports)) {
  const esm = resolveCondition(target, "import");
  const cjs = resolveCondition(target, "require");
  if (!isEntry(esm) && !isEntry(cjs)) continue;
  if (!isEntry(esm) || !isEntry(cjs)) {
    refuse(
      `exports["${subpath}"] resolves to a \`dist/\` entry under one module system but not the ` +
        `other (import: ${String(esm)}, require: ${String(cjs)}). A dual package that only loads ` +
        `one way is exactly what this gate exists to catch, and it cannot be reported from a ` +
        `half-derived entry.`,
    );
  }
  published.push({ subpath, esm, cjs });
}

if (published.length === 0) {
  refuse("no `exports` entry resolves to a `dist/` entry point, so there is nothing to smoke.");
}

// The refusal that keeps the probe map honest. Either direction is a refusal: an unprobed published
// subpath would be silently unsmoked, and a probe for a subpath nobody publishes is a stale gate
// reporting on a surface that no longer exists.
const publishedKeys = new Set(published.map((p) => p.subpath));
const probedKeys = new Set(Object.keys(PROBES));
const unprobed = [...publishedKeys].filter((k) => !probedKeys.has(k));
const stale = [...probedKeys].filter((k) => !publishedKeys.has(k));
if (unprobed.length > 0 || stale.length > 0) {
  refuse(
    "the probe map in this file and package.json `exports` disagree, so this smoke would report " +
      "on a subset of the published surface:\n" +
      (unprobed.length > 0 ? `  published but not probed: ${unprobed.join(", ")}\n` : "") +
      (stale.length > 0 ? `  probed but not published: ${stale.join(", ")}\n` : "") +
      "  Add or remove the probe in the same change as the `exports` entry.",
  );
}

for (const { subpath, esm, cjs } of published) {
  const probe = PROBES[subpath];
  const mjs = join(root, esm.replace(/^\.\//, ""));
  const cjsPath = join(root, cjs.replace(/^\.\//, ""));

  let esmOut, cjsOut;
  try {
    const mod = await import(mjs);
    esmOut = probe(mod);
    check(typeof esmOut === "string" && esmOut.length > 0, `ESM ${subpath}: empty generation`);
  } catch (err) {
    check(false, `ESM ${subpath}: ${String(err)}`);
  }
  try {
    const mod = require(cjsPath);
    cjsOut = probe(mod);
    check(typeof cjsOut === "string" && cjsOut.length > 0, `CJS ${subpath}: empty generation`);
  } catch (err) {
    check(false, `CJS ${subpath}: ${String(err)}`);
  }
  // Determinism across module systems: the same seed yields the same bytes under ESM and CJS.
  if (esmOut && cjsOut) {
    check(esmOut === cjsOut, `${subpath}: ESM/CJS output differ for the same seed`);
  }
}

if (failures > 0) {
  console.error(`smoke: ${failures} failure(s) across the built subpaths`);
  process.exit(1);
}
console.log(
  `smoke: ok - all ${published.length} published subpath(s), derived from package.json exports ` +
    `[${published.map((p) => p.subpath).join(", ")}], generate synthetic output under both ESM and CJS`,
);
