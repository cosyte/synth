# `synth` PHI-scan parameters: the derivation

Status: **DERIVATION ONLY. NOTHING HERE IS ADOPTED, AND THE BRANCH CARRYING IT MUST NOT MERGE.**
`scripts/phi-scan.ts` on this branch is byte-identical to `main`. The one code change is a
`@cosyte/script-utils` devDependency, added and left in place because it proves the install works
here (see "What the install proved" below), not because anything imports it yet.

This file answers three questions, in order:

1. what shape is `synth`, measured against the shared engine's config surface;
2. what are `synth`'s parameters, written as data;
3. what must `@cosyte/script-utils/phi-scan` parameterize before that data can be declared, and
   **which part of it cannot be parameterized at all**.

Everything below was re-derived on this checkout against `scripts/phi-scan.ts` at `main`
(2,324 lines, cross-checked `wc -l` and `rg -c ''`). Where a count appears, the members are named
beside it, because a bare number is the trap this lineage keeps paying for.

---

## 0. Classification: `synth` is a FOURTH non-mechanical repo, and the largest

The adopt item's taxonomy places 11 of 13 repos and **never names `synth`**. It is not a rename, not
a `{abs, rel}` flattener, and not the `mllp` / `ccda` seventh spelling. It is the **non-mechanical**
class, alongside `hl7`, `terminology` and `dicom`, and it has more in it than any of them.

`synth` is the only sibling that **generates** the value shapes a PHI gate hunts for. Every other
repo parses documents that arrive from outside; this one emits them. That single fact is why three
of its rules have no parameter on the engine, and it is why an under-reading scanner here is the one
most likely to be trusted wrongly.

The three, each with what the engine does instead:

| `synth` construct | what it does | engine today |
|---|---|---|
| `Target.tolerateVanish` | `ENOENT` on an **untracked** walk target is reported *unobserved* rather than refusing | **REFUSES.** Same class as `hl7`. Fail-closed either way, so this one costs nothing but noise |
| `isSyntheticSsn` in the **cross-cutting floor** | a dashed SSN in an SSA never-issued area (`000`, `666`, `900-999`) is *proof of synthetic*, not PHI | the floor consults `allow.ids` **literals**. A range is not expressible |
| the `EMAIL <address>` allow-list tag | clears **one exact address** without clearing its domain | `AllowList` has `emailDomains` only, and the parser **drops an unrecognised tag silently**, so an `EMAIL` line would look declared and clear nothing |

**The asymmetry that makes the last two cost something: `detect` can only ADD hits.** There is no
hook through which a caller withdraws a hit the engine's floor raised. So where `synth`'s floor is
NARROWER than the shared one, adoption changes what reds, and no amount of detector code fixes it.

---

## 1. The two mandatory pre-checks, re-derived

**Pre-check 1: is any scan root `./`-prefixed?** **No.**
`scripts/phi-scan.ts:308` reads `const SCAN_ROOTS: readonly string[] = ["src", "test", "scripts"];`.
Three bare relative names, no `./`, no trailing slash, no absolute path. The failure this check
exists for (a root that walks correctly while matching no index path, silently emptying the union and
both index refusals) is not present.

