const std = @import("std");

pub fn slug(allocator: std.mem.Allocator, text: []const u8) ![]u8 {
    var out = std.ArrayList(u8).empty;
    errdefer out.deinit(allocator);

    for (text) |c| {
        if (shouldRemove(c)) {
            continue;
        } else if (c == ' ') {
            try out.append(allocator, '-');
        } else if (c >= 'A' and c <= 'Z') {
            try out.append(allocator, c + 32);
        } else {
            try out.append(allocator, c);
        }
    }

    return out.toOwnedSlice(allocator);
}

pub fn shouldRemove(c: u8) bool {
    if (c <= 0x1F) return true;
    if (c >= 0x21 and c <= 0x2C) return true;
    if (c == '.' or c == '/') return true;
    if (c >= 0x3A and c <= 0x40) return true;
    if (c >= 0x5B and c <= 0x5E) return true;
    if (c == '`') return true;
    if (c >= 0x7B and c <= 0x7E) return true;
    if (c == 0x7F) return true;
    return false;
}
