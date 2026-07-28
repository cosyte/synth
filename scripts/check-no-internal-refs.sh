#!/usr/bin/env bash
# scripts/check-no-internal-refs.sh
#
# Founder directive, 2026-07-27: NO INTERNAL PROJECT BOOKKEEPING ON A PUBLIC SURFACE.
# Anything a consumer reads (a GitHub release body, README.md, docs-content/, the npm
# package description) describes what the software does and what changed. It must never
# carry our internal bookkeeping: item identifiers (`SYNTH-4`, `CCDA-P7`), "Phase 8" /
# "roadmap Phase K", sweep and programme names, ADR numbers, internal repo paths, or
# process commentary about how the artifact came to exist. Source of truth: the meta-repo's
# `documentation/conventions.md`, "No internal project bookkeeping on a public surface".
# The founder's words: "The releases should also not speak on anything regarding phases,
# etc. That has no relevance to the user consuming it. This goes for readmes and
# documentation as well."
#
# WHY THIS IS A GATE AND NOT A MEMORY NOTE. Founder, same day: "it needs to not just be
# a memory note, but something that is addressed in the workflow accordingly. This needs
# to not happen again." A one-time sweep regresses the first time someone writes
# `(SYNTH-10)` into a README. A documented rule governs whoever reads it; a gate governs
# everyone.
#
# WHERE THE IDENTIFIERS DO BELONG, and therefore what this gate deliberately does NOT
# scan: the changeset, CHANGELOG.md, commit messages, the PR title and body, CLAUDE.md,
# `docs/adr/`, source `//` comments, and the meta-repo. The traceability is real and worth
# keeping; it just belongs on the inside. So this is a translation at the boundary, not a
# deletion, and the boundary is what SCAN SURFACE below defines.
#
# ---------------------------------------------------------------------------
# WHAT IS LIFTED FROM WHERE, AND WHAT IS DELIBERATELY NOT.
#
#   * THE SHAPE is `hl7`'s `scripts/check-no-internal-refs.sh`
#     ([hl7#62](https://github.com/cosyte/hl7/pull/62), [hl7#64](https://github.com/cosyte/hl7/pull/64)),
#     which is the reference implementation the sibling packages copy, taken here via
#     `ncpdp`'s copy ([ncpdp#36](https://github.com/cosyte/ncpdp/pull/36)) because that one
#     added the fourth pass. THE SHAPE, NOT THE FILE: hl7's copy carries HL7-specific
#     machinery (the `CSP` Clinical Study Phase field names, the `PKG` Item Packaging
#     segment, HL7 v2 table numbers written `HL7-0396`) which is dead weight here, and it is
#     missing the collision that bites hardest in THIS repo. What is carried across verbatim
#     because it is genuinely cross-repo: the prefix list, the paragraph-join second pass,
#     the doc-comment third pass, the string-literal fourth pass, the silent-green route
#     closures, and the NEGATIVE self-tests. What is re-derived for synth: the scan surface,
#     the SYNTHETIC-FIXTURE exclusions, and every self-test sample.
#
#     THERE ARE EXACTLY TWO DIVERGENCES FROM `ncpdp`'S COPY, and neither is in the
#     machinery. A divergent copy is worse than a known shared limit, so both are named here
#     as well as at the line that carries them, and there are no others.
#
#       * `SYNTH` is PRESENT in the prefix list here and ABSENT there, because it is this
#         repo's own item prefix and was the whole of the identifier backlog. The collision
#         that made ncpdp drop it is live here too and is handled by an explicit
#         SYNTHETIC_FIXTURE_TOKEN exclusion instead. See PROJECT_PREFIXES.
#       * RULE 5 HAS A `roadmap §` ARM. That is the same widening ncpdp made to rule 3 for
#         ADR paths, arriving through a different rule: this repo cites its roadmap by
#         section, which the meta-repo-path arm cannot see. See RULE_PATTERN[4].
#
#     Both carry a standalone self-test, so a later "resync with a sibling copy" reds
#     instead of silently reverting them.
#
#   * THE DETECTION RULES ultimately come from `cosyte/.github`
#     `scripts/release-notes.mjs` (its `CONTENT_RULES`), which is validated against every
#     published release body across the org. This file transcribes the prefix-keyed set to
#     PCRE. THE REASONING IS KEPT WITH THEM ON PURPOSE. Every one of the four traps
#     recorded here shipped a public defect before it was caught, and a reader who has not
#     hit them will tidy the guard away as over-complication.
#
# ---------------------------------------------------------------------------
# THE FOUR TRAPS THAT BREAK A NAIVE DETECTOR. All four are why this file is not a
# one-line grep. Do not "simplify" past them.
#
#   (1) KEY ON KNOWN PROJECT PREFIXES, NEVER ON THE `WORD-N` SHAPE. This package generates
#       fixtures for SIX standards, so it carries every sibling's reference vocabulary at
#       once: `HL7-V2`, `FHIR-R4`, `X12-837P`, `NCPDP-SCRIPT`, `CCDA-R2.1`, `ASTM-E1394`,
#       `DICOM-SR`, `ICD-10-CM`, and X12 headlines that open with a digit (`835`, `271`,
#       `837`). A shape rule destroys the reference material a fixture generator's docs
#       exist to provide. The cost of keying on prefixes is that a NEW PROGRAMME MEANS
#       ADDING ITS PREFIX to the list below, and nothing will catch it until someone does.
#       That is the cheaper of the two mistakes.
#
#       THIS REPO HAS A SECOND EDGE ON THE SAME TRAP, and it is the one that is specific to
#       a GENERATOR: the token `SYNTH` is BOTH this repo's item prefix (`SYNTH-4`) AND the
#       marker this package writes INTO the artifacts it generates, precisely so a reader of
#       a generated message can see at a glance that it is not real (`SYNTH-FAC` in `MSH-4`,
#       `SYNTH-LIS` and `SYNTH-ANALYZER` in the ASTM `H` header). That marker is the PHI
#       discipline made visible in the output, so it must survive; the item identifier must
#       not. There is no shape that separates them, so the separation is the explicit,
#       reviewable SYNTHETIC_FIXTURE_TOKEN list below, and every entry in it is asserted in
#       the NEGATIVE samples of both the doc-comment and the string-literal pass.
#
#   (2) DECAPITATION, which is a rule for the person REMEDIATING a hit, not for the
#       scanner. Stripping an identifier off the FRONT leaves the fragment behind:
#       "Phase 7 (thirteenth slice): builder emits X (CCDA-P7)" became "(thirteenth
#       slice): builder emits X" across 17 lines of ccda's published release notes, which
#       is worse than the text it replaced. Repair the head: drop a leading orphan
#       parenthetical, strip leading punctuation, recapitalise. Same mid-sentence: "(of
#       the v2.4 capability arc)" reads worse than no parenthetical at all.
#
#   (3) CASE SENSITIVITY. The identifier rule is case-SENSITIVE and the segment after the
#       hyphen must start uppercase or with a digit, which is what lets `FHIR-bridge`,
#       `HL7-defined`, `NCPDP-derived` and `docs-content/` through. Leading digits are fine
#       too: `835`, `271` and `837` open X12 headlines legitimately, so nothing here keys on
#       a leading number.
#
#   (4) PHASE PATTERNS NEED A LETTER SUFFIX (`Phase 5b`) AND A LETTER-ONLY FORM
#       (`Phase W`): a digits-only pattern misses both. Ordinal `slice` and `wave` are
#       ours too ("thirteenth slice", "second wave"): "slice" is our word for a unit of
#       work and a reader does not have it. In prose it should read "change".
#
# ---------------------------------------------------------------------------
# SCAN SURFACE. This gate scans the PUBLIC surface only, which is the one substantive
# difference from check-no-emdash (that one scans every tracked file, because the em-dash
# ban has no inside/outside distinction: it covers commit messages too). Here the same
# identifier is REQUIRED on the inside and BANNED on the outside, so scanning every
# tracked file would red on CHANGELOG.md, `.changeset/`, CLAUDE.md and source comments,
# where the convention explicitly says the identifiers belong. A gate that reds on
# correct content is a gate someone deletes.
#
# In scope:
#   * README.md            the repo's front page, and shipped inside the npm tarball
#   * LICENSE              shipped inside the npm tarball
#   * docs-content/        every tracked file, including sidebars.json: this is the
#                          content published to docs.cosyte.com. `limitations.md` lives
#                          here rather than at the repo root, which is where ncpdp's copy
#                          names KNOWN-LIMITATIONS.md separately; one path covers it.
#   * package.json         the npm-visible metadata ONLY (`description`, `keywords`),
#                          extracted and scanned as text. Named explicitly by the
#                          convention. The rest of package.json is not public prose, and
#                          scanning it whole would red on a future dependency or script
#                          name that happens to match.
#
# Out of scope, each for a stated reason:
#   * CHANGELOG.md         SHIPS INSIDE THE NPM TARBALL, so it is genuinely public surface,
#                          and it currently carries internal identifiers across its
#                          history. It is excluded anyway because the convention names
#                          CHANGELOG.md as one of the places identifiers BELONG, and
#                          because rewriting a released changelog's history destroys the
#                          traceability the same convention preserves. That is a live
#                          contradiction in the standard, it is ECOSYSTEM-WIDE (every
#                          parser has it), hl7 excludes it on exactly this reasoning, and
#                          it is not for one repo to settle alone. Recorded here, and
#                          queued on PUBLIC-SURFACE-HYGIENE in the meta-repo, rather than
#                          silently decided in either direction.
#   * phi-scan-overrides.md
#                          the audit log for fixture-level PHI-scan bypasses. Internal
#                          compliance bookkeeping, not consumer documentation.
#   * CLAUDE.md, .github/, .changeset/, scripts/
#                          internal by definition, or code rather than prose. This repo has
#                          no `docs/adr/` of its own; rule 3 still bans ADR numbers on the
#                          public surface, because the meta-repo's ADRs are the ones a page
#                          here is tempted to cite.
#   * test/                OUT of scope, and in a GENERATOR that deserves its own sentence
#                          rather than the blanket "code rather than prose" above.
#                          `test/fixtures/` holds COMMITTED GENERATED OUTPUT -- the artifacts
#                          this package emits, checked in as round-trip goldens. Generated
#                          output IS a surface a reader looks at, so the question is real.
#                          It is out of scope for two reasons, both measured: `files` is
#                          `dist`/`README.md`/`LICENSE`/`CHANGELOG.md`, so no fixture is in
#                          the tarball; and a fixture's bytes are a pure function of the
#                          seed and of the string literals in `src/`, which the FOURTH pass
#                          gates. Gating the output as well as its source would put the same
#                          red in two places. MEASURED on the tree this gate shipped with:
#                          the only project-prefixed tokens in `test/fixtures/` are
#                          `SYNTH-FAC`, `SYNTH-LIS`, `SYNTH-ANALYZER` and the generated
#                          `SYNTH-<10 digits>` message ids -- the synthetic-provenance
#                          markers, not bookkeeping. If a fixture ever carries an item
#                          identifier, its SOURCE literal is the thing to fix, and pass four
#                          is what will say so.
#   * src/ DOC COMMENTS    IN SCOPE, as a THIRD PASS at the bottom of this file, with its
#                          own rule array (SRC_RULE_PATTERN), its own self-tests, and its
#                          own extractor. `src/` JSDoc IS public: it is compiled into
#                          `dist/index.d.ts` and `dist/index.d.cts`, `dist` is the first
#                          entry in package.json's `files`, and it is what a consumer's
#                          editor shows on hover.
#   * src/ `//` COMMENTS   OUT of scope, because THE CONVENTION SAYS SO: it names source
#                          comments as one of the places identifiers BELONG. That is the
#                          whole reason, and it is deliberately the only one.
#                          DO NOT REASON ABOUT THIS BOUNDARY FROM WHAT REACHES `dist/`.
#                          Two drafts of the ncpdp copy tried and both were false, each
#                          caught by a refuter: "`//` comments do not reach `dist`" and
#                          "they do not reach `dist/*.d.ts` or `dist/*.js`" (tsup emits
#                          `.mjs`/`.cjs`, so that glob matched nothing and the check could
#                          not see its subject). RE-MEASURED HERE rather than inherited,
#                          on this repo's own build: `dist` is `files[0]`, there is no
#                          `.npmignore`, `dist/index.mjs` and `dist/index.cjs` each carry
#                          17 `//` comment lines verbatim, `dist` contains no `*.js` at
#                          all, and `dist/index.mjs.map` carries every tracked source byte
#                          in `sourcesContent`. SO EVERYTHING IN `src/` IS IN THE TARBALL.
#                          This gate's line is therefore not "what reaches the consumer's
#                          disk" -- everything does -- but WHAT THE CONSUMER IS SHOWN:
#                          JSDoc their editor renders on hover, and message text their log
#                          prints. Those are passes three and four. A comment they would
#                          have to go digging for is not.
#   * dist/                NOT SCANNED, and this is the gate's stated ceiling rather than a
#                          hole that has been closed. `dist/` is untracked build output:
#                          neither this script nor CI can read it without building first,
#                          and this script does not build. What the third pass gates is
#                          dist's SOURCE, which is a proxy that holds only because the dts
#                          build copies doc text verbatim. A build that began transforming
#                          comments would decouple the two silently.
#
# ---------------------------------------------------------------------------
# NO STDIN / PR-TEXT MODE, deliberately, and this is the other difference from
# check-no-emdash. That gate scans the PR title, body and commit messages because the
# brand rule names commit messages explicitly. This rule says the opposite: identifiers
# BELONG in the commit, the PR and the changeset. A PR-text half here would red on correct
# work. If you are looking for the half that keeps identifiers out of a published RELEASE
# BODY, it exists and it is not here: `cosyte/.github` `scripts/release-notes.mjs assert`
# runs inside the shared release pipeline and refuses to publish a violating body.
#
# ---------------------------------------------------------------------------
# DISCLOSED RESIDUALS. Known and stated rather than discovered later.
#
#   (i)   THE PREFIX LIST IS DUPLICATED across every copy of this gate and against
#         release-notes.mjs, because a bash gate inside a parser repo cannot import from
#         `cosyte/.github` and vendoring a 900-line Node script into 11 repos is worse. So
#         the copies can drift: a prefix added there does not appear here. The cross-repo
#         fix is one shared list (published as data by `cosyte/.github`, or as a
#         `@cosyte/*` package), and it is ONE fix across every copy rather than one per
#         repo. Do not patch this copy alone; a divergent variant is worse than a known
#         shared limit. The ONE deliberate divergence in this copy is `SYNTH`, PRESENT here
#         and absent from ncpdp's, with its reason at the list itself.
#   (ii)  The scan reads file CONTENTS, never file NAMES. A tracked path that itself
#         carries an identifier passes green.
#   (iii) An identifier inside a fenced code block, a URL, or a link target is treated
#         exactly like prose. That is deliberate (a reader sees it either way), but it
#         means a legitimate quotation of an internal path in an example would have to be
#         rewritten rather than escaped.
#   (iv)  This gate does not check the em dash. That rule is its own gate elsewhere in the
#         ecosystem (`scripts/check-no-emdash.sh` in hl7 / ncpdp / fhir / pathways /
#         knowledgebase) and this repo does not carry a copy yet. Do not fold it in here:
#         it scans a wider surface, including PR text and commit messages, which this gate
#         deliberately does not.
#   (v)   IT CATCHES IDENTIFIERS AND CITATIONS, NOT PROSE ABOUT OUR PROCESS. The founder's
#         rule bans both. Removed BY HAND alongside this gate, because no pattern here would
#         have found any of them: five subpath headers reading "This is the lazy, per-format
#         boundary THE ROADMAP MANDATES"; a doc comment crediting "the detail THE ROADMAP
#         STRESSES"; a code pool introduced as "FOLLOWING THE ROADMAP'S BYO posture"; and one
#         runtime `reason` string citing "deid's roadmap" in prose with no section sign.
#         Every one is an ordinary English sentence whose only fault is that it describes how
#         the artifact came to exist.
#
#         TWO CLASSES OF STALE FALSEHOOD WERE FOUND IN THE SAME SWEEP, and they are worth
#         naming because they are what makes a "just delete the identifier" edit dangerous.
#         `src/ccda/index.ts` said "Quirk generation is deferred" three lines above an
#         `export { generateCcdaQuirk }`, and `src/astm/index.ts` and `src/ncpdp/index.ts`
#         carried the same shape. Stripping the phase number out of those sentences would
#         have LEFT A FALSE CLAIM standing in cleaner clothes. They were DELETED, not
#         rewritten. THAT IS THE RULE FOR THIS WHOLE SWEEP: cut the claim rather than repair
#         it. A sibling repo's remediation shipped three new majors by doing the opposite,
#         the worst of them strengthening a guarantee while deleting the leg that grounded
#         it.
#
#         THE BY-HAND HALF IS NOT CLAIMED COMPLETE, and should not be. It raises the floor;
#         it does not replace the reviewer.
#   (vi)  `phase` AT THE END OF A CLAUSE IS NOT CAUGHT. Measured rather than assumed:
#         rule 2 DOES catch the running-prose forms, because it keys on `phase` plus a
#         following word, so `phase models`, `phase recognizes` and `phase opens` all red.
#         What escapes is `phase` with nothing after it but punctuation or a line end,
#         which is the shape of "the segments decoded this phase." and of a markdown
#         heading ending in the word. It is a real residual here rather than a footnote: this
#         repo's doc comments end clauses on `phase` freely. A rule for the determiner form was
#         written, measured and REMOVED in the hl7 copy because of what it cost in clinical
#         phrasing ("the phase of the clinical study", "the phase of illness"), and that
#         verdict is inherited rather than re-litigated. It is a reviewer's catch. The
#         paragraph-joined second pass narrows it: `phase` at a line end that is followed
#         by more prose in the same paragraph DOES red, because the join makes the next
#         word adjacent.
#   (vii) `D-NN`-STYLE SINGLE-LETTER INTERNAL LABELS ARE NOT CAUGHT, deliberately, and the
#         reason is clinical rather than stylistic. Catching them needs a single-letter
#         prefix, and that is trap (1) with a sharp edge in a package that generates
#         fixtures for six standards at once: legacy SNOMED RT codes are axis-prefixed in
#         exactly that shape (`D-13000` topography, `T-32000`, `M-80003`), NCPDP field
#         references are two characters after a hyphen (`439-E4`, `111-AM`), and this
#         package's own ASTM record types are single letters. This repo does not use `D-NN`
#         labels today; the non-catch is stated so a future one is a known gap rather than
#         a surprise.
#  (viii) A VIOLATION SPLIT BY INLINE MARKUP REJOINS IN NEITHER PASS. `phase **8**` and
#         `phase [8](...)` put markup between the two tokens, and neither the line scan nor
#         the paragraph join strips it, so a multi-token rule does not match. Closing it
#         needs a markdown renderer, not a bigger regex. Stated because a reader of the
#         second pass could otherwise assume it normalises markup as well as whitespace.
#         REACHABLE HERE: this repo's docs bold their emphasis heavily.
#   (ix)  THE THIRD PASS CANNOT SEE `dist/`, only its source. Stated at length in the pass
#         itself and in SCAN SURFACE above, and repeated here because it is the single most
#         important thing to know about what this gate does and does not prove.
#   (x)   RULE 4 (`slice`) FALSE-POSITIVES ON "the slice of Y" IN CODE PROSE, where `slice`
#         means portion and is nobody's jargon. Inherited rather than observed: ZERO
#         instances on this tree, measured. The rule found nothing here at all, in any pass.
#         It is carried anyway because it only ever ADDS a red and the sibling copies have
#         it; if an instance appears where no rewrite reads well, that is the signal to
#         narrow the rule and assert the phrasing in SRC_NEGATIVE[3], not to widen an
#         exclusion quietly.
#   (xi)  A DOC COMMENT THAT DOES NOT OPEN ITS OWN LINE IS INVISIBLE TO THE THIRD PASS. The
#         extractor enters a block only on `^[[:space:]]*/**`, so `const x = 1; /** ... */`
#         is scanned by neither pass 3 (never entered) nor pass 4 (not a string literal).
#         Checked: a seeded violation in that position prints OK. It is not fixed because
#         entering mid-line means tracking whether the `/**` is itself inside a string or a
#         regex, which is a tokenizer. Prettier puts a doc comment on its own line and
#         `format:check` runs ahead of this gate on the ladder, so the construct does not
#         occur in this repo today. Found by a refuter, stated rather than left implicit.
#  (xii)  `.changeset/` IS OUT OF SCOPE AND THAT IS A LIVE CONTRADICTION, the same one
#         CHANGELOG.md carries, one step earlier in the pipeline. The convention names the
#         changeset as a place identifiers BELONG, so this gate does not scan it -- and the
#         changeset text is what `cosyte/.github` turns into the PUBLISHED RELEASE BODY,
#         where `scripts/release-notes.mjs assert` refuses a violating one. MEASURED on this
#         tree: ELEVEN of the twelve pending changesets carry item identifiers or phase
#         language, so the FIRST release of this package will hit that assert. That is not
#         a defect of this gate and it is not fixed here: rewriting a pending changeset
#         changes what the first release notes say, which is a founder-visible act, and it
#         is the same ecosystem-wide contradiction rather than a synth problem. RECORDED so
#         whoever runs that first release is not surprised by it.
# (xiii)  MEASURE ON THE REFLOWED TEXT, NOT LINE BY LINE, when you sweep by hand. hl7's
#         `Plan N` sweep was done with a line scan and reported itself complete while one
#         instance survived where `Plan` ended a line and `04` began the next; it shipped
#         into `dist/`. That is the same wrap blindness this gate's second and third passes
#         exist for, arriving in the REMEDIATION rather than in the detection. Also: QUOTE
#         A COUNT WITH THE TREE IT WAS TAKEN ON, OR NOT AT ALL.
#
# Run it locally with `pnpm check:no-internal-refs`.
set -euo pipefail

