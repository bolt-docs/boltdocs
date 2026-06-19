const std = @import("std");
const slugger = @import("slugger.zig");

pub const Heading = struct {
    level: u8,
    text: []const u8,
    id: []const u8,
};

pub const ParsedDoc = struct {
    rawMatter: []const u8,
    content: []const u8,
    headings: []Heading,
    plainText: []const u8,
    description: []const u8,
};

/// Helper state machine to strip HTML tags, Markdown bold/italic/code block markers,
/// remove URL parts of markdown links [text](url) keeping only "text", collapse duplicate
/// whitespaces, and decode common HTML entities like &amp;, &lt;, &gt;, &quot;, &apos; / &#39;.
/// Processes the string in a single pass with a single allocation.
/// Caller owns the returned memory slice.
pub fn stripAndDecode(allocator: std.mem.Allocator, input: []const u8) ![]u8 {
    var out = std.ArrayList(u8).empty;
    errdefer out.deinit(allocator);

    const State = enum { text, html_tag, md_link_url };
    var state = State.text;
    var last_was_space = true; // start as true to trim leading spaces

    var i: usize = 0;
    while (i < input.len) {
        const c = input[i];
        switch (state) {
            .text => {
                if (c == '<') {
                    state = .html_tag;
                } else if (c == '[') {
                    // skip opening bracket
                } else if (c == ']' and i + 1 < input.len and input[i + 1] == '(') {
                    state = .md_link_url;
                    i += 1; // skip both ']' and '('
                } else if (c == '*' or c == '_' or c == '`') {
                    // skip markdown formatting characters
                } else {
                    // handle html entities on the fly
                    if (c == '&') {
                        if (std.mem.startsWith(u8, input[i..], "&amp;")) {
                            try appendChar(&out, allocator, '&', &last_was_space);
                            i += 4;
                        } else if (std.mem.startsWith(u8, input[i..], "&lt;")) {
                            try appendChar(&out, allocator, '<', &last_was_space);
                            i += 3;
                        } else if (std.mem.startsWith(u8, input[i..], "&gt;")) {
                            try appendChar(&out, allocator, '>', &last_was_space);
                            i += 3;
                        } else if (std.mem.startsWith(u8, input[i..], "&quot;")) {
                            try appendChar(&out, allocator, '"', &last_was_space);
                            i += 5;
                        } else if (std.mem.startsWith(u8, input[i..], "&apos;")) {
                            try appendChar(&out, allocator, '\'', &last_was_space);
                            i += 5;
                        } else if (std.mem.startsWith(u8, input[i..], "&#39;")) {
                            try appendChar(&out, allocator, '\'', &last_was_space);
                            i += 4;
                        } else {
                            try appendChar(&out, allocator, '&', &last_was_space);
                        }
                    } else {
                        try appendChar(&out, allocator, c, &last_was_space);
                    }
                }
            },
            .html_tag => {
                if (c == '>') {
                    state = .text;
                }
            },
            .md_link_url => {
                if (c == ')') {
                    state = .text;
                }
            },
        }
        i += 1;
    }

    // Pop trailing space if present
    if (out.items.len > 0 and out.items[out.items.len - 1] == ' ') {
        _ = out.pop();
    }

    return out.toOwnedSlice(allocator);
}

fn appendChar(out: *std.ArrayList(u8), allocator: std.mem.Allocator, c: u8, last_was_space: *bool) !void {
    const is_space = (c == ' ' or c == '\t' or c == '\r' or c == '\n');
    if (is_space) {
        if (!last_was_space.*) {
            try out.append(allocator, ' ');
            last_was_space.* = true;
        }
    } else {
        try out.append(allocator, c);
        last_was_space.* = false;
    }
}

/// Parses frontmatter boundaries.
/// Returns the raw frontmatter block and the remaining markdown content.
pub fn parseFrontmatter(input: []const u8) struct { rawMatter: []const u8, content: []const u8 } {
    const trimmed = std.mem.trim(u8, input, " \t\r\n");
    if (!std.mem.startsWith(u8, trimmed, "---")) {
        return .{ .rawMatter = "", .content = input };
    }

    // Find end of first line
    const first_line_end = std.mem.indexOfScalar(u8, trimmed, '\n') orelse return .{ .rawMatter = "", .content = input };
    // Find next --- after the first line
    const second_dashes = std.mem.indexOf(u8, trimmed[first_line_end..], "\n---") orelse return .{ .rawMatter = "", .content = input };

    const start_idx = first_line_end;
    const end_idx = first_line_end + second_dashes;

    const rawMatter = std.mem.trim(u8, trimmed[start_idx..end_idx], " \t\r\n");
    const content = std.mem.trim(u8, trimmed[end_idx + 4 ..], " \t\r\n");

    return .{ .rawMatter = rawMatter, .content = content };
}

/// Extracts headings from markdown content.
pub fn extractHeadings(allocator: std.mem.Allocator, content: []const u8) ![]Heading {
    var headings = std.ArrayList(Heading).empty;
    errdefer {
        for (headings.items) |h| {
            allocator.free(h.text);
            allocator.free(h.id);
        }
        headings.deinit(allocator);
    }

    var in_code_block = false;
    var lines = std.mem.splitScalar(u8, content, '\n');
    while (lines.next()) |line| {
        const trimmed = std.mem.trim(u8, line, " \t\r");
        if (std.mem.startsWith(u8, trimmed, "```") or std.mem.startsWith(u8, trimmed, "~~~")) {
            in_code_block = !in_code_block;
            continue;
        }
        if (in_code_block) continue;
        if (trimmed.len == 0) continue;

        var level: u8 = 0;
        while (level < trimmed.len and trimmed[level] == '#') : (level += 1) {}

        // We only extract ##, ###, and #### headings as per Boltdocs spec.
        if (level >= 2 and level <= 4 and level < trimmed.len and trimmed[level] == ' ') {
            const raw_text = std.mem.trim(u8, trimmed[level..], " \t");

            const decoded_text = try stripAndDecode(allocator, raw_text);
            errdefer allocator.free(decoded_text);

            // Generate slug for the heading
            const heading_id = try slugger.slug(allocator, decoded_text);
            errdefer allocator.free(heading_id);

            try headings.append(allocator, .{
                .level = level,
                .text = decoded_text,
                .id = heading_id,
            });
        }
    }

    return headings.toOwnedSlice(allocator);
}

/// Parses a full doc file.
pub fn parseDoc(allocator: std.mem.Allocator, file_content: []const u8) !ParsedDoc {
    const fm = parseFrontmatter(file_content);

    const headings = try extractHeadings(allocator, fm.content);
    errdefer allocator.free(headings);

    const plainText = try stripAndDecode(allocator, fm.content);
    errdefer allocator.free(plainText);

    // Generate description (first 160 chars)
    const desc_len = if (plainText.len > 160) @as(usize, 160) else plainText.len;
    const description = try allocator.dupe(u8, plainText[0..desc_len]);

    return .{
        .rawMatter = fm.rawMatter,
        .content = fm.content,
        .headings = headings,
        .plainText = plainText,
        .description = description,
    };
}
