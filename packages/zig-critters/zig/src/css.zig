const std = @import("std");
const mem = std.mem;
const Allocator = mem.Allocator;

pub const RuleType = enum {
    rule,
    atrule,
    comment,
};

pub const AtRuleType = enum {
    media,
    keyframes,
    font_face,
    layer,
    supports,
    property,
    other,
};

pub const CssRule = struct {
    type: RuleType,
    selector: ?[]const u8 = null,
    declarations: []const Declaration = &.{},
    children: []CssRule = &.{},
    at_rule_type: AtRuleType = .other,
    at_rule_name: []const u8 = "",
    at_rule_params: []const u8 = "",
    is_comment_include: bool = false,
    is_comment_exclude: bool = false,
    marked_for_removal: bool = false,
};

pub const Declaration = struct {
    property: []const u8,
    value: []const u8,
    important: bool = false,
};

const Token = enum {
    Ident,
    AtKeyword,
    Hash,
    String,
    Number,
    Delim,
    Colon,
    Semicolon,
    Comma,
    LeftBrace,
    RightBrace,
    LeftParen,
    RightParen,
    LeftBracket,
    RightBracket,
    Whitespace,
    Comment,
    Eof,
};

const TokenInfo = struct {
    kind: Token,
    start: usize,
    end: usize,
};