# LOCALE PIN, load-bearing, and inherited from check-no-emdash for the same measured
# reason: `grep -P` compiles PCRE in UTF-8 mode only when the locale says so. Under
# LC_CTYPE=POSIX (a bare container, cron, `sh -c`) GNU grep's handling of non-ASCII in the
# input and of `\w` in the pattern changes, and the docs scanned here contain non-ASCII
# (the en dash in "Phases 6-7", `§`, curly quotes). A gate whose matching depends on an
# inherited environment is a gate that reports green somewhere and red elsewhere.
export LC_ALL=C.UTF-8

# ---------------------------------------------------------------------------
# THE BANNED SET, transcribed from release-notes.mjs CONTENT_RULES
# ---------------------------------------------------------------------------

# Known project and programme prefixes. THE KEYING IS ON THESE, NEVER ON THE `WORD-N`
# SHAPE: see trap (1) above. Order matters only for readability. Kept in the same order as
# the source list so a diff between the copies is legible.
#
# `SYNTH` IS PRESENT HERE AND ABSENT FROM `ncpdp`'S COPY. That is the one deliberate
# divergence between the two, and it is the divergence that matters most in this repo,
# because `SYNTH` is this repo's OWN item prefix: `SYNTH-1` ... `SYNTH-11` are its units of
# work, and MEASURED on the base commit of the change that added this gate they were the
# whole of the identifier backlog on every scanned surface. Dropping the prefix, as ncpdp
# does, would leave rule 1 with nothing to find here at all.
#
# ncpdp drops it because its runnable examples use `SYNTH-MSG-0001`-style message ids, and
# THE SAME COLLISION IS LIVE HERE, in a sharper form: this package WRITES the marker into
# the artifacts it generates. It is handled through SYNTHETIC_FIXTURE_TOKEN below rather
# than by dropping the prefix, because here the identifiers are the majority and the
# markers are three known constants; in ncpdp it was the other way round. The mechanism is
# the same explicit-exclusion bargain in both copies, pointed the other way.
#
# `PKG` IS ABSENT, for hl7's reason rather than one of ours (`PKG-1` and `PKG-4` are HL7 v2
# Chapter 17 Item Packaging segment-field references). Kept absent here so the copies stay
# diffable, and because it has never been minted as an item anywhere.
PROJECT_PREFIXES='PARSERS-PUBLIC|DOCS-CONTENT|KNOWLEDGEBASE|TERMINOLOGY|PATHWAYS|TRANSFORM|WEBSITE|STAGING|SUPPLY|NCPDP|ASSETS|EMDASH|README|CONFIG|DICOM|DEID|CCDA|ASTM|MLLP|FHIR|CREW|DOCS|PERF|SYNC|VERSION|PUBLIC|HL7|X12|IAC|CLI|KB|PW|PUB|CI|REAL|TERM|WF|VERIFY|SYNTH'

