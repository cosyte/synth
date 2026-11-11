---
"@cosyte/synth": patch
---

The synthetic-safety providers are now tested against the published ranges they cite, and two of them read more simply with the same results. `isSyntheticPhone` checks that the number's digits end in `55501NN` with one pattern where it used two, and gives the same answer for every input. `ssn(rng, block?)` declares its second parameter optional instead of giving it a default; leaving it out still draws the never-issued space, and its type is unchanged. Generated output is unchanged.
