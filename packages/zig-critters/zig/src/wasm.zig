const std = @import("std");
const beasties = @import("beasties");

var result_ptr: u32 = 0;
var result_len: u32 = 0;

/// Growing scratch arena for one extraction. Kept alive (not freed) between
/// calls on purpose: JS reads the result bytes through `getResultPtr` after
/// this export returns, so they must stay valid until the next invocation.
var extraction_arena: ?std.heap.ArenaAllocator = null;

export fn getResultPtr() u32 {
    return result_ptr;
}
export fn getResultLen() u32 {
    return result_len;
}

export fn reset() void {
    result_ptr = 0;
    result_len = 0;
}

export fn processCriticalCss(
    html_ptr: u32,
    html_len: u32,
    css_ptr: u32,
    css_len: u32,
    arena_ptr: u32,
    arena_size: u32,
    compress: u32,
) u32 {
    // The JS host still reserves an `arena_size` scratch window (ABI kept for
    // compatibility), but a fixed window silently truncated extraction on
    // large stylesheets: a ~115KB Tailwind bundle produces far more parser
    // allocations than 2MB of scratch, and every `catch continue` in the
    // parser then dropped rules mid-file with no error surfaced. Grow with
    // linear memory instead; the reserved window is simply ignored.
    _ = arena_ptr;
    _ = arena_size;

    // Free the PREVIOUS call's scratch (and result bytes) only now, just
    // before reusing the allocator — never at the end of this call.
    if (extraction_arena) |*prev| {
        _ = prev.reset(.free_all);
    } else {
        extraction_arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    }
    const allocator = extraction_arena.?.allocator();

    const html = @as([*]const u8, @ptrFromInt(html_ptr))[0..html_len];
    const css_content = @as([*]const u8, @ptrFromInt(css_ptr))[0..css_len];

    const result = beasties.extractCriticalCss(allocator, html, css_content, .{ .compress = compress != 0 }) catch {
        return 0;
    };

    result_ptr = @intCast(@intFromPtr(result.critical_css.ptr));
    result_len = @intCast(result.critical_css.len);
    return result_len;
}
