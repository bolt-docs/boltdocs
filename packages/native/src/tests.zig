const std = @import("std");
const parser = @import("parser.zig");
const slugger = @import("slugger.zig");

test "parser - stripAndDecode" {
    const testing = std.testing;
    const allocator = testing.allocator;

    const input1 = "Hello <b>world</b>!";
    const res1 = try parser.stripAndDecode(allocator, input1);
    defer allocator.free(res1);
    try testing.expectEqualStrings("Hello world!", res1);

    const input2 = "Entity check: &lt;tag&gt; &amp; &quot;quote&quot; &apos;apostrophe&apos;";
    const res2 = try parser.stripAndDecode(allocator, input2);
    defer allocator.free(res2);
    try testing.expectEqualStrings("Entity check: <tag> & \"quote\" 'apostrophe'", res2);

    const input3 = "Link check: [Boltdocs Website](https://boltdocs.vercel.app) is cool.";
    const res3 = try parser.stripAndDecode(allocator, input3);
    defer allocator.free(res3);
    try testing.expectEqualStrings("Link check: Boltdocs Website is cool.", res3);

    const input4 = "  Trim check:  **bold** and _italic_  ";
    const res4 = try parser.stripAndDecode(allocator, input4);
    defer allocator.free(res4);
    try testing.expectEqualStrings("Trim check: bold and italic", res4);
}

test "parser - parseFrontmatter YAML objects and arrays" {
    const testing = std.testing;

    const input1 =
        \\---
        \\title: "My Doc"
        \\author:
        \\  name: Jesus
        \\  nested:
        \\    active: true
        \\tags:
        \\  - zig
        \\  - docs
        \\metadata: { version: 2, status: "stable" }
        \\---
        \\# Page Title
        \\Content starts here.
    ;

    const fm = parser.parseFrontmatter(input1);

    const expected_raw =
        \\title: "My Doc"
        \\author:
        \\  name: Jesus
        \\  nested:
        \\    active: true
        \\tags:
        \\  - zig
        \\  - docs
        \\metadata: { version: 2, status: "stable" }
    ;
    try testing.expectEqualStrings(expected_raw, fm.rawMatter);
    try testing.expectEqualStrings("# Page Title\nContent starts here.", fm.content);

    const input2 = "# Page without frontmatter";
    const fm2 = parser.parseFrontmatter(input2);
    try testing.expectEqualStrings("", fm2.rawMatter);
    try testing.expectEqualStrings(input2, fm2.content);
}

test "parser - extractHeadings" {
    const testing = std.testing;
    const allocator = testing.allocator;

    const input =
        \\# Document Title
        \\
        \\## Section 1
        \\Some content.
        \\
        \\### Section 1.1 &amp; Details
        \\More content.
        \\
        \\#### Sub-detail [link](http://example.com)
        \\
        \\##### Level 5 is ignored
        \\
        \\```typescript
        \\## Heading inside code block should be ignored
        \\```
    ;

    const headings = try parser.extractHeadings(allocator, input);
    defer {
        for (headings) |h| {
            allocator.free(h.text);
            allocator.free(h.id);
        }
        allocator.free(headings);
    }

    try testing.expectEqual(@as(usize, 3), headings.len);

    try testing.expectEqual(@as(u8, 2), headings[0].level);
    try testing.expectEqualStrings("Section 1", headings[0].text);
    try testing.expectEqualStrings("section-1", headings[0].id);

    try testing.expectEqual(@as(u8, 3), headings[1].level);
    try testing.expectEqualStrings("Section 1.1 & Details", headings[1].text);
    try testing.expectEqualStrings("section-11--details", headings[1].id);

    try testing.expectEqual(@as(u8, 4), headings[2].level);
    try testing.expectEqualStrings("Sub-detail link", headings[2].text);
    try testing.expectEqualStrings("sub-detail-link", headings[2].id);
}

test "parser - parseDoc integration" {
    const testing = std.testing;
    const allocator = testing.allocator;

    const input =
        \\---
        \\title: Integration Test
        \\---
        \\# Header 1
        \\## Header 2
        \\Welcome to the document!
    ;

    const doc = try parser.parseDoc(allocator, input);
    defer {
        for (doc.headings) |h| {
            allocator.free(h.text);
            allocator.free(h.id);
        }
        allocator.free(doc.headings);
        allocator.free(doc.plainText);
        allocator.free(doc.description);
    }

    try testing.expectEqualStrings("title: Integration Test", doc.rawMatter);
    try testing.expectEqualStrings("# Header 1\n## Header 2\nWelcome to the document!", doc.content);
    try testing.expectEqual(@as(usize, 1), doc.headings.len);
    try testing.expectEqualStrings("Header 2", doc.headings[0].text);
    try testing.expectEqualStrings("# Header 1 ## Header 2 Welcome to the document!", doc.plainText);
}

test "slug - basic conversions" {
    const testing = std.testing;
    const allocator = testing.allocator;

    const s1 = try slugger.slug(allocator, "Hello World");
    defer allocator.free(s1);
    try testing.expectEqualStrings("hello-world", s1);

    const s2 = try slugger.slug(allocator, "Hello, World! & Co.");
    defer allocator.free(s2);
    try testing.expectEqualStrings("hello-world--co", s2);

    const s3 = try slugger.slug(allocator, "hello_world__foo");
    defer allocator.free(s3);
    try testing.expectEqualStrings("hello_world__foo", s3);

    const s4 = try slugger.slug(allocator, "-some-slug-with-trailing-dashes---");
    defer allocator.free(s4);
    try testing.expectEqualStrings("-some-slug-with-trailing-dashes---", s4);

    const s5 = try slugger.slug(allocator, "café");
    defer allocator.free(s5);
    try testing.expectEqualStrings("café", s5);
}
