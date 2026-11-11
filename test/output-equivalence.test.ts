/**
 * Output equivalence: for every seed of the corpus, the package generates exactly what it did
 * before its work on import cost and corpus time.
 *
 * `test/_helpers/output-corpus.ts` records everything a caller can observe of each generator on a
 * fixed set of seeds (every message, resource, document and transaction, every corpus with its
 * manifest and warnings, every round-trip verdict, quirk and de-identification loop, and every
 * exported constant) and hashes it. The digests in `test/fixtures/equivalence/output-digests.json`
 * were captured from the source before that work (`SYNTH_CAPTURE_DIGESTS=1 pnpm exec vitest run
 * test/output-equivalence.test.ts` writes them). This test holds the current source to every one.
 *
 * A digest that moves is an output change. Recapture only for a change that means to move what a
 * caller sees, and name it in the changeset and the pull request.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { digestOf, observations } from "./_helpers/output-corpus.js";

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
