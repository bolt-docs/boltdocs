const std = @import("std");
const mem = std.mem;
const Allocator = mem.Allocator;

const selector = @import("selector");
const css_mod = @import("css");
const html_mod = @import("html");

pub const BeastiesOptions = struct {
    compress: bool = true,
    prune_source: bool = false,
    inline_fonts: bool = false,
    preload_fonts: bool = true,
    keyframes: KeyframeStrategy = .critical,
    reduce_inline_styles: bool = true,
    merge_stylesheets: bool = true,
    allow_rules: ?[]const []const u8 = null,
};

pub const KeyframeStrategy = enum {
    critical,
    all,
    none,
};

pub const CriticalCssResult = struct {
    critical_css: []const u8,
    non_critical_css: ?[]const u8 = null,
};

/// Check if selector or any comma-separated part is an always-include selector
fn isAlwaysInclude(sel: []const u8) bool {
    // Check exact match first
    if (mem.eql(u8, sel, ":root")) return true;
    if (mem.eql(u8, sel, "html")) return true;
    if (mem.eql(u8, sel, "body")) return true;
    if (mem.eql(u8, sel, "::before")) return true;
    if (mem.eql(u8, sel, "::after")) return true;
    if (mem.eql(u8, sel, ":before")) return true;
    if (mem.eql(u8, sel, ":after")) return true;
    // Check each comma-separated part for always-include selectors
    // (handles cases like ":root,:host" or "html,:host")
    var iter = mem.splitScalar(u8, sel, ',');
    while (iter.next()) |part| {
        const trimmed = mem.trim(u8, part, " \t\n\r");
        if (mem.eql(u8, trimmed, ":root")) return true;
        if (mem.eql(u8, trimmed, "html")) return true;
        if (mem.eql(u8, trimmed, "body")) return true;
    }
    return false;
}

fn isLayoutSelector(sel: []const u8) bool {
    const layout_terms = [_][]const u8{
        "sidebar",
        "navbar",
        "toc",
        "header",
        "footer",
        "nav",
        "aside",
        "menu",
    };
    for (layout_terms) |term| {
        if (mem.indexOf(u8, sel, term) != null) {
            return true;
        }
    }
    return false;
}

fn isTooComplex(tokens: []const selector.SelectorToken, max_complexity: usize) bool {
    var parts_count: usize = 1;
    for (tokens) |token| {
        switch (token) {
            .combinator_descendant,
            .combinator_child,
            .combinator_sibling,
            .combinator_adjacent => {
                parts_count += 1;
            },
            else => {},
        }
    }
    return parts_count > max_complexity;
}

/// Check if a CSS selector matches any element in the list
fn selectorMatchesAnyElements(
    sel_str: []const u8,
    selector_elements: []const selector.Element,
    selector_tokens_cache: *std.StringHashMap(?[]selector.SelectorToken),
    allocator: Allocator,
) bool {
    if (isAlwaysInclude(sel_str)) return true;
    if (isLayoutSelector(sel_str)) return false;

    const tokens_opt = selector_tokens_cache.get(sel_str);
    var tokens: []selector.SelectorToken = undefined;

    if (tokens_opt) |cached| {
        if (cached) |t| {
            tokens = t;
        } else {
            return false;
        }
    } else {
        tokens = selector.parseSelector(allocator, sel_str) catch {
            selector_tokens_cache.put(sel_str, null) catch {};
            return false;
        };
        selector_tokens_cache.put(sel_str, tokens) catch {};
    }

    if (isTooComplex(tokens, 2)) return false;

    return selector.selectorMatches(tokens, selector_elements);
}

/// The core Beasties algorithm: extract critical CSS from HTML + CSS
pub fn extractCriticalCss(
    allocator: Allocator,
    html: []const u8,
    css_content: []const u8,
    options: BeastiesOptions,
) !CriticalCssResult {
    const elements = try html_mod.parseHtml(allocator, html);
    defer html_mod.freeElements(allocator, elements);

    // Convert to selector.Element for matching
    var selector_elements = try allocator.alloc(selector.Element, elements.len);
    for (elements, 0..) |elem, i| {
        selector_elements[i] = .{
            .tag = elem.tag,
            .classes = elem.classes,
            .id = elem.id,
            .attrs = &.{},
        };
    }
    defer allocator.free(selector_elements);

    var css_parser = css_mod.CssParser.init(allocator, css_content);
    const rules = css_parser.parseStylesheet();
    defer freeRules(allocator, rules);

    var selector_cache = std.StringHashMap(?[]selector.SelectorToken).init(allocator);
    defer {
        var iter = selector_cache.iterator();
        while (iter.next()) |entry| {
            if (entry.value_ptr.*) |tokens| {
                selector.freeSelectorTokens(allocator, tokens);
            }
        }
        selector_cache.deinit();
    }

    var critical_keyframe_names = std.StringHashMap(void).init(allocator);
    defer critical_keyframe_names.deinit();

    markUnusedRules(rules, selector_elements, &selector_cache, allocator, &critical_keyframe_names, options);

    const critical_css = try css_parser.serializeStyleSheet(rules, options.compress);

    return .{ .critical_css = critical_css };
}

