const std = @import("std");
const mem = std.mem;
const Allocator = mem.Allocator;

pub const SelectorTokenType = enum {
    tag,
    class,
    id,
    universal,
    attribute,
    combinator_descendant,
    combinator_child,
    combinator_sibling,
    combinator_adjacent,
    group_end,
};

pub const AttrOp = enum {
    exists,
    equals,
    includes,
    dash,
    prefix,
    suffix,
    substring,
};

/// The kinds of name a page can have. A tag, a class and an id are kept
/// apart: `div` as a tag and `div` as a class are different names, and a
/// filter that mixed them would let a rule through that cannot match — or
/// drop one that can.
pub const TokenKind = enum(u8) {
    tag = 1,
    class = 2,
    id = 3,
};

/// The names a page has, as a bitmap of hashes.
///
/// Matching a rule means trying it against every element of the page, and
/// that is where the time of an extraction goes: the stylesheet of the
/// documentation site has fifteen hundred rules and a page has a thousand
/// elements, so a page costs fifteen hundred thousand attempts to answer a
/// question most of the time is "no".
///
/// Almost all of those attempts are hopeless before they start. A rule whose
/// last compound asks for a class the page does not have cannot match, and
/// the page can say so in one lookup. This filter answers that: it holds a
/// hash of every tag, class and id of the page, and a rule whose required
/// name is not in it is dropped without touching the elements.
///
/// It is a filter, not a set: a name that is not in the page can still be
/// reported as possibly present, because two names can hash to the same
/// place. That only costs time — the rule is then matched as before. A name
/// that IS in the page is never reported as absent, so no rule that could
/// match is ever dropped.
pub const TokenFilter = struct {
    words: []u64,
    mask: usize,

    /// The filter holds 2^18 bits — 32 kB. A page with a few thousand names
    /// fills about two percent of them, so a name that is not in the page
    /// passes the filter two times in a hundred.
    pub fn init(allocator: Allocator) !TokenFilter {
        const words = try allocator.alloc(u64, 4096);
        @memset(words, 0);
        return .{ .words = words, .mask = 4095 };
    }

    fn hash(kind: TokenKind, name: []const u8) u64 {
        var h: u64 = 0xcbf29ce484222325;
        h = (h ^ @intFromEnum(kind)) *% 0x100000001b3;
        for (name) |c| {
            h = (h ^ c) *% 0x100000001b3;
        }
        h ^= h >> 33;
        h *%= 0xff51afd7ed558ccd;
        h ^= h >> 33;
        return h;
    }

    pub fn add(self: *TokenFilter, kind: TokenKind, name: []const u8) void {
        if (name.len == 0) return;
        const h = hash(kind, name);
        const bit: u6 = @truncate(h);
        const index = self.indexOf(h);
        self.words[index] |= @as(u64, 1) << bit;
    }

    /// Whether the name may be in the page. False means it is not.
    pub fn mayContain(self: *const TokenFilter, kind: TokenKind, name: []const u8) bool {
        if (name.len == 0) return true;
        const h = hash(kind, name);
        const bit: u6 = @truncate(h);
        const index = self.indexOf(h);
        return (self.words[index] & (@as(u64, 1) << bit)) != 0;
    }

    fn indexOf(self: *const TokenFilter, h: u64) usize {
        return @as(usize, @truncate(h >> 6)) & self.mask;
    }
};

/// Whether the selector could match an element of a page with these names.
///
/// Every name of a selector has to be somewhere in the page for the selector
/// to match: the subject compound names the element, and every other
/// compound names one of its ancestors — all of them elements of the page.
/// So a rule that asks for a class the page does not have cannot match, and
/// neither can a rule that asks for a tag the page does not have.
///
/// A selector with groups (a comma) matches when any of its groups matches,
/// so the groups are checked one by one.
pub fn mayMatchPage(
    tokens: []const SelectorToken,
    filter: *const TokenFilter,
) bool {
    var group_start: usize = 0;
    var index: usize = 0;
    while (index <= tokens.len) : (index += 1) {
        if (index != tokens.len and tokens[index] != .group_end) continue;
        const group = tokens[group_start..index];
        group_start = index + 1;
        if (group.len == 0) continue;
        if (groupMayMatch(group, filter)) return true;
    }
    return false;
}

