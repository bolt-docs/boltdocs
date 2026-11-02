const std = @import("std");
const yaml = @import("yaml.zig");

test "yaml mini test" {
    const testing = std.testing;
    const allocator = testing.allocator;

    const input = "title: YAML Test\ndraft: true\ncount: 42\n";
    
    var result = try yaml.parseYaml(allocator, input);
    defer result.deinit(allocator);

    const title = result.object.get("title");
    try testing.expect(title != null);
    try testing.expectEqualStrings("YAML Test", title.?.string);

    const draft = result.object.get("draft");
    try testing.expect(draft != null);
    try testing.expectEqual(true, draft.?.bool_value);

    const count = result.object.get("count");
    try testing.expect(count != null);
    try testing.expectEqual(@as(i64, 42), count.?.int_value);
    
    std.debug.print("count() = {d}\n", .{result.object.count()});
    var iter = result.object.iterator();
    while (iter.next()) |entry| {
        std.debug.print("key = '{s}'\n", .{entry.key_ptr.*});
    }
}
