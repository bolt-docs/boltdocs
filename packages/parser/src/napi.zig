const std = @import("std");
const builtin = @import("builtin");
const parser = @import("parser.zig");
const yaml = @import("yaml.zig");

/// Append a JSON-escaped string to the list.
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

/// Append a YAML value as JSON to the list.
fn appendYamlValue(list: *std.ArrayList(u8), allocator: std.mem.Allocator, value: yaml.Value) !void {
    switch (value) {
        .null_value => try list.appendSlice(allocator, "null"),
        .bool_value => |b| try list.appendSlice(allocator, if (b) "true" else "false"),
        .int_value => |i| {
            var buf: [64]u8 = undefined;
            const formatted = try std.fmt.bufPrint(&buf, "{}", .{i});
            try list.appendSlice(allocator, formatted);
        },
        .float_value => |f| {
            var buf: [64]u8 = undefined;
            if (std.math.isNan(f) or std.math.isInf(f)) {
                try list.appendSlice(allocator, "null");
            } else {
                const formatted = try std.fmt.bufPrint(&buf, "{d}", .{f});
                try list.appendSlice(allocator, formatted);
            }
        },
        .string => |s| try appendEscapedJsonString(list, allocator, s),
        .array => |items| {
            try list.appendSlice(allocator, "[");
            for (items, 0..) |item, i| {
                if (i > 0) try list.appendSlice(allocator, ",");
                try appendYamlValue(list, allocator, item);
            }
            try list.appendSlice(allocator, "]");
        },
        .object => |obj| {
            try list.appendSlice(allocator, "{");
            var iter = obj.iterator();
            var first = true;
            while (iter.next()) |entry| {
                if (!first) try list.appendSlice(allocator, ",");
                first = false;
                try appendEscapedJsonString(list, allocator, entry.key_ptr.*);
                try list.appendSlice(allocator, ":");
                try appendYamlValue(list, allocator, entry.value_ptr.*);
            }
            try list.appendSlice(allocator, "}");
        },
    }
}

/// Append a ParsedDoc as JSON to the list.
fn appendDocJson(list: *std.ArrayList(u8), allocator: std.mem.Allocator, doc: parser.ParsedDoc) !void {
    try list.appendSlice(allocator, "{");

    try list.appendSlice(allocator, "\"rawMatter\":");
    try appendEscapedJsonString(list, allocator, doc.rawMatter);
    try list.appendSlice(allocator, ",");

    try list.appendSlice(allocator, "\"content\":");
    try appendEscapedJsonString(list, allocator, doc.content);
    try list.appendSlice(allocator, ",");

    try list.appendSlice(allocator, "\"headings\":[");
    for (doc.headings, 0..) |h, i| {
        if (i > 0) try list.appendSlice(allocator, ",");
        try list.appendSlice(allocator, "{\"level\":");
        var level_buf: [16]u8 = undefined;
        const level_str = try std.fmt.bufPrint(&level_buf, "{}", .{h.level});
        try list.appendSlice(allocator, level_str);
        try list.appendSlice(allocator, ",\"text\":");
        try appendEscapedJsonString(list, allocator, h.text);
        try list.appendSlice(allocator, ",\"id\":");
        try appendEscapedJsonString(list, allocator, h.id);
        try list.appendSlice(allocator, "}");
    }
    try list.appendSlice(allocator, "],");

    try list.appendSlice(allocator, "\"plainText\":");
    try appendEscapedJsonString(list, allocator, doc.plainText);
    try list.appendSlice(allocator, ",");

    try list.appendSlice(allocator, "\"description\":");
    try appendEscapedJsonString(list, allocator, doc.description);
    try list.appendSlice(allocator, ",");

    try list.appendSlice(allocator, "\"frontmatter\":");
    try appendYamlValue(list, allocator, doc.frontmatter);

    try list.appendSlice(allocator, "}");
}

/// Thread worker context for parallel file parsing.
const FileJob = struct {
    path: []const u8,
    content: []const u8,
};

const WorkerContext = struct {
    allocator: std.mem.Allocator,
    jobs: []const FileJob,
    results: []?parser.ParsedDoc,
    error_msgs: []?[]const u8,
    next_idx: *std.atomic.Value(usize),
    turbo: bool,
};

fn workerFn(ctx: WorkerContext, arena: *std.heap.ArenaAllocator) void {
    const aa = arena.allocator();
    while (true) {
        const idx = ctx.next_idx.fetchAdd(1, .monotonic);
        if (idx >= ctx.jobs.len) break;

        const job = ctx.jobs[idx];
        const doc = if (ctx.turbo)
            parser.parseDocSinglePass(aa, job.content) catch |err| {
                // Allocate error message from outer allocator (not arena)
                // so it outlives the arena.
                ctx.error_msgs[idx] = std.fmt.allocPrint(ctx.allocator, "{}", .{err}) catch continue;
                continue;
            }
        else
            parser.parseDoc(aa, job.content) catch |err| {
                ctx.error_msgs[idx] = std.fmt.allocPrint(ctx.allocator, "{}", .{err}) catch continue;
                continue;
            };

        ctx.results[idx] = doc;
    }
}

