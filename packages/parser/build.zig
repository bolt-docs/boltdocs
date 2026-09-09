const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Shared library module (reused by both exe and napi lib)
    const parser_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
        .strip = if (optimize != .Debug) true else null,
    });

    // CLI executable
    const exe = b.addExecutable(.{
        .name = "bdocs-parser",
        .root_module = parser_module,
    });
    b.installArtifact(exe);

    // N-API shared library (.so / .dylib / .dll)
    // Run `pnpm build:napi` from this directory to compile.
    // zig build-lib is used directly (not b.addLibrary) because it
    // reliably exports symbols. See package.json 'build:napi' script.
    const napi_step = b.step("napi", "Build the N-API shared library via zig build-lib");
    const napi_build = b.addSystemCommand(&.{
        "zig", "build-lib",
        "src/napi.zig",
        "-dynamic", "-fPIC",
        "--name", "bdocs_parser_napi",
    });

    if (optimize != .Debug) {
        napi_build.addArg("-O");
        napi_build.addArg(@tagName(optimize));
    }

    napi_step.dependOn(&napi_build.step);

    // Unit tests
    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/tests.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    const run_tests = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_tests.step);
}