fn freeRules(allocator: Allocator, rules: []css_mod.CssRule) void {
    for (rules) |rule| {
        if (rule.declarations.len > 0) allocator.free(rule.declarations);
        if (rule.children.len > 0) freeRules(allocator, rule.children);
    }
    allocator.free(rules);
}

fn markUnusedRules(
    rules: []css_mod.CssRule,
    selector_elements: []const selector.Element,
    selector_cache: *std.StringHashMap(?[]selector.SelectorToken),
    allocator: Allocator,
    critical_keyframe_names: *std.StringHashMap(void),
    options: BeastiesOptions,
) void {
    var include_next = false;
    var exclude_next = false;
    var include_all = false;
    var exclude_all = false;

    for (rules) |*rule| {
        switch (rule.type) {
            .comment => {
                if (rule.is_comment_include) {
                    include_next = true;
                    include_all = true;
                }
                if (rule.is_comment_exclude) {
                    exclude_next = true;
                    exclude_all = true;
                }
                continue;
            },
            .rule => {
                if (include_next) {
                    include_next = false;
                    include_all = false;
                    rule.marked_for_removal = false;
                    continue;
                }
                if (exclude_next) {
                    exclude_next = false;
                    exclude_all = false;
                    rule.marked_for_removal = true;
                    continue;
                }
                if (exclude_all) {
                    rule.marked_for_removal = true;
                    continue;
                }

                if (rule.selector) |sel| {
                    // Check allowRules option
                    if (options.allow_rules) |allowed| {
                        var is_allowed = false;
                        for (allowed) |a| {
                            if (mem.eql(u8, a, sel)) {
                                is_allowed = true;
                                break;
                            }
                        }
                        if (is_allowed) {
                            rule.marked_for_removal = false;
                            continue;
                        }
                    }

                    const matches = selectorMatchesAnyElements(sel, selector_elements, selector_cache, allocator);

                    if (!matches) {
                        rule.marked_for_removal = true;
                    } else {
                        // Collect animation names
                        for (rule.declarations) |decl| {
                            if (mem.indexOf(u8, decl.property, "animation") != null) {
                                var iter = mem.splitScalar(u8, decl.value, ' ');
                                while (iter.next()) |token| {
                                    const trimmed = mem.trim(u8, token, " \t\n\r");
                                    if (trimmed.len > 0 and trimmed[0] != ',' and
                                        !mem.eql(u8, trimmed, "none") and !mem.eql(u8, trimmed, "infinite") and
                                        !mem.eql(u8, trimmed, "ease") and !mem.eql(u8, trimmed, "linear") and
                                        !mem.eql(u8, trimmed, "normal") and !mem.eql(u8, trimmed, "reverse") and
                                        !mem.eql(u8, trimmed, "alternate") and !mem.eql(u8, trimmed, "alternate-reverse") and
                                        !mem.eql(u8, trimmed, " forwards") and !mem.eql(u8, trimmed, "backwards") and
                                        !mem.eql(u8, trimmed, "both") and !mem.eql(u8, trimmed, "running") and
                                        !mem.eql(u8, trimmed, "paused"))
                                    {
                                        critical_keyframe_names.put(trimmed, {}) catch {};
                                    }
                                }
                            }
                        }
                    }
                }
            },
            .atrule => {
                switch (rule.at_rule_type) {
                    .font_face => {
                        if (options.inline_fonts) {
                            rule.marked_for_removal = false;
                        } else {
                            rule.marked_for_removal = true;
                        }
                    },
                    .property => {
                        // @property rules are always kept (they define custom properties)
                        rule.marked_for_removal = false;
                    },
                    .keyframes => {
                        switch (options.keyframes) {
                            .none => rule.marked_for_removal = true,
                            .all => rule.marked_for_removal = false,
                            .critical => {
                                if (critical_keyframe_names.get(rule.at_rule_params) == null) {
                                    rule.marked_for_removal = true;
                                }
                            },
                        }
                    },
                    .media, .supports, .layer => {
                        markUnusedRules(rule.children, selector_elements, selector_cache, allocator, critical_keyframe_names, options);

                        var all_removed = true;
                        for (rule.children) |child| {
                            if (!child.marked_for_removal) {
                                all_removed = false;
                                break;
                            }
                        }
                        if (all_removed) {
                            rule.marked_for_removal = true;
                        }
                    },
                    .other => {},
                }
            },
        }
    }
}
