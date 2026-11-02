const std = @import("std");
const slugger = @import("slugger.zig");
const yaml = @import("yaml.zig");

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
    frontmatter: yaml.Value,
};

/// Shared parsing context for single-pass optimization.
/// Reuses a single buffer for plainText processing, avoiding multiple allocations.
pub const ParseContext = struct {
    buffer: std.ArrayList(u8),
    headings: std.ArrayList(Heading),
    last_was_space: bool,

    pub fn init() ParseContext {
        return .{
            .buffer = std.ArrayList(u8).empty,
            .headings = std.ArrayList(Heading).empty,
            .last_was_space = true,
        };
    }

    pub fn deinit(self: *ParseContext, allocator: std.mem.Allocator) void {
        self.buffer.deinit(allocator);
        self.headings.deinit(allocator);
    }

    pub fn reset(self: *ParseContext) void {
        self.buffer.clearRetainingCapacity();
        self.headings.clearRetainingCapacity();
        self.last_was_space = true;
    }
};

/// Writes a single character to the output buffer, collapsing whitespace.
pub fn appendCharToBuffer(buffer: *std.ArrayList(u8), allocator: std.mem.Allocator, c: u8, last_was_space: *bool) !void {
    const is_space = (c == ' ' or c == '\t' or c == '\r' or c == '\n');
    if (is_space) {
        if (!last_was_space.*) {
            try buffer.append(allocator, ' ');
            last_was_space.* = true;
        }
    } else {
        try buffer.append(allocator, c);
        last_was_space.* = false;
    }
}

