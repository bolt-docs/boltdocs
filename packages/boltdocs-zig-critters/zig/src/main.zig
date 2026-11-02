const std = @import("std");
const mem = std.mem;
const Io = std.Io;

const beasties = @import("beasties");
const html_mod = @import("html");

const FileTask = struct {
    path: []const u8,
    html: ?[]const u8 = null,
    result_ns: ?u64 = null,
    err: ?anyerror = null,
};

pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;
    const io = init.io;

    const stdout = Io.File.stdout();

    try stdout.writeStreamingAll(io, "Beasties Zig Benchmark - 300 archivos\n");
    try stdout.writeStreamingAll(io, "============================================================\n");

    // Read CSS file
    var dir = Io.Dir.cwd();
    const css_file = dir.openFile(io, "test-files/styles.css", .{}) catch |err| {
        try stdout.writeStreamingAll(io, "Error: No se pudo abrir test-files/styles.css\n");
        return err;
    };
    defer css_file.close(io);

    var read_buf: [4096]u8 = undefined;
    var r = css_file.reader(io, &read_buf);
    const css_content = try r.interface.allocRemaining(allocator, .unlimited);
    defer allocator.free(css_content);

    var buf: [128]u8 = undefined;
    const css_msg = try std.fmt.bufPrint(&buf, "CSS cargado: {d:.1}KB\n", .{@as(f64, @floatFromInt(css_content.len)) / 1024.0});
    try stdout.writeStreamingAll(io, css_msg);

    // Read all HTML files
    var tasks = std.ArrayList(FileTask).empty;
    defer {
        for (tasks.items) |task| {
            if (task.html) |html| allocator.free(html);
        }
        tasks.deinit(allocator);
    }

    var file_count: u32 = 0;
    while (file_count < 300) : (file_count += 1) {
        var path_buf: [64]u8 = undefined;
        const path = try std.fmt.bufPrint(&path_buf, "test-files/page-{d}.html", .{file_count});

        const html_file = dir.openFile(io, path, .{}) catch |err| {
            const err_msg = try std.fmt.bufPrint(&path_buf, "Error abriendo {s}: {}\n", .{path, err});
            try stdout.writeStreamingAll(io, err_msg);
            continue;
        };
        defer html_file.close(io);

        var r2 = html_file.reader(io, &read_buf);
        const html_content = try r2.interface.allocRemaining(allocator, .unlimited);
        try tasks.append(allocator, .{ .path = path, .html = html_content });
    }

    const count_msg = try std.fmt.bufPrint(&buf, "Archivos cargados: {d}\n", .{tasks.items.len});
    try stdout.writeStreamingAll(io, count_msg);
    try stdout.writeStreamingAll(io, "Ejecutando benchmark...\n");

    // Warmup
    {
        var warmup_arena = std.heap.ArenaAllocator.init(allocator);
        defer warmup_arena.deinit();
        _ = beasties.extractCriticalCss(warmup_arena.allocator(), tasks.items[0].html.?, css_content, .{}) catch {};
    }

    // Run benchmark
    const start_total = Io.Timestamp.now(io, .awake);

    var total_ns: u64 = 0;
    var times = std.ArrayList(u64).empty;
    defer times.deinit(allocator);

    for (tasks.items) |*task| {
        var file_arena = std.heap.ArenaAllocator.init(allocator);
        defer file_arena.deinit();

        const start = Io.Timestamp.now(io, .awake);
        _ = beasties.extractCriticalCss(file_arena.allocator(), task.html.?, css_content, .{}) catch |err| {
            task.err = err;
            continue;
        };
        const end = Io.Timestamp.now(io, .awake);
        const elapsed = Io.Timestamp.durationTo(start, end);
        const elapsed_ns: u64 = @intCast(elapsed.nanoseconds);
        task.result_ns = elapsed_ns;
        total_ns += elapsed_ns;
        try times.append(allocator, elapsed_ns);
    }

    const end_total = Io.Timestamp.now(io, .awake);
    const wall_duration = Io.Timestamp.durationTo(start_total, end_total);
    const wall_time_ns: u64 = @intCast(wall_duration.nanoseconds);

    // Calculate stats
    var success_count: usize = 0;
    for (tasks.items) |task| {
        if (task.result_ns != null) success_count += 1;
    }

    const avg_ns = total_ns / @max(success_count, 1);
    const total_ms = @as(f64, @floatFromInt(total_ns)) / 1_000_000.0;
    const avg_ms = @as(f64, @floatFromInt(avg_ns)) / 1_000_000.0;
    const wall_ms = @as(f64, @floatFromInt(wall_time_ns)) / 1_000_000.0;

    // Sort for median/p95
    std.mem.sort(u64, times.items, {}, comptime struct {
        fn ascending(_: void, a: u64, b: u64) bool {
            return a < b;
        }
    }.ascending);

    const median_ns = times.items[times.items.len / 2];
    const p95_idx = @min(@as(usize, @intFromFloat(@as(f64, @floatFromInt(times.items.len)) * 0.95)), times.items.len - 1);
    const p95_ns = times.items[p95_idx];
    const min_ns = times.items[0];
    const max_ns = times.items[times.items.len - 1];

    const median_ms = @as(f64, @floatFromInt(median_ns)) / 1_000_000.0;
    const p95_ms_val = @as(f64, @floatFromInt(p95_ns)) / 1_000_000.0;
    const min_ms = @as(f64, @floatFromInt(min_ns)) / 1_000_000.0;
    const max_ms = @as(f64, @floatFromInt(max_ns)) / 1_000_000.0;
    const fps = @as(f64, @floatFromInt(success_count)) / (total_ms / 1000.0);

    try stdout.writeStreamingAll(io, "\n============================================================\n");
    try stdout.writeStreamingAll(io, "RESULTADOS ZIG\n");
    try stdout.writeStreamingAll(io, "============================================================\n");

    var line_buf: [256]u8 = undefined;

    var msg = try std.fmt.bufPrint(&line_buf, "Total archivos:     {d}\n", .{success_count});
    try stdout.writeStreamingAll(io, msg);

    msg = try std.fmt.bufPrint(&line_buf, "Tiempo total CPU:   {d:.2}s\n", .{total_ms / 1000.0});
    try stdout.writeStreamingAll(io, msg);

    msg = try std.fmt.bufPrint(&line_buf, "Tiempo wall clock:  {d:.2}s\n", .{wall_ms / 1000.0});
    try stdout.writeStreamingAll(io, msg);

    msg = try std.fmt.bufPrint(&line_buf, "Promedio/archivo:   {d:.2}ms\n", .{avg_ms});
    try stdout.writeStreamingAll(io, msg);

    msg = try std.fmt.bufPrint(&line_buf, "Mediana/archivo:    {d:.2}ms\n", .{median_ms});
    try stdout.writeStreamingAll(io, msg);

    msg = try std.fmt.bufPrint(&line_buf, "Minimo:             {d:.2}ms\n", .{min_ms});
    try stdout.writeStreamingAll(io, msg);

    msg = try std.fmt.bufPrint(&line_buf, "Maximo:             {d:.2}ms\n", .{max_ms});
    try stdout.writeStreamingAll(io, msg);

    msg = try std.fmt.bufPrint(&line_buf, "P95:                {d:.2}ms\n", .{p95_ms_val});
    try stdout.writeStreamingAll(io, msg);

    msg = try std.fmt.bufPrint(&line_buf, "Archivos/segundo:   {d:.1}\n", .{fps});
    try stdout.writeStreamingAll(io, msg);

    // Check for errors
    var error_count: usize = 0;
    for (tasks.items) |task| {
        if (task.err != null) error_count += 1;
    }
    if (error_count > 0) {
        msg = try std.fmt.bufPrint(&line_buf, "Errores:            {d}\n", .{error_count});
        try stdout.writeStreamingAll(io, msg);
    }
}
