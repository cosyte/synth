---
id: guides-x12
title: X12 (837 / 835 / 271)
sidebar_position: 5
---

# Generate X12 EDI transactions

The `@cosyte/synth/x12` subpath builds HIPAA **005010** transactions **through `@cosyte/x12`'s domain
builders** (`build837P/I/D`, `build835`, `build271`), so the ISA/GS/ST…SE/GE/IEA envelope, the computed
HL spine, the control numbers, and every segment are the builder's own: each transaction
round-trips through `@cosyte/x12` with **zero warnings**.
`@cosyte/x12` is an **optional peer dependency**, needed only for this subpath.

The X12 surface emits:

- **837** claims: Professional (`generate837P`), Institutional (`generate837I`), and Dental
  (`generate837D`);
- the **835** remittance (`generate835`): **balance-checked by construction** (the line, claim, and
  remit balance identities are satisfied before the builder is called, so `build835` never refuses it);
- the **271** eligibility response (`generate271`).

## A claim, spec-clean by construction

The round-trip harness checks an interchange by `@cosyte/x12`'s own judgment: it re-parses with
zero warnings and re-serializes byte-identically:

```ts runnable
import { generate837P, roundTrip } from "@cosyte/synth/x12";

// Same seed → byte-identical EDI, on any machine, any run.
const result = roundTrip(generate837P({ seed: 12345 }));
result.warnings; // => []
result.byteStable; // => true
result.specClean; // => true
```

## A reproducible corpus

`x12Corpus` builds a self-describing, deterministic corpus: one of each of 837P/I/D + 835 + 271 by
default:

```ts runnable
import { x12Corpus } from "@cosyte/synth/x12";

const corpus = x12Corpus({ seed: 42 });
corpus.artifacts.map((a) => a.kind); // => ["837P", "837I", "837D", "835", "271"]
corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```

## Synthetic-by-construction, hardest-attacked here

An 837/271 is identity-dense: it carries subscriber and patient names, member ids, provider NPIs, a
provider tax id, dates of birth, and addresses across two HL loops. Every value has a
construction-level guarantee, not a heuristic:

- **NPI** (`NM1*XX`): a 10-digit National Provider Identifier with a **deliberately-invalid Luhn check
  digit**. A real NPI must satisfy the CMS `80840`-prefixed Luhn check, so a `synth` NPI can **never** be
  a NPPES-issued provider. (`safe.npi`, `isSyntheticNpi`.)
- **Provider tax id** (`REF*SY`): an SSA **never-issued** (900-range) SSN, so it can never be a real
  SSN or a sole-proprietor's real tax id.
- **Member id** (`NM1*MI`): scoped to a synthetic assigning authority (there is no reserved member-id
  range, so the _namespace_ is the guarantee).
- **Names**: the shipped clearly-fake pool; **DOBs / dates**: the seeded generator (no real event
  implied); **addresses**: a synthetic street + reserved ZIP.

The repository's `phi-scan` gate runs X12-aware structured detection over every generated corpus: a
Luhn-**valid** `NM1*XX` NPI, a real-area `REF*SY` SSN, or an `NM1*34` raw-SSN qualifier is a hard
failure.

## Deferred

- The **270** eligibility _request_: `@cosyte/x12` ships `build270` from 0.1.0, but `synth` does not
  generate a 270 yet. `synth` builds every artifact through the parser's own builder or serializer and
  never hand-writes the bytes.
- **Vendor-quirk mode** (deliberately off-spec fixtures) is deferred for X12.
