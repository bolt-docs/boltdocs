const std = @import("std");
const mem = std.mem;
const Allocator = mem.Allocator;

pub fn WorkerContext(comptime Task: type) type {
    return struct {
        allocator: Allocator,
        tasks: []Task,
        next_task_idx: *std.atomic.Value(usize),
    };
}

pub fn ThreadPool(comptime Task: type, comptime workerFn: fn (*WorkerContext(Task), usize, *std.heap.ArenaAllocator) void) struct {
    pub fn run(allocator: Allocator, tasks: []Task) void {
        const use_threads = !@import("builtin").single_threaded and @import("builtin").cpu.arch != .wasm32;
        const cpu_count = if (use_threads) std.Thread.getCpuCount() catch 1 else 1;
        const num_threads = @max(@as(usize, 1), cpu_count);

        // Per-thread arena allocators
        var thread_arenas = allocator.alloc(std.heap.ArenaAllocator, num_threads) catch return;
        defer {
            for (thread_arenas) |*a| {
                a.deinit();
            }
            allocator.free(thread_arenas);
        }
        for (thread_arenas) |*a| {
            a.* = std.heap.ArenaAllocator.init(allocator);
        }

        // Shared context
        var next_idx = std.atomic.Value(usize).init(0);
        const context = WorkerContext(Task){
            .allocator = allocator,
            .tasks = tasks,
            .next_task_idx = &next_idx,
        };

        if (use_threads and num_threads > 1) {
            const spawn_limit = num_threads - 1;
            var threads = allocator.alloc(std.Thread, spawn_limit) catch return;
            defer allocator.free(threads);

            var spawned_count: usize = 0;
            for (0..spawn_limit) |i| {
                threads[i] = std.Thread.spawn(
                    .{},
                    workerFn,
                    .{ context, i, &thread_arenas[i] },
                ) catch |err| {
                    std.debug.print("Warning: failed to spawn thread {}: {}\n", .{ i, err });
                    break;
                };
                spawned_count += 1;
            }

            // Main thread also works
            workerFn(context, spawn_limit, &thread_arenas[spawn_limit]);

            // Wait for all threads
            for (threads[0..spawned_count]) |t| {
                t.join();
            }
        } else {
            workerFn(context, 0, &thread_arenas[0]);
        }
    }
}{}