/// Whether every name of the group may be in the page.
fn groupMayMatch(group: []const SelectorToken, filter: *const TokenFilter) bool {
    for (group) |token| {
        switch (token) {
            .tag => |name| if (!filter.mayContain(.tag, name)) return false,
            .class => |name| if (!filter.mayContain(.class, name)) return false,
            .id => |name| if (!filter.mayContain(.id, name)) return false,
            else => {},
        }
    }
    return true;
}

pub const SelectorToken = union(SelectorTokenType) {
    tag: []const u8,
    class: []const u8,
    id: []const u8,
    universal,
    attribute: AttrSelector,
    combinator_descendant,
    combinator_child,
    combinator_sibling,
    combinator_adjacent,
    group_end,
};

pub const AttrSelector = struct {
    name: []const u8,
    op: AttrOp,
    value: []const u8,
};

pub const Element = struct {
    tag: []const u8,
    classes: []const []const u8,
    id: ?[]const u8,
    attrs: []const Attr,
};

pub const Attr = struct {
    name: []const u8,
    value: []const u8,
};

/// Strip pseudo-classes and pseudo-elements from a selector string.
/// This matches Beasties' behavior: if the base element exists in DOM, the rule is kept.
/// Handles CSS escape sequences: \: is a literal colon, not a pseudo-class separator.
fn stripPseudo(sel: []const u8) []const u8 {
    var result = sel;
    while (result.len > 0) {
        var found = false;
        var i: usize = 0;
        while (i < result.len) : (i += 1) {
            // Skip escaped characters (\x) - these are literal, not pseudo
            if (result[i] == '\\' and i + 1 < result.len) {
                i += 2; // Skip backslash and the escaped character
                continue;
            }
            if (result[i] == ':' and i + 1 < result.len and result[i + 1] == ':') {
                // Pseudo-element ::xxx (only if not escaped)
                const start = i;
                i += 2;
                while (i < result.len and result[i] != ' ' and result[i] != ',' and result[i] != '>' and result[i] != '+' and result[i] != '~') : (i += 1) {}
                if (i < result.len and result[i] == '(') {
                    i += 1;
                    var depth: u32 = 1;
                    while (i < result.len and depth > 0) : (i += 1) {
                        if (result[i] == '(') depth += 1;
                        if (result[i] == ')') depth -= 1;
                    }
                }
                result.len = start;
                found = true;
                break;
            } else if (result[i] == ':' and i + 1 < result.len and isAsciiAlpha(result[i + 1])) {
                // Pseudo-class :xxx (only if not escaped)
                const start = i;
                i += 1;
                while (i < result.len and isAsciiAlpha(result[i])) : (i += 1) {}
                if (i < result.len and result[i] == '(') {
                    i += 1;
                    var depth: u32 = 1;
                    while (i < result.len and depth > 0) : (i += 1) {
                        if (result[i] == '(') depth += 1;
                        if (result[i] == ')') depth -= 1;
                    }
                }
                // Remove trailing space if present
                while (result.len > start and result.len > 0 and result[result.len - 1] == ' ') {
                    result.len -= 1;
                }
                result.len = start;
                found = true;
                break;
            }
        }
        if (!found) break;
    }
    // Trim trailing whitespace
    while (result.len > 0 and result[result.len - 1] == ' ') {
        result.len -= 1;
    }
    // Trim leading whitespace
    while (result.len > 0 and result[0] == ' ') {
        result.ptr += 1;
        result.len -= 1;
    }
    return result;
}

