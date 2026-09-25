Split out of `CLAUDE.md` to keep that file inside its byte budget. The text below is unchanged.
A pointer written `notes#<section>` names a section of `agent-notes.md` beside this file.

## Standing disciplines (every change)

Mirrors the three disciplines in the meta-repo's `documentation/conventions.md`, and they bind here too:

1. **Documentation follows code**: a change to the public surface/stack/status isn't done until the
   docs are: this repo's docs content (`README.md`, `docs-content/`), the meta-repo
   `documentation/repos/synth.md` (bump its "last verified" date), and the `ecosystem-map.md`
   status table.
2. **Version + changelog**: a Changeset (`patch` on the `0.0.x` ladder) per meaningful change.
   **The changeset summary IS the changelog entry**, and `CHANGELOG.md` is generated output above
   `## Released before this file was generated`: `.changeset/config.json` names a `changelog`
   generator, so the release writes the version heading and the entry itself. **Do not hand-edit
   `CHANGELOG.md`, and never reintroduce a hand-maintained `[Unreleased]` heading**: one stood over
   this package's whole published history and shipped a tarball calling its own contents unreleased;
   with generation on, a release prepends ABOVE such a heading, which is worse. Only the H1 may sit
   above the first heading, and Changesets' Prettier pass stays ON here (derived, not copied):
   `notes#the-changelog-is-generated-by-the-release`. Gated by
   `test/scripts/changelog-generation.test.ts`. Renaming a stable warning code is a **breaking
   change**.
3. **Crew + knowledgebase loop**, if this parser's public API or warning codes change, flag/update
   the matching `crew` healthcare skill + the KB product doc.
4. **No internal project bookkeeping on a public surface** (founder directive, 2026-07-27). What a
   consumer reads (`README.md`, `docs-content/`, the npm `description`, a release body) says what the
   software does and what changed; identifiers, phase/wave language, ADR numbers, meta-repo paths and
   `roadmap §N` citations belong in the changeset, `CHANGELOG.md`, the commit, the PR and the
   roadmap. It is a **translation** at the boundary, not a deletion: **repair the head of a line you
   strip an identifier from**. Gated by `pnpm check:no-internal-refs`, which keys on known prefixes
   (**a new programme prefix must be added by hand**) and catches identifiers, not English sentences
   about our process, so the reviewer still owns half the rule.
   `notes#no-internal-project-bookkeeping-on-a-public-surface`.

   **`SYNTH` is BOTH our item prefix AND the marker this package writes into what it generates**
   (`SYNTH-FAC`, `SYNTH-LIS`, `SYNTH-ANALYZER`, the `SYNTH-`+10-digit NCPDP message id). The
   separation is the explicit `SYNTHETIC_FIXTURE_TOKEN` list in the gate, never a shape rule.
   **Never re-key the identifier rule on the `WORD-N` shape**, and never "resync" the prefix list
   with a sibling's copy without re-reading why `SYNTH` is PRESENT here and ABSENT from `ncpdp`'s.
   `notes#synth-is-both-our-item-prefix-and-a-marker-in-generated-output`.

   **Four surfaces, three different answers.** Browsable Markdown, npm metadata and `/** */` doc
   comments are **gated**; string literals are **gated too, and here they matter most: they are the
   bytes this package emits**; `//` and plain `/* */` comments are **not gated and identifiers are
   welcome in them**, because the convention says source comments are a place identifiers belong.
   **Do not justify this boundary from what reaches `dist/`**: effectively all of `src/` does, and
   two attempts to argue it that way in a sibling repo were false and both caught by a refuter. The
   line is not what reaches a consumer's disk but what a consumer is **shown**.
   `notes#four-surfaces-three-different-answers`.

   Two consequences: **removing a doc comment to satisfy the gate is a regression**, not a fix; and
   **when a stale claim is what carries the phase number, cut the sentence rather than reword it**:
   rewording leaves a falsehood standing in cleaner clothes. The gate cannot read `dist/`, so it
   gates the source of the published text, not the published text.
   `notes#two-consequences-doc-comments-and-stale-phase-claims`.

5. **No em dash, anywhere** (founder directive, 2026-07-24), **including commit messages**. Gated by
   `pnpm check:no-emdash` over every tracked file, its name, the gate script, and on a PR the title,
   body and commit messages. Rewrite with a comma, colon, period or **parentheses**; **never
   re-encode it**. Landed 2026-08-06 with the sweep (1,167 rewrites over 135 files).
   Full text and the sweep's own traps: `notes#no-em-dash-anywhere`. Two that gate what you change:
   - **The job is deliberately NOT a required context**: it reads the PR body, and Dependabot pastes
     the dependency's upstream release notes there. **Keep the exemption and its written reason, and
     never answer it with an actor `if:` on a required context** (that leaves the check PENDING, not
     red). **PR text is also the half no local hook can see, so check your own before you push.**
   - **Do not simplify two deliberate shapes.** The binary partition is a **declaration**
     (`git check-attr binary`, refused outside `vendor/`), never a NUL test and never `grep -I`,
     because a real UTF-8 source here holds a NUL and carried 14. And `CHANGELOG.md` is scanned
     **above** `## Released before this file was generated` rather than excluded, the archive below
     being a dated ship-log (128 deliberate survivors, and it fails closed).
