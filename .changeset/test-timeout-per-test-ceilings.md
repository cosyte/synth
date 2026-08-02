---
"@cosyte/synth": patch
---

The test suite no longer fails on a busy machine while the code under test is correct.

No published API changes. This is the project's own test harness.

A per-test timeout is a wall-clock budget, so it measures the machine as much as the code. These suites are CPU-bound — their running time is set by how much processor they actually get, not by the work the code does — so on a machine with few cores or other work in flight, the same correct code takes longer and the budget is simply the wrong question to ask. The two heaviest C-CDA sweeps ran within about 2x of the 10 s limit with a core to themselves; sharing one, they crossed it and reported a failure that reproduced nowhere else. A failure that means "the machine was busy" costs more than it saves, because the next real failure gets read as noise too.

- **The C-CDA quirk sweeps carry their own explicit ceilings.** They are the heaviest cases here — each builds a document, re-parses it bare, then parses it again under a profile, at the highest case count in the package — and the sibling C-CDA suites already had exactly this treatment. The case counts are unchanged: these sweeps are the intended-warning conformance contract, and trimming cases to fit a clock would weaken a correctness check to fix a scheduling problem.
- **The PHI-gate suite starts its subprocesses with `node`.** It runs the scanner as a real subprocess about 65 times, on purpose, so the full command-line path is exercised. That fixed start-up cost, not any assertion, was the bulk of the file's running time: measured on one box, 0.6 s per start against 2.1 s for the on-the-fly TypeScript runner, taking the file from roughly 145 s to 75 s. The scanner itself is untouched, and one test still starts it the original way and holds both invocations to the same verdict, so the substitution stays honest.

**The global timeout is unchanged, deliberately.** Raising it would have been the shorter fix and would have traded a false failure for a false pass — a genuinely stuck test would then sit for a minute before failing, instead of ten seconds.