fn isAsciiAlpha(c: u8) bool {
    return (c >= 'a' and c <= 'z') or (c >= 'A' and c <= 'Z');
}

fn isAsciiAlphaNum(c: u8) bool {
    return isAsciiAlpha(c) or (c >= '0' and c <= '9');
}

fn isSpace(c: u8) bool {
    return c == ' ' or c == '\t' or c == '\n' or c == '\r';
}

fn isCombinator(c: u8) bool {
    return c == '>' or c == '+' or c == '~';
}

/// Parse a single CSS selector into a list of tokens.
/// Supports: tag, .class, #id, [attr], [attr="v"], [attr~="v"], [attr|="v"], [attr^="v"], [attr$="v"], [attr*="v"],
/// combinators: > + ~ and descendant (space), universal *, comma groups.
/// Pseudo-classes/elements are stripped before parsing (Beasties behavior).
/// Release selector tokens and any decoded class/id names owned by the token list.
/// Attribute and tag slices borrow from the original selector input.
pub fn freeSelectorTokens(allocator: Allocator, tokens: []SelectorToken) void {
    for (tokens) |token| {
        switch (token) {
            .class => |value| allocator.free(value),
            .id => |value| allocator.free(value),
            else => {},
        }
    }
    allocator.free(tokens);
}