/// Count how many bytes to skip for a JSON escape sequence starting at `input[pos]`.
/// Assumes input[pos] == '\\'.
fn jsonEscapeLen(input: []const u8, pos: usize) usize {
    if (pos + 1 >= input.len) return 1;
    switch (input[pos + 1]) {
        '"', '\\', '/', 'b', 'f', 'n', 'r', 't' => return 2,
        'u' => {
            // \uXXXX - consume 6 bytes total
            if (pos + 5 < input.len) return 6;
            return input.len - pos;
        },
        else => return 2, // invalid escape, consume 2
    }
}

/// Read a JSON string value starting at input[pos] (which should be '"').
/// Returns the unescaped string content and advances pos past the closing quote.
fn readJsonString(input: []const u8, pos: *usize, allocator: std.mem.Allocator) ![]const u8 {
    std.debug.assert(input[pos.*] == '"');
    pos.* += 1; // skip opening quote

    var buf = std.ArrayList(u8).empty;
    errdefer buf.deinit(allocator);

    while (pos.* < input.len) {
        const c = input[pos.*];
        if (c == '\\') {
            // JSON escape sequence
            const escape_len = jsonEscapeLen(input, pos.*);
            const escaped = input[pos.* + 1];
            switch (escaped) {
                '"' => try buf.append(allocator, '"'),
                '\\' => try buf.append(allocator, '\\'),
                '/' => try buf.append(allocator, '/'),
                'b' => try buf.append(allocator, 0x08),
                'f' => try buf.append(allocator, 0x0C),
                'n' => try buf.append(allocator, '\n'),
                'r' => try buf.append(allocator, '\r'),
                't' => try buf.append(allocator, '\t'),
                'u' => {
                    // Parse \uXXXX hex code
                    if (pos.* + 5 < input.len) {
                        const hex_str = input[pos.* + 2 .. pos.* + 6];
                        const code_point = std.fmt.parseInt(u21, hex_str, 16) catch 0xFFFD;
                        // Simple UTF-8 encoding for BMP codepoints
                        if (code_point < 0x80) {
                            try buf.append(allocator, @intCast(code_point));
                        } else if (code_point < 0x800) {
                            try buf.append(allocator, @intCast(0xC0 | (code_point >> 6)));
                            try buf.append(allocator, @intCast(0x80 | (code_point & 0x3F)));
                        } else {
                            try buf.append(allocator, @intCast(0xE0 | (code_point >> 12)));
                            try buf.append(allocator, @intCast(0x80 | ((code_point >> 6) & 0x3F)));
                            try buf.append(allocator, @intCast(0x80 | (code_point & 0x3F)));
                        }
                    }
                },
                else => try buf.append(allocator, escaped),
            }
            pos.* += escape_len;
        } else if (c == '"') {
            pos.* += 1; // skip closing quote
            return buf.toOwnedSlice(allocator);
        } else {
            try buf.append(allocator, c);
            pos.* += 1;
        }
    }

    // Unterminated string - return what we have
    return buf.toOwnedSlice(allocator);
}

/// Skip past a JSON string value starting at input[pos] (which should be '"').
/// Advances pos past the closing quote without allocating.
fn skipJsonString(input: []const u8, pos: *usize) void {
    std.debug.assert(input[pos.*] == '"');
    pos.* += 1;
    while (pos.* < input.len) {
        if (input[pos.*] == '\\') {
            const escape_len = jsonEscapeLen(input, pos.*);
            pos.* += escape_len;
        } else if (input[pos.*] == '"') {
            pos.* += 1;
            return;
        } else {
            pos.* += 1;
        }
    }
}

/// Skip whitespace characters.
fn skipWhitespace(input: []const u8, pos: *usize) void {
    while (pos.* < input.len and switch (input[pos.*]) {
        ' ', '\n', '\t', '\r' => true,
        else => false,
    }) : (pos.* += 1) {}
}

