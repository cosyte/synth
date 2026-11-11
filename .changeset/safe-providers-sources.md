---
"@cosyte/synth": patch
---

A generator falls back to loading a parser by name only where `import.meta.resolve` throws the error Deno's test runner throws (`TypeError: Invalid arguments`), or answers with a URL that is not a `file:` URL. Before, any error from resolving fell back, so on Node.js a resolve that failed for another reason could load the CommonJS copy of a parser, whose classes `instanceof` does not recognize. Now that error is thrown as it is. A caller changes nothing.

The synthetic-safety providers are now tested against the published ranges they cite, and two of them read more simply with the same results. `isSyntheticPhone` checks that the number's digits end in `55501NN` with one pattern where it used two, and gives the same answer for every input. `ssn(rng, block?)` declares its second parameter optional instead of giving it a default; leaving it out still draws the never-issued space, and its type is unchanged. Generated output is unchanged.
