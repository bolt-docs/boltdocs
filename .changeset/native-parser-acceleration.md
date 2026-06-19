---
"boltdocs": "patch"
"@bdocs/native": "patch"
---

feat(core,native): integrate high-performance native parser in Zig 0.16.0 to accelerate route generation

Introduces a compiled Zig binary (`bdocs-parser`) that crawls the documentation directory, extracts frontmatter, processes and sanitizes headings using the GitHub Slugger algorithm, and collects plain text for search indexing.

- **Speedup**: Replaced the JS-based worker-pool parser with a native Zig crawler/parser, resulting in a **10.5x speedup** on a 75-file dataset.
- **Cold Start Time**: Reduced from **3.67 seconds (3670ms)** down to **349.73ms** (a **90.5% build-time reduction**).
- **Zig 0.16.0 Compatibility**: Implemented using explicit allocator-driven structures (`std.ArrayList.empty`, `iterateAllocator`) and async-first standard library directory methods.
- **Robust Fallback**: Automatically falls back to the original JS-based worker pool parsing if the compiled binary is unavailable or unsupported on the host platform.