pub fn parseSelector(allocator: Allocator, sel: []const u8) ![]SelectorToken {
    const stripped = stripPseudo(sel);
    if (stripped.len == 0) return &[_]SelectorToken{};

    var tokens = std.ArrayList(SelectorToken).empty;
    errdefer tokens.deinit(allocator);

    var i: usize = 0;
    var last_was_combinator = true; // Start true so leading spaces are descendant combinators
    var last_was_tag_or_universal = false;

    while (i < stripped.len) {
        const c = stripped[i];

        if (isSpace(c)) {
            if (!last_was_combinator and !last_was_tag_or_universal) {
                // Descendant combinator
                try tokens.append(allocator, .combinator_descendant);
                last_was_combinator = true;
            }
            i += 1;
            continue;
        }

        last_was_tag_or_universal = false;

        if (c == ',') {
            // Group separator - add group_end marker
            try tokens.append(allocator, .group_end);
            last_was_combinator = true;
            i += 1;
            continue;
        }

        if (isCombinator(c)) {
            const tok: SelectorToken = switch (c) {
                '>' => .combinator_child,
                '+' => .combinator_adjacent,
                '~' => .combinator_sibling,
                else => unreachable,
            };
            try tokens.append(allocator, tok);
            last_was_combinator = true;
            i += 1;
            // Skip whitespace after combinator
            while (i < stripped.len and isSpace(stripped[i])) : (i += 1) {}
            continue;
        }

        last_was_combinator = false;

        if (c == '*') {
            try tokens.append(allocator, .universal);
            last_was_tag_or_universal = true;
            i += 1;
            continue;
        }

        if (c == '.') {
            // Class selector - may contain CSS escape sequences (\: \/ etc)
            // We need to decode escapes to match raw HTML class names (md:hidden, bg-main/80)
            i += 1;
            var name_buf: [256]u8 = undefined;
            var name_len: usize = 0;
            while (i < stripped.len) : (i += 1) {
                const ch = stripped[i];
                if (ch == '\\' and i + 1 < stripped.len) {
                    // CSS escape: \x -> literal x
                    i += 1;
                    if (name_len < name_buf.len) {
                        name_buf[name_len] = stripped[i];
                        name_len += 1;
                    }
                } else if (isAsciiAlphaNum(ch) or ch == '-' or ch == '_' or ch == ':' or ch == '/' or ch == '[' or ch == ']' or ch == '(' or ch == ')' or ch == '.') {
                    if (name_len < name_buf.len) {
                        name_buf[name_len] = ch;
                        name_len += 1;
                    }
                } else {
                    break;
                }
            }
            // Use a slice from stripped if no escapes were decoded (zero-copy path)
            if (name_len == (i - 1) - (i - name_len - 1)) {
                // Check if the original substring matches (no escapes were decoded)
                // Actually simpler: check if we can just use a substring
            }
            // For simplicity, always use the decoded name. We need to allocate.
            const decoded = try allocator.dupe(u8, name_buf[0..name_len]);
            errdefer allocator.free(decoded);
            try tokens.append(allocator, .{ .class = decoded });
            continue;
        }

        if (c == '#') {
            // ID selector - may contain CSS escape sequences
            i += 1;
            var name_buf: [256]u8 = undefined;
            var name_len: usize = 0;
            while (i < stripped.len) : (i += 1) {
                const ch = stripped[i];
                if (ch == '\\' and i + 1 < stripped.len) {
                    i += 1;
                    if (name_len < name_buf.len) {
                        name_buf[name_len] = stripped[i];
                        name_len += 1;
                    }
                } else if (isAsciiAlphaNum(ch) or ch == '-' or ch == '_') {
                    if (name_len < name_buf.len) {
                        name_buf[name_len] = ch;
                        name_len += 1;
                    }
                } else {
                    break;
                }
            }
            const decoded = try allocator.dupe(u8, name_buf[0..name_len]);
            errdefer allocator.free(decoded);
            try tokens.append(allocator, .{ .id = decoded });
            continue;
        }

        if (c == '[') {
            // Attribute selector: [attr], [attr="v"], [attr~="v"], [attr|="v"], [attr^="v"], [attr$="v"], [attr*="v"]
            i += 1;
            while (i < stripped.len and isSpace(stripped[i])) : (i += 1) {}

            // Parse attribute name
            const name_start = i;
            while (i < stripped.len and !isSpace(stripped[i]) and stripped[i] != '=' and stripped[i] != ']') : (i += 1) {}
            const attr_name = stripped[name_start..i];
            while (i < stripped.len and isSpace(stripped[i])) : (i += 1) {}

            // Check for closing bracket (existence check)
            if (i < stripped.len and stripped[i] == ']') {
                i += 1;
                try tokens.append(allocator, .{ .attribute = .{ .name = attr_name, .op = .exists, .value = "" } });
                continue;
            }

            // Parse operator: ~= |= ^= $= *= =
            var op: AttrOp = .equals;
            if (i < stripped.len) {
                const c1 = stripped[i];
                if (c1 == '~' or c1 == '|' or c1 == '^' or c1 == '$' or c1 == '*') {
                    op = switch (c1) {
                        '~' => .includes,
                        '|' => .dash,
                        '^' => .prefix,
                        '$' => .suffix,
                        '*' => .substring,
                        else => unreachable,
                    };
                    i += 1;
                }
            }

            // Skip the =
            if (i < stripped.len and stripped[i] == '=') {
                i += 1;
            }

            while (i < stripped.len and isSpace(stripped[i])) : (i += 1) {}

            // Parse value (quoted or unquoted)
            var attr_value: []const u8 = "";
            if (i < stripped.len and (stripped[i] == '"' or stripped[i] == '\'')) {
                const quote = stripped[i];
                i += 1;
                const vs = i;
                while (i < stripped.len and stripped[i] != quote) : (i += 1) {}
                attr_value = stripped[vs..i];
                if (i < stripped.len) i += 1;
            } else {
                const vs = i;
                while (i < stripped.len and stripped[i] != ']' and !isSpace(stripped[i])) : (i += 1) {}
                attr_value = stripped[vs..i];
            }

            // Skip to ]
            while (i < stripped.len and stripped[i] != ']') : (i += 1) {}
            if (i < stripped.len) i += 1;

            try tokens.append(allocator, .{ .attribute = .{ .name = attr_name, .op = op, .value = attr_value } });
            continue;
        }

        // Tag selector
        const start = i;
        while (i < stripped.len and (isAsciiAlphaNum(stripped[i]) or stripped[i] == '-' or stripped[i] == '_')) : (i += 1) {}
        if (i > start) {
            try tokens.append(allocator, .{ .tag = stripped[start..i] });
            last_was_tag_or_universal = true;
        } else {
            i += 1; // Skip unknown character
        }
    }

    return tokens.toOwnedSlice(allocator);
}

