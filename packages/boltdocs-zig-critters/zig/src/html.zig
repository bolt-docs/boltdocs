const std = @import("std");
const mem = std.mem;
const Allocator = mem.Allocator;

pub const HtmlElement = struct {
    tag: []const u8,
    classes: []const []const u8 = &.{},
    id: ?[]const u8 = null,
    attrs: []const HtmlAttr = &.{},
};

pub const HtmlAttr = struct {
    name: []const u8,
    value: []const u8,
};

fn isWhitespace(c: u8) bool {
    return c == ' ' or c == '\t' or c == '\n' or c == '\r';
}

fn isAlpha(c: u8) bool {
    return (c >= 'a' and c <= 'z') or (c >= 'A' and c <= 'Z');
}

fn isAlphaNum(c: u8) bool {
    return isAlpha(c) or (c >= '0' and c <= '9');
}

/// Lightweight HTML parser that extracts elements with their tags, classes, IDs, and attributes.
/// Does NOT build a full DOM tree — produces a flat list of elements in document order.
/// Handles: tags, attributes (quoted/unquoted), self-closing tags, comments, CDATA.
pub fn parseHtml(allocator: Allocator, html: []const u8) ![]HtmlElement {
    var elements = std.ArrayList(HtmlElement).empty;
    errdefer elements.deinit(allocator);

    var i: usize = 0;
    const len = html.len;

    while (i < len) {
        if (html[i] != '<') {
            i += 1;
            continue;
        }

        i += 1;
        if (i >= len) break;

        // Skip closing tags, comments, CDATA, doctype
        if (html[i] == '/' or html[i] == '!' or html[i] == '?') {
            while (i < len and html[i] != '>') i += 1;
            if (i < len) i += 1;
            continue;
        }

        // Read tag name
        const tag_start = i;
        while (i < len and !isWhitespace(html[i]) and html[i] != '>' and html[i] != '/') : (i += 1) {}
        const tag_name = html[tag_start..i];

        var elem = HtmlElement{ .tag = tag_name };
        var classes = std.ArrayList([]const u8).empty;
        var attrs = std.ArrayList(HtmlAttr).empty;
        var id: ?[]const u8 = null;

        // Parse attributes
        while (i < len) {
            while (i < len and isWhitespace(html[i])) : (i += 1) {}
            if (i >= len) break;
            if (html[i] == '>' or html[i] == '/') break;

            // Read attribute name
            const attr_name_start = i;
            while (i < len and html[i] != '=' and html[i] != ' ' and html[i] != '\t' and html[i] != '>' and html[i] != '/') : (i += 1) {}
            const attr_name = html[attr_name_start..i];

            // Skip whitespace around =
            while (i < len and isWhitespace(html[i])) : (i += 1) {}

            var attr_value: []const u8 = "";

            if (i < len and html[i] == '=') {
                i += 1; // skip =
                while (i < len and isWhitespace(html[i])) : (i += 1) {}

                if (i < len and (html[i] == '"' or html[i] == '\'')) {
                    const quote = html[i];
                    i += 1;
                    const val_start = i;
                    while (i < len and html[i] != quote) : (i += 1) {}
                    attr_value = html[val_start..i];
                    if (i < len) i += 1;
                } else {
                    // Unquoted value
                    const val_start = i;
                    while (i < len and !isWhitespace(html[i]) and html[i] != '>' and html[i] != '/') : (i += 1) {}
                    attr_value = html[val_start..i];
                }
            }

            // Store class and id for fast access
            if (mem.eql(u8, attr_name, "class")) {
                var class_iter = mem.splitScalar(u8, attr_value, ' ');
                while (class_iter.next()) |cls| {
                    if (cls.len > 0) {
                        classes.append(allocator, cls) catch continue;
                    }
                }
            } else if (mem.eql(u8, attr_name, "id")) {
                id = attr_value;
            }

            attrs.append(allocator, .{ .name = attr_name, .value = attr_value }) catch continue;
        }

        // Skip to end of tag
        if (i < len and html[i] == '/') i += 1; // self-closing
        if (i < len and html[i] == '>') i += 1;

        elem.classes = try classes.toOwnedSlice(allocator);
        elem.id = id;
        elem.attrs = try attrs.toOwnedSlice(allocator);

        try elements.append(allocator, elem);
    }

    return try elements.toOwnedSlice(allocator);
}

/// Free all memory used by parsed elements
pub fn freeElements(allocator: Allocator, elements: []HtmlElement) void {
    for (elements) |*elem| {
        if (elem.classes.len > 0) allocator.free(elem.classes);
        if (elem.attrs.len > 0) allocator.free(elem.attrs);
    }
    allocator.free(elements);
}

test "parse simple div" {
    const allocator = std.testing.allocator;
    const elements = try parseHtml(allocator, "<div class=\"foo\" id=\"bar\">hello</div>");
    defer freeElements(allocator, elements);
    try std.testing.expectEqual(@as(usize, 1), elements.len);
    try std.testing.expectEqualStrings("div", elements[0].tag);
    try std.testing.expectEqual(@as(usize, 1), elements[0].classes.len);
    try std.testing.expectEqualStrings("foo", elements[0].classes[0]);
    try std.testing.expect(elements[0].id != null);
    try std.testing.expectEqualStrings("bar", elements[0].id.?);
}

test "parse self-closing tags" {
    const allocator = std.testing.allocator;
    const elements = try parseHtml(allocator, "<br/><img src=\"test.png\" />");
    defer freeElements(allocator, elements);
    try std.testing.expectEqual(@as(usize, 2), elements.len);
    try std.testing.expectEqualStrings("br", elements[0].tag);
    try std.testing.expectEqualStrings("img", elements[1].tag);
}

test "parse nested elements" {
    const allocator = std.testing.allocator;
    const elements = try parseHtml(allocator, "<div><span class=\"inner\">text</span></div>");
    defer freeElements(allocator, elements);
    try std.testing.expectEqual(@as(usize, 2), elements.len);
    try std.testing.expectEqualStrings("div", elements[0].tag);
    try std.testing.expectEqualStrings("span", elements[1].tag);
}

test "skip comments" {
    const allocator = std.testing.allocator;
    const elements = try parseHtml(allocator, "<div><!-- comment --><p>text</p></div>");
    defer freeElements(allocator, elements);
    try std.testing.expectEqual(@as(usize, 2), elements.len);
    try std.testing.expectEqualStrings("div", elements[0].tag);
    try std.testing.expectEqualStrings("p", elements[1].tag);
}

test "multiple classes" {
    const allocator = std.testing.allocator;
    const elements = try parseHtml(allocator, "<div class=\"a b c\"></div>");
    defer freeElements(allocator, elements);
    try std.testing.expectEqual(@as(usize, 1), elements.len);
    try std.testing.expectEqual(@as(usize, 3), elements[0].classes.len);
    try std.testing.expectEqualStrings("a", elements[0].classes[0]);
    try std.testing.expectEqualStrings("b", elements[0].classes[1]);
    try std.testing.expectEqualStrings("c", elements[0].classes[2]);
}
