/**
 * The format-agnostic core of the **`@cosyte/deid` pairing loop** (roadmap §Phase 8) — a **closed-loop
 * co-validation harness** for the `synth` ⇄ `deid` pair.
 *
 * The loop's shape is: **generate a spec-clean synthetic artifact → enumerate the distinctive synthetic
 * PHI sentinels `@cosyte/synth` planted at its patient loci → run it through `@cosyte/deid` → verify
 * every planted sentinel is gone from the de-identified output** (a surviving sentinel is a hard
 * failure), **and that the non-PHI clinical content survived** (the over-scrub guard). It is
 * deterministic and seeded, and it does **not** change what the generators emit — it consumes their
 * output.
 *
 * **Honesty line (governs the whole module).** This is a **co-validation harness**, not an independent
 * audit of `@cosyte/deid` against real-world data. It proves *the pair works on `synth`'s own output*:
 * that the synthetic PHI `synth` plants at the patient loci is removed by `deid`, and that `deid` does
 * not over-scrub `synth`'s clinical payload. A sentinel that `deid` **blocks** rather than redacts still
 * passes the removal check (blocked = gone from the wire). Formats where `@cosyte/deid` ships no adapter
 * (NCPDP **SCRIPT**, **ASTM**) — and DICOM, which `synth` does not generate — are **skipped and named**
 * (see `DEID_LOOP_SKIPPED` in `./index`), never silently.
 *
 * This module holds only the pure, parser-free pieces (the policy, the sentinel model, the sweep, the
 * over-scrub check, the verdict). The per-format loops that drive the generators and the `deid` adapters
 * live in `./index`.
 *
 * @module
 */

import {
  defineDeidPolicy,
  SAFE_HARBOR_CATEGORIES,
  type DeidPolicy,
  type GenericLocus,
} from "@cosyte/deid";

/**
 * The set of cosyte formats the loop covers — every format for which **both** `@cosyte/synth` generates
 * and `@cosyte/deid` ships an adapter.
 */
export type DeidLoopFormat = "hl7" | "fhir" | "ccda" | "x12" | "ncpdp-telecom";

/**
 * A single **planted sentinel**: one distinctive, synthetic-by-construction PHI token that
 * `@cosyte/synth` placed at a patient locus of a generated artifact, tracked so the loop can prove
 * `@cosyte/deid` removed it. The token is always drawn from a synthetic-safety provider (roadmap §4) —
 * a fake-name-pool name, a `900`-range SSN, a `555-01xx` phone, a synthetic-assigning-authority
 * identifier — so a sentinel can never be, or collide with, a real person's PHI.
 *
 * @example
 * ```ts
 * const s: DeidSentinel = { token: "Examplewood", locus: "PID-5", category: "names" };
 * ```
 */
export interface DeidSentinel {
  /** The exact synthetic token planted at the locus — a literal substring of the spec-clean artifact. */
  readonly token: string;
  /** Where it lives — a format-neutral path (e.g. `"PID-5"`, `"recordTarget"`, `"NM1[0]-3"`). */
  readonly locus: string;
  /** The Safe Harbor category `@cosyte/deid` assigned to the locus, when known. */
  readonly category?: string;
}

/**
 * The verdict of one pass through the pairing loop for one artifact.
 *
 * `pass` is `true` **iff** at least one sentinel was planted, **no** planted sentinel survived
 * de-identification, and **no** probed clinical value was over-scrubbed.
 *
 * @example
 * ```ts
 * import { hl7DeidLoop } from "@cosyte/synth/deid";
 * const r = hl7DeidLoop({ seed: 42 });
 * r.pass;            // => true
 * r.survivors.length; // => 0
 * ```
 */
export interface DeidLoopResult {
  /** The covered format. */
  readonly format: DeidLoopFormat;
  /** The concrete artifact label (e.g. `"ORU^R01"`, `"837P"`, `"CCD"`). */
  readonly artifact: string;
  /** The seed — the same seed yields the same artifact and the same verdict. */
  readonly seed: number;
  /** Every distinctive synthetic PHI sentinel `synth` planted at a patient locus of the artifact. */
  readonly planted: readonly DeidSentinel[];
  /** Planted sentinels still present in the de-identified output — **must be empty**. */
  readonly survivors: readonly DeidSentinel[];
  /** The non-PHI clinical code tokens probed for over-scrub (present in the spec-clean artifact). */
  readonly clinicalProbed: readonly string[];
  /** Probed clinical tokens missing after de-identification (over-scrub) — **must be empty**. */
  readonly clinicalScrubbed: readonly string[];
  /** The spec-clean serialized artifact (before de-identification). */
  readonly original: string;
  /** The serialized de-identified artifact (`@cosyte/deid`'s output). */
  readonly deidentified: string;
  /** `true` iff sentinels were planted, none survived, and nothing clinical was over-scrubbed. */
  readonly pass: boolean;
}