/// Strips HTML tags, markdown formatting, link URLs, and decodes HTML entities.
/// Writes result directly into the provided buffer (single-pass, no extra allocation).
pub fn stripAndDecodeInto(buffer: *std.ArrayList(u8), allocator: std.mem.Allocator, input: []const u8, last_was_space: *bool) !void {
    const State = enum { text, html_tag, md_link_url };
    var state = State.text;

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
                    i += 1;
                } else if (c == '*' or c == '_' or c == '`') {
                    // skip markdown formatting characters
                } else {
                    if (c == '&') {
                        if (std.mem.startsWith(u8, input[i..], "&amp;")) {
                            try appendCharToBuffer(buffer, allocator, '&', last_was_space);
                            i += 4;
                        } else if (std.mem.startsWith(u8, input[i..], "&lt;")) {
                            try appendCharToBuffer(buffer, allocator, '<', last_was_space);
                            i += 3;
                        } else if (std.mem.startsWith(u8, input[i..], "&gt;")) {
                            try appendCharToBuffer(buffer, allocator, '>', last_was_space);
                            i += 3;
                        } else if (std.mem.startsWith(u8, input[i..], "&quot;")) {
                            try appendCharToBuffer(buffer, allocator, '"', last_was_space);
                            i += 5;
                        } else if (std.mem.startsWith(u8, input[i..], "&apos;")) {
                            try appendCharToBuffer(buffer, allocator, '\'', last_was_space);
                            i += 5;
                        } else if (std.mem.startsWith(u8, input[i..], "&#39;")) {
                            try appendCharToBuffer(buffer, allocator, '\'', last_was_space);
                            i += 4;
                        } else {
                            try appendCharToBuffer(buffer, allocator, '&', last_was_space);
                        }
                    } else {
                        try appendCharToBuffer(buffer, allocator, c, last_was_space);
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
}

/// Original stripAndDecode function for backward compatibility.
/// Creates a new allocation for the result.
pub fn stripAndDecode(allocator: std.mem.Allocator, input: []const u8) ![]u8 {
    var buffer = std.ArrayList(u8).empty;
    errdefer buffer.deinit(allocator);

    var last_was_space = true;
    try stripAndDecodeInto(&buffer, allocator, input, &last_was_space);

    // Pop trailing space if present
    if (buffer.items.len > 0 and buffer.items[buffer.items.len - 1] == ' ') {
        _ = buffer.pop();
    }

    return buffer.toOwnedSlice(allocator);
}

/// Writes slug directly into the buffer.
fn slugInto(buffer: *std.ArrayList(u8), allocator: std.mem.Allocator, text: []const u8) !void {
    for (text) |c| {
        if (slugger.shouldRemove(c)) {
            continue;
        } else if (c == ' ') {
            try buffer.append(allocator, '-');
        } else if (c >= 'A' and c <= 'Z') {
            try buffer.append(allocator, c + 32);
        } else {
            try buffer.append(allocator, c);
        }
    }
}

/// Attempts to extract a heading from a trimmed line.
/// If successful, appends the heading to the context's heading_offsets list.
/// Uses a temporary buffer for heading text/slug (not the main plainText buffer).
/// Returns true if a heading was extracted, false otherwise.
fn tryExtractHeading(ctx: *ParseContext, allocator: std.mem.Allocator, trimmed: []const u8) !bool {
    if (trimmed.len == 0) return false;

    var level: u8 = 0;
    while (level < trimmed.len and trimmed[level] == '#') : (level += 1) {}

    // Only extract ##, ###, and #### headings as per Boltdocs spec.
    if (level < 2 or level > 4 or level >= trimmed.len or trimmed[level] != ' ') {
        return false;
    }

    const raw_text = std.mem.trim(u8, trimmed[level..], " \t");

    // Use a temporary buffer for heading text processing (avoids contaminating plainText)
    var heading_buf = std.ArrayList(u8).empty;
    defer heading_buf.deinit(allocator);

    var temp_space = true;
    try stripAndDecodeInto(&heading_buf, allocator, raw_text, &temp_space);

    // Pop trailing space from heading text
    if (heading_buf.items.len > 0 and heading_buf.items[heading_buf.items.len - 1] == ' ') {
        _ = heading_buf.pop();
    }

    // Generate slug from decoded text
    const decoded_text = heading_buf.items;
    const id_start = heading_buf.items.len;
    try slugInto(&heading_buf, allocator, decoded_text);
    const heading_id = heading_buf.items[id_start..];

    // Copy text and id to separate allocations (they outlive the temporary buffer)
    const text_copy = try allocator.dupe(u8, decoded_text);
    errdefer allocator.free(text_copy);
    const id_copy = try allocator.dupe(u8, heading_id);
    errdefer allocator.free(id_copy);

    // Store in context headings list (with individually allocated text/id)
    try ctx.headings.append(allocator, .{
        .level = level,
        .text = text_copy,
        .id = id_copy,
    });

    return true;
}

/// Appends a line to the buffer for plainText accumulation.
/// Handles newline separation and calls stripAndDecodeInto.
fn appendLineToBuffer(ctx: *ParseContext, allocator: std.mem.Allocator, line: []const u8) !void {
    // Add space between lines (unless buffer is empty or ends with newline)
    if (ctx.buffer.items.len > 0) {
        const last_char = ctx.buffer.items[ctx.buffer.items.len - 1];
        if (last_char != '\n' and last_char != ' ') {
            try appendCharToBuffer(&ctx.buffer, allocator, ' ', &ctx.last_was_space);
        }
    }

    // Strip and decode the line content
    try stripAndDecodeInto(&ctx.buffer, allocator, line, &ctx.last_was_space);
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

/// Single-pass document parser.
/// Extracts headings and plainText in one scan through the content.
/// Uses a shared buffer for all text processing (minimal allocations).
/// Heading text and id are individually allocated for API compatibility.
pub fn parseDocSinglePass(allocator: std.mem.Allocator, file_content: []const u8) !ParsedDoc {
    const fm = parseFrontmatter(file_content);

    var ctx = ParseContext.init();
    defer ctx.deinit(allocator);

    var in_code_block = false;
    var lines = std.mem.splitScalar(u8, fm.content, '\n');

    while (lines.next()) |line| {
        const trimmed = std.mem.trim(u8, line, " \t\r");

        // Detect code block boundaries (only affects heading extraction, not plainText)
        if (std.mem.startsWith(u8, trimmed, "```") or std.mem.startsWith(u8, trimmed, "~~~")) {
            in_code_block = !in_code_block;
            // Still accumulate code fence lines into plainText
            try appendLineToBuffer(&ctx, allocator, line);
            continue;
        }

        // Try to extract heading (only when not in code block)
        if (!in_code_block and try tryExtractHeading(&ctx, allocator, trimmed)) {
            // Still accumulate heading lines into plainText (matches original behavior)
            try appendLineToBuffer(&ctx, allocator, line);
            continue;
        }

        // Accumulate all other lines into plainText
        if (trimmed.len > 0) {
            try appendLineToBuffer(&ctx, allocator, line);
        }
    }

    // Trim trailing whitespace from plainText
    if (ctx.buffer.items.len > 0 and ctx.buffer.items[ctx.buffer.items.len - 1] == ' ') {
        _ = ctx.buffer.pop();
    }

    // Generate description (first 160 chars of plainText)
    const desc_len = @min(ctx.buffer.items.len, 160);
    const description = try allocator.dupe(u8, ctx.buffer.items[0..desc_len]);

    // plainText is the buffer contents
    const plainText = try ctx.buffer.toOwnedSlice(allocator);

    const frontmatter = try yaml.parseYaml(allocator, fm.rawMatter);

    // Headings already have individually allocated text and id from tryExtractHeading.
    // Just transfer ownership to the result.
    return .{
        .rawMatter = fm.rawMatter,
        .content = fm.content,
        .headings = try ctx.headings.toOwnedSlice(allocator),
        .plainText = plainText,
        .description = description,
        .frontmatter = frontmatter,
    };
}

/// Extracts headings from markdown content (original function for backward compatibility).
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

/// Parses a full doc file (original function for backward compatibility).
pub fn parseDoc(allocator: std.mem.Allocator, file_content: []const u8) !ParsedDoc {
    const fm = parseFrontmatter(file_content);

    const headings = try extractHeadings(allocator, fm.content);
    errdefer allocator.free(headings);

    const plainText = try stripAndDecode(allocator, fm.content);
    errdefer allocator.free(plainText);

    // Generate description (first 160 chars)
    const desc_len = if (plainText.len > 160) @as(usize, 160) else plainText.len;
    const description = try allocator.dupe(u8, plainText[0..desc_len]);

    const frontmatter = try yaml.parseYaml(allocator, fm.rawMatter);

    return .{
        .rawMatter = fm.rawMatter,
        .content = fm.content,
        .headings = headings,
        .plainText = plainText,
        .description = description,
        .frontmatter = frontmatter,
    };
}
