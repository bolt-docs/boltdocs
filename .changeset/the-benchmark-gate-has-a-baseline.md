---
'boltdocs': patch
---

The benchmark gate has a baseline, and knows what it measured.

`scripts/benchmarks/baseline.json` did not exist, so the gate in SPEC §2.2
could never run: it wrote a baseline on the first invocation and had nothing
to compare against afterwards. There is one now, and it records the machine it
came from — the CPU model, the core count, the memory and the Node version.

A build time is a property of the machine as much as of the code, so the gate
compares only what it can compare. On the machine the baseline came from it
enforces the threshold; on another machine it says the comparison is not
meaningful and exits without a verdict, rather than failing a build on
hardware.

The three tests that live outside a package — the benchmark helpers' — had no
configuration to run under: they used the global `describe` and `it` that
`globals: true` provides, and there was no config that set it. They were dead
files, written and never run. They run now.
