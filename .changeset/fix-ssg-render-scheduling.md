---
'@bdocs/ssg': patch
---

Fix a render scheduling bug that serialized page rendering across the worker pool.

Batches render sequentially inside a worker, and the batch was sized to the in-flight window (`workers * 2`). With six workers that meant a twelve-page serial job per worker, so the workers never interleaved and total wall time became roughly `ceil(pages / workers) * batchDuration`. Measured per-batch wait was a P50 of 21 seconds against a per-page render of 206ms — the queue, not the render, was the cost.

The default batch is now two pages, which keeps every worker fed with short jobs that the scheduler can interleave. On a 263-page build this dropped measured batch wait from a P50 of 21,180ms to 170ms and reduced the render phase from 75.3s to 63.1s on the same machine. An explicit `batchSize` is still honoured and still clamped to a minimum of two.

Also adds the per-batch wait to the build's benchmark output as a count plus P50/P95/max. The previous figure summed queue wait across concurrent batches, which double-counted overlapping time and reported 2,768,043ms for a 40s build.
