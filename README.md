# @cosyte/synth

> Deterministic, seedable **synthetic healthcare-fixture generator** for Node.js and TypeScript —
> spec-clean by construction, and **never real PHI**.

`@cosyte/synth` generates reproducible synthetic test corpora across the cosyte formats (HL7 v2 today;
FHIR / C-CDA / X12 / NCPDP / ASTM in later phases). It is a **consumer** of the cosyte parsers, not a
parser: it builds each artifact **through the parser's own builder/serializer** (so the output is
spec-clean by the same mechanism the parser proves) and draws every identifier, name, date, phone, and
address from a **guaranteed-non-colliding synthetic source**. It is a **format/conformance generator,
not a clinical simulator** — it does not model disease progression (that is Synthea).

> **Status:** pre-alpha (`0.0.x`), not yet published to npm. Phase 1 ships the seeded-PRNG core, the
> synthetic-safety providers, and the round-trip harness proven on HL7 v2.

## Install

```bash
npm install @cosyte/synth @cosyte/hl7
```

`@cosyte/hl7` is an **optional peer dependency**, needed only for the `@cosyte/synth/hl7` subpath. The
package core has **zero third-party runtime dependencies**.

## Generate a spec-clean HL7 v2 message

```ts
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";

// Same seed → byte-identical message, on any machine, any run.
const message = generateAdt({ seed: 12345, trigger: "A01" });

// Spec-clean by construction: it round-trips through @cosyte/hl7 with zero warnings.
roundTrip(message).specClean; // true
```

## Draw a synthetic value

```ts
import { createRng, safe, isSyntheticSsn } from "@cosyte/synth";

const rng = createRng(42);
isSyntheticSsn(safe.ssn(rng)); // true — always an SSA never-issued SSN
```

## What makes it trustworthy

- **Synthetic-by-construction** — no code path emits a value not drawn from a reserved range or the
  shipped fake-name pool (SSA never-issued SSNs, NANP `555-01xx` phones, RFC 2606/6761 `example.*`
  domains, RFC 5737/3849 TEST-NET IPs, a synthetic assigning authority for MRNs). A CI gate proves it.
  **No generated value can be real or plausibly-real PHI.**
- **Spec-clean by the parser's own judgment** — built through the parser's conservative serializer, and
  checked by feeding the artifact straight back in: a spec-clean artifact re-parses with zero warnings.
- **Deterministic** — a hand-rolled seeded PRNG (`sfc32`/`splitmix32`); `Math.random` is lint-banned.
  A seed, and only the seed, determines the output — byte-for-byte, anywhere.
- **Immutable** — generated artifacts and the `Corpus` result are deep-frozen.
- **Zero third-party runtime dependencies** — the parser peers are first-party cosyte packages,
  vendored for dev/test; dual ESM + CJS, validated with `attw`.

## License

MIT © Cosyte