/**
 * The name of the removal-oriented policy the loop runs `@cosyte/deid` under.
 *
 * @example
 * ```ts
 * import { DEID_LOOP_POLICY_NAME } from "@cosyte/synth/deid";
 * DEID_LOOP_POLICY_NAME; // => "synth-deid-loop-removal"
 * ```
 */
export const DEID_LOOP_POLICY_NAME = "synth-deid-loop-removal";

/**
 * Build the **removal-oriented** de-identification policy the loop runs `@cosyte/deid` under: HIPAA Safe
 * Harbor, but with the three keyed-by-default identifier categories (MRN, health-plan-beneficiary,
 * account) switched from `pseudonymize` to `redact`.
 *
 * Two reasons this is the right policy for a co-validation loop: (1) it needs **no key context**, so the
 * loop is a pure function of the seed (the default Safe Harbor policy pseudonymizes those three
 * categories, which requires the consumer's HMAC key); and (2) it makes the removal contract crisp —
 * every PHI locus is **removed or generalized away**, never replaced by a surrogate that a naive sweep
 * might mistake for a survivor. `pseudonymize` also removes the original value, so this is a stricter,
 * not weaker, check.
 *
 * @returns A frozen {@link DeidPolicy} suitable for the `policy` option of any `@cosyte/deid` adapter.
 * @example
 * ```ts
 * import { deidLoopPolicy } from "@cosyte/synth/deid";
 * import { deidentifyHl7 } from "@cosyte/deid/hl7";
 * const { document } = deidentifyHl7(msg, { policy: deidLoopPolicy() });
 * ```
 */
export function deidLoopPolicy(): DeidPolicy {
  return defineDeidPolicy({
    name: DEID_LOOP_POLICY_NAME,
    transforms: {
      [SAFE_HARBOR_CATEGORIES.MRN]: "redact",
      [SAFE_HARBOR_CATEGORIES.HEALTH_PLAN_BENEFICIARY]: "redact",
      [SAFE_HARBOR_CATEGORIES.ACCOUNT]: "redact",
    },
  });
}

