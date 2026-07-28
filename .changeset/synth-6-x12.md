---
"@cosyte/synth": patch
---

Spec-clean HIPAA 005010 X12 generation, synthetic and seed-deterministic by construction, built
through `@cosyte/x12`'s domain builders so output round-trips with zero warnings. It lives at the
`@cosyte/synth/x12` subpath and is byte-stable.

- New generators: `generate837P` / `generate837I` / `generate837D` (claims via `build837P/I/D`),
  `generate835` (remittance via `build835`, balance-checked by construction), and `generate271`
  (eligibility via `build271`); plus `x12Corpus`, the X12 `roundTrip` harness, the `x12*` identity
  minters, and the `dec` / `money` `X12Decimal` helpers. The builder owns the HL spine and the
  ISA/GS/ST…SE/GE/IEA envelope + control numbers.
- Synthetic-safety (the hardest-attacked invariant): new `safe.npi` emits a 10-digit NPI with a
  deliberately-**invalid Luhn** check digit (never a NPPES-issued NPI — `isSyntheticNpi` /
  `npiCheckDigit` / `luhnMod10`); provider tax ids are 900-range SSNs at `REF*SY`; member ids are
  synthetic-AA-scoped; names from the fake-name pool; dates seeded. The repo `phi-scan` gains
  X12-aware structured detection (a Luhn-valid NPI or a real-area SSN is a hard hit).
- `@cosyte/x12` vendored as an optional peer dep, lazily loaded per format; third-party runtime deps
  stay at zero.
- Deferred: the 270 request (`@cosyte/x12` ships no `build270`) and vendor-quirk mode (Phase 7).
