const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const is_wasm = target.result.os.tag == .wasi;

    // Modules
    const selector_mod = b.addModule("selector", .{
        .root_source_file = b.path("src/selector.zig"),
        .target = target,
        .optimize = optimize,
    });

    const css_mod = b.addModule("css", .{
        .root_source_file = b.path("src/css.zig"),
        .target = target,
        .optimize = optimize,
    });

    const html_mod = b.addModule("html", .{
        .root_source_file = b.path("src/html.zig"),
        .target = target,
        .optimize = optimize,
    });

    const beasties_mod = b.createModule(.{
        .root_source_file = b.path("src/beasties.zig"),
        .target = target,
        .optimize = optimize,
    });
    beasties_mod.addImport("selector", selector_mod);
    beasties_mod.addImport("css", css_mod);
    beasties_mod.addImport("html", html_mod);

    _ = b.addModule("beasties", .{
        .root_source_file = b.path("src/beasties.zig"),
        .target = target,
        .optimize = optimize,
    });

    _ = b.addModule("thread_pool", .{
        .root_source_file = b.path("src/thread_pool.zig"),
        .target = target,
        .optimize = optimize,
    });

    // WASM target
    if (is_wasm) {
        const wasm_mod = b.createModule(.{
            .root_source_file = b.path("src/wasm.zig"),
            .target = target,
            .optimize = optimize,
        });
        wasm_mod.addImport("selector", selector_mod);
        wasm_mod.addImport("css", css_mod);
        wasm_mod.addImport("html", html_mod);
        wasm_mod.addImport("beasties", beasties_mod);

        // Step 1: Compile to .o object
        const wasm_obj = b.addObject(.{
            .name = "zig-critters",
            .root_module = wasm_mod,
        });

        // Step 2: Link with wasm-ld to produce .wasm with exports
        const wasm_out = b.addSystemCommand(&.{
            "wasm-ld",
            "--no-entry",
            "--export-all",
            "--allow-undefined",
        });
        wasm_out.addArtifactArg(wasm_obj);
        wasm_out.addArg("-o");
        _ = wasm_out.addOutputFileArg("zig-critters.wasm");

        b.default_step.dependOn(&wasm_out.step);
    }

    // Native executable (for benchmarking)
    if (!is_wasm) {
        const exe_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        });
        exe_module.addImport("selector", selector_mod);
        exe_module.addImport("css", css_mod);
        exe_module.addImport("html", html_mod);
        exe_module.addImport("beasties", beasties_mod);

        const exe = b.addExecutable(.{
            .name = "zig-critters",
            .root_module = exe_module,
        });
        b.installArtifact(exe);

        const run_cmd = b.addRunArtifact(exe);
        run_cmd.step.dependOn(b.getInstallStep());
        if (b.args) |args| {
            run_cmd.addArgs(args);
        }
        const run_step = b.step("run", "Run the benchmark");
        run_step.dependOn(&run_cmd.step);
    }

    // Tests
    const selector_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/selector.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    const css_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/css.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    const html_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/html.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    const run_selector_tests = b.addRunArtifact(selector_tests);
    const run_css_tests = b.addRunArtifact(css_tests);
    const run_html_tests = b.addRunArtifact(html_tests);

    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_selector_tests.step);
    test_step.dependOn(&run_css_tests.step);
    test_step.dependOn(&run_html_tests.step);
}
