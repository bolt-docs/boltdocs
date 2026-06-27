const std = @import("std");
const beasties = @import("beasties");

var result_ptr: u32 = 0;
var result_len: u32 = 0;

export fn getResultPtr() u32 { return result_ptr; }
export fn getResultLen() u32 { return result_len; }

export fn reset() void {
    result_ptr = 0; result_len = 0;
}

export fn processCriticalCss(
    html_ptr: u32, html_len: u32,
    css_ptr: u32, css_len: u32,
    arena_ptr: u32, arena_size: u32,
    compress: u32,
) u32 {
    const arena_buf = @as([*]u8, @ptrFromInt(arena_ptr))[0..arena_size];
    var fba = std.heap.FixedBufferAllocator.init(arena_buf);
    const allocator = fba.allocator();

    const html = @as([*]const u8, @ptrFromInt(html_ptr))[0..html_len];
    const css_content = @as([*]const u8, @ptrFromInt(css_ptr))[0..css_len];

    const result = beasties.extractCriticalCss(allocator, html, css_content, .{ .compress = compress != 0 }) catch {
        return 0;
    };

    result_ptr = @intCast(@intFromPtr(result.critical_css.ptr));
    result_len = @intCast(result.critical_css.len);
    return result_len;
}
