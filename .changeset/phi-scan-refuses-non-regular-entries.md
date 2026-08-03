---
"@cosyte/synth": patch
---

The PHI scanner no longer reads a symbolic link as clean. A link under a scan root pointing at a
PHI-bearing file passed both enumerating routes — the working-tree walk collected regular files
only, and the staged route read a link's blob, which git stores as the target path under mode
`120000`. An in-scope entry that is not a regular file now refuses the scan, naming each offender's
own path and an engine-owned word for its kind, never the link target. The full rule and its
evidence are stated once, in `scripts/phi-scan.ts`.