# STANDARDS DESIGNATIONS THAT COLLIDE WITH THE PREFIX LIST, excluded explicitly. Nine of
# the prefixes above (`NCPDP`, `HL7`, `X12`, `DICOM`, `FHIR`, `CCDA`, `ASTM`, `MLLP`,
# `TERM`) are the names of standards this ecosystem parses as well as the names of our
# projects. THIS PACKAGE GENERATES FOR SIX OF THEM AT ONCE, so where ncpdp carried most of
# this list defensively, every arm of it is reachable here: a page in `docs-content/` names
# HL7 v2, FHIR R4, C-CDA R2.1, X12 005010, NCPDP SCRIPT and ASTM E1394 in the same
# paragraph. The list is therefore CARRIED WHOLE rather than trimmed, which is also what
# keeps the copies diffable (residual (i)). There is no shape that separates a designation
# from an item identifier, so the separation is an explicit, reviewable exclusion list:
# it must be extended by hand, and that is the cheaper mistake. Every entry here is
# asserted in this rule's NEGATIVE sample.
#
# HL7's `HL7-\d{3,4}` ARM IS DELIBERATELY DROPPED, as in ncpdp's copy. In the hl7 copy it
# exempts HL7 v2 table numbers (Table 0396, Table 0003) written with a hyphen. Measured on
# this tree: `HL7-` followed by a digit appears zero times on the public surface, in `src/`
# doc comments and in `src/` string literals. This package writes v2 table references the
# way its own generated messages carry them, unhyphenated (`HL70162`, `HL70163`), which the
# rule never sees. Carrying the arm would exempt a shape this repo does not write and would
# weaken the rule against a real `HL7-<digits>` item identifier arriving from a sibling
# repo's release note. That is porting the FILE rather than the SHAPE.
STANDARDS_DESIGNATION='NCPDP-(?:SCRIPT|TELECOM|D\.\d|F\d)|HL7-(?:V2|V3|CDA|FHIR|OMG)|FHIR-R\d[A-Z]?|DICOM-(?:SR|RT|SEG|DIR|PS\d)|X12-\d{3}[A-Z]?|X12-\d{6}|CCDA-R\d(?:\.\d)?|ASTM-E\d+'

# SYNTHETIC-PROVENANCE MARKERS, excluded explicitly. THIS EXCLUSION IS THIS REPO'S OWN and
# has no counterpart in hl7's or ncpdp's copy, because no other package in the ecosystem
# WRITES a token into the artifacts it produces.
#
# These three constants are stamped into generated output precisely so a reader of a
# generated message can see at a glance that it is not real: `SYNTH-FAC` is the `MSH-4`
# sending facility on every generated HL7 v2 message, and `SYNTH-LIS` / `SYNTH-ANALYZER`
# are the sender and analyzer ids in the ASTM `H` header. They are the PHI discipline made
# visible in the output, which is the same category of "reference material a consumer needs"
# that STANDARDS_DESIGNATION protects, arriving through the DATA rather than through the
# docs. Their source is `src/` string literals, so without this exclusion the FOURTH pass
# reds on them and tells a remediator to rename the marker that says the data is fake.
#
# IT IS A LIST OF THREE LITERAL TOKENS, NOT A SHAPE, and that is the whole safety of it.
# The generated NCPDP message id is `SYNTH-` followed by ten random digits, which is
# typographically an item identifier and is NOT excluded here: it never appears in `src/`
# as a literal (the source writes the template `SYNTH-${rng.digits(10)}`, which rule 1
# cannot match because `$` is not in its character class) and it never appears on the
# public surface. Excluding it by digit count would be trap (1) arriving through the
# exclusion list, and it is not needed. Measured on this tree: the only project-prefixed
# tokens in committed generated output are these three plus that message id.
SYNTHETIC_FIXTURE_TOKEN='SYNTH-(?:FAC|LIS|ANALYZER)'

# Rule 1: internal project identifier. CASE SENSITIVE, and the segment after the hyphen
# must start with an uppercase letter or a digit, which is what lets `FHIR-bridge`,
# `NCPDP-copyrighted` and `HL7-defined` through (trap 3). The second alternative is our
# internal priority label, and it matches its own trailing word rather than looking ahead
# for one: an earlier version keyed on `P\d+` followed by end-of-string or a comma, which
# is the shape rule this file exists to avoid. It deleted the ICD-10-CM code in "Map
# ICD-10 P07, P22 and P29 to SNOMED CT" and truncated the code range "P00-P96". Corrupting
# a diagnosis code to remove an internal label is not a trade worth making.
#
# The collisions this rule has to survive in a SIX-FORMAT GENERATOR are not hypothetical,
# and they arrive from every standard at once. NCPDP Telecom field references are written
# `<number>-<two chars>` (`439-E4`, `511-FB`), X12 transaction sets open with a digit
# (`835`, `271`, `837`), HL7 v2 fields are `MSH-4` and `PID-3`, and this package's own
# generated output carries `SYNTH-FAC`, `SYNTH-LIS` and `SYNTH-ANALYZER`. All are asserted
# in NEGATIVE[0] so a later "simplification" cannot quietly drop them.
#
# THE LOOKAHEAD CARRIES BOTH EXCLUSION LISTS. STANDARDS_DESIGNATION protects the reference
# material a reader came for; SYNTHETIC_FIXTURE_TOKEN protects the provenance markers this
# package writes into what it generates. They are separate variables rather than one merged
# string because they are extended for different reasons and a reader needs to know which
# bargain they are looking at.
RULE_NAME[0]='internal project identifier'
RULE_PATTERN[0]='\b(?!(?:'"$STANDARDS_DESIGNATION"'|'"$SYNTHETIC_FIXTURE_TOKEN"')\b)(?:'"$PROJECT_PREFIXES"')(?:-[A-Z0-9][A-Z0-9.]*)+\b|\bP\d+ (?:safety|documentation)\b'

# Rule 2: phase and wave language. CASE INSENSITIVE via the inline `(?i)`, because the
# rules do not share a case policy and one `grep -i` for all of them would break trap (3).
# `Phase 5b` and `Phase W` are both covered (trap 4). The negative lookahead keeps ordinary
# English off the list, so "in phase with the source system" and "out of phase" survive.
#
# THE CLINICAL LOOKBEHINDS ARE KEPT AND THE HL7 FIELD-NAME LOOKAHEAD IS DROPPED, and the
# split is deliberate rather than a partial copy.
#
#   KEPT: `study|clinical|trial` and the ordinary clinical senses
#   (`acute|chronic|luteal|follicular|liquid|gas`), plus the clinical-trial roman numerals
#   when followed by trial vocabulary. They are reachable here for a reason particular to a
#   GENERATOR: this package's example-code pools carry LOINC and SNOMED CT concepts, and
#   "acute phase reactant" is one of the ordinary names for a class of them. A bare
#   `Phase III` is still flagged, because it is genuinely ambiguous with an internal
#   single-letter item and a loud red on a rare line beats a silent hole.
#
#   DROPPED: `identifier|start|end|evaluability|number` from the lookahead. In hl7 those
#   exempt the field names of the Chapter 7 `CSP` Clinical Study Phase segment (`CSP-1
#   Study Phase Identifier`, `CSP-2 Study Phase Start Date/Time`, ...). This package
#   generates ADT, ORU, ORM, SIU and VXU and models no `CSP` segment at all; measured on
#   this tree those phrases appear zero times. Carrying them would exempt a construction
#   this repo does not write while widening the hole in residual (vi).
#
# `phase[ -]` rather than `phase ` is kept: `Phase-L` was live in hl7's docs and slipped a
# space-only rule.
#
# `phases?` RATHER THAN `phase` IS INHERITED FROM ncpdp's copy and is load-bearing here
# too: this repo's README reads "Phases 1-9 shipped" and its docs read "the phases that
# follow", which a singular rule walks straight past. Widening the stem rather than bolting
# on a second alternative keeps the clinical lookbehinds and the ordinary-English lookahead
# applied to the plural too, so "the phases of the trial" and "clinical phases" still
# survive; a separate `phases \d+` arm would have had neither guard. Asserted in both
# directions: POSITIVE[1] carries "Phases 6 and 7", NEGATIVE[1] carries the clinical plural.
ORDINAL='(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty-first|twenty-second|twenty-third|twenty-fourth|\d+(?:st|nd|rd|th))'
PHASE_NOT_CLINICAL='(?<!study )(?<!clinical )(?<!trial )(?<!acute )(?<!chronic )(?<!luteal )(?<!follicular )(?<!liquid )(?<!gas )'
PHASE_NOT_ENGLISH='(?!of\b|with\b|in\b|out\b|the\b|and\b|is\b|for\b|to\b|(?:I{1,3}|IV)\s+(?:trial|stud|clinical|oncolog))'
RULE_NAME[1]='phase or wave language'
RULE_PATTERN[1]='(?i)\b(?:roadmap phases?\b[ ]?[A-Za-z0-9]*|'"$PHASE_NOT_CLINICAL"'phases?[ -]'"$PHASE_NOT_ENGLISH"'[A-Za-z0-9]+[a-z]?\b|wave \d+\b|the \w+ and final phase\b|documentation residual\b|'"$ORDINAL"' (?:slice|wave)\b)'

# Rule 3: ADR references. An ADR number is a pointer into a decision record the reader did
# not come here for. This repo has NO `docs/adr/` of its own; the decisions that govern it
# are the meta-repo's, which a consumer cannot open at all. The temptation is live either
# way (this package's quirk grounding rests on one), so the rule is kept. Cite what the
# decision WAS, not the number it has.
#
# `/` IS IN THE SEPARATOR CLASS, and hl7's copy does not have it. Carried from ncpdp's copy
# rather than re-derived: there, three live citations written as PATHS (`docs/adr/0001-...`)
# survived a whole gate because a space-or-hyphen class cannot see that form, and a refuter
# found them after the gate had reported OK. This repo writes no such path today, so the
# arm costs nothing here and closes the shape a page copied from a sibling would bring
# along. The NEGATIVE sample keeps `0015` alone and a bare `ADR` off the rule.
#
# THE `\d{3,4}` FLOOR IS INHERITED AND IS A KNOWN GAP: `ADR 7` and `ADR-12` are not
# caught. Left as hl7 has it rather than fixed here, because every ADR in this ecosystem is
# written four-digit and lowering the floor to `\d{1,4}` would start matching ordinary
# two-digit numbers after any three letters that happen to spell `adr`.
RULE_NAME[2]='ADR reference'
RULE_PATTERN[2]='(?i)\bADR[ \-/]?\d{3,4}\b'

