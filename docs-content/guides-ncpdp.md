---
id: guides-ncpdp
title: NCPDP (SCRIPT / Telecom)
sidebar_position: 6
---

# Generate NCPDP messages

The `@cosyte/synth/ncpdp` subpath builds both NCPDP standards **through `@cosyte/ncpdp`'s own emit
surface**, so every message is **spec-clean by construction** and round-trips through the parser with
**zero warnings**. `@cosyte/ncpdp` is an **optional peer dependency**, needed only for this subpath.

NCPDP is two structurally unrelated standards under one brand, and the surface covers both:

- **SCRIPT** (XML ePrescribing) — `generateNewRx` (built through the validated `buildNewRx` builder),
  `generateRxRenewalRequest`, and `generateRxChangeRequest` (built as `@cosyte/ncpdp`'s public typed
  `ScriptMessage` model, then serialized by `serializeScript` — the same typed-model→serializer path
  the X12 surface uses, never a hand-written byte).
- **Telecom** (vD.0 pharmacy claims) — `generateB1` (billing), `generateB2` (reversal), and
  `generateB3` (rebill), built through `buildTelecomRequest` + `serializeTelecom`.

## A NewRx, spec-clean by construction

The round-trip harness proves spec-cleanliness by `@cosyte/ncpdp`'s own judgment — a spec-clean message
re-parses with zero warnings and re-serializes byte-identically:

```ts runnable
import { generateNewRx, scriptRoundTrip } from "@cosyte/synth/ncpdp";

// Same seed → byte-identical SCRIPT XML, on any machine, any run.
const result = scriptRoundTrip(generateNewRx({ seed: 12345 }));
result.warnings; // => []
result.byteStable; // => true
result.specClean; // => true
```

## A Telecom claim

```ts runnable
import { generateB1, telecomRoundTrip } from "@cosyte/synth/ncpdp";

const result = telecomRoundTrip(generateB1({ seed: 777 }));
result.specClean; // => true
```

## A reproducible corpus

`ncpdpCorpus` builds a self-describing, deterministic corpus — one of each shipped transaction by
default:

```ts runnable
import { ncpdpCorpus } from "@cosyte/synth/ncpdp";

const corpus = ncpdpCorpus({ seed: 42 });
corpus.artifacts.map((a) => a.kind); // => ["NewRx", "RxRenewalRequest", "RxChangeRequest", "B1", "B2", "B3"]
corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```

## Synthetic-by-construction — patient *and* prescriber

NCPDP carries patient identity (name, DOB) **and** prescriber identity — including the **DEA** number,
an identity locus the other formats do not have. Every value has a construction-level guarantee:

- **Prescriber NPI** — a 10-digit NPI with a **deliberately-invalid Luhn check digit**, so it can never
  be a NPPES-issued provider (`safe.npi`, `isSyntheticNpi`).
- **Prescriber DEA** — a `XX`+7-digit DEA number with a **deliberately-invalid checksum**. A real DEA
  number's 7th digit satisfies the published `(d1+d3+d5) + 2·(d2+d4+d6)` checksum, so a `synth` DEA can
  **never** be a validly-issued registration (`safe.dea`, `isSyntheticDea`).
- **Patient / cardholder / member ids** — scoped to a synthetic assigning authority (`MBR`-prefixed;
  there is no reserved id range, so the *namespace* is the guarantee).
- **Names** — the shipped clearly-fake pool; **phone** — the reserved `555-01xx` block; **DOBs / dates**
  (including SCRIPT `SentTime`) — the seeded generator (never wall-clock); **drug content** — a small
  license-clean example pool with invented `00000`-labeler NDCs (no NCPDP-copyrighted text is bundled).

```ts runnable
import { isSyntheticNpi, isSyntheticDea, createRng } from "@cosyte/synth";
import { ncpdpPrescriber } from "@cosyte/synth/ncpdp";

const dr = ncpdpPrescriber(createRng(1));
isSyntheticNpi(dr.npi); // => true
isSyntheticDea(dr.dea); // => true
```

The repository's `phi-scan` gate runs NCPDP-aware structured detection over every generated corpus: a
Luhn-**valid** `<NPI>` / `DB` or a checksum-**valid** `<DEANumber>` is a hard failure — it could denote
a real provider.

## Deferred

- SCRIPT coverage **tracks the parser's builder surface**: the renewal/change *responses* and other
  lifecycle transactions land as `@cosyte/ncpdp` grows its builders. `synth` never hand-writes bytes
  around a missing builder.
- **ASTM** generation is gated on `@cosyte/astm`'s serializer (not yet shipped).
- **Vendor-quirk mode** (deliberately off-spec fixtures) is a later phase.