**Pre-check 2: does `isStagedReadable` admit anything outside `scanRoots`?** **No, by construction.**
The staged route filters through `inScanRoot` first and `isScannable` second
(`buildTargetsForStaged`, lines 1250 and 1267), and `isScannable` is `inScanRoot` plus the `.md`
exemption. Both are defined over the same `SCAN_ROOTS` list via `rootOf`, so the staged set is a
subset of the root set with no second source of truth. The escape this check exists for (a staged
mode-120000 entry enumerated, read, and handed the link's target path as content at exit 0) is
already closed here by a separate mechanism: the route reads `--raw` rather than `--name-only`
specifically to get the destination MODE, and refuses any mode outside `100644` / `100755`.

**Order matters and this repo has already paid for it.** The non-regular check runs over everything
under a root, and only then does the `.md` exemption narrow what is read. Running `isScannable`
first put a `.md`-named staged link through the exemption and back out as `OK`.

---

## 2. AXES: the five per-repo axes as declared data

| axis | parameter | `synth`'s value | note |
|---|---|---|---|
| 1 | `exitCodes` | `{ clean: 0, hits: 1, refuse: 2 }` | derived here, never ported. A root of the wrong KIND exited **1** in this repo before the contract was written down, which is the code reserved for "hits found" |
| 2 | `scanRoots` | **`["."]`**, NOT `["src", "test", "scripts"]` | see below. This is the single most important line in this file |
| 2 | `excludedPaths` | the 7 literal `vendor/*.tgz` paths | listed in full below |
| 2 | `isWalkReadable` | **leave defaulted** (`exemptsMarkdown`) | the engine default is exactly this repo's `.md` boundary |
| 3 | `isStagedReadable` | under `src` / `test` / `scripts` **and** `exemptsMarkdown` | the deliberate asymmetry, kept |
| 4 | `regularBlobModes` | **leave defaulted** | re-measured: `git ls-files -s` reports no entry outside `100644` / `100755` |
| 5 | EOL normalization | no parameter, checked | no `.gitattributes` EOL conversion, so index and working tree agree and the union adds zero reads on a clean checkout |

### AXIS 2 is a widening, not a translation, and copying the three roots across would silently narrow this gate

`synth` declares three roots and then, **in all-mode only**, reconciles the walk against
`git ls-files` and reads every OTHER tracked file the walk did not reach: the manifest, the lockfile,
every workflow, every root config file. That second half exists because it FOUND something. Measured
on the change that added it: 225 tracked files, 176 read, **49 read by neither route**.

**The engine's union is bounded by `scanRoots`.** `unionCandidatePaths` filters the index through
`isUnderScanRoot`, so declaring the three roots would hand the union a scope the hand-written one
never had, and those 49 files would go back to being read by nothing under a gate that still printed
`OK`. Re-derived on this checkout:

```
git ls-files | wc -l                                    -> 225
git ls-files | grep -ci '\.md$'                          -> 20
git ls-files | grep -vc '^\(src\|test\|scripts\)/'       -> 49
```

So the honest translation of "the three roots PLUS every other tracked file" is **`["."]`**, and the
three roots survive where they always belonged, on `--staged`.

**The old argument against `["."]` is now stale and must not be carried forward.** The comment at
`scripts/phi-scan.ts:317` says a `.` root "walks `node_modules/` and `dist/` on every run and then
throws the result away through `git check-ignore`". The engine **prunes ignored directories during
descent**, one `check-ignore` per level, so it never descends into either. The cost that argument
named is gone; the reach it was refusing is the reach this gate already has.

**One thing `["."]` re-opens, disclosed rather than found later.** The old roots stopped short of the
repo root, which is where `tsup` writes its `tsup.config.bundled_<hash>.mjs` transient, so that race
was unreachable here and becomes reachable. With `tolerateVanish` gone it REFUSES rather than
reporting clean, so it fails closed, but a refusal on an unrelated build is still a bad run. It is
answered in `.gitignore` (the engine drops a gitignored entry before it becomes a target) and **not**
with an `excludedPaths` entry, because the filename carries a hash and a literal path cannot name it.

### `excludedPaths`, in full

```
vendor/cosyte-astm-0.0.0.tgz
vendor/cosyte-ccda-0.0.1.tgz
vendor/cosyte-deid-0.0.0.tgz
vendor/cosyte-fhir-0.0.0.tgz
vendor/cosyte-hl7-0.0.0.tgz
vendor/cosyte-ncpdp-0.0.1.tgz
vendor/cosyte-x12-0.0.1.tgz
```

Seven literal paths, never a predicate. A compressed archive read as UTF-8 produces name-shaped and
email-shaped nonsense: measured on this repo, scanning the seven by path returned 4 hits across 3 of
them, none of which stands for anything. Refreshing a tarball means editing this list because the
version is in the filename, and both directions of drift are loud.

---

## 3. VOCABULARIES: the synthetic-versus-real declarations as data

These are the only per-repo values the detectors consult. All of them are already data, in
`scripts/phi-allow-list.txt`. Tag counts cross-checked with `rg` and `awk`, which agree:

| tag | count | consumed by |
|---|---|---|
| `NAME` | 43 | every structured name detector |
| `EMAILDOMAIN` | 4 | the email floor: `example.com`, `example.org`, `example.net`, `example.test` |
| `EMAIL` | 2 | the email floor: `cgp@lists.HL7.org`, `hello@cosyte.com` |
| `ID` | **0** | **nothing** |
| `DOB` | **0** | **nothing** |

`allow.ids` and `allow.dobs` are loaded and consumed by **nothing**. Verified two ways, `rg` and
`grep` over `scripts/phi-scan.ts`, both returning no match for `allow.ids` or `allow.dobs`. That is
not an oversight, and section 6 is about why.

### The two `EMAIL` entries and what they cost

- `cgp@lists.HL7.org`, domain `lists.hl7.org`. It appears in 10 of the 10 US Core StructureDefinitions
  under `test/us-core-profiles/`, which this repo vendors so US Core conformance is validated against
  the normative artifact. It is a real address and it is not PHI: it denotes a standards-body mailing
  list, not a person receiving care.
- `hello@cosyte.com`, domain `cosyte.com`. The publisher contact in `package.json`.

Measured on the tracked non-markdown corpus: **each is the only address at its domain.** So swapping
each for the narrowest covering `EMAILDOMAIN` would be behaviourally identical today and would widen
only prospectively. **That swap is not proposed**, because it is a real subtraction from the gate
taken to work around a missing engine feature, and the engine feature is one line of parsing.

---

## 4. DETECTOR KINDS: universal kinds, per-standard loci, declared rules

The organising claim holds for `synth` with one exception. The detector KINDS are universal; what
varies per standard is the **locus grammar** (where the field is and how to extract it), and what
varies per repo is the **rule** (what makes a value synthetic).

**The locus grammar is per-STANDARD, not per-repo, and that is the large win.** `hl7`'s PID-5 rule is
the same rule `synth` needs at PID-5. Shipping the grammars once in the engine and selecting them by
declaration removes the seven hand-written arms from this repo and the equivalent from every sibling.

### Loci, per standard

| standard | admission | name | phone | id |
|---|---|---|---|---|
| HL7 v2 | an `MSH` segment; delimiters from MSH-1 / MSH-2 | PID-5 components | PID-13 | PID-19 |
| FHIR | whole-file `JSON.parse` succeeds (structural), else a `resourceType` marker (textual) | `HumanName.family` / `.given` | `ContactPoint` where `system` is `phone` | none |
| C-CDA | a `.xml` path **OR** a CDA marker (`ClinicalDocument`, `recordTarget`, `urn:hl7-org:v3`) | `given` / `family` element text, document-wide | `telecom` with a `tel:` value | none |
| X12 | starts `ISA` and is at least 106 bytes; delimiters from byte 3 / byte 105 | NM1-03/04/05 where NM1-02 is `1`; PER-02 | PER-04/06/08 | NM1-09 by qualifier: `MI` member, `XX` NPI, `34` always a hit; `REF*SY` |
| NCPDP SCRIPT | a `<Message>` root **and** a SCRIPT transaction/party element | `LastName` / `FirstName` / `MiddleName` element text | none | `NPI`, `DEANumber` |
| NCPDP Telecom | any of the three FS/GS/RS control characters | `CA` / `CB` / `CC` / `CD` | `CQ` | `CY`, `C2`, `DB` (NPI) |
| ASTM | the canonical `H` delimiter declaration | `P`-6 components, tokens of length 2 or more | none | `P`-3 (practice), `P`-4 (lab) |

### Rules, as a named registry

Every one of these is a published range or a published checksum, so every one is engine-shippable
data or engine-shipped code selected by name. None of them is a `synth` invention.

| rule | definition | used at |
|---|---|---|
| `vocabulary` | token uppercased, must be in the declared `NAME` set | every name locus above |
| `nanp-555-01xx` | last 7 digits match `55501` plus two digits | HL7 PID-13, FHIR `ContactPoint`, C-CDA `telecom`, Telecom `CQ` |
| `x12-per-555` | 10 or more digits **and** the digit string contains `555` | X12 PER-04/06/08 **only** |
| `ssa-never-issued` | 9 digits, area `000`, `666`, or `900-999` | HL7 PID-19, `REF*SY`, and the fallback inside the two id-namespace rules |
| `npi-luhn-invalid` | fails the CMS Luhn check over the `80840` prefix | X12 `NM1` qualifier `XX`, SCRIPT `NPI`, Telecom `DB` |
| `dea-checksum-invalid` | fails `(d1+d3+d5) + 2*(d2+d4+d6)` against the 7th digit | SCRIPT `DEANumber` |
| `synthetic-aa-namespace` | prefix in `PRA` / `LAB` / `ACC` / `MBR`, optional `-` or `_`, then alphanumerics | ASTM `P`-3 / `P`-4, Telecom `CY` / `C2` |
| `undistinguished-digits` | all digits, length 1 to 8 | ASTM `P`-3 / `P`-4, Telecom `CY` / `C2` |
| `x12-member-id` | `MBR` prefix **or** all digits, **any length** | X12 `NM1` qualifier `MI` |

**Writing the rules down as data made two real divergences visible that seven hand-written functions
had buried, and this is an argument FOR parameterization rather than against it.**

1. **The phone rule is not one rule.** Six loci require the reserved `555-01xx` tail; X12 PER requires
   only that the digit string *contains* `555`. The second is materially weaker: `555` anywhere in a
   10-digit number passes.
2. **The id digit bound is not one bound.** ASTM and NCPDP accept a bare all-digit id of 1 to 8
   digits, on the stated reasoning that a short id carries too little entropy to denote a person. X12
   accepts an all-digit member id of **any length**.

Neither is proposed for change here, because changing a detector is a behaviour change and this
branch ships none. They are recorded because a declaration puts them side by side in one table, where
a divergence is a diff, and seven functions put them 400 lines apart, where it is not.

---

## 5. What the engine must parameterize

Ordered by whether adoption is blocked on it. Each names the parameter, its type, its default, and
what it must express. **All three blockers default to today's behaviour, so no existing consumer
changes.**

### BLOCKER 1: the cross-cutting SSN floor takes a rule, not only a literal set

```
floor?: {
  ssn?: { rule: "allow-list-ids" | "ssa-never-issued" }
}
```

**Default `{ rule: "allow-list-ids" }`, which is today's behaviour exactly.**

What it must express: `synth` emits `900-xx-xxxx` never-issued SSNs and the `987-65-432x` advertising
block by design, and those are proof of synthetic. The floor currently clears a dashed SSN only if
the literal is in `allow.ids`. The tracked corpus carries exactly five distinct dashed-SSN literals,
and every one of them is in the never-issued space: **one in area `000`, one in area `666`, one in
area `900`, and two in the `987-65-432x` advertising block.**

**The digits are deliberately not reproduced here, and that is a rule rather than a nicety.** This is
a tracked `.md`, and a tracked `.md` is read by NEITHER scanning route, so a value written here sits
on a surface the gate cannot see, and `README.md` and `CHANGELOG.md` ship in the npm tarball. Writing
SSN-shaped bytes into an unscanned surface is the third escape class in this lineage wearing a
different hat, and it is the wrong instinct even when the values are fake. The area is the
load-bearing property; the remaining digits carry nothing this derivation needs. To see the literals,
run the scanner, which is the surface that is supposed to hold them.

**Why a caller-side answer will not do, and why declaring the five is the wrong answer.** `detect`
can only add hits, so the caller cannot withdraw the floor's. Declaring the five as `ID` entries
would work today and is exactly the hand-maintenance being deleted: every new seeded fixture SSN
becomes a new line in a file somebody has to remember to edit, and a gate that reds on correct output
is a gate that gets routed around.

The residual in the other direction, stated because it is real: a rule is a range and a range cannot
be talked out of, whereas an `ID` entry naming a genuinely real SSN would clear it. That argues for
the rule, not against it.

### BLOCKER 2: the allow-list parses an exact-address tag

```
AllowList.emails: Set<string>    // lower-cased, populated from `EMAIL <address>`
```

**Default: empty set. The email floor consults it before `emailDomains`, so no existing consumer
changes.**

What it must express: an address that is real, is not PHI, and must be cleared **without** clearing
its domain. `cgp@lists.HL7.org` is the worked case: it is in 10 vendored US Core
StructureDefinitions, and it denotes a standards-body mailing list. The only caller-side answers are
to widen to `EMAILDOMAIN` (a real subtraction) or to withdraw 10 files from the scan (a much larger
one).

The engine's parser today **drops an unrecognised tag silently**, so an `EMAIL` line placed in the
allow-list would look declared and clear nothing. That silence is itself worth closing: an unknown
tag should be loud.

### BLOCKER 3: the detector kinds and their locus grammars ship in the engine

```
standards?: {
  [K in "hl7v2" | "fhir" | "ccda" | "x12" | "ncpdp-script" | "ncpdp-telecom" | "astm"]?: {
    admit?: { extensions?: string[]; markers?: RegExp[] }
    name?:  RuleName | false
    phone?: RuleName | false
    id?:    RuleName | false
    dob?:   RuleName | false
    address?: RuleName | false
  }
}
```

**Default: no standard enabled, so a repo declaring nothing keeps today's `detect`-only behaviour.**

What it must express: the seven arms in section 4, as selection rather than code. `detect` stays as
the escape hatch for anything genuinely repo-specific, but `synth` would declare all seven and write
no detector code at all.

### NON-BLOCKER, but it removes a shim: give the detector the bare path

```
DetectContext.relPath: string    // the target's undecorated repo-relative path
```

`ctx.path` is the reported LOCUS, so a union-route target arrives as
`fixtures/doc.xml (as git carries it)`. The C-CDA arm admits on a `.xml` extension, and an
`endsWith(".xml")` against that string is false, so the arm would silently stop admitting `.xml`
fixtures on the union route while still admitting them on the walk, and the two routes would disagree
about the same bytes. It is workable around with an additive predicate that cannot under-read, which
is why it is not a blocker, but the workaround exists only because the field is missing.

---

## 6. THE LIMIT: what cannot be parameterized, and it is not an API gap

The coordinator asked whether `synth`'s intentional-versus-leaked distinction can be stated
declaratively at all. **The answer is yes for four of the five detector kinds and NO for the fifth,
and the no is a fact about the world rather than a missing parameter.**

Four of the five kinds work declaratively because each has a **reserved space that IS the provenance
marker**. The scanner can only see shape, and `synth` bridges shape to provenance by drawing every
value from a range whose shape proves it:

| kind | the reserved space that carries provenance |
|---|---|
| name | the shipped fake-name pool, 43 declared tokens |
| phone | NANP `555-01xx` |
| id | SSA never-issued, invalid-Luhn NPI, invalid-checksum DEA, the synthetic assigning authority |
| address | TEST-NET ranges and `example.*` domains |

**There is no reserved date-of-birth space.** A date of birth drawn from a seeded generator is
indistinguishable in kind from a real one, because every well-formed date is a date somebody was born
on. So the DOB kind has **no predicate to declare**, in any format, under any parameterization.

This is not inferred from the API. It is what this repo already does, in three separate places, and
the evidence is that the vocabulary slot exists and is empty while the rule slot is empty because
nothing could fill it: `allow.dobs` is loaded and consumed by **nothing** (verified with `rg` and
`grep`, both returning no match), there are **zero** `DOB` entries declared, and the allow-list's own
header says the tag is kept "so a future rule has a declared source to read".

**The consequence, stated plainly because it is the finding.** A real date of birth that leaks into a
generator fixture is **invisible to this gate in all six formats**, and shipping a `dob` locus grammar
does not change that: the engine would find the field and have no predicate to apply to it. A
declarative gate cannot be given one, and neither could the 2,324-line hand-written scanner, which is
why it does not have one either. Parameterization loses nothing here; it only makes the hole explicit,
which is an improvement over a hole spread across seven functions each with its own comment saying
DOB is deliberately not gated.

What covers it instead is a different mechanism answering a different question: the property layer
(`synthetic-safety.property.test.ts` and `test/phi/`, selected by the `include` glob in
`vitest.config.ts` and gated by `scripts/check-test-selection.ts`) tests whether the **generator** can
emit a non-synthetic value. The scanner tests whether the **corpus** contains one. Only the second is
a scanner's question, and for DOB only the first is answerable. **Never read a green `phi-scan` in
this repo as "no PHI"; read it as "no PHI of the four kinds that have a reserved space".**

### Two qualified yeses, so the yes is not read wider than it is

**The name vocabulary is declarable HERE because of a repo invariant, not because the kind is
universally declarable.** `synth` holds that no code path may emit a value not drawn from a reserved
range or the shipped fake-name pool, which is what makes 43 tokens cover the whole corpus. A repo
without that invariant cannot declare a name vocabulary and would have to fall back to something
weaker. So `name: "vocabulary"` is available to `synth` as a consequence of a property `synth`
maintains, and a sibling copying the declaration without the invariant would get a gate that reds on
every legitimate name.

**Admission is declarable as data but not verifiable as data.** The markers in section 4 are a list
and a list is data, but whether a marker set admits the right files is a judgement grounded in a
measurement over one repo's corpus. The worked case is already in this tree:
`test/scripts/phi-scan.test.ts` is admitted to the NCPDP SCRIPT arm because it genuinely contains a
`<Message>` envelope and a `<Patient>` element inside a fixture string. It is a TypeScript test, not a
SCRIPT message, and **no marker list can tell the difference, because the file really does contain the
marker.** Declaring markers as data does not shrink that false-positive surface. It makes it
reviewable in one table instead of buried in seven functions, which is worth having, and it is not the
same as making it correct.

---

## What the install proved

`pnpm add -D @cosyte/script-utils@^0.0.2` **succeeded in this repo**, resolving 405 packages with no
`ERESOLVE`. That is worth recording because `@cosyte/synth` is on the registry and fails to INSTALL
for a consumer, with `ERESOLVE` on the optional `@cosyte/fhir` peer. Those are different directions:
a consumer installing `synth` hits it, and `synth` installing a devDependency does not. The
devDependency is left in the manifest so the adoption does not have to re-prove this.

## What happens next

Adoption is blocked on the three parameters in section 5. When the engine ships them,
`scripts/phi-scan.ts` becomes the axes in section 2, the vocabularies in section 3, and the standard
declarations in section 4, with no machinery and no detector code. On the `0.0.x` ladder `^0.0.2`
resolves to `0.0.2` only, so adopting means editing the manifest to the published version rather than
relying on the range.
