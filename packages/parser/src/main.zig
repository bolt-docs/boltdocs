const std = @import("std");
const builtin = @import("builtin");
const parser = @import("parser.zig");

/// Appends a JSON-escaped representation of a string to the list.
fn appendEscapedJsonString(list: *std.ArrayList(u8), allocator: std.mem.Allocator, s: []const u8) !void {
    try list.append(allocator, '"');
    for (s) |c| {
        switch (c) {
            '\\' => try list.appendSlice(allocator, "\\\\"),
            '"' => try list.appendSlice(allocator, "\\\""),
            '\n' => try list.appendSlice(allocator, "\\n"),
            '\r' => try list.appendSlice(allocator, "\\r"),
            '\t' => try list.appendSlice(allocator, "\\t"),
            else => {
                if (c < 0x20) {
                    var buf: [16]u8 = undefined;
                    const formatted = try std.fmt.bufPrint(&buf, "\\u{x:0>4}", .{c});
                    try list.appendSlice(allocator, formatted);
                } else {
                    try list.append(allocator, c);
                }
            },
        }
    }
    try list.append(allocator, '"');
}

/// Checks if any segment of the relative path starts with "_" (excluding "_index.md" and "_index.mdx")
fn shouldExcludePath(rel_path: []const u8) bool {
    var it = std.mem.tokenizeAny(u8, rel_path, "/\\");
    while (it.next()) |segment| {
        if (std.mem.startsWith(u8, segment, "_")) {
            if (!std.mem.eql(u8, segment, "_index.md") and !std.mem.eql(u8, segment, "_index.mdx")) {
                return true;
            }
        }
    }
    return false;
}

const FileTask = struct {
    path: []const u8,
    doc: ?parser.ParsedDoc = null,
    err: ?anyerror = null,
};

const WorkerContext = struct {
    allocator: std.mem.Allocator,
    docs_dir: []const u8,
    dir: std.Io.Dir,
    init: std.process.Init,
    tasks: []FileTask,
    next_task_idx: *std.atomic.Value(usize),
    turbo: bool,
};

fn workerFn(context: WorkerContext, thread_idx: usize, arena: *std.heap.ArenaAllocator) void {
    _ = thread_idx;
    const arena_allocator = arena.allocator();
    while (true) {
        const idx = context.next_task_idx.fetchAdd(1, .monotonic);
        if (idx >= context.tasks.len) break;

        const task = &context.tasks[idx];

        const file = context.dir.openFile(context.init.io, task.path, .{}) catch |err| {
            task.err = err;
            continue;
        };
        defer file.close(context.init.io);

        var read_tmp_buf: [4096]u8 = undefined;
        var r = file.reader(context.init.io, &read_tmp_buf);
        const file_content = r.interface.allocRemaining(arena_allocator, .unlimited) catch |err| {
            task.err = err;
            continue;
        };

        const doc = if (context.turbo)
            parser.parseDocSinglePass(arena_allocator, file_content) catch |err| {
                task.err = err;
                continue;
            }
        else
            parser.parseDoc(arena_allocator, file_content) catch |err| {
                task.err = err;
                continue;
            };

        task.doc = doc;
    }
}

pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;

    var args_it = try init.minimal.args.iterateAllocator(allocator);
    defer args_it.deinit();

    var docs_dir: ?[]const u8 = null;
    var turbo = false;

    _ = args_it.skip();

    while (args_it.next()) |arg| {
        if (std.mem.eql(u8, arg, "--dir")) {
            if (args_it.next()) |val| {
                docs_dir = try allocator.dupe(u8, val);
            }
        } else if (std.mem.eql(u8, arg, "--turbo")) {
            turbo = true;
        }
    }
    defer if (docs_dir) |d| allocator.free(d);

    if (docs_dir == null) {
        std.debug.print("Usage: bdocs-parser --dir <docs_directory> [--turbo]\n", .{});
        std.process.exit(1);
    }

    const is_cwd = std.mem.eql(u8, docs_dir.?, ".");
    var dir = if (is_cwd) std.Io.Dir.cwd() else try std.Io.Dir.cwd().openDir(init.io, docs_dir.?, .{ .iterate = true });
    defer if (!is_cwd) dir.close(init.io);

    var tasks = std.ArrayList(FileTask).empty;
    defer {
        for (tasks.items) |t| {
            allocator.free(t.path);
        }
        tasks.deinit(allocator);
    }

    var walker = try dir.walk(allocator);
    defer walker.deinit();

    while (try walker.next(init.io)) |entry| {
        if (entry.kind != .file) continue;

        const is_md = std.mem.endsWith(u8, entry.path, ".md") or std.mem.endsWith(u8, entry.path, ".mdx");
        if (!is_md) continue;

        if (shouldExcludePath(entry.path)) continue;

        const path_dup = try allocator.dupe(u8, entry.path);
        errdefer allocator.free(path_dup);

        try tasks.append(allocator, .{
            .path = path_dup,
        });
    }

    var next_task_idx = std.atomic.Value(usize).init(0);

    const use_threads = !builtin.single_threaded and builtin.cpu.arch != .wasm32;
    const cpu_count = if (use_threads) std.Thread.getCpuCount() catch 1 else 1;
    const num_threads = @max(@as(usize, 1), cpu_count);

    var thread_arenas = try allocator.alloc(std.heap.ArenaAllocator, num_threads);
    defer {
        for (thread_arenas) |*a| {
            a.deinit();
        }
        allocator.free(thread_arenas);
    }
    for (thread_arenas) |*a| {
        a.* = std.heap.ArenaAllocator.init(allocator);
    }

    const context = WorkerContext{
        .allocator = allocator,
        .docs_dir = docs_dir.?,
        .dir = dir,
        .init = init,
        .tasks = tasks.items,
        .next_task_idx = &next_task_idx,
        .turbo = turbo,
    };

    if (use_threads and num_threads > 1) {
        const spawn_limit = num_threads - 1;
        var threads = try allocator.alloc(std.Thread, spawn_limit);
        defer allocator.free(threads);

        var spawned_count: usize = 0;
        for (0..spawn_limit) |i| {
            threads[i] = std.Thread.spawn(.{}, workerFn, .{ context, i, &thread_arenas[i] }) catch |err| {
                std.debug.print("Warning: failed to spawn thread {}: {}\n", .{ i, err });
                break;
            };
            spawned_count += 1;
        }

        workerFn(context, spawn_limit, &thread_arenas[spawn_limit]);

        for (threads[0..spawned_count]) |t| {
            t.join();
        }
    } else {
        workerFn(context, 0, &thread_arenas[0]);
    }

    var output_list = std.ArrayList(u8).empty;
    defer output_list.deinit(allocator);

    try output_list.appendSlice(allocator, "{\n");
    var first_file = true;

    var print_arena = std.heap.ArenaAllocator.init(allocator);
    defer print_arena.deinit();
    const print_allocator = print_arena.allocator();

    for (tasks.items) |task| {
        if (task.err) |err| {
            const absolute_path = std.fs.path.resolve(print_allocator, &.{ docs_dir.?, task.path }) catch task.path;
            std.debug.print("Error parsing file {s}: {}\n", .{ absolute_path, err });
            continue;
        }

        const doc = task.doc orelse continue;

        if (!first_file) {
            try output_list.appendSlice(allocator, ",\n");
        }
        first_file = false;

        const absolute_path = try std.fs.path.resolve(print_allocator, &.{ docs_dir.?, task.path });

        const normalized_path = try print_allocator.dupe(u8, absolute_path);
        for (normalized_path) |*char| {
            if (char.* == '\\') char.* = '/';
        }

        try appendEscapedJsonString(&output_list, allocator, normalized_path);
        try output_list.appendSlice(allocator, ": {\n");

        try output_list.appendSlice(allocator, "  \"rawMatter\": ");
        try appendEscapedJsonString(&output_list, allocator, doc.rawMatter);
        try output_list.appendSlice(allocator, ",\n");

        try output_list.appendSlice(allocator, "  \"content\": ");
        try appendEscapedJsonString(&output_list, allocator, doc.content);
        try output_list.appendSlice(allocator, ",\n");

        try output_list.appendSlice(allocator, "  \"headings\": [\n");
        for (doc.headings, 0..) |h, h_idx| {
            if (h_idx > 0) try output_list.appendSlice(allocator, ",\n");

            try output_list.appendSlice(allocator, "    {\"level\": ");
            var level_buf: [16]u8 = undefined;
            const level_str = try std.fmt.bufPrint(&level_buf, "{}", .{h.level});
            try output_list.appendSlice(allocator, level_str);

            try output_list.appendSlice(allocator, ", \"text\": ");
            try appendEscapedJsonString(&output_list, allocator, h.text);

            try output_list.appendSlice(allocator, ", \"id\": ");
            try appendEscapedJsonString(&output_list, allocator, h.id);
            try output_list.appendSlice(allocator, "}");
        }
        try output_list.appendSlice(allocator, "\n  ],\n");

        try output_list.appendSlice(allocator, "  \"plainText\": ");
        try appendEscapedJsonString(&output_list, allocator, doc.plainText);
        try output_list.appendSlice(allocator, ",\n");

        try output_list.appendSlice(allocator, "  \"description\": ");
        try appendEscapedJsonString(&output_list, allocator, doc.description);
        try output_list.appendSlice(allocator, "\n}");

        _ = print_arena.reset(.retain_capacity);
    }

    try output_list.appendSlice(allocator, "\n}\n");

    try std.Io.File.stdout().writeStreamingAll(init.io, output_list.items);
}