fn attrValueContains(haystack: []const u8, needle: []const u8) bool {
    return mem.indexOf(u8, haystack, needle) != null;
}

fn attrValueStartsWith(haystack: []const u8, prefix: []const u8) bool {
    if (prefix.len > haystack.len) return false;
    return mem.startsWith(u8, haystack, prefix);
}

fn matchAttr(elem: Element, attr: AttrSelector) bool {
    if (attr.op == .exists) {
        for (elem.attrs) |a| {
            if (mem.eql(u8, a.name, attr.name)) return true;
        }
        return false;
    }

    for (elem.attrs) |a| {
        if (mem.eql(u8, a.name, attr.name)) {
            return switch (attr.op) {
                .exists => unreachable,
                .equals => mem.eql(u8, a.value, attr.value),
                .includes => blk: {
                    // Check if space-separated list contains value
                    var iter = mem.splitScalar(u8, a.value, ' ');
                    while (iter.next()) |item| {
                        if (mem.eql(u8, item, attr.value)) break :blk true;
                    }
                    break :blk false;
                },
                .dash => blk: {
                    // Exact or starts with value followed by -
                    if (mem.eql(u8, a.value, attr.value)) break :blk true;
                    if (attrValueStartsWith(a.value, attr.value) and a.value.len > attr.value.len and a.value[attr.value.len] == '-') break :blk true;
                    break :blk false;
                },
                .prefix => attrValueStartsWith(a.value, attr.value),
                .suffix => blk: {
                    if (attr.value.len > a.value.len) break :blk false;
                    const start = a.value.len - attr.value.len;
                    break :blk mem.eql(u8, a.value[start..], attr.value);
                },
                .substring => attrValueContains(a.value, attr.value),
            };
        }
    }
    return false;
}

fn matchSimpleSelector(token: SelectorToken, elem: Element) bool {
    return switch (token) {
        .tag => |tag| mem.eql(u8, elem.tag, tag),
        .class => |cls| blk: {
            for (elem.classes) |c| {
                if (mem.eql(u8, c, cls)) break :blk true;
            }
            break :blk false;
        },
        .id => |id| if (elem.id) |eid| mem.eql(u8, eid, id) else false,
        .universal => true,
        .attribute => |attr| matchAttr(elem, attr),
        else => false,
    };
}

/// Match a parsed selector against a list of elements.
/// Supports all combinator types: descendant, child, sibling, adjacent.
pub fn selectorMatches(tokens: []const SelectorToken, elements: []const Element) bool {
    if (tokens.len == 0) return false;

    // Split into groups by group_end markers
    var group_start: usize = 0;
    var i: usize = 0;
    while (i <= tokens.len) {
        if (i == tokens.len or tokens[i] == .group_end) {
            const group = tokens[group_start..i];
            if (group.len > 0 and matchGroup(group, elements)) return true;
            group_start = i + 1;
        }
        i += 1;
    }
    return false;
}

fn matchGroup(tokens: []const SelectorToken, elements: []const Element) bool {
    if (tokens.len == 0) return false;

    // If starts with combinator, that's invalid for our purposes
    if (tokens[0] == .combinator_descendant or tokens[0] == .combinator_child or
        tokens[0] == .combinator_sibling or tokens[0] == .combinator_adjacent)
    {
        return false;
    }

    // Check each element as potential match for the rightmost selector
    for (elements, 0..) |elem, elem_idx| {
        if (matchSelectorRightToLeft(tokens, elem, elem_idx, elements)) return true;
    }
    return false;
}

