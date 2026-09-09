const std = @import("std");

/// Minimal YAML value types for Boltdocs frontmatter.
pub const Value = union(enum) {
    null_value: void,
    bool_value: bool,
    int_value: i64,
    float_value: f64,
    string: []const u8,
    array: []Value,
    object: std.StringArrayHashMapUnmanaged(Value),

    /// Free all owned allocations recursively.
    pub fn deinit(self: *Value, allocator: std.mem.Allocator) void {
        switch (self.*) {
            .null_value, .bool_value, .int_value, .float_value => {},
            .string => |s| allocator.free(s),
            .array => |items| {
                for (items) |*item| item.deinit(allocator);
                allocator.free(items);
            },
            .object => |*obj| {
                var iter = obj.iterator();
                while (iter.next()) |*entry| {
                    const key_copy = entry.key_ptr.*;
                    entry.value_ptr.deinit(allocator);
                    allocator.free(key_copy);
                }
                obj.deinit(allocator);
            },
        }
    }
};

/// Parse a YAML frontmatter block into a Value.object.
/// Returns an object Value containing top-level key-value pairs.
pub fn parseYaml(allocator: std.mem.Allocator, input: []const u8) !Value {
    var parser = try YamlParser.init(allocator, input);
    defer parser.deinit();
    return try parser.parseRoot();
}

