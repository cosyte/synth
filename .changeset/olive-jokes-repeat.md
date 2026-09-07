---
"@cosyte/synth": patch
---

Seed determinism is now verified ACROSS Node majors, not just twice inside one process. Until now every determinism assertion in this repository generated the same seed twice in a single Node process and compared the two, and a single process cannot disagree with itself about the engine it is running on. A change in the JavaScript engine that shifted number formatting, sort stability or key order between Node majors would have landed with every check green, while a consumer's committed golden file quietly stopped matching.

On every change, a declared seed corpus covering all six formats is now generated in its own job on **Node 22 and on Node 24**, each job carries out one digest per `(format, seed)` pair and nothing else, and a third job fails the build if the two engines disagree. A mismatch is reported by seed, format and engine identity; the differing bytes are never printed, because the corpus is reproducible from the seed. There is no tolerance on a digest, no warning-only mode and no suppression list. Taking a pair out of the compared set means naming it and its reason in a committed declaration, which every report republishes.

Each per-engine run is also measured against a **committed baseline** for the current compatibility window, so a toolchain or dependency change that moves every engine together, the one thing a cross-engine comparison is blind to, is caught as well. That baseline cannot change without a release declaring a breaking change, so a golden fixture pinned to a version inside the window keeps matching.

`docs-content/limitations.md` now states which Node majors the seed-to-bytes mapping is verified byte-identical across, that the verification is a digest comparison across separate runs, and that a change to that mapping is released as a breaking change.

Nothing about what the generator emits changed. Same seeds, same bytes.
