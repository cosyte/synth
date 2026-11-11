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

One rule is enforced rather than chosen: a change to the bytes a seed maps to has to be stated.
`pnpm run check:determinism-window` accepts a changeset whose body carries an `Output change:`
section, one paragraph, naming every format that moved (`C-CDA`, `HL7 v2`, `FHIR`, `X12`, `NCPDP`,
`ASTM`) and saying what changed. It refuses a changed mapping stated only in prose. The check also
accepts a major changeset, but we release patch only, so state the output change instead.