/// Match selector right-to-left. The rightmost token must match the current element,
/// then combinators determine which previous element must match.
fn matchSelectorRightToLeft(tokens: []const SelectorToken, elem: Element, elem_idx: usize, elements: []const Element) bool {
    // Find the last simple selector (not a combinator) and match it
    var pos = tokens.len;
    // Walk backwards to find the rightmost simple selector
    while (pos > 0) {
        pos -= 1;
        if (tokens[pos] == .combinator_descendant or tokens[pos] == .combinator_child or
            tokens[pos] == .combinator_sibling or tokens[pos] == .combinator_adjacent)
        {
            pos += 1;
            break;
        }
    }

    if (pos >= tokens.len) return false;

    // Match the rightmost selector token against the element
    if (!matchSimpleSelector(tokens[pos], elem)) return false;

    // Now walk backwards through combinators and selectors
    var current_idx: usize = elem_idx;
    var current_pos = pos;

    while (current_pos > 0) {
        current_pos -= 1;
        const tok = tokens[current_pos];

        if (tok == .combinator_descendant) {
            // Find any ancestor
            current_pos -= 1;
            if (current_pos >= 0) {
                // Look for matching ancestor
                var found = false;
                var anc_idx: usize = current_idx;
                while (anc_idx > 0) {
                    anc_idx -= 1;
                    if (matchSimpleSelector(tokens[current_pos], elements[anc_idx])) {
                        found = true;
                        break;
                    }
                }
                if (!found) return false;
                current_idx = anc_idx;
            }
        } else if (tok == .combinator_child) {
            // Find direct parent
            current_pos -= 1;
            if (current_pos < tokens.len) {
                if (current_idx == 0) return false;
                const parent_idx = current_idx - 1;
                if (!matchSimpleSelector(tokens[current_pos], elements[parent_idx])) return false;
                current_idx = parent_idx;
            }
        } else if (tok == .combinator_sibling) {
            // Find preceding sibling
            current_pos -= 1;
            if (current_pos < tokens.len) {
                var found = false;
                var sib_idx: usize = current_idx;
                while (sib_idx > 0) {
                    sib_idx -= 1;
                    if (matchSimpleSelector(tokens[current_pos], elements[sib_idx])) {
                        found = true;
                        break;
                    }
                    // Stop at block boundaries (simplified: stop at different parent tags)
                    if (sib_idx > 0 and !mem.eql(u8, elements[sib_idx].tag, elements[current_idx].tag)) break;
                }
                if (!found) return false;
                current_idx = sib_idx;
            }
        } else if (tok == .combinator_adjacent) {
            // Find immediate preceding sibling
            current_pos -= 1;
            if (current_pos < tokens.len) {
                if (current_idx == 0) return false;
                const sib_idx = current_idx - 1;
                if (!matchSimpleSelector(tokens[current_pos], elements[sib_idx])) return false;
                current_idx = sib_idx;
            }
        } else {
            // Simple selector - must match current element
            if (!matchSimpleSelector(tok, elements[current_idx])) return false;
        }
    }

    return true;
}

test "parse tag selector" {
    const allocator = std.testing.allocator;
    const tokens = try parseSelector(allocator, "div");
    defer freeSelectorTokens(allocator, tokens);
    try std.testing.expectEqual(@as(usize, 1), tokens.len);
    try std.testing.expectEqual(SelectorTokenType.tag, @as(SelectorTokenType, tokens[0]));
}

test "parse class selector" {
    const allocator = std.testing.allocator;
    const tokens = try parseSelector(allocator, ".foo");
    defer freeSelectorTokens(allocator, tokens);
    try std.testing.expectEqual(@as(usize, 1), tokens.len);
    try std.testing.expectEqual(SelectorTokenType.class, @as(SelectorTokenType, tokens[0]));
}