pub const CssParser = struct {
    input: []const u8,
    pos: usize,
    allocator: Allocator,

    pub fn init(allocator: Allocator, input: []const u8) CssParser {
        return .{ .input = input, .pos = 0, .allocator = allocator };
    }

    fn peek(self: *const CssParser) u8 {
        if (self.pos >= self.input.len) return 0;
        return self.input[self.pos];
    }

    fn advance(self: *CssParser) void {
        if (self.pos < self.input.len) self.pos += 1;
    }

    fn skipWhitespace(self: *CssParser) void {
        while (self.pos < self.input.len) {
            const c = self.input[self.pos];
            if (c == ' ' or c == '\t' or c == '\n' or c == '\r') {
                self.pos += 1;
            } else if (c == '/' and self.pos + 1 < self.input.len and self.input[self.pos + 1] == '*') {
                self.skipComment();
            } else {
                break;
            }
        }
    }

    fn skipComment(self: *CssParser) void {
        if (self.pos + 1 < self.input.len and self.input[self.pos] == '/' and self.input[self.pos + 1] == '*') {
            self.pos += 2;
            while (self.pos + 1 < self.input.len) {
                if (self.input[self.pos] == '*' and self.input[self.pos + 1] == '/') {
                    self.pos += 2;
                    return;
                }
                self.pos += 1;
            }
            self.pos = self.input.len;
        }
    }

    fn readUntil(self: *CssParser, delimiter: u8) []const u8 {
        const start = self.pos;
        while (self.pos < self.input.len and self.input[self.pos] != delimiter) {
            // Always stop at closing brace to prevent runaway parsing past block boundaries
            if (self.input[self.pos] == '}') break;
            if (self.input[self.pos] == '\'' or self.input[self.pos] == '"') {
                const q = self.input[self.pos];
                self.pos += 1;
                while (self.pos < self.input.len and self.input[self.pos] != q) {
                    if (self.input[self.pos] == '\\') self.pos += 1;
                    self.pos += 1;
                }
                if (self.pos < self.input.len) self.pos += 1;
            } else if (self.input[self.pos] == '(') {
                self.pos += 1;
                var depth: u32 = 1;
                while (self.pos < self.input.len and depth > 0) {
                    if (self.input[self.pos] == '(') depth += 1;
                    if (self.input[self.pos] == ')') depth -= 1;
                    self.pos += 1;
                }
                continue;
            } else {
                self.pos += 1;
            }
        }
        return self.input[start..self.pos];
    }

    fn readBlock(self: *CssParser) []const u8 {
        var depth: u32 = 1;
        const start = self.pos;
        while (self.pos < self.input.len and depth > 0) {
            const c = self.input[self.pos];
            if (c == '{') depth += 1;
            if (c == '}') depth -= 1;
            if (c == '\'' or c == '"') {
                const q = c;
                self.pos += 1;
                while (self.pos < self.input.len and self.input[self.pos] != q) {
                    if (self.input[self.pos] == '\\') self.pos += 1;
                    self.pos += 1;
                }
            }
            if (depth > 0) self.pos += 1;
        }
        const result = self.input[start..self.pos];
        if (self.pos < self.input.len) self.pos += 1; // skip closing }
        return result;
    }

    fn readIdent(self: *CssParser) []const u8 {
        const start = self.pos;
        while (self.pos < self.input.len) {
            const c = self.input[self.pos];
            if ((c >= 'a' and c <= 'z') or (c >= 'A' and c <= 'Z') or (c >= '0' and c <= '9') or c == '-' or c == '_' or c > 127) {
                self.pos += 1;
            } else {
                break;
            }
        }
        return self.input[start..self.pos];
    }

    fn isAtRuleName(self: *const CssParser) bool {
        if (self.pos >= self.input.len or self.input[self.pos] != '@') return false;
        const saved = self.pos;
        self.pos += 1;
        const name = self.readIdent();
        self.pos = saved;
        return name.len > 0;
    }

    fn parseAtRuleName(self: *CssParser) []const u8 {
        self.pos += 1; // skip @
        return self.readIdent();
    }

    fn classifyAtRule(name: []const u8) AtRuleType {
        if (mem.eql(u8, name, "media")) return .media;
        if (mem.eql(u8, name, "keyframes") or mem.eql(u8, name, "-webkit-keyframes")) return .keyframes;
        if (mem.eql(u8, name, "font-face")) return .font_face;
        if (mem.eql(u8, name, "layer")) return .layer;
        if (mem.eql(u8, name, "supports")) return .supports;
        if (mem.eql(u8, name, "property")) return .property;
        return .other;
    }

    fn parseDeclarations(self: *CssParser) []Declaration {
        var declarations = std.ArrayList(Declaration).empty;
        defer declarations.deinit(self.allocator);

        while (self.pos < self.input.len) {
            self.skipWhitespace();
            if (self.pos >= self.input.len) break;
            if (self.input[self.pos] == '}') break;

            // Check for comments (beasties include/exclude)
            if (self.input[self.pos] == '/' and self.pos + 1 < self.input.len and self.input[self.pos + 1] == '*') {
                const comment_start = self.pos;
                self.skipComment();
                const comment_text = self.input[comment_start..self.pos];
                // Check for beasties directives
                if (mem.indexOf(u8, comment_text, "beasties:include") != null or mem.indexOf(u8, comment_text, "beasties:exclude") != null) {
                    // These are handled at rule level, skip in declarations
                }
                continue;
            }

            // Read property name
            const prop_start = self.pos;
            while (self.pos < self.input.len) {
                const c = self.input[self.pos];
                if (c == ':' or c == ';' or c == '}' or isWhitespace(c)) break;
                self.pos += 1;
            }
            const prop = mem.trim(u8, self.input[prop_start..self.pos], " \t\n\r");

            if (prop.len == 0) {
                self.pos += 1;
                continue;
            }

            self.skipWhitespace();
            if (self.pos >= self.input.len or self.input[self.pos] != ':') continue;
            self.pos += 1; // skip :
            self.skipWhitespace();

            // Read value until ; or }
            const val = self.readUntil(';');
            const val_trimmed = trimRight(u8, val, " \t\n\r");

            // Check for !important
            var important = false;
            if (mem.indexOf(u8, val_trimmed, "!important")) |_| {
                important = true;
            }

            if (self.pos < self.input.len and self.input[self.pos] == ';') {
                self.pos += 1;
            }

            declarations.append(self.allocator, .{
                .property = prop,
                .value = val_trimmed,
                .important = important,
            }) catch continue;
        }

        return declarations.toOwnedSlice(self.allocator) catch &.{};
    }

    fn parseSelectors(self: *CssParser) []const u8 {
        const start = self.pos;
        while (self.pos < self.input.len) {
            const c = self.input[self.pos];
            if (c == '{') break;
            if (c == '\'' or c == '"') {
                const q = c;
                self.pos += 1;
                while (self.pos < self.input.len and self.input[self.pos] != q) {
                    if (self.input[self.pos] == '\\') self.pos += 1;
                    self.pos += 1;
                }
                if (self.pos < self.input.len) self.pos += 1;
            } else if (c == '(') {
                self.pos += 1;
                var depth: u32 = 1;
                while (self.pos < self.input.len and depth > 0) {
                    if (self.input[self.pos] == '(') depth += 1;
                    if (self.input[self.pos] == ')') depth -= 1;
                    self.pos += 1;
                }
            } else {
                self.pos += 1;
            }
        }
        return mem.trim(u8, self.input[start..self.pos], " \t\n\r");
    }

fn isWhitespace(c: u8) bool {
    return c == ' ' or c == '\t' or c == '\n' or c == '\r';
}

fn trimRight(comptime T: type, slice: []const T, chars: []const T) []const T {
    var end = slice.len;
    while (end > 0) {
        var found = false;
        for (chars) |c| {
            if (slice[end - 1] == c) {
                found = true;
                break;
            }
        }
        if (!found) break;
        end -= 1;
    }
    return slice[0..end];
}

    pub fn parseStylesheet(self: *CssParser) []CssRule {
        var rules = std.ArrayList(CssRule).empty;
        defer rules.deinit(self.allocator);

        while (self.pos < self.input.len) {
            self.skipWhitespace();
            if (self.pos >= self.input.len) break;

            const c = self.input[self.pos];

            // Comment
            if (c == '/' and self.pos + 1 < self.input.len and self.input[self.pos + 1] == '*') {
                const comment_start = self.pos;
                self.skipComment();
                const comment_text = self.input[comment_start..self.pos];

                // Check for beasties directives
                const is_include = mem.indexOf(u8, comment_text, "beasties:include") != null;
                const is_exclude = mem.indexOf(u8, comment_text, "beasties:exclude") != null;

                if (is_include or is_exclude) {
                    // The directive applies to the next rule
                    rules.append(self.allocator, .{
                        .type = .comment,
                        .is_comment_include = is_include,
                        .is_comment_exclude = is_exclude,
                    }) catch continue;
                }
                continue;
            }

            // At-rule
            if (c == '@') {
                const at_name = self.parseAtRuleName();
                const at_type = classifyAtRule(at_name);

                self.skipWhitespace();

                // Read params (for @media, @keyframes, @supports, @layer, @property etc.)
                // Stop at {, ;, or } to handle both block and statement forms
                var params: []const u8 = "";
                if (at_type == .media or at_type == .keyframes or at_type == .supports or at_type == .layer or at_type == .property) {
                    const start = self.pos;
                    while (self.pos < self.input.len) {
                        const ch = self.input[self.pos];
                        if (ch == '{' or ch == ';' or ch == '}') break;
                        if (ch == '\'' or ch == '"') {
                            const q = ch;
                            self.pos += 1;
                            while (self.pos < self.input.len and self.input[self.pos] != q) {
                                if (self.input[self.pos] == '\\') self.pos += 1;
                                self.pos += 1;
                            }
                            if (self.pos < self.input.len) self.pos += 1;
                        } else if (ch == '(') {
                            self.pos += 1;
                            var depth: u32 = 1;
                            while (self.pos < self.input.len and depth > 0) {
                                if (self.input[self.pos] == '(') depth += 1;
                                if (self.input[self.pos] == ')') depth -= 1;
                                self.pos += 1;
                            }
                        } else {
                            self.pos += 1;
                        }
                    }
                    params = trimRight(u8, self.input[start..self.pos], " \t\n\r");
                }

                self.skipWhitespace();

                if (self.pos < self.input.len and self.input[self.pos] == '{') {
                    self.pos += 1; // skip {

                    if (at_type == .font_face or at_type == .property) {
                        // @font-face and @property have declarations only
                        const decls = self.parseDeclarations();
                        rules.append(self.allocator, .{
                            .type = .atrule,
                            .at_rule_type = at_type,
                            .at_rule_name = at_name,
                            .at_rule_params = params,
                            .declarations = decls,
                        }) catch continue;
                    } else if (at_type == .keyframes) {
                        // @keyframes has nested rules
                        const children = self.parseKeyframeRules();
                        rules.append(self.allocator, .{
                            .type = .atrule,
                            .at_rule_type = .keyframes,
                            .at_rule_name = at_name,
                            .at_rule_params = params,
                            .children = children,
                        }) catch continue;
                    } else {
                        // @media, @supports, @layer have nested rules
                        const children = self.parseStylesheet();
                        rules.append(self.allocator, .{
                            .type = .atrule,
                            .at_rule_type = at_type,
                            .at_rule_name = at_name,
                            .at_rule_params = params,
                            .children = children,
                        }) catch continue;
                    }
                } else {
                    // At-rule without block (e.g., @charset, @import)
                    // Must handle quoted strings to avoid stopping at ; inside URLs
                    while (self.pos < self.input.len and self.input[self.pos] != ';' and self.input[self.pos] != '{') {
                        if (self.input[self.pos] == '\'' or self.input[self.pos] == '"') {
                            const q = self.input[self.pos];
                            self.pos += 1;
                            while (self.pos < self.input.len and self.input[self.pos] != q) {
                                if (self.input[self.pos] == '\\') self.pos += 1;
                                self.pos += 1;
                            }
                            if (self.pos < self.input.len) self.pos += 1;
                        } else {
                            self.pos += 1;
                        }
                    }
                    if (self.pos < self.input.len and self.input[self.pos] == ';') self.pos += 1;
                }
                continue;
            }

            // Regular rule or end of block
            if (c == '}') {
                self.pos += 1;
                break;
            }

            // Regular CSS rule
            const selector = self.parseSelectors();
            self.skipWhitespace();

            if (self.pos < self.input.len and self.input[self.pos] == '{') {
                self.pos += 1; // skip {
                const decls = self.parseDeclarations();
                // Consume closing }
                if (self.pos < self.input.len and self.input[self.pos] == '}') {
                    self.pos += 1;
                }
                rules.append(self.allocator, .{
                    .type = .rule,
                    .selector = selector,
                    .declarations = decls,
                }) catch continue;
            }
        }

        return rules.toOwnedSlice(self.allocator) catch &.{};
    }

    fn parseKeyframeRules(self: *CssParser) []CssRule {
        var rules = std.ArrayList(CssRule).empty;
        defer rules.deinit(self.allocator);

        while (self.pos < self.input.len) {
            self.skipWhitespace();
            if (self.pos >= self.input.len) break;
            if (self.input[self.pos] == '}') {
                self.pos += 1;
                break;
            }

            // Read keyframe selector (e.g., "0%", "100%", "from", "to")
            const selector = self.parseSelectors();
            self.skipWhitespace();

            if (self.pos < self.input.len and self.input[self.pos] == '{') {
                self.pos += 1;
                const decls = self.parseDeclarations();
                rules.append(self.allocator, .{
                    .type = .rule,
                    .selector = selector,
                    .declarations = decls,
                }) catch continue;
            }
        }

        return rules.toOwnedSlice(self.allocator) catch &.{};
    }

    pub fn serializeStyleSheet(self: *const CssParser, rules: []const CssRule, compress: bool) ![]u8 {
        var output = std.ArrayList(u8).empty;
        defer output.deinit(self.allocator);

        for (rules) |rule| {
            if (rule.marked_for_removal) continue;

            switch (rule.type) {
                .comment => {},
                .rule => {
                    if (rule.selector) |sel| {
                        try output.appendSlice(self.allocator, sel);
                        if (!compress) try output.append(self.allocator, ' ');
                        try output.append(self.allocator, '{');
                        for (rule.declarations) |decl| {
                            if (!compress) try output.appendSlice(self.allocator, "  ");
                            try output.appendSlice(self.allocator, decl.property);
                            try output.append(self.allocator, ':');
                            try output.appendSlice(self.allocator, decl.value);
                            if (decl.important) try output.appendSlice(self.allocator, " !important");
                            try output.append(self.allocator, ';');
                        }
                        try output.append(self.allocator, '}');
                    }
                },
                .atrule => {
                    try output.append(self.allocator, '@');
                    try output.appendSlice(self.allocator, rule.at_rule_name);
                    if (rule.at_rule_params.len > 0) {
                        try output.append(self.allocator, ' ');
                        try output.appendSlice(self.allocator, rule.at_rule_params);
                    }
                    try output.append(self.allocator, '{');
                    const inner = try self.serializeStyleSheet(rule.children, compress);
                    try output.appendSlice(self.allocator, inner);
                    self.allocator.free(inner);
                    try output.append(self.allocator, '}');

                    // Also serialize declarations (for @font-face)
                    for (rule.declarations) |decl| {
                        if (!compress) try output.appendSlice(self.allocator, "  ");
                        try output.appendSlice(self.allocator, decl.property);
                        try output.append(self.allocator, ':');
                        try output.appendSlice(self.allocator, decl.value);
                        if (decl.important) try output.appendSlice(self.allocator, " !important");
                        try output.append(self.allocator, ';');
                    }
                },
            }
        }

        return output.toOwnedSlice(self.allocator);
    }
};