const YamlParser = struct {
    allocator: std.mem.Allocator,
    lines: std.ArrayListUnmanaged([]const u8),
    index: usize,

    fn init(allocator: std.mem.Allocator, input: []const u8) !YamlParser {
        var lines = std.ArrayListUnmanaged([]const u8).empty;
        errdefer lines.deinit(allocator);

        var it = std.mem.splitScalar(u8, input, '\n');
        while (it.next()) |line| {
            try lines.append(allocator, line);
        }

        return .{
            .allocator = allocator,
            .lines = lines,
            .index = 0,
        };
    }

    fn deinit(self: *YamlParser) void {
        self.lines.deinit(self.allocator);
    }

    fn current(self: *YamlParser) ?[]const u8 {
        if (self.index >= self.lines.items.len) return null;
        return self.lines.items[self.index];
    }

    fn trimmedLine(self: *YamlParser) ?[]const u8 {
        const line = self.current() orelse return null;
        return std.mem.trim(u8, line, " \t\r");
    }

    fn indentOf(self: *YamlParser) usize {
        const line = self.current() orelse return 0;
        var count: usize = 0;
        for (line) |c| {
            if (c == ' ') {
                count += 1;
            } else {
                break;
            }
        }
        return count;
    }

    fn advance(self: *YamlParser) void {
        self.index += 1;
    }

    fn parseRoot(self: *YamlParser) !Value {
        var obj = std.StringArrayHashMapUnmanaged(Value).empty;
        errdefer {
            var iter = obj.iterator();
            while (iter.next()) |*entry| {
                const key_copy = entry.key_ptr.*;
                entry.value_ptr.deinit(self.allocator);
                self.allocator.free(key_copy);
            }
            obj.deinit(self.allocator);
        }

        while (self.current() != null) {
            const line = self.trimmedLine() orelse break;

            if (line.len == 0 or std.mem.startsWith(u8, line, "#")) {
                self.advance();
                continue;
            }

            const colon_idx = indexOfUnquoted(line, ':');
            if (colon_idx == null or colon_idx.? == 0) {
                self.advance();
                continue;
            }

            const key = std.mem.trim(u8, line[0..colon_idx.?], " \t");
            const rest = std.mem.trim(u8, line[colon_idx.? + 1 ..], " \t");

            const key_copy = try self.allocator.dupe(u8, unquote(key));
            errdefer self.allocator.free(key_copy);

            const is_multiline = rest.len == 0;
            const value = if (is_multiline)
                try self.parseMultilineValue()
            else
                try self.parseInlineValue(rest);

            try obj.put(self.allocator, key_copy, value);
            // Multiline values already advanced past their lines;
            // only advance for inline values.
            if (!is_multiline) {
                self.advance();
            }
        }

        return Value{ .object = obj };
    }

    fn parseMultilineValue(self: *YamlParser) anyerror!Value {
        const base_indent = self.indentOf();
        self.advance();

        if (self.current() == null) {
            return Value{ .null_value = {} };
        }

        const first_line = self.trimmedLine() orelse return Value{ .null_value = {} };

        // Array of items
        if (std.mem.startsWith(u8, first_line, "-")) {
            return try self.parseArray(base_indent);
        }

        // Nested object
        if (indexOfUnquoted(first_line, ':') != null) {
            return try self.parseNestedObject(base_indent);
        }

        return Value{ .null_value = {} };
    }

    fn parseArray(self: *YamlParser, base_indent: usize) !Value {
        var items = std.ArrayListUnmanaged(Value).empty;
        errdefer {
            for (items.items) |*item| item.deinit(self.allocator);
            items.deinit(self.allocator);
        }

        while (self.current() != null) {
            const line = self.current().?;
            const trimmed = std.mem.trim(u8, line, " \t\r");

            if (trimmed.len == 0 or std.mem.startsWith(u8, trimmed, "#")) {
                self.advance();
                continue;
            }

            const line_indent = self.indentOf();
            if (line_indent < base_indent) break;
            if (!std.mem.startsWith(u8, trimmed, "-")) break;

            const item_content = std.mem.trim(u8, trimmed[1..], " \t");

            if (item_content.len == 0) {
                self.advance();
                continue;
            }

            const colon_pos = indexOfUnquoted(item_content, ':');
            if (colon_pos != null and
                !std.mem.startsWith(u8, item_content, "[") and
                !std.mem.startsWith(u8, item_content, "{") and
                !isQuoted(item_content) and
                // Don't treat URLs (e.g., "https://...") as inline objects.
                // URLs have `:` followed by `//`, e.g., "https://..."
                !(colon_pos.? + 2 < item_content.len and
                  item_content[colon_pos.? + 1] == '/' and
                  item_content[colon_pos.? + 2] == '/'))
            {
                // Inline object item: "key: value, key2: value2"
                const obj = try self.parseInlineObject(item_content);
                try items.append(self.allocator, obj);
                self.advance();
                continue;
            }

            const value = try self.parseInlineValue(item_content);
            try items.append(self.allocator, value);

            self.advance();
        }

        return Value{ .array = try items.toOwnedSlice(self.allocator) };
    }

    fn parseNestedObject(self: *YamlParser, base_indent: usize) !Value {
        var obj = std.StringArrayHashMapUnmanaged(Value).empty;
        errdefer {
            var iter = obj.iterator();
            while (iter.next()) |*entry| {
                const key_copy = entry.key_ptr.*;
                entry.value_ptr.deinit(self.allocator);
                self.allocator.free(key_copy);
            }
            obj.deinit(self.allocator);
        }

        while (self.current() != null) {
            const line = self.current().?;
            const trimmed = std.mem.trim(u8, line, " \t\r");

            if (trimmed.len == 0 or std.mem.startsWith(u8, trimmed, "#")) {
                self.advance();
                continue;
            }

            const line_indent = self.indentOf();
            if (line_indent <= base_indent) break;

            const colon_idx = indexOfUnquoted(trimmed, ':');
            if (colon_idx == null or colon_idx.? == 0) {
                self.advance();
                continue;
            }

            const key = std.mem.trim(u8, trimmed[0..colon_idx.?], " \t");
            const rest = std.mem.trim(u8, trimmed[colon_idx.? + 1 ..], " \t");

            const key_copy = try self.allocator.dupe(u8, unquote(key));
            errdefer self.allocator.free(key_copy);

            const is_multiline = rest.len == 0;
            const value = if (is_multiline)
                try self.parseMultilineValue()
            else
                try self.parseInlineValue(rest);

            try obj.put(self.allocator, key_copy, value);
            // Multiline values already advanced past their lines;
            // only advance for inline values.
            if (!is_multiline) {
                self.advance();
            }
        }

        return Value{ .object = obj };
    }

    fn parseInlineValue(self: *YamlParser, input: []const u8) anyerror!Value {
        const trimmed = std.mem.trim(u8, input, " \t");

        if (trimmed.len == 0 or std.mem.eql(u8, trimmed, "null") or std.mem.eql(u8, trimmed, "~")) {
            return Value{ .null_value = {} };
        }

        if (std.mem.eql(u8, trimmed, "true")) return Value{ .bool_value = true };
        if (std.mem.eql(u8, trimmed, "false")) return Value{ .bool_value = false };

        if (std.mem.startsWith(u8, trimmed, "[") and std.mem.endsWith(u8, trimmed, "]")) {
            return try self.parseInlineArray(trimmed);
        }

        if (std.mem.startsWith(u8, trimmed, "{") and std.mem.endsWith(u8, trimmed, "}")) {
            return try self.parseInlineObject(trimmed);
        }

        if (isQuoted(trimmed)) {
            return Value{ .string = try self.allocator.dupe(u8, unquote(trimmed)) };
        }

        // Number
        const maybe_number = parseNumber(trimmed);
        if (maybe_number) |num| {
            return num;
        }

        return Value{ .string = try self.allocator.dupe(u8, trimmed) };
    }

    fn parseInlineArray(self: *YamlParser, input: []const u8) anyerror!Value {
        const inner = std.mem.trim(u8, input[1 .. input.len - 1], " \t");
        var items = std.ArrayListUnmanaged(Value).empty;
        errdefer {
            for (items.items) |*item| item.deinit(self.allocator);
            items.deinit(self.allocator);
        }

        if (inner.len == 0) {
            return Value{ .array = try items.toOwnedSlice(self.allocator) };
        }

        var parts = std.mem.splitScalar(u8, inner, ',');
        while (parts.next()) |part| {
            const value = try self.parseInlineValue(part);
            try items.append(self.allocator, value);
        }

        return Value{ .array = try items.toOwnedSlice(self.allocator) };
    }

    fn parseInlineObject(self: *YamlParser, input: []const u8) anyerror!Value {
        const trimmed = std.mem.trim(u8, input, " \t");
        var obj = std.StringArrayHashMapUnmanaged(Value).empty;
        errdefer {
            var iter = obj.iterator();
            while (iter.next()) |*entry| {
                const key_copy = entry.key_ptr.*;
                entry.value_ptr.deinit(self.allocator);
                self.allocator.free(key_copy);
            }
            obj.deinit(self.allocator);
        }

        const inner = if (std.mem.startsWith(u8, trimmed, "{") and std.mem.endsWith(u8, trimmed, "}"))
            std.mem.trim(u8, trimmed[1 .. trimmed.len - 1], " \t")
        else
            trimmed;

        if (inner.len == 0) {
            return Value{ .object = obj };
        }

        var pairs = std.ArrayListUnmanaged([]const u8).empty;
        defer pairs.deinit(self.allocator);

        // Split by comma, but respect nested braces and quotes
        var depth: usize = 0;
        var start: usize = 0;
        var in_quote: u8 = 0;
        var i: usize = 0;
        while (i < inner.len) : (i += 1) {
            const c = inner[i];
            if (in_quote == 0) {
                if (c == '{' or c == '[') {
                    depth += 1;
                } else if (c == '}' or c == ']') {
                    if (depth > 0) depth -= 1;
                } else if (c == '"' or c == '\'') {
                    in_quote = c;
                } else if (c == ',' and depth == 0) {
                    try pairs.append(self.allocator, std.mem.trim(u8, inner[start..i], " \t"));
                    start = i + 1;
                }
            } else {
                if (c == in_quote) {
                    in_quote = 0;
                }
            }
        }
        if (start < inner.len) {
            try pairs.append(self.allocator, std.mem.trim(u8, inner[start..], " \t"));
        }

        for (pairs.items) |pair| {
            const colon_idx = indexOfUnquoted(pair, ':');
            if (colon_idx == null or colon_idx.? == 0) continue;

            const key = std.mem.trim(u8, pair[0..colon_idx.?], " \t");
            const value_str = std.mem.trim(u8, pair[colon_idx.? + 1 ..], " \t");

            const key_copy = try self.allocator.dupe(u8, unquote(key));
            errdefer self.allocator.free(key_copy);

            const value = try self.parseInlineValue(value_str);
            try obj.put(self.allocator, key_copy, value);
        }

        return Value{ .object = obj };
    }
};