/// Inner implementation that can use Zig error handling.
/// Returns a null-terminated slice, or error.
fn parseDocsJsonInner(input: []const u8) ![]u8 {
    // Use c_allocator (malloc/free) instead of page_allocator (mmap)
    // because page_allocator doesn't work reliably in shared library
    // contexts loaded via dlopen/koffi.
    const allocator = std.heap.c_allocator;

    // Detect turbo mode (check for "turbo" key, tolerates whitespace variations)
    const turbo = std.mem.indexOf(u8, input, "\"turbo\"") != null;

    // Find "files" object
    const files_start = std.mem.indexOf(u8, input, "\"files\":{") orelse {
        // Return empty result if no files key
        const empty = try allocator.alloc(u8, 3);
        empty[0] = '{';
        empty[1] = '}';
        empty[2] = 0;
        return empty;
    };

    const scan_pos: usize = files_start + 9;

    // First pass: count files
    var file_count: usize = 0;
    {
        var p = scan_pos;
        while (p < input.len) {
            skipWhitespace(input, &p);
            if (p >= input.len or input[p] != '"') break;
            skipJsonString(input, &p);
            skipWhitespace(input, &p);
            if (p < input.len and input[p] == ':') {
                p += 1;
                skipWhitespace(input, &p);
                if (p < input.len and input[p] == '"') {
                    skipJsonString(input, &p);
                    file_count += 1;
                }
            }
            skipWhitespace(input, &p);
            if (p < input.len and input[p] == ',') {
                p += 1;
            } else if (p < input.len and input[p] == '}') {
                break;
            }
        }
    }

    if (file_count == 0) {
        const empty = try allocator.alloc(u8, 3);
        empty[0] = '{';
        empty[1] = '}';
        empty[2] = 0;
        return empty;
    }

    var jobs = std.ArrayList(FileJob).empty;
    defer {
        for (jobs.items) |j| {
            allocator.free(j.path);
            allocator.free(j.content);
        }
        jobs.deinit(allocator);
    }
    try jobs.ensureTotalCapacity(allocator, file_count);

    const results_alloc = try allocator.alloc(?parser.ParsedDoc, file_count);
    defer allocator.free(results_alloc);
    @memset(results_alloc, null);

    const error_msgs_alloc = try allocator.alloc(?[]const u8, file_count);
    defer allocator.free(error_msgs_alloc);
    @memset(error_msgs_alloc, null);

    // Second pass: extract file entries
    {
        var p = scan_pos;
        var idx: usize = 0;
        while (p < input.len and idx < file_count) {
            skipWhitespace(input, &p);
            if (p >= input.len or input[p] != '"') break;

            const path = try readJsonString(input, &p, allocator);
            errdefer allocator.free(path);

            skipWhitespace(input, &p);
            if (p < input.len and input[p] == ':') {
                p += 1;
            } else break;

            skipWhitespace(input, &p);
            const content = try readJsonString(input, &p, allocator);
            errdefer allocator.free(content);

            jobs.appendAssumeCapacity(.{ .path = path, .content = content });
            idx += 1;

            skipWhitespace(input, &p);
            if (p < input.len and input[p] == ',') {
                p += 1;
            } else if (p < input.len and input[p] == '}') {
                break;
            }
        }
    }

    const use_threads = !builtin.single_threaded and builtin.cpu.arch != .wasm32;
    const cpu_count = if (use_threads) std.Thread.getCpuCount() catch 1 else 1;
    const num_threads = @max(@as(usize, 1), cpu_count);

    var thread_arenas = try allocator.alloc(std.heap.ArenaAllocator, num_threads);
    defer {
        for (thread_arenas) |*a| a.deinit();
        allocator.free(thread_arenas);
    }
    for (thread_arenas) |*a| a.* = std.heap.ArenaAllocator.init(allocator);

    var next_idx = std.atomic.Value(usize).init(0);
    const ctx = WorkerContext{
        .allocator = allocator,
        .jobs = jobs.items,
        .results = results_alloc,
        .error_msgs = error_msgs_alloc,
        .next_idx = &next_idx,
        .turbo = turbo,
    };

    if (use_threads and num_threads > 1) {
        const spawn_limit = num_threads - 1;
        var threads = try allocator.alloc(std.Thread, spawn_limit);
        defer allocator.free(threads);

        var spawned: usize = 0;
        for (0..spawn_limit) |i| {
            threads[i] = std.Thread.spawn(.{}, workerFn, .{ ctx, &thread_arenas[i] }) catch break;
            spawned += 1;
        }
        workerFn(ctx, &thread_arenas[spawn_limit]);

        for (threads[0..spawned]) |t| t.join();
    } else {
        workerFn(ctx, &thread_arenas[0]);
    }

    var output = std.ArrayList(u8).empty;
    defer output.deinit(allocator);

    try output.append(allocator, '{');
    var first_file = true;

    for (jobs.items, 0..) |job, i| {
        if (!first_file) try output.append(allocator, ',');
        first_file = false;

        try appendEscapedJsonString(&output, allocator, job.path);
        try output.append(allocator, ':');

        if (error_msgs_alloc[i]) |err_msg| {
            try output.appendSlice(allocator, "{\"error\":");
            try appendEscapedJsonString(&output, allocator, err_msg);
            try output.append(allocator, '}');
        } else if (results_alloc[i]) |doc| {
            try appendDocJson(&output, allocator, doc);
        } else {
            try output.appendSlice(allocator, "{\"error\":\"unknown\"}");
        }
    }

    try output.append(allocator, '}');
    try output.append(allocator, 0); // null terminator
    return output.toOwnedSlice(allocator);
}

