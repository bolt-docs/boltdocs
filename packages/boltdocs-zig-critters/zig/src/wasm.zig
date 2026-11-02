const std = @import("std");
const beasties = @import("beasties");
const css_mod = @import("css");

var result_ptr: u32 = 0;
var result_len: u32 = 0;

/// Growing scratch arena for one extraction. Kept alive (not freed) between
/// calls on purpose: JS reads the result bytes through `getResultPtr` after
/// this export returns, so they must stay valid until the next invocation.
var extraction_arena: ?std.heap.ArenaAllocator = null;

/// The stylesheet, parsed once and kept for the life of the instance.
///
/// The stylesheet is the same for every page of a build, and parsing it is the
/// expensive half of an extraction — 91 ms against 44 ms of matching, on the
/// documentation site's 180 kB stylesheet. One parse per instance and one match
/// per page is the difference between paying for the parse once and paying for
/// it on every page.
var prepared_stylesheet: ?beasties.Stylesheet = null;

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

/// Parse the stylesheet once.
///
/// The bytes are copied into the stylesheet's own arena, so a later growth of
/// the linear memory cannot invalidate them: the caller's copy lives at a
/// fixed offset that growth would move.
export fn prepareStylesheet(css_ptr: u32, css_len: u32) void {
    const css = @as([*]const u8, @ptrFromInt(css_ptr))[0..css_len];
    if (prepared_stylesheet) |*previous| {
        previous.deinit();
        prepared_stylesheet = null;
    }
    prepared_stylesheet = beasties.prepareStylesheet(std.heap.page_allocator, css) catch null;
}

/// Whether a stylesheet has been prepared.
export fn hasPreparedStylesheet() bool {
    return prepared_stylesheet != null;
}

/// Extract the critical CSS for one page against the prepared stylesheet.
///
/// The scratch arena is reset exactly as in `processCriticalCss`: the result
/// bytes must stay valid until the next call, and the stylesheet's own arena
/// must not accumulate the output of every page.
export fn processPreparedCriticalCss(html_ptr: u32, html_len: u32, compress: u32) u32 {
    if (prepared_stylesheet == null) return 0;
    const stylesheet = &prepared_stylesheet.?;

    if (extraction_arena) |*prev| {
        _ = prev.reset(.free_all);
    } else {
        extraction_arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    }
    const allocator = extraction_arena.?.allocator();

    const html = @as([*]const u8, @ptrFromInt(html_ptr))[0..html_len];

    const result = beasties.extractCriticalCssWith(
        stylesheet,
        allocator,
        html,
        .{ .compress = compress != 0 },
    ) catch {
        return 0xFFFF_FFFF;
    };

    result_ptr = @intCast(@intFromPtr(result.critical_css.ptr));
    result_len = @intCast(result.critical_css.len);
    return result_len;
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