# Rule 4: `slice`, our internal word for a unit of work. It is ALSO real clinical
# vocabulary elsewhere in this ecosystem: a DICOM study has slices, with a slice thickness,
# a slice location and slice spacing. So this keys on the determiner forms that are
# unambiguously ours ("this slice", "the final slice") and excludes the imaging nouns. A
# bare `slice` is deliberately NOT flagged: across this corpus that word is more often the
# reader's than ours.
#
# THE IMAGING-NOUN EXCLUSION IS KEPT VERBATIM. It only ever EXCLUDES, so it cannot cause a
# miss of our jargon; diverging from the sibling copies to delete an unused alternation
# would make the copies harder to diff for no safety gained (residual (i)). It is grounded
# in @cosyte/dicom's generated tag dictionary (SliceThickness, SliceLocation,
# SpacingBetweenSlices, NumberOfSlices). A modifier may sit between the determiner and the
# noun ("the misfiling-prevention slice") but a preposition may not: "the Number of Slices"
# is a DICOM attribute, not one of our units of work.
#
# `phase` IS DELIBERATELY NOT MATCHED HERE. A refuter pass on the hl7 copy added it to
# catch "non-goals of this phase"; the next pass measured what it cost and the answer was
# ordinary clinical English: "the phase of the clinical study", "the phase of illness" and
# "each phase of the trial". No modifier exclusion list rescues that, because the collision
# is with the HEAD noun rather than the modifier. That verdict is inherited, not
# re-litigated: rule 2 still catches `phase X`, and "of this phase" with no following
# identifier is the reviewer's catch recorded in residual (vi).
IMAGING_NOUNS='thickness|location|spacing|position|interval|order|number|index|gap|count|data|pixel|orientation|plane|direction|width|vector|sensitivity|progression|factor'
RULE_NAME[3]='internal jargon ("slice")'
RULE_PATTERN[3]='(?i)\b(?:this|that|the|each|another|previous|next|final|current)\s+(?:(?!(?:of|in|on|between|per|for|to|with|at)\s)[\w-]+\s+){0,2}slices?\b(?!\s+(?:'"$IMAGING_NOUNS"'))'

# Rule 5: internal repo paths. A docs page carries citations, and a reader who installs
# @cosyte/synth has no meta-repo and no such file. Keyed on the known meta-repo paths, not
# on a `dir/file.md` shape, for exactly the reason trap (1) gives -- this package's own
# pages legitimately cite `docs-content/limitations.md`, and its doc comments cite real
# source paths, both of which a shape rule would take with it.
#
# THE `roadmap §` ARM IS THIS REPO'S ADDITION, and it is the SAME WIDENING ncpdp made to
# rule 3, arriving through rule 5 instead. There, three live ADR citations written as PATHS
# were structurally invisible to a prose-keyed pattern and survived a whole gate run; the
# lesson recorded with them was that A COUNT IS A FUNCTION OF THE RULE SET. The same shape
# is live here and much larger: this repo cites its roadmap by SECTION (`roadmap §4`,
# `roadmap §4.1`, `roadmap §10 Q2`), which the path arm above cannot see, and MEASURED on
# the base commit of this change there were 169 such citations inside `src/` doc comments
# alone -- an order of magnitude more than every other rule found put together. Without
# this arm the gate would have reported the doc-comment surface clean while a consumer's
# editor kept showing them pointers into a document they cannot open.
#
# IT IS DELIMITER-ANCHORED, not shape-keyed, which is the only reason it is safe: it
# requires the literal word `roadmap` immediately followed by a section sign. No standard
# in this ecosystem writes that, and `§` alone is left untouched, so a page that cites
# `ONC 2015 Edition §170.315(b)(1)` -- which this package's quirk grounding really does --
# passes. Asserted alone in ROADMAP_SECTION_SAMPLE below, for the same reason ncpdp asserts
# its ADR path form alone: the array sample carries other matter, so it would stay green if
# a later "resync" dropped the arm.
RULE_NAME[4]='internal repo path'
RULE_PATTERN[4]='\boperations/(?:BACKLOG\.md|roadmaps/|plans/)|\bdocumentation/(?:decisions/|ecosystem-map\.md|conventions\.md)|\bBACKLOG\.md\b|\broadmap §'

# Rule 6: internal traceability markers. Bracketed spec-trace tags that key into a roadmap
# traceability table, and "Open-question #12" pointers into a decision log the reader
# cannot open. Zero instances measured on this tree; the rule is carried because the
# convention that produces them is shared across the parsers and a page copied from a
# sibling would bring them along. Both are DELIMITER-ANCHORED rather than shape-keyed,
# which is the only reason they are safe: the tag rule requires a literal `[S-` opening
# bracket and at least two characters after it, so a documented character range like
# `[S-Z]` does not match, and neither does a value set written `[SNOMED]`.
RULE_NAME[5]='internal traceability marker'
RULE_PATTERN[5]='\[S-[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)*\]|(?i:\bopen[- ]question #?\d+\b)'

RULE_COUNT=6

# ---------------------------------------------------------------------------
# THE `src/` DOC-COMMENT RULE SET, deliberately a SEPARATE ARRAY
# ---------------------------------------------------------------------------
#
# WHY A SECOND SURFACE EXISTS AT ALL. The block above scans markdown a reader browses.
# This one scans the JSDoc a consumer's EDITOR renders: `src/` doc comments are compiled
# into `dist/index.d.ts` and `dist/index.d.cts` by tsup, `dist` is the first entry in
# package.json's `files`, and every `npm i @cosyte/synth` receives them. It is by far the
# LARGER of the two surfaces in this repo, not an afterthought: measured on the base commit
# of the change that added this pass, tracked `src/**/*.ts` carried an order of magnitude
# more matching doc-comment lines than the whole public markdown surface, including exported
# symbols documented as built "(roadmap Phase 3, deferred to SYNTH-4)" -- which tells a
# consumer nothing except that we build in phases.
#
# WHY A SEPARATE ARRAY RATHER THAN REUSING RULE_PATTERN. Code comments are not markdown.
# The two surfaces have different collision profiles (TypeScript prose says `.slice()` and
# "the slice after the fixed header"; markdown says "the thirteenth slice"), different wrap
# shapes, and different self-test material. Sharing one array would mean a fix for one
# surface silently retunes the other, and the negative self-test that caught it would be in
# the wrong file's language. They START identical. They are ALLOWED to diverge, and when
# they do, each side's NEGATIVE sample is what stops the divergence from being a widening.
#
# WHAT IS SCANNED, precisely: only text inside `/** ... */` blocks. NOT `//` line comments
# and NOT `/* */` block comments, and that boundary is the whole point rather than a
# convenience. `/** */` is what the dts build carries into `dist`; `//` is not. The
# convention names source comments as a place identifiers BELONG. So the line this draws is
# exactly the founder's line: what a CONSUMER receives is public and is swept; what only a
# maintainer reads stays internal.
#
# REMOVING A DOC COMMENT TO SATISFY THIS PASS IS A REGRESSION, NOT A FIX. JSDoc with an
# `@example` on every public export is a hard guardrail in CLAUDE.md and the JSDoc lint
# rule is an error, but neither lint nor coverage notices prose deleted from the middle of
# a block. Rewrite the sentence to say what the software does.
SRC_RULE_NAME[0]="${RULE_NAME[0]}"; SRC_RULE_PATTERN[0]="${RULE_PATTERN[0]}"
SRC_RULE_NAME[1]="${RULE_NAME[1]}"; SRC_RULE_PATTERN[1]="${RULE_PATTERN[1]}"
SRC_RULE_NAME[2]="${RULE_NAME[2]}"; SRC_RULE_PATTERN[2]="${RULE_PATTERN[2]}"
SRC_RULE_NAME[3]="${RULE_NAME[3]}"; SRC_RULE_PATTERN[3]="${RULE_PATTERN[3]}"
SRC_RULE_NAME[4]="${RULE_NAME[4]}"; SRC_RULE_PATTERN[4]="${RULE_PATTERN[4]}"
SRC_RULE_NAME[5]="${RULE_NAME[5]}"; SRC_RULE_PATTERN[5]="${RULE_PATTERN[5]}"
SRC_RULE_COUNT=6

# ---------------------------------------------------------------------------
# THE `src/` STRING-LITERAL RULE SET: the fourth pass, and the one hl7 does not have
# ---------------------------------------------------------------------------
#
# WHY IT EXISTS, AND WHY hl7's COPY DOES NOT HAVE IT. A library's most widely read text is
# not its README and not its JSDoc: it is its MESSAGE STRINGS. A parser's warnings reach a
# consumer's log; a GENERATOR'S string literals reach further still, because THEY ARE THE
# BYTES IT EMITS. `SYNTH-FAC` is not a message about the software, it is a field in every
# HL7 v2 message this package produces, and a consumer's whole test corpus is built out of
# these literals. Neither markdown nor doc comments, so the three passes above walk straight
# past them. This pass is carried from ncpdp's copy, where it was added after six warning
# messages were found saying "not modeled this phase" in a consumer's log.
#
# MEASURED, not assumed, on the tree that added this pass to THIS repo: TWO consumer-facing
# strings carried internal bookkeeping --
#   "@cosyte/synth does not generate DICOM (deferred, roadmap §2), so there is nothing to pair."
#   "@cosyte/deid ships no NCPDP SCRIPT locus map (deferred in deid's roadmap); ..."
# Both are `reason` strings on `DEID_LOOP_SKIPPED`, a frozen exported constant a consumer
# reads to find out why a format is not covered. Neither is markdown and neither is a doc
# comment, so passes one to three walked past both. Both are gone.
#
# BE PRECISE ABOUT WHAT CAUGHT WHICH, because the honest half is the useful half. THE FIRST
# WAS CAUGHT BY THIS PASS, under rule 5, and only because that rule's `roadmap §` arm had
# just been added; under the un-widened rule set the pass would have run over it and reported
# clean. THE SECOND WAS NOT CAUGHT BY ANYTHING. It cites a roadmap in prose, with no section
# sign, so no rule here sees it; it was a reviewer's catch during the same sweep and it stays
# a reviewer's catch. One found, one missed, on a surface of two: that is the measure of this
# pass, and it is residual (v) arriving inside the string surface rather than the markdown.
#
# SO WHAT IS THIS PASS WORTH? It closes the SURFACE, not that one shape. An item identifier
# (`(SYNTH-9)`), an ADR number, a meta-repo path, a `Phase 9` with a following token, or a
# traceability tag written into an emitted string is caught here and is caught nowhere
# else. Rule 1 is the highest-value rule in this file and it had no reach into a string at
# all. A surface with no gate on it regresses silently; a surface with a gate that shares
# one stated residual regresses loudly for everything except that residual. Both halves of
# that sentence are true and neither is the whole story.
#
# THE FALSE-POSITIVE RISK WAS MEASURED, because a rule over code strings is the obvious
# place for one. All six rules over all 2,003 double-quoted and backtick literals in tracked
# `src/`, on the remediated tree: ZERO matches. That number is worth stating next to the
# SYNTHETIC_FIXTURE_TOKEN list, because WITHOUT that exclusion it would not have been zero:
# `SYNTH-FAC`, `SYNTH-LIS` and `SYNTH-ANALYZER^ModelS^1` are literals in this set, and rule 1
# reds on all three until the exclusion lets them through. Import
# specifiers, the `SYNTH_*` fatal-code constants (underscored, so rule 1's hyphen
# requirement never fires), the LOINC / SNOMED / RxNorm display strings and the emitted
# identity constants all pass cleanly. The rules are therefore reused whole rather than
# trimmed: a narrowed copy would have no measurement behind it.
#
# WHAT IS SCANNED, precisely: double-quoted and backtick literals on lines that are NOT
# whole-line comments. Three boundaries, each deliberate:
#   * WHOLE-LINE COMMENTS ARE SKIPPED (`//`, `/*`, `/**`, and a continuation ` *`). Pass
#     three owns doc comments, and `//` comments are deliberately out of scope for the
#     whole gate: the convention names source comments as a place identifiers BELONG.
#     Without this skip, a `//` comment that happens to contain a backticked
#     symbol would be scanned as a string and the stated boundary would quietly move.
#   * A TRAILING COMMENT ON A CODE LINE IS STILL SCANNED. Accepted rather than solved:
#     splitting a trailing comment off needs a tokenizer, and the failure mode is an
#     over-report on a line a maintainer can read in one second.
#   * SINGLE-QUOTED LITERALS ARE NOT SCANNED. Prettier (`@cosyte/prettier-config`) emits
#     double quotes, `format:check` runs ahead of this gate on the verify ladder, and
#     tracked `src/` contains no single-quoted string. Including `'` would instead capture
#     comment prose between two apostrophes, which would drag `//` comments into scope
#     through the back door.
#   * A MULTI-LINE TEMPLATE LITERAL IS SCANNED PER LINE, so a violation split across its
#     line breaks is missed. Under-reports rather than over-reports. There is no reflow
#     pass here because a reflow would have to model template continuation, and the fix
#     for a missed one is the same as for any residual: the reviewer.
STR_RULE_NAME[0]="${RULE_NAME[0]}"; STR_RULE_PATTERN[0]="${RULE_PATTERN[0]}"
STR_RULE_NAME[1]="${RULE_NAME[1]}"; STR_RULE_PATTERN[1]="${RULE_PATTERN[1]}"
STR_RULE_NAME[2]="${RULE_NAME[2]}"; STR_RULE_PATTERN[2]="${RULE_PATTERN[2]}"
STR_RULE_NAME[3]="${RULE_NAME[3]}"; STR_RULE_PATTERN[3]="${RULE_PATTERN[3]}"
STR_RULE_NAME[4]="${RULE_NAME[4]}"; STR_RULE_PATTERN[4]="${RULE_PATTERN[4]}"
STR_RULE_NAME[5]="${RULE_NAME[5]}"; STR_RULE_PATTERN[5]="${RULE_PATTERN[5]}"
STR_RULE_COUNT=6