/// Parse a batch of file contents provided as JSON.
///
/// Input JSON format:
///   { "turbo": bool, "files": { "/abs/path.md": "content...", ... } }
///
/// Output JSON format (same as CLI):
///   { "/abs/path.md": { rawMatter, content, headings, plainText, description, frontmatter }, ... }
///
/// On parse error for a file, includes an "error" field instead of the parsed doc:
///   { "/abs/path/bad.md": { "error": "message" }, ... }
///
/// Returns a null-terminated JSON string, or null on fatal error.
/// The caller must free the returned string with `free_result`.
pub export fn parse_docs_json(input_json: [*:0]const u8) ?[*:0]u8 {
    const input = std.mem.span(input_json);
    const result = parseDocsJsonInner(input) catch return null;
    return @as([*:0]u8, @ptrCast(result.ptr));
}

/// Free a string returned by `parse_docs_json`.
/// The length is determined by scanning for the null terminator.
///
/// Note: Currently NOT called from the Node.js koffi binding (which uses
/// koffi's 'string' return type and accepts the per-call memory leak).
/// Kept exported for potential future use (e.g., C FFI consumers, or
/// switching to pointer-based return in the binding).
pub export fn free_result(ptr: [*:0]u8) void {
    const slice = std.mem.span(ptr);
    std.heap.c_allocator.free(slice);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test "napi - empty input returns empty object" {
    const testing = std.testing;
    const result = try parseDocsJsonInner("{}");
    defer std.heap.c_allocator.free(result);
    try testing.expectEqualStrings("{}" ++ "\x00", result);
}

test "napi - no files key returns empty object" {
    const testing = std.testing;
    const result = try parseDocsJsonInner("{ \"turbo\": false }");
    defer std.heap.c_allocator.free(result);
    try testing.expectEqualStrings("{}" ++ "\x00", result);
}

test "napi - single file with frontmatter" {
    const testing = std.testing;
    // Simple markdown with frontmatter, JSON-escaped for the input
    const content = "---\n---\ntitle: Test\n---\n## Hello\nWorld";
    const json_input = "{\"files\":{\"/path/doc.md\":\"" ++ content ++ "\"}}";

    const result = try parseDocsJsonInner(json_input);
    defer std.heap.c_allocator.free(result);

    // Verify it parsed successfully (produces JSON output)
    try testing.expect(result.len > 3);
    try testing.expect(result[0] == '{');
    try testing.expect(result[result.len - 1] == 0); // null terminated
}

test "napi - multiple files" {
    const testing = std.testing;
    const part1 = "{\"files\":{\"/a.md\":\"# File A\\n## Section A\",";
    const part2 = "\"/b.md\":\"# File B\\n## Section B\"}}";
    const json_input = part1 ++ part2;

    const result = try parseDocsJsonInner(json_input);
    defer std.heap.c_allocator.free(result);

    try testing.expect(result.len > 3);
    try testing.expect(result[0] == '{');
    try testing.expect(result[result.len - 1] == 0);
}

test "napi - turbo mode" {
    const testing = std.testing;
    const json_input = "{\"turbo\":true,\"files\":{\"/test.md\":\"### Turbo Mode\"}}";

    const result = try parseDocsJsonInner(json_input);
    defer std.heap.c_allocator.free(result);

    try testing.expect(result.len > 3);
    try testing.expect(result[0] == '{');
}

test "napi - debug simple input" {
    const testing = std.testing;
    // Same input that crashes via C FFI
    const json_input = "{\"files\":{\"/t.md\":\"## Hello\"}}";

    const result = try parseDocsJsonInner(json_input);
    defer std.heap.c_allocator.free(result);

    try testing.expect(result.len > 3);
    try testing.expect(result[0] == '{');
    try testing.expect(result[result.len - 1] == 0);
}

test "napi - error handling for bad content" {
    const testing = std.testing;
    // Very long content shouldn't crash
    const long_content = "# " ++ ("x" ** 1000);
    const json_input = "{\"files\":{\"/big.md\":\"" ++ long_content ++ "\"}}";

    const result = try parseDocsJsonInner(json_input);
    defer std.heap.c_allocator.free(result);

    try testing.expect(result.len > 3);
    try testing.expect(result[0] == '{');
}