fn isQuoted(input: []const u8) bool {
    const trimmed = std.mem.trim(u8, input, " \t");
    if (trimmed.len < 2) return false;
    return (trimmed[0] == '"' and trimmed[trimmed.len - 1] == '"') or
        (trimmed[0] == '\'' and trimmed[trimmed.len - 1] == '\'');
}

fn unquote(input: []const u8) []const u8 {
    const trimmed = std.mem.trim(u8, input, " \t");
    if (trimmed.len < 2) return trimmed;
    if ((trimmed[0] == '"' and trimmed[trimmed.len - 1] == '"') or
        (trimmed[0] == '\'' and trimmed[trimmed.len - 1] == '\''))
    {
        return trimmed[1 .. trimmed.len - 1];
    }
    return trimmed;
}

fn indexOfUnquoted(input: []const u8, target: u8) ?usize {
    var in_quote: u8 = 0;
    for (input, 0..) |c, i| {
        if (in_quote == 0) {
            if (c == '"' or c == '\'') {
                in_quote = c;
            } else if (c == target) {
                return i;
            }
        } else if (c == in_quote) {
            in_quote = 0;
        }
    }
    return null;
}

fn parseNumber(input: []const u8) ?Value {
    const trimmed = std.mem.trim(u8, input, " \t");
    if (trimmed.len == 0) return null;

    var is_float = false;
    var start: usize = 0;
    if (trimmed[0] == '-' or trimmed[0] == '+') {
        if (trimmed.len == 1) return null;
        start = 1;
    }

    for (trimmed[start..]) |c| {
        if (c == '.') {
            if (is_float) return null;
            is_float = true;
        } else if (c < '0' or c > '9') {
            return null;
        }
    }

    if (is_float) {
        const val = std.fmt.parseFloat(f64, trimmed) catch return null;
        return Value{ .float_value = val };
    } else {
        const val = std.fmt.parseInt(i64, trimmed, 10) catch return null;
        return Value{ .int_value = val };
    }
}