# ---------------------------------------------------------------------------
# SELF-TESTS. A gate is believed only after it has shown it can still see.
# ---------------------------------------------------------------------------
#
# Two halves, and the second is the one that is unusual. POSITIVE samples prove each rule
# still matches what it bans (the check-no-emdash property: refuse to report a clean tree
# from a scanner that cannot see). NEGATIVE samples prove each rule still lets through the
# reference material it was most likely to destroy, which is trap (1) turned into an
# assertion: if someone "simplifies" the identifier rule to a `WORD-N` shape, the negative
# self-test reds here instead of silently deleting `NCPDP-SCRIPT` and `439-E4` from a
# fixture generator's docs on the next sweep. Both halves run on every invocation, local
# and CI, and both refuse rather than warn.

self_test_fail() {
  echo "ERROR: check-no-internal-refs - SELF-TEST FAILED: $1" >&2
  echo "       The scanner is not behaving as specified, so no result from it can be" >&2
  echo "       believed. Refusing to report on the tree." >&2
  exit 1
}

# rule index -> text that MUST match. Every sample is written in THIS repo's own
# vocabulary, so a reader can tell what the rule is for without opening another package.
POSITIVE[0]='Item SYNTH-4 is done, and CCDA-P7 and ASTM-7 with it'
POSITIVE[1]='Phase 5b closes it (Phase W, Phase-L and the thirteenth slice landed earlier, in wave 2), and Phases 6 and 7 preceded it'
POSITIVE[2]='Decided in ADR 0015, restated in ADR-0021, and recorded in docs/adr/0001-xml-parser.md'
POSITIVE[3]='This slice adds the vitals generator and the final slice removes it'
POSITIVE[4]='Roadmap operations/roadmaps/synth.md and documentation/decisions/0015-x.md'
POSITIVE[5]='Repeating [S-SIG], and Open-question #12 resolves the direction'

# rule index -> text that must NOT match. Every entry is real reference material from an
# an HL7, FHIR, C-CDA, X12, NCPDP or ASTM context, a synthetic-provenance marker this
# package writes into what it generates, or ordinary English that collides with our jargon.
NEGATIVE[0]='The synthetic-provenance markers SYNTH-FAC and SYNTH-LIS and SYNTH-ANALYZER, NCPDP-SCRIPT and NCPDP-TELECOM and NCPDP-D.0 and NCPDP-F6, NCPDP-derived labels, Reason for Service 439-E4, Reject Code 511-FB, ICD-10-CM P00-P96, FHIR-bridge stability, docs-content/ layout, HL7-defined tables, HL7-V2 and HL7-CDA, FHIR-R4, DICOM-SR, X12-837P and X12-005010, CCDA-R2.1, ASTM-E1394 and ASTM-E1381, 835 remittance and 271 eligibility'
NEGATIVE[1]='A Phase III oncology trial and a Phase II study; the clinical phases of a drug programme; the acute phase reactant; luteal phase dosing and follicular phase dosing; the liquid phase of a preparation; the generator stays in phase with the source system and is out of phase'
NEGATIVE[2]='ADR is not a segment identifier, and 0015 alone is a value'
NEGATIVE[3]='The slice thickness and the number of slices are DICOM attributes, each slice location is too, and the phase of the clinical study, the phase of illness and each phase of the trial are the reader words this rule must not touch'
NEGATIVE[4]='Generator operations are documented in the README, and documentation for the API is generated'
NEGATIVE[5]='A character range like [S-Z], a value set written [SNOMED], and open questions about the feed'

# TWO WIDENED ARMS GET THEIR OWN ASSERTIONS, separate from the array loop, and they are the
# only two that need one. The array samples all carry the NARROW form as well as the widened
# one, so every one of them still matches under the un-widened pattern: they prove the rule
# works, they do NOT prove it still has the arm that was added. A "resync with a sibling
# copy" that reverted either pattern would leave the whole suite green and silently reopen
# the exact hole the widening exists to close. So each widened form is asserted ALONE, with
# nothing else in the sample for the rule to match on.
ADR_PATH_SAMPLE='Ratified in docs/adr/0001-xml-parser.md'
if ! printf '%s\n' "$ADR_PATH_SAMPLE" | grep -qP -e "${RULE_PATTERN[2]}"; then
  self_test_fail "rule 'ADR reference' no longer matches an ADR cited as a PATH ('docs/adr/0001-...'), which is the form hl7's narrower pattern misses. Three live citations survived a whole gate in a sibling repo because of that gap. Do not drop '/' from the separator class."
fi

ROADMAP_SECTION_SAMPLE='Built through the parser own builder, roadmap §4.1'
if ! printf '%s\n' "$ROADMAP_SECTION_SAMPLE" | grep -qP -e "${RULE_PATTERN[4]}"; then
  self_test_fail "rule 'internal repo path' no longer matches a roadmap cited by SECTION ('roadmap §4.1'), which is the form this repo writes and the form the meta-repo-path arm alone cannot see. 169 live citations were in src/ doc comments when this arm was added. Do not drop the 'roadmap §' arm."
fi
# The other half of the same bargain: `§` on its own is REFERENCE MATERIAL here. This
# package's quirk grounding cites regulation and standards by section, and a rule that
# keyed on the section sign rather than on `roadmap` immediately before it would delete it.
ROADMAP_SECTION_NEGATIVE='Grounded in ONC 2015 Edition §170.315(b)(1) and in the standard §4.1'
if printf '%s\n' "$ROADMAP_SECTION_NEGATIVE" | grep -qP -e "${RULE_PATTERN[4]}"; then
  self_test_fail "rule 'internal repo path' now matches an ordinary standards citation by section. The 'roadmap §' arm must stay anchored on the word 'roadmap'; keying on the section sign alone destroys the regulatory citations this package's quirk grounding depends on."
fi

i=0
while [ "$i" -lt "$RULE_COUNT" ]; do
  if ! printf '%s\n' "${POSITIVE[$i]}" | grep -qP -e "${RULE_PATTERN[$i]}"; then
    self_test_fail "rule '${RULE_NAME[$i]}' no longer matches its own positive sample."
  fi
  if printf '%s\n' "${NEGATIVE[$i]}" | grep -qP -e "${RULE_PATTERN[$i]}"; then
    hit=$(printf '%s\n' "${NEGATIVE[$i]}" | grep -oP -e "${RULE_PATTERN[$i]}" | head -1)
    self_test_fail "rule '${RULE_NAME[$i]}' now matches legitimate reference material (matched: '${hit}'). This is the WORD-N trap: it destroys the standards designations a six-format generator's docs exist to provide, or the SYNTH- markers that say its output is not real."
  fi
  i=$((i + 1))
done

# The `src/` set gets its OWN self-tests, in the language of the surface it guards. The
# NEGATIVE samples are built from material that is actually present in this package's
# source: the six standards' designations as its doc comments write them, the three
# synthetic-provenance markers, and TypeScript that reads like our jargon
# (`date.slice(0, 4)`). If someone widens the `src` rules into the WORD-N shape, or
# "resyncs" the prefix list and drops SYNTHETIC_FIXTURE_TOKEN with it, this reds instead of
# deleting `SYNTH-FAC` from an exported function's IntelliSense on the next sweep.
SRC_POSITIVE[0]='Item SYNTH-4 is done, and CCDA-P7 and ASTM-7 with it'
SRC_POSITIVE[1]='Phase 5b closes it (Phase W, Phase-L and the thirteenth slice landed earlier, in wave 2), and Phases 6 and 7 preceded it'
SRC_POSITIVE[2]='Decided in ADR 0015, restated in ADR-0021, and recorded in docs/adr/0001-xml-parser.md'
SRC_POSITIVE[3]='This slice adds the vitals generator and the final slice removes it'
SRC_POSITIVE[4]='Roadmap operations/roadmaps/synth.md and documentation/decisions/0015-x.md'
SRC_POSITIVE[5]='Repeating [S-SIG], and Open-question #12 resolves the direction'

SRC_NEGATIVE[0]='The synthetic-provenance markers SYNTH-FAC and SYNTH-LIS and SYNTH-ANALYZER, NCPDP-SCRIPT and NCPDP-TELECOM and NCPDP-D.0 and NCPDP-F6, Reason for Service 439-E4, Reject Code 511-FB, Cardholder ID 302-C2, ICD-10-CM P00-P96, FHIR-bridge stability, HL7-defined tables, HL7-V2, FHIR-R4, DICOM-SR, X12-837P and X12-005010, CCDA-R2.1, ASTM-E1394 and ASTM-E1381'
SRC_NEGATIVE[1]='A Phase III oncology trial and a Phase II study; the clinical phases of a drug programme; the acute phase reactant; luteal phase dosing; the liquid phase of a preparation; the generator stays in phase with the source system and is out of phase'
SRC_NEGATIVE[2]='ADR is not a segment identifier, and 0015 alone is a value'
SRC_NEGATIVE[3]='The slice thickness and the number of slices are DICOM attributes, each slice location is too; date.slice(0, 4) and raw.slice(4, 6) are TypeScript; and the phase of the clinical study, the phase of illness and each phase of the trial are the reader words this rule must not touch'
SRC_NEGATIVE[4]='Generator operations are documented in the README, and documentation for the API is generated'
SRC_NEGATIVE[5]='A character range like [S-Z], a value set written [SNOMED], and open questions about the feed'

# The STRING-LITERAL set gets its own samples too, in the language of a runtime warning
# message. The POSITIVE ones are what the rules DO catch in a message string; the rule-2
# sample is deliberately NOT one of the six real messages this change removed, because
# none of those matched (see the residual note at STR_RULE_NAME) and asserting a sample
# the rule cannot match is how a gate ends up believed for the wrong reason. The NEGATIVE
# ones are real strings from this package's source: the underscored warning codes (which
# must never look like an identifier), an import specifier, the field tables, and a
# REMEDIATED warning message, so a widening that starts flagging correct messages reds
# here instead of on the next pull request.
STR_POSITIVE[0]='SYNTH-7 shipped this generator'
STR_POSITIVE[1]='Added in Phase 9 and reworked in phase 10b'
STR_POSITIVE[2]='Behaviour fixed by ADR 0018, recorded in docs/adr/0001-xml-parser.md'
STR_POSITIVE[3]='Added by the final slice of the generator'
STR_POSITIVE[4]='See operations/roadmaps/synth.md'
STR_POSITIVE[5]='Traced as [S-SIG]'