test "parse simple rule" {
    const allocator = std.testing.allocator;
    var parser = CssParser.init(allocator, "div { color: red; }");
    const rules = parser.parseStylesheet();
    defer {
        for (rules) |rule| {
            if (rule.declarations.len > 0) allocator.free(rule.declarations);
        }
        allocator.free(rules);
    }
    try std.testing.expectEqual(@as(usize, 1), rules.len);
    try std.testing.expectEqual(@as(usize, 1), rules[0].declarations.len);
}

test "parse @media" {
    const allocator = std.testing.allocator;
    var parser = CssParser.init(allocator, "@media screen { .foo { color: blue; } }");
    const rules = parser.parseStylesheet();
    defer {
        for (rules) |rule| {
            for (rule.children) |child| {
                if (child.declarations.len > 0) allocator.free(child.declarations);
            }
            if (rule.children.len > 0) allocator.free(rule.children);
        }
        allocator.free(rules);
    }
    try std.testing.expectEqual(@as(usize, 1), rules.len);
    try std.testing.expectEqual(AtRuleType.media, rules[0].at_rule_type);
    try std.testing.expectEqual(@as(usize, 1), rules[0].children.len);
}

test "parse @font-face" {
    const allocator = std.testing.allocator;
    var parser = CssParser.init(allocator, "@font-face { font-family: 'Arial'; src: url('arial.woff2'); }");
    const rules = parser.parseStylesheet();
    defer {
        for (rules) |rule| {
            if (rule.declarations.len > 0) allocator.free(rule.declarations);
        }
        allocator.free(rules);
    }
    try std.testing.expectEqual(@as(usize, 1), rules.len);
    try std.testing.expectEqual(AtRuleType.font_face, rules[0].at_rule_type);
    try std.testing.expectEqual(@as(usize, 2), rules[0].declarations.len);
}
