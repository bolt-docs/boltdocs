const std = @import("std");
const mem = std.mem;
const Allocator = mem.Allocator;

const beasties = @import("beasties");

// WASM allocator
var gpa_state: std.heap.ArenaAllocator = undefined;
var gpa_initialized = false;

fn getAllocator() Allocator {
    if (!gpa_initialized) {
        gpa_state = std.heap.ArenaAllocator.init(std.heap.wasm_allocator);
        gpa_initialized = true;
    }
    return gpa_state.allocator();
}

// Result - pointer + length stored after processing
var result_ptr: u32 = 0;
var result_len: u32 = 0;

export fn processCriticalCss(
    html_ptr: u32,
    html_len: u32,
    css_ptr: u32,
    css_len: u32,
    compress: u32,
) u32 {
    const allocator = getAllocator();

    const html = @as([*]const u8, @ptrFromInt(html_ptr))[0..html_len];
    const css_content = @as([*]const u8, @ptrFromInt(css_ptr))[0..css_len];

    const options = beasties.BeastiesOptions{
        .compress = compress != 0,
    };

    const result = beasties.extractCriticalCss(allocator, html, css_content, options) catch {
        result_ptr = 0;
        result_len = 0;
        return 0;
    };

    result_ptr = @intCast(@intFromPtr(result.critical_css.ptr));
    result_len = @intCast(result.critical_css.len);

    return result_len;
}

export fn getResultPtr() u32 {
    return result_ptr;
}

export fn getResultLen() u32 {
    return result_len;
}

export fn reset() void {
    if (gpa_initialized) {
        gpa_state.deinit();
        gpa_state = std.heap.ArenaAllocator.init(std.heap.wasm_allocator);
    }
    result_ptr = 0;
    result_len = 0;
}