STR_NEGATIVE[0]='The emitted provenance markers SYNTH-FAC and SYNTH-LIS and SYNTH-ANALYZER^ModelS^1, alongside COSYTE-SYNTH and RECV-FAC and FIXTURE-HOST and PLACEHOLDER-LAB and MOCK-CHEM^ModelC^2, the fatal codes SYNTH_UNSUPPORTED_FORMAT and SYNTH_UNSUPPORTED_QUIRK, the specifiers ./tokenize.js and ../safe/index.js, NCPDP-SCRIPT and NCPDP-D.0, Reason for Service 439-E4, Reject Code 511-FB, HL7-V2 and FHIR-R4 and X12-837P and CCDA-R2.1 and ASTM-E1394, ICD-9-CM and ICD-10-CM'
STR_NEGATIVE[1]='Synthetic assessment narrative. Not a real clinical assessment. A Phase III trial and the acute phase reactant are out of scope, and the generator stays in phase with the source system.'
STR_NEGATIVE[2]='ADR is not a record type, and 0001 alone is a value'
STR_NEGATIVE[3]='the transform changed some bytes. The slice thickness and the number of slices are DICOM attributes.'
STR_NEGATIVE[4]='Generator operations are documented in the README, and documentation for the API is generated'
STR_NEGATIVE[5]='A character range like [S-Z], a value set written [SNOMED], and open questions about the feed'

i=0
while [ "$i" -lt "$STR_RULE_COUNT" ]; do
  if ! printf '%s\n' "${STR_POSITIVE[$i]}" | grep -qP -e "${STR_RULE_PATTERN[$i]}"; then
    self_test_fail "string-literal rule '${STR_RULE_NAME[$i]}' no longer matches its own positive sample."
  fi
  if printf '%s\n' "${STR_NEGATIVE[$i]}" | grep -qP -e "${STR_RULE_PATTERN[$i]}"; then
    hit=$(printf '%s\n' "${STR_NEGATIVE[$i]}" | grep -oP -e "${STR_RULE_PATTERN[$i]}" | head -1)
    self_test_fail "string-literal rule '${STR_RULE_NAME[$i]}' now matches a legitimate runtime string (matched: '${hit}'). A warning message a consumer reads must survive this gate; only our bookkeeping must not."
  fi
  i=$((i + 1))
done

i=0
while [ "$i" -lt "$SRC_RULE_COUNT" ]; do
  if ! printf '%s\n' "${SRC_POSITIVE[$i]}" | grep -qP -e "${SRC_RULE_PATTERN[$i]}"; then
    self_test_fail "src rule '${SRC_RULE_NAME[$i]}' no longer matches its own positive sample."
  fi
  if printf '%s\n' "${SRC_NEGATIVE[$i]}" | grep -qP -e "${SRC_RULE_PATTERN[$i]}"; then
    hit=$(printf '%s\n' "${SRC_NEGATIVE[$i]}" | grep -oP -e "${SRC_RULE_PATTERN[$i]}" | head -1)
    self_test_fail "src rule '${SRC_RULE_NAME[$i]}' now matches legitimate reference material (matched: '${hit}'). This is the WORD-N trap, arriving through the source-comment surface: it destroys the standards references a six-format generator's IntelliSense exists to provide."
  fi
  i=$((i + 1))
done

# ---------------------------------------------------------------------------
# Refusals. Anything the scanner writes to stderr means it did not read everything it was
# given, and an incomplete scan must never print OK. Exit status cannot carry that signal:
# grep exits 1 on "no match", which xargs reports as 123, so "clean" and "died part way
# through the batch" are indistinguishable by code. A match inside input grep classifies
# as binary also arrives on stderr with empty stdout.
# ---------------------------------------------------------------------------
ERRLOG=$(mktemp)
FILELIST=$(mktemp)
SCANLIST=$(mktemp)
NPMBUF=$(mktemp)
REFLOWBUF=$(mktemp)
RAWBUF=$(mktemp)
SRCLIST=$(mktemp)
SRCSCAN=$(mktemp)
DOCLINES=$(mktemp)
DOCMAP=$(mktemp)
DOCFLOW=$(mktemp)
DOCFLOWMAP=$(mktemp)
STRLINES=$(mktemp)
STRMAP=$(mktemp)
trap 'rm -f "$ERRLOG" "$FILELIST" "$SCANLIST" "$NPMBUF" "$REFLOWBUF" "$RAWBUF" \
      "$SRCLIST" "$SRCSCAN" "$DOCLINES" "$DOCMAP" "$DOCFLOW" "$DOCFLOWMAP" \
      "$STRLINES" "$STRMAP"' EXIT

refuse_if_incomplete() {
  [ -s "$ERRLOG" ] || return 0
  cat "$ERRLOG" >&2
  echo "" >&2
  # GNU grep >= 3.5 prints "grep: FILE: binary file matches" on STDERR with nothing on
  # stdout, so a match in input it cannot read as text arrives here rather than in the hit
  # list. Name that case, or the run reds blaming an I/O failure that never happened and
  # sends a reader hunting it. This branch only chooses the wording; every path exits 1.
  if grep -qi 'binary file' "$ERRLOG"; then
    echo "ERROR: check-no-internal-refs - the input named above MATCHED a banned pattern," >&2
    echo "       but grep classifies it as binary, so the hit has no line number. Treat it" >&2
    echo "       as a real violation, and repair the file's encoding (it should be UTF-8)." >&2
  fi
  if grep -qiv 'binary file' "$ERRLOG"; then
    echo "ERROR: check-no-internal-refs - the scan reported errors, so it did not read all" >&2
    echo "       of its input. Refusing to report green from an incomplete scan." >&2
  fi
  exit 1
}