test "parse id selector" {
    const allocator = std.testing.allocator;
    const tokens = try parseSelector(allocator, "#bar");
    defer freeSelectorTokens(allocator, tokens);
    try std.testing.expectEqual(@as(usize, 1), tokens.len);
    try std.testing.expectEqual(SelectorTokenType.id, @as(SelectorTokenType, tokens[0]));
}

test "strip pseudo-classes" {
    const allocator = std.testing.allocator;
    const tokens = try parseSelector(allocator, "div:hover");
    defer freeSelectorTokens(allocator, tokens);
    try std.testing.expectEqual(@as(usize, 1), tokens.len);
    try std.testing.expectEqual(SelectorTokenType.tag, @as(SelectorTokenType, tokens[0]));
}

test "parse compound selector" {
    const allocator = std.testing.allocator;
    const tokens = try parseSelector(allocator, "div.foo#bar");
    defer freeSelectorTokens(allocator, tokens);
    try std.testing.expectEqual(@as(usize, 3), tokens.len);
}

test "match simple tag" {
    const elem = Element{ .tag = "div", .classes = &.{}, .id = null, .attrs = &.{} };
    const tokens = [_]SelectorToken{.{ .tag = "div" }};
    try std.testing.expect(selectorMatches(&tokens, &.{elem}));
}

test "match class" {
    const elem = Element{ .tag = "div", .classes = &.{"foo"}, .id = null, .attrs = &.{} };
    const tokens = [_]SelectorToken{.{ .class = "foo" }};
    try std.testing.expect(selectorMatches(&tokens, &.{elem}));
}

test "the filter holds the names of the page" {
    const allocator = std.testing.allocator;
    var filter = try TokenFilter.init(allocator);
    defer allocator.free(filter.words);

    filter.add(.tag, "div");
    filter.add(.class, "prose");
    filter.add(.id, "main");

    try std.testing.expect(filter.mayContain(.tag, "div"));
    try std.testing.expect(filter.mayContain(.class, "prose"));
    try std.testing.expect(filter.mayContain(.id, "main"));

    // A name of another kind is a different name.
    try std.testing.expect(!filter.mayContain(.class, "div"));
    try std.testing.expect(!filter.mayContain(.tag, "span"));
}

test "a selector whose names the page lacks cannot match" {
    const allocator = std.testing.allocator;
    var filter = try TokenFilter.init(allocator);
    defer allocator.free(filter.words);

    filter.add(.tag, "div");
    filter.add(.class, "prose");

    // The page has no <p> and no <span>, so neither rule can match.
    const missing_tag = try parseSelector(allocator, ".prose p");
    defer freeSelectorTokens(allocator, missing_tag);
    try std.testing.expect(!mayMatchPage(missing_tag, &filter));

    const missing_class = try parseSelector(allocator, ".absent div");
    defer freeSelectorTokens(allocator, missing_class);
    try std.testing.expect(!mayMatchPage(missing_class, &filter));

    // Both of its names are in the page, so the rule has to be tried.
    const possible = try parseSelector(allocator, ".prose div");
    defer freeSelectorTokens(allocator, possible);
    try std.testing.expect(mayMatchPage(possible, &filter));
}

test "a selector with groups needs only one group to be possible" {
    const allocator = std.testing.allocator;
    var filter = try TokenFilter.init(allocator);
    defer allocator.free(filter.words);

    filter.add(.tag, "div");

    // The first group asks for a name the page does not have, the second
    // for one it has: the selector can still match.
    const tokens = try parseSelector(allocator, ".missing, div");
    defer freeSelectorTokens(allocator, tokens);
    try std.testing.expect(mayMatchPage(tokens, &filter));

    const none = try parseSelector(allocator, ".missing, .also-missing");
    defer freeSelectorTokens(allocator, none);
    try std.testing.expect(!mayMatchPage(none, &filter));
}
