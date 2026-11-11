# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). Changesets drives
the **version bump**, the **publish**, and the **release section in `CHANGELOG.md`** for
`@cosyte/synth`: a release writes its own version heading there from the changesets it consumed. So
**the changeset summary is the changelog entry**. Write it there and do not hand-edit
`CHANGELOG.md`, whose sections above `## Released before this file was generated` are generated
output.

Add a changeset for every meaningful change:

```bash
pnpm changeset
```

Every changeset is a **patch**. That is the rule for every Cosyte package: patch only, never
minor, never major, whatever the change does to the published package. A new export, a new option,
a fix, a documentation change and a breaking change are all released as a patch.

A patch that breaks a caller says so in its summary: what changed, and what a caller must change to
keep working. The version number alone tells a consumer nothing, so the summary has to.

One rule is enforced rather than chosen: a change to the committed determinism baseline has to be
stated. `pnpm run check:determinism-window` reads the changesets for this package for one section
per kind of change, each a paragraph that opens with its heading:

- `Output change:` names every format whose bytes moved or that gained a graded pair (`C-CDA`,
  `HL7 v2`, `FHIR`, `X12`, `NCPDP`, `ASTM`) and says what changed.
- `Corpus narrowed:` names every format that lost a graded pair and says why.
- `Window change:` names the new compatibility window.
- `Digest algorithm change:` names the new digest algorithm.
- `Artifact count change:` names the new number of artifacts digested per pair.

A name counts only as a whole word: `X12` inside `X125` names nothing, and `5` inside `5.5` is not
the count `5`. It refuses a change stated only in prose, and it refuses a major changeset that
carries no section: the version number is not the statement, the section is.

A new digest algorithm or artifact count moves every digest with no output moving, so across one
the check cannot compare outputs. Such a change must land by itself: the check refuses it when the
same change adds or removes a graded pair, moves the window, or touches `src/`, `package.json`,
`pnpm-lock.yaml` or `pnpm-workspace.yaml`. When it cannot read the changed paths from git, it
refuses a changeset for this package that carries any other section alongside it. Land the
re-digest first, then the other change against the new baseline.