fail_with_hits() {
  local what="$1" hits="$2"
  echo "$hits" >&2
  echo "" >&2
  echo "ERROR: check-no-internal-refs - internal project bookkeeping found in ${what}." >&2
  echo "       A consumer reads this surface. Item identifiers, phase and wave language," >&2
  echo "       ADR numbers and meta-repo paths belong in the changeset, CHANGELOG.md, the" >&2
  echo "       commit, the PR and the roadmap. Translate at the boundary: say what the" >&2
  echo "       software does and what changed." >&2
  echo "       When you strip an identifier off the FRONT of a line, repair the head too:" >&2
  echo "       drop a leading orphan parenthetical, strip leading punctuation, recapitalise." >&2
  echo "       Leaving the fragment behind is worse than the text it replaced." >&2
  echo "       Rule: documentation/conventions.md, 'No internal project bookkeeping on a" >&2
  echo "       public surface'." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Build the scan list
# ---------------------------------------------------------------------------
#
# `git ls-files` is relative to the working directory, so from a subdirectory it lists a
# subtree and the scan would report OK having skipped the rest of the surface. Anchor at
# the top level.
cd "$(git rev-parse --show-toplevel)"

# The public surface, as paths. Each is justified in the SCAN SURFACE note at the top.
SURFACE_PATHS=(README.md LICENSE docs-content)

# Every named surface path must still be tracked. Without this, renaming or deleting
# README.md makes the gate scan less and still print OK, which is the same silent-green
# failure the routes below close, arriving through the file list instead of through grep.
for p in "${SURFACE_PATHS[@]}"; do
  if [ -z "$(git ls-files -- "$p")" ]; then
    echo "ERROR: check-no-internal-refs - the public surface path '$p' is not tracked." >&2
    echo "       Either it was renamed or removed (update SURFACE_PATHS in this script," >&2
    echo "       deliberately), or the scan is about to cover less than it claims." >&2
    echo "       Refusing to report green from a shrunken surface." >&2
    exit 1
  fi
done

# DRIFT TRIPWIRE on the npm tarball. `files` in package.json decides what a consumer
# actually receives, so anything added there is new public surface this gate would not know
# about. Rather than let that pass silently, refuse until someone puts it in SURFACE_PATHS
# or names it below as deliberately excluded.
#
# EVERY entry is checked, not just the prose-looking ones. Filtering `files` down to
# `*.md`/`LICENSE` first would discard `dist` before checking, and so structurally could
# not see the tarball's largest prose payload: the compiled JSDoc in `dist/index.d.ts`. A
# tripwire that cannot see the thing it was built to catch is not a tripwire. The two
# standing exclusions are named with their reasons in SCAN SURFACE above: `CHANGELOG.md`
# (contested, queued) and `dist` (untracked build output this script cannot read; its
# SOURCE is gated by the third pass instead).
command -v node >/dev/null || {
  echo "ERROR: check-no-internal-refs - node is required (to read package.json) and is not" >&2
  echo "       on PATH. Refusing to skip the npm-surface half of this gate." >&2
  exit 1
}
UNKNOWN_TARBALL_DOCS=$(node -e '
  const pkg = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
  // Scanned by this gate:            README.md, LICENSE
  // Excluded deliberately, reasons in SCAN SURFACE: CHANGELOG.md, dist
  const known = new Set(["README.md", "LICENSE", "CHANGELOG.md", "dist"]);
  process.stdout.write((pkg.files ?? []).filter((f) => !known.has(f)).join(" "));
')
if [ -n "$UNKNOWN_TARBALL_DOCS" ]; then
  echo "ERROR: check-no-internal-refs - package.json 'files' ships something this gate does" >&2
  echo "       not cover: $UNKNOWN_TARBALL_DOCS" >&2
  echo "       That is public surface a consumer receives in the tarball. Add it to" >&2
  echo "       SURFACE_PATHS, or record it as a deliberate exclusion in this script." >&2
  exit 1
fi

git ls-files -z -- "${SURFACE_PATHS[@]}" > "$FILELIST"

if [ ! -s "$FILELIST" ]; then
  echo "ERROR: check-no-internal-refs - no tracked public-surface files to scan. Refusing" >&2
  echo "       to report green from a scan that read nothing." >&2
  exit 1
fi

# THE SILENT-GREEN ROUTES, all closed here. This list is NOT a claim of exhaustiveness:
# route (9) was found by a refuter against an hl7 copy whose own comment implied it was
# already complete.
#
#   (1) THE SCANNER CANNOT SEE. Closed by the locale pin and the positive self-tests
#       above, plus the negative self-tests, which are stronger than the em-dash gate's
#       single sample: they also catch a rule widened into the trap (1) shape.
#   (2) AN EMPTY FILE LIST. `xargs` without `-r` runs grep anyway, and grep with no file
#       operand reads STDIN, finds nothing, and exits 0. Closed by `-r` AND by refusing an
#       empty list outright, above and again after the loop.
#   (3) `git ls-files` FAILS (unreadable or corrupt index) AND ITS STATUS IS ERASED. The
#       list is built as its OWN command, not as the head of the pipeline: piped, its
#       status is swallowed by the `|| true` the no-match case needs, and the scan reports
#       OK over an empty list.
#   (4) A PATH THE SCANNER NEVER RECEIVES. `git ls-files` C-quotes any path holding a
#       space, a quote or a non-ASCII byte, so unseparated, grep is handed a name no file
#       has. Closed by `-z` here and `-0` on xargs.
#   (5) A FILENAME PARSED AS AN OPTION. A tracked file named `-q` would silence the whole
#       batch and the gate would print OK. Closed by `-e` before the pattern and `--`
#       after it.
#   (6) A FILENAME READ AS STANDARD INPUT, which `--` does NOT close. `--` stops `-` being
#       parsed as an OPTION; grep then reads the bare operand `-` as STDIN, and xargs
#       points its child's stdin at /dev/null, so a tracked file literally named `-` (a
#       `cmd > -` typo, which `git add -A` stages without complaint) is NEVER OPENED and
#       the gate prints OK and exits 0 over a live violation. Closed by `./`-prefixing
#       every path AS THE LIST IS BUILT, in the loop below rather than through `sed -z`, so
#       the scan stays a single command with the stderr capture bound to all of it and
#       there is no GNU-only stage that has no self-test of its own.
#       BE PRECISE ABOUT REACHABILITY: grep treats only a BARE `-` operand as stdin, and
#       every path this gate scans is emitted by `git ls-files` under a listed surface
#       path. None of those is the repo root today, so the worst a file named `-` can
#       produce is `docs-content/-`, which grep opens normally. The route becomes live the
#       moment SURFACE_PATHS gains a root-level glob or `.`. The prefix is therefore kept
#       as the thing that makes widening the surface safe, not as decoration.
#   (7) AN UNREAD ENTRY THAT IS NOT A MISSED MATCH. `-d skip` silently skips a tracked
#       symlink to a directory: no stderr, so nothing refuses, and the gate goes green
#       having never opened it. `-d skip` is NOT used. The loop refuses a tracked entry
#       that is not a regular file BY NAME instead, which is louder. The `! -L` guard
#       matters: `-d` follows symlinks, so a symlink to a directory tests true and would
#       be skipped as if it were a gitlink.
#   (8) A SCAN THAT DIED PART WAY THROUGH AND REPORTED CLEAN. grep's exit status cannot
#       distinguish that from no-match. Closed by capturing stderr and refusing on any of
#       it; see refuse_if_incomplete.
#   (9) A VIOLATION THAT STRADDLES A LINE WRAP. Not inherited from the em-dash family at
#       all: that gate matches a single character, so line anchoring costs it nothing.
#       Every rule here except the bare identifier is multi-token, and this repo hard-wraps
#       its markdown, so a phase sentence broken across two lines reads perfectly on the
#       rendered page and is invisible to a line scan. Closed by the paragraph-joined
#       second pass at the bottom of this file.
#
# Also, and not a route so much as a standing choice: NO `-I`. `-I` skips anything grep's
# heuristic calls binary, which includes a genuine TEXT file with a broken encoding, so a
# violation inside one would be skipped in silence. This repo's public surface is markdown
# and JSON with no binaries (checked: no tracked file under it holds a NUL byte), so losing
# `-I` makes a future binary a loud red instead of a silent miss. Fail closed, not open.
# `-H` is set so every hit carries its filename: grep omits the name when handed exactly
# one file, which an xargs batch boundary can produce.
: > "$SCANLIST"
gitlinks=0
scanned=0
while IFS= read -r -d '' f; do
  if [ -d "$f" ] && [ ! -L "$f" ]; then
    gitlinks=$((gitlinks + 1))
    continue
  fi
  if [ ! -r "$f" ]; then
    echo "ERROR: check-no-internal-refs - tracked file is not readable: $f" >&2
    echo "       Refusing to report green from a scan that could not open its input." >&2
    exit 1
  fi
  if [ ! -f "$f" ]; then
    echo "ERROR: check-no-internal-refs - tracked entry is not a regular file: $f" >&2
    echo "       Refusing to report green from a scan that skipped one of its inputs." >&2
    exit 1
  fi
  printf './%s\0' "$f" >> "$SCANLIST"
  scanned=$((scanned + 1))
done < "$FILELIST"

if [ ! -s "$SCANLIST" ]; then
  echo "ERROR: check-no-internal-refs - no public-surface files survived list building." >&2
  echo "       Refusing to report green from a scan that read nothing." >&2
  exit 1
fi

# The npm metadata is public surface that is not a file of its own. Extract the two fields
# the convention names and scan them as text. Written with a real newline between fields so
# a hit reports a usable line number.
node -e '
  const pkg = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
  const lines = ["description: " + (pkg.description ?? ""), "keywords: " + (pkg.keywords ?? []).join(", ")];
  process.stdout.write(lines.join("\n") + "\n");
' > "$NPMBUF"
if [ ! -s "$NPMBUF" ]; then
  echo "ERROR: check-no-internal-refs - could not read the npm metadata from package.json." >&2
  echo "       Refusing to report green from a scan that read nothing." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Scan, one rule at a time so a hit can name the rule it broke
# ---------------------------------------------------------------------------
#
# Each rule is its own single command with its own stderr capture, rather than one merged
# pattern: a merged pattern cannot report WHICH rule fired, and "phase language" and
# "internal identifier" want different remediation advice. The cost is N passes over a
# handful of markdown files, which is nothing.
ALL_HITS=""
i=0
while [ "$i" -lt "$RULE_COUNT" ]; do
  : > "$ERRLOG"
  HITS=$(xargs -0 -r grep -H -nP -e "${RULE_PATTERN[$i]}" -- < "$SCANLIST" 2>>"$ERRLOG" || true)
  refuse_if_incomplete

  : > "$ERRLOG"
  NPM_HITS=$(grep -H -nP -e "${RULE_PATTERN[$i]}" -- "$NPMBUF" 2>>"$ERRLOG" || true)
  refuse_if_incomplete
  # Report the npm metadata under a name a reader can act on, not a temp path.
  [ -n "$NPM_HITS" ] && NPM_HITS=$(printf '%s\n' "$NPM_HITS" | sed "s|^${NPMBUF}|package.json (npm metadata)|")

  for block in "$HITS" "$NPM_HITS"; do
    [ -n "$block" ] || continue
    ALL_HITS="${ALL_HITS}[${RULE_NAME[$i]}]"$'\n'"${block}"$'\n'
  done
  i=$((i + 1))
done

# ---------------------------------------------------------------------------
# Second pass: the same rules over PARAGRAPH-JOINED text
# ---------------------------------------------------------------------------
#
# WHY THIS EXISTS. Every rule above except the bare identifier is MULTI-TOKEN (`phase X`,
# `wave N`, `this slice`, `roadmap phase K`), grep matches within a line, and this repo
# hard-wraps its markdown by house style. So a violation that happens to straddle a wrap is
# invisible to the line scan, while a reader of the rendered page sees it plainly, because
# markdown folds a soft line break into a space. In the hl7 copy this was not hypothetical:
# a spec-notes page read "... A future phase" / "may add opt-in decode ...", and the gate
# printed OK over it.
#
# So the file is joined the way markdown renders it (consecutive non-blank lines in a
# paragraph become one line, blank lines stay blank) and scanned again. Line numbers are
# lost by construction, so this pass reports the FILE and the MATCHED TEXT, and it reports
# only matches the line pass did not already produce, which keeps a wrapped hit from being
# printed twice in the same run.
#
# It cannot replace the line pass: that one gives line numbers, which is what a remediator
# actually needs. It is additive, and its cost is a second grep per file per rule over a
# handful of markdown files.
while IFS= read -r -d '' f; do
  # WHITESPACE IS SQUEEZED, and that is the whole difference between this pass working and
  # this pass looking as though it works. Joining lines verbatim leaves the continuation
  # line's own indentation in the joined text: an indented wrap produces `phase   may`, and
  # every rule here is written with single spaces, so it does not match. Indented
  # continuations are the DOMINANT wrap shape in this corpus, because the pages are mostly
  # bulleted, so the pass would miss the very case it was added for while reporting that it
  # had run. Squeezing runs of whitespace to one space is also what markdown itself does to
  # a paragraph, so this models the rendered page rather than approximating it.
  : > "$ERRLOG"
  awk '
    /^[[:space:]]*$/ { print ""; next }
    { line = $0; gsub(/[[:space:]]+/, " ", line); sub(/^ /, "", line); printf "%s ", line }
    END { print "" }
  ' "$f" > "$REFLOWBUF" 2>>"$ERRLOG"
  refuse_if_incomplete

  i=0
  while [ "$i" -lt "$RULE_COUNT" ]; do
    : > "$ERRLOG"
    grep -oP -e "${RULE_PATTERN[$i]}" -- "$f" > "$RAWBUF" 2>>"$ERRLOG" || true
    refuse_if_incomplete

    : > "$ERRLOG"
    FLOW_HITS=$(grep -oP -e "${RULE_PATTERN[$i]}" -- "$REFLOWBUF" 2>>"$ERRLOG" || true)
    refuse_if_incomplete

    if [ -n "$FLOW_HITS" ]; then
      # Only what the line pass could not see. An empty RAWBUF means no line-pass match, and
      # `grep -f` with no patterns selects nothing, so -v then keeps every wrapped hit.
      EXTRA=$(printf '%s\n' "$FLOW_HITS" | grep -Fxv -f "$RAWBUF" | sort -u || true)
      if [ -n "$EXTRA" ]; then
        while IFS= read -r m; do
          [ -n "$m" ] || continue
          ALL_HITS="${ALL_HITS}[${RULE_NAME[$i]} / wrapped across lines]"$'\n'"${f}: ${m}"$'\n'
        done <<< "$EXTRA"
      fi
    fi
    i=$((i + 1))
  done
done < "$SCANLIST"

# ---------------------------------------------------------------------------
# THIRD PASS: `src/` DOC COMMENTS, the prose that compiles into `dist/`
# ---------------------------------------------------------------------------
#
# THE CEILING, STATED FIRST, because it is the honest frame for everything below.
# `dist/` is UNTRACKED BUILD OUTPUT. No checked-in gate can scan it without building
# first, and this script deliberately does not build. So the thing a consumer actually
# receives is NOT what is checked here. What is checked is its SOURCE: the `/** */`
# blocks the dts build copies verbatim. That is a PROXY, and it is a good one only
# because the copy is verbatim -- tsup rewrites declarations, not doc text. A rewrite of
# the build that started transforming comments would silently decouple the two, and
# nothing here would notice. This pass therefore raises the floor on `dist/`; it does not
# observe `dist/`.
#
# Two consequences worth naming rather than discovering:
#   * A doc comment that never reaches an exported declaration is swept anyway. That is
#     deliberate: which comments survive the dts rollup is a property of the BUILD, not of
#     the source, and gating on it would make the gate's answer depend on tsup's inlining
#     decisions. It matters more here than in a single-entry package: this one has four
#     entry points (`.`, `/hl7`, `/fhir`, `/ccda`, `/x12`, `/ncpdp`, `/astm`, `/deid`), so
#     "does it reach a declaration file" is eight questions, not one.
#   * `dist/*.d.cts` is the same text as `dist/*.d.ts`, so one clean source covers both
#     conditions.

# The `src/` surface must still be tracked, for the same reason SURFACE_PATHS is checked:
# a rename that empties this list must red, not shrink the scan in silence.
git ls-files -z -- 'src/*.ts' 'src/**/*.ts' > "$SRCLIST"
if [ ! -s "$SRCLIST" ]; then
  echo "ERROR: check-no-internal-refs - no tracked src/*.ts files to scan for doc" >&2
  echo "       comments. Either the source moved (update this pass, deliberately) or the" >&2
  echo "       scan is about to cover less than it claims. Refusing to report green." >&2
  exit 1
fi

# Same list-building discipline as the public-surface pass: `./`-prefixed as the list is
# built (route 6), a non-regular-file entry refused by name rather than skipped (route 7),
# an unreadable entry refused (not silently missed).
: > "$SRCSCAN"
src_scanned=0
while IFS= read -r -d '' f; do
  if [ -d "$f" ] && [ ! -L "$f" ]; then continue; fi
  if [ ! -r "$f" ]; then
    echo "ERROR: check-no-internal-refs - tracked source file is not readable: $f" >&2
    echo "       Refusing to report green from a scan that could not open its input." >&2
    exit 1
  fi
  if [ ! -f "$f" ]; then
    echo "ERROR: check-no-internal-refs - tracked source entry is not a regular file: $f" >&2
    echo "       Refusing to report green from a scan that skipped one of its inputs." >&2
    exit 1
  fi
  printf './%s\0' "$f" >> "$SRCSCAN"
  src_scanned=$((src_scanned + 1))
done < "$SRCLIST"

if [ ! -s "$SRCSCAN" ]; then
  echo "ERROR: check-no-internal-refs - no source files survived list building." >&2
  echo "       Refusing to report green from a scan that read nothing." >&2
  exit 1
fi

# EXTRACT THE DOC COMMENTS. Two buffers per pass, and the reason for the second one is
# line numbers: the rules must run over doc text ALONE (so a rule cannot match a line
# number, a path, or the code on the far side of a `*/`), which means the location has to
# travel beside the text rather than inside it. DOCLINES holds one doc line of text per
# line; DOCMAP holds `file:lineno` at the SAME line index. A hit at index N in one is
# located by index N in the other.
#
# The leaders are stripped the way an IDE strips them: `/**`, a leading `*`, and `*/`
# disappear, because none of them is part of what the reader sees on hover. `//` and
# plain `/* */` are NOT extracted -- see the boundary argument at SRC_RULE_NAME above.
: > "$DOCLINES"; : > "$DOCMAP"; : > "$DOCFLOW"; : > "$DOCFLOWMAP"
: > "$ERRLOG"
while IFS= read -r -d '' f; do
  awk -v file="$f" -v dl="$DOCLINES" -v dm="$DOCMAP" -v df="$DOCFLOW" -v dfm="$DOCFLOWMAP" '
    function emit() {
      gsub(/[[:space:]]+/, " ", joined); sub(/^ /, "", joined); sub(/ $/, "", joined)
      if (joined != "") { print joined >> df; print file ":" blockstart >> dfm }
      joined = ""
    }
    # End of a paragraph inside a block: emit it, keep the block open, keep reporting the
    # location as the block start (a paragraph index would be a number no reader can use).
    function flush2() { if (blockstart > 0) emit() }
    # End of the block.
    function flush() { if (blockstart > 0) emit(); blockstart = 0 }
    {
      line = $0
      if (!indoc) {
        if (line !~ /^[[:space:]]*\/\*\*/) { next }
        indoc = 1; blockstart = FNR; joined = ""
        sub(/^[[:space:]]*\/\*\*/, "", line)
      }
      # THE TERMINATOR IS TESTED BEFORE THE LEADER IS STRIPPED, and that ordering is the
      # whole correctness of this extractor. Stripping first turns a closing " */" into
      # "/" (the leader pattern eats the asterisk of the terminator), the block never
      # closes, and every `//` comment and line of CODE after it is scanned as doc text.
      # That is not hypothetical: it is what the first draft of the hl7 pass did, and it
      # reported 60 violations that were all real bookkeeping sitting in `//` comments
      # this surface deliberately does not cover. A gate that over-reports is not "safe":
      # it would have forced a sweep of the wrong lines.
      # TESTING THE TERMINATOR AGAINST DOC TEXT IS CORRECT, NOT A SHORTCUT: a doc comment
      # whose prose contains `*/` (a glob like `src/**/*.ts`, a regex ending `*/`) would
      # close the block early and drop the rest of it from the scan. THE CONSTRUCT IS
      # UNREACHABLE IN VALID TYPESCRIPT: block comments do not nest and cannot contain
      # `*/`, so the compiler ends the comment at exactly the same character this does,
      # and `typecheck` runs ahead of this gate on the ladder. The extractor mirrors the
      # language; it does not approximate it.
      closed = 0
      if (line ~ /\*\//) { closed = 1; sub(/\*\/.*$/, "", line) }
      # Exactly ONE leading asterisk, never `\*+`: a greedy leader would swallow the
      # opening `**` of markdown bold ("* **Fail-safe:**") and alter the scanned text.
      sub(/^[[:space:]]*\*[[:space:]]?/, "", line)
      sub(/^[[:space:]]+/, "", line)
      # The LINE pass sees the doc text with its location beside it.
      print line >> dl; print file ":" FNR >> dm
      # The FLOW pass accumulates a PARAGRAPH, not the whole block, and squeezes it the way
      # a tooltip reflows one. A BLANK doc line is a paragraph break and ends the run, for
      # the same reason the markdown pass above prints an empty line rather than joining
      # through it: a list item ending "(this module)" followed by a blank line and a new
      # sentence starting "The ..." is not the text "(this module) The ...", and joining
      # through the break invents adjacencies that no reader ever sees. Left unbroken, a
      # doc line ending in "phase" followed by a blank line and a paragraph opening with a
      # capital letter would red as "phase X". That is an over-report rather than a silent
      # green, but a gate that reds on correct content is a gate someone deletes.
      if (line ~ /^[[:space:]]*$/) { flush2() } else { joined = joined " " line }
      if (closed) { flush(); indoc = 0 }
    }
    END { if (indoc) flush() }
  ' "$f" 2>>"$ERRLOG"
done < "$SRCSCAN"
refuse_if_incomplete

# An extraction that produced nothing from a non-empty, JSDoc-heavy source tree means the
# extractor broke, not that the tree is clean. Same class as the empty-file-list refusal.
if [ ! -s "$DOCLINES" ]; then
  echo "ERROR: check-no-internal-refs - extracted no doc-comment text from ${src_scanned}" >&2
  echo "       tracked source file(s). Every public export in this package carries JSDoc," >&2
  echo "       so an empty extraction means the extractor is broken, not that the source" >&2
  echo "       is clean. Refusing to report green from a scan that read nothing." >&2
  exit 1
fi

# SCAN. Line pass first (it can name a file and a line), then the reflowed pass for
# violations that straddle a wrap. Wraps are not hypothetical here either: this package's
# doc comments are wrapped at the same column as its markdown, and a sentence ending
# "... this" / "phase models" is exactly as invisible to a line scan in JSDoc as it is in
# markdown. The reflow models a hover tooltip: whitespace squeezed, `*` leaders already
# gone.
SRC_HITS=""
i=0
while [ "$i" -lt "$SRC_RULE_COUNT" ]; do
  : > "$ERRLOG"
  LINE_IDX=$(grep -nP -e "${SRC_RULE_PATTERN[$i]}" -- "$DOCLINES" 2>>"$ERRLOG" | cut -d: -f1 || true)
  refuse_if_incomplete
  if [ -n "$LINE_IDX" ]; then
    while IFS= read -r n; do
      [ -n "$n" ] || continue
      loc=$(sed -n "${n}p" "$DOCMAP")
      txt=$(sed -n "${n}p" "$DOCLINES")
      SRC_HITS="${SRC_HITS}[${SRC_RULE_NAME[$i]} / src doc comment]"$'\n'"${loc}: ${txt}"$'\n'
    done <<< "$LINE_IDX"
  fi

  : > "$ERRLOG"
  FLOW_IDX=$(grep -nP -e "${SRC_RULE_PATTERN[$i]}" -- "$DOCFLOW" 2>>"$ERRLOG" | cut -d: -f1 || true)
  refuse_if_incomplete
  if [ -n "$FLOW_IDX" ]; then
    while IFS= read -r n; do
      [ -n "$n" ] || continue
      # Report only what the line pass could not see, so a wrapped hit is not printed
      # twice. A block whose violation is on one line is already reported above.
      blockloc=$(sed -n "${n}p" "$DOCFLOWMAP")
      # DELIMITED, not a bare substring. An unanchored `*"$blockloc"*` makes
      # `./src/x.ts:1` a substring of an existing hit at `./src/x.ts:12`, so a real wrapped
      # violation in the block starting at line 1 is suppressed by an unrelated hit at
      # line 12. It never loses the RED (SRC_HITS is non-empty either way) but it loses the
      # REPORT, which is the line a remediator needs. The trailing ':' is what a location
      # is always followed by in SRC_HITS.
      case "$SRC_HITS" in
        *"${blockloc}: "*|*"${blockloc} (block): "*) continue ;;
      esac
      m=$(sed -n "${n}p" "$DOCFLOW" | grep -oP -e "${SRC_RULE_PATTERN[$i]}" | head -1)
      SRC_HITS="${SRC_HITS}[${SRC_RULE_NAME[$i]} / src doc comment, wrapped across lines]"$'\n'"${blockloc} (block): ${m}"$'\n'
    done <<< "$FLOW_IDX"
  fi
  i=$((i + 1))
done

# ---------------------------------------------------------------------------
# FOURTH PASS: `src/` STRING LITERALS, the prose that reaches a consumer's LOG
# ---------------------------------------------------------------------------
#
# The argument for this pass, the measurement behind it, and its four stated boundaries
# are at STR_RULE_NAME above. In short: a parser's warning messages are read more often
# than its README, they are neither markdown nor doc comments, and six of them carried
# "this phase" into a consumer's log until this pass was written.
#
# The extractor keeps text ONLY, never the quotes, and records `file:line` beside each
# extracted line in the same index-aligned way the doc-comment pass does. Several literals
# on one source line are joined with a space, which is safe because a rule that matched
# across the join would have to span two adjacent literals in one expression; measured
# zero such matches, and an over-report there is a maintainer reading one line.
: > "$STRLINES"; : > "$STRMAP"
: > "$ERRLOG"
while IFS= read -r -d '' f; do
  awk -v file="$f" -v sl="$STRLINES" -v sm="$STRMAP" '
    # Whole-line comments are skipped: the doc-comment pass owns `/** */`, and `//` is
    # deliberately out of scope for this gate. Matches `//`, `/*`, `/**` and a ` *`
    # continuation line.
    /^[[:space:]]*(\/\/|\/\*|\*)/ { next }
    {
      line = $0
      out = ""
      while (match(line, /"([^"\\]|\\.)*"|`([^`\\]|\\.)*`/)) {
        out = out " " substr(line, RSTART + 1, RLENGTH - 2)
        line = substr(line, RSTART + RLENGTH)
      }
      if (out != "") { print out >> sl; print file ":" FNR >> sm }
    }
  ' "$f" 2>>"$ERRLOG"
done < "$SRCSCAN"
refuse_if_incomplete

# A source tree this size cannot contain zero string literals. An empty extraction means
# the extractor broke, not that the tree is clean; same class as every other refusal here.
if [ ! -s "$STRLINES" ]; then
  echo "ERROR: check-no-internal-refs - extracted no string literals from ${src_scanned}" >&2
  echo "       tracked source file(s). This package's warning messages, warning codes and" >&2
  echo "       import specifiers are all string literals, so an empty extraction means the" >&2
  echo "       extractor is broken, not that the source is clean. Refusing to report green" >&2
  echo "       from a scan that read nothing." >&2
  exit 1
fi

STR_HITS=""
i=0
while [ "$i" -lt "$STR_RULE_COUNT" ]; do
  : > "$ERRLOG"
  STR_IDX=$(grep -nP -e "${STR_RULE_PATTERN[$i]}" -- "$STRLINES" 2>>"$ERRLOG" | cut -d: -f1 || true)
  refuse_if_incomplete
  if [ -n "$STR_IDX" ]; then
    while IFS= read -r n; do
      [ -n "$n" ] || continue
      loc=$(sed -n "${n}p" "$STRMAP")
      txt=$(sed -n "${n}p" "$STRLINES")
      STR_HITS="${STR_HITS}[${STR_RULE_NAME[$i]} / src string literal]"$'\n'"${loc}:${txt}"$'\n'
    done <<< "$STR_IDX"
  fi
  i=$((i + 1))
done

[ -n "$ALL_HITS" ] && fail_with_hits "the public surface listed above" "$ALL_HITS"
[ -n "$SRC_HITS" ] && fail_with_hits "src/ doc comments, which compile into dist/ and render in every consumer's editor" "$SRC_HITS"
[ -n "$STR_HITS" ] && fail_with_hits "src/ string literals, which reach a consumer as warning and error message text" "$STR_HITS"

echo "check-no-internal-refs: OK (${scanned} public-surface file(s) and the npm metadata scanned against ${RULE_COUNT} rules, line by line and paragraph-joined; ${src_scanned} source file(s) scanned against ${SRC_RULE_COUNT} rules for doc-comment bookkeeping, line by line and paragraph-reflowed, and against ${STR_RULE_COUNT} rules for string-literal bookkeeping; ${gitlinks} gitlink(s) skipped)"