/**
 * Tokens that are structural labels or generic address words rather than distinctive PHI — dropped when
 * decomposing a composite locus value so a sentinel is always a *distinctive* synthetic token. (A
 * de-identifier keeps `state`, so a generic street suffix at a redacted address locus could otherwise
 * read as a false survivor.)
 *
 * @internal
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  "official",
  "usual",
  "temp",
  "old",
  "anonymous",
  "maiden",
  "nickname",
  "home",
  "work",
  "mobile",
  "phone",
  "email",
  "fax",
  "sms",
  "pager",
  "other",
  "use",
  "street",
  "road",
  "avenue",
  "court",
  "lane",
  "drive",
  "boulevard",
  "place",
  "way",
  "suite",
  "apt",
  "unit",
  "null",
  "undefined",
]);

/** Split a composite locus value into candidate tokens on the delimiters the formats use. @internal */
function tokenize(value: string): readonly string[] {
  return value
    .split(/[\s^~&|,()/\\]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Whether a candidate token is a *distinctive* sentinel: long enough, not a structural stopword, and —
 * for a pure-digit run — at least five digits (so a 4-digit street number that a de-identifier removes
 * but that could coincide with a retained value is not treated as a sentinel).
 *
 * @internal
 */
function isDistinctive(token: string): boolean {
  if (token.length < 4) return false;
  if (STOPWORDS.has(token.toLowerCase())) return false;
  if (/^\d+$/.test(token) && token.length < 5) return false;
  return true;
}

/**
 * Enumerate the distinctive synthetic PHI sentinels from a de-identifier's **patient-scoped**
 * identifier loci, decomposed to **literal** tokens of the spec-clean artifact.
 *
 * The loci come from `@cosyte/deid`'s own per-format extractor (`extractHl7Loci` / `extractFhirLoci` /
 * `extractX12Loci` / `extractTelecomLoci`), which locates PHI **structurally** — so provider and
 * organization names, which a de-identifier legitimately retains, are never extracted and never become
 * false sentinels. Only `identifier`-kind loci are used (names, SSNs, phones, emails, member/account
 * ids); dates (generalized to a year, not removed) and ZIPs (generalized to three digits) are handled by
 * the format's own contract, not asserted here.
 *
 * Requiring each token to be a **literal substring of `original`** keeps the removal check non-vacuous:
 * a sentinel the sweep later looks for is one that is provably present before de-identification.
 *
 * @param loci - The located candidate values from a `@cosyte/deid` extractor.
 * @param original - The spec-clean serialized artifact the loci were extracted from.
 * @returns The distinctive, literal, synthetic PHI sentinels — de-duplicated by token.
 * @example
 * ```ts
 * import { extractHl7Loci } from "@cosyte/deid/hl7";
 * const sentinels = identifierSentinels(extractHl7Loci(msg).loci, msg.toString());
 * ```
 */
export function identifierSentinels(
  loci: readonly GenericLocus[],
  original: string,
): readonly DeidSentinel[] {
  const out: DeidSentinel[] = [];
  const seen = new Set<string>();
  for (const locus of loci) {
    if (locus.kind !== "identifier" || locus.value.length === 0) continue;
    for (const token of tokenize(locus.value)) {
      if (!isDistinctive(token)) continue;
      if (!original.includes(token)) continue;
      if (seen.has(token)) continue;
      seen.add(token);
      out.push({
        token,
        locus: locus.path,
        ...(locus.category !== undefined ? { category: locus.category } : {}),
      });
    }
  }
  return out;
}

/**
 * Enumerate the patient sentinels of a **C-CDA** document by reading the `<recordTarget>` element of the
 * serialized XML — the patient participation. Scoping to `recordTarget` (rather than `author` /
 * `custodian`, which carry provider identity a de-identifier retains) is what keeps the sentinels
 * patient-PHI only. Used for C-CDA because `@cosyte/deid`'s C-CDA extractor operates on a raw DOM, which
 * this zero-dependency module does not construct.
 *
 * @param xml - The serialized spec-clean C-CDA document.
 * @returns The distinctive synthetic patient sentinels (given/family names, the patient id extensions).
 * @example
 * ```ts
 * import { serializeCcda } from "@cosyte/ccda";
 * const sentinels = recordTargetSentinels(serializeCcda(generateCcd({ seed: 1 })));
 * ```
 */
export function recordTargetSentinels(xml: string): readonly DeidSentinel[] {
  const block = /<recordTarget[\s\S]*?<\/recordTarget>/i.exec(xml);
  if (block === null) return [];
  const scope = block[0];
  const out: DeidSentinel[] = [];
  const seen = new Set<string>();
  const add = (token: string, locus: string): void => {
    const trimmed = token.trim();
    if (!isDistinctive(trimmed) || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push({ token: trimmed, locus, category: "names" });
  };
  for (const m of scope.matchAll(/<given>([^<]+)<\/given>/g)) add(m[1] ?? "", "recordTarget/given");
  for (const m of scope.matchAll(/<family>([^<]+)<\/family>/g))
    add(m[1] ?? "", "recordTarget/family");
  for (const m of scope.matchAll(/<id\b[^>]*\bextension="([^"]+)"/g))
    add(m[1] ?? "", "recordTarget/id");
  return out;
}

/**
 * Sweep the **PHI-locus residue** of a de-identified artifact for **surviving** planted sentinels — the
 * heart of the removal check. A sentinel survives if its exact token still appears in the values that
 * remain at the (former) PHI loci after de-identification; a non-empty result is a **hard failure** (real
 * PHI-shaped data leaked through de-identification).
 *
 * **Why the PHI-locus residue and not the whole document.** `@cosyte/synth` draws patient *and*
 * provider/organization names, addresses, and phones from the same synthetic pools, and a de-identifier
 * legitimately **retains** provider identity. So the same synthetic token can sit at both a patient locus
 * (removed) and a provider locus (retained); a whole-document sweep would read the retained provider copy
 * as a false survivor. Sweeping only the residue at the loci that were PHI — re-read from the
 * de-identifier's own output — is locus-scoped and collision-proof: a token still present *there* is a
 * genuine leak. It remains independent of the de-identifier's manifest: it reads the actual serialized
 * output, so a de-identifier that locates a locus but fails to strip it is still caught.
 *
 * @param phiResidue - The de-identified values that remain at the former PHI loci (for the model formats,
 *   the re-extracted identifier-locus values joined; for C-CDA, the de-identified `<recordTarget>` block).
 * @param sentinels - The sentinels planted in the corresponding spec-clean artifact.
 * @returns The subset of `sentinels` still present in `phiResidue` — empty on a clean pass.
 * @example
 * ```ts
 * sweepSurvivors(deidPhiResidue, planted); // => []  (all removed)
 * ```
 */
export function sweepSurvivors(
  phiResidue: string,
  sentinels: readonly DeidSentinel[],
): readonly DeidSentinel[] {
  return sentinels.filter((s) => phiResidue.includes(s.token));
}

/**
 * The over-scrub side of the loop: of the clinical (non-PHI) code tokens that appear in the spec-clean
 * artifact, which are **missing** after de-identification. A de-identifier must keep clinical content; a
 * non-empty result means it over-scrubbed. Only structured code tokens present before de-identification
 * are probed (a code that appears solely inside a free-text narrative a de-identifier legitimately blocks
 * is not a structured-content loss).
 *
 * Only **distinctive** codes (four or more characters) are probed: a short 2–3 digit code (e.g. a CVX
 * vaccine code) can appear by coincidence *inside* a PHI value a de-identifier removes — a timestamp, an
 * SSN — and would read as a false over-scrub. Distinctive codes (LOINC `4548-4`, SNOMED `44054006`,
 * 11-digit NDCs, CPT `99213`) do not collide this way. An artifact whose clinical codes are all short
 * simply yields an empty probe (the guard is skipped, never falsely tripped).
 *
 * @param original - The spec-clean serialized artifact.
 * @param deidentified - The serialized de-identified artifact.
 * @param clinicalCodes - Candidate structured clinical code tokens (e.g. LOINC/ICD/NDC from the example
 *   pools) to probe.
 * @returns `{ probed, scrubbed }` — the distinctive codes present before, and the subset absent after.
 * @example
 * ```ts
 * const { probed, scrubbed } = clinicalRetention(before, after, ["4548-4", "44054006"]);
 * scrubbed; // => []  (clinical content retained)
 * ```
 */
export function clinicalRetention(
  original: string,
  deidentified: string,
  clinicalCodes: readonly string[],
): { readonly probed: readonly string[]; readonly scrubbed: readonly string[] } {
  const probed = [...new Set(clinicalCodes.filter((c) => c.length >= 4 && original.includes(c)))];
  const scrubbed = probed.filter((c) => !deidentified.includes(c));
  return { probed, scrubbed };
}

/**
 * Assemble a {@link DeidLoopResult} from the planted sentinels, the de-identified output, and the
 * clinical probe — computing the `pass` verdict (sentinels planted, none survived, nothing over-scrubbed).
 *
 * @param parts - The pieces gathered by a per-format loop.
 * @returns The immutable verdict.
 * @example
 * ```ts
 * const result = assembleVerdict({
 *   format: "hl7", artifact: "ORU^R01", seed: 1,
 *   planted, original, deidentified, clinicalCodes,
 * });
 * ```
 */
export function assembleVerdict(parts: {
  readonly format: DeidLoopFormat;
  readonly artifact: string;
  readonly seed: number;
  readonly planted: readonly DeidSentinel[];
  readonly original: string;
  readonly deidentified: string;
  /**
   * The de-identified values that remain at the former PHI loci — what the survivor sweep reads (see
   * {@link sweepSurvivors}). Defaults to `deidentified` when omitted (a whole-document sweep), but the
   * per-format loops supply the locus-scoped residue so provider/organization identity a de-identifier
   * legitimately retains never reads as a false survivor.
   */
  readonly phiResidue?: string;
  readonly clinicalCodes: readonly string[];
}): DeidLoopResult {
  const survivors = sweepSurvivors(parts.phiResidue ?? parts.deidentified, parts.planted);
  const { probed, scrubbed } = clinicalRetention(
    parts.original,
    parts.deidentified,
    parts.clinicalCodes,
  );
  const pass = parts.planted.length > 0 && survivors.length === 0 && scrubbed.length === 0;
  return Object.freeze({
    format: parts.format,
    artifact: parts.artifact,
    seed: parts.seed,
    planted: Object.freeze([...parts.planted]),
    survivors: Object.freeze(survivors),
    clinicalProbed: Object.freeze(probed),
    clinicalScrubbed: Object.freeze(scrubbed),
    original: parts.original,
    deidentified: parts.deidentified,
    pass,
  });
}
