const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const is_release = optimize != .debug;
    const is_wasm = switch (target.result.cpu.arch) {
        .wasm32, .wasm64 => true,
        else => false,
    };

    // Release builds strip debug info, drop frame pointers and disable
    // error-name tracing. None are needed at runtime; together they remove a
    // large amount of metadata from the shipped binaries.
    const strip = if (is_release) true else null;
    const omit_frame_pointer = if (is_release) true else null;
    const error_tracing = if (is_release) false else null;

    // Modules
    const selector_mod = b.addModule("selector", .{
        .root_source_file = b.path("src/selector.zig"),
        .target = target,
        .optimize = optimize,
        .strip = strip,
        .omit_frame_pointer = omit_frame_pointer,
        .error_tracing = error_tracing,
    });

    const css_mod = b.addModule("css", .{
        .root_source_file = b.path("src/css.zig"),
        .target = target,
        .optimize = optimize,
        .strip = strip,
        .omit_frame_pointer = omit_frame_pointer,
        .error_tracing = error_tracing,
    });

    const html_mod = b.addModule("html", .{
        .root_source_file = b.path("src/html.zig"),
        .target = target,
        .optimize = optimize,
        .strip = strip,
        .omit_frame_pointer = omit_frame_pointer,
        .error_tracing = error_tracing,
    });

    const beasties_mod = b.createModule(.{
        .root_source_file = b.path("src/beasties.zig"),
        .target = target,
        .optimize = optimize,
        .strip = strip,
        .omit_frame_pointer = omit_frame_pointer,
        .error_tracing = error_tracing,
    });
    beasties_mod.addImport("selector", selector_mod);
    beasties_mod.addImport("css", css_mod);
    beasties_mod.addImport("html", html_mod);

    _ = b.addModule("beasties", .{
        .root_source_file = b.path("src/beasties.zig"),
        .target = target,
        .optimize = optimize,
        .strip = strip,
        .omit_frame_pointer = omit_frame_pointer,
        .error_tracing = error_tracing,
    });

    _ = b.addModule("thread_pool", .{
        .root_source_file = b.path("src/thread_pool.zig"),
        .target = target,
        .optimize = optimize,
        .strip = strip,
        .omit_frame_pointer = omit_frame_pointer,
        .error_tracing = error_tracing,
    });

    // WASM target
    if (is_wasm) {
        const wasm_mod = b.createModule(.{
            .root_source_file = b.path("src/wasm.zig"),
            .target = target,
            .optimize = optimize,
            .strip = strip,
            .omit_frame_pointer = omit_frame_pointer,
            .error_tracing = error_tracing,
        });
        wasm_mod.addImport("selector", selector_mod);
        wasm_mod.addImport("css", css_mod);
        wasm_mod.addImport("html", html_mod);
        wasm_mod.addImport("beasties", beasties_mod);

        // Compile straight to a .wasm with Zig's own bundled linker. The module
        // only exposes `export fn` symbols and needs no WASI entry point, so no
        // external `wasm-ld` and no object-file middle step are required.
        // Zig 0.17 requires exports to be listed explicitly; `__heap_base` is
        // the linker-created end of static data that the JS host uses as the
        // base address for its scratch buffers.
        wasm_mod.export_symbol_names = &.{
            "getResultPtr",
            "getResultLen",
            "reset",
            "prepareStylesheet",
            "hasPreparedStylesheet",
            "processPreparedCriticalCss",
            "processCriticalCss",
            "__heap_base",
        };
        const wasm_exe = b.addExecutable(.{
            .name = "zig-critters",
            .root_module = wasm_mod,
        });
        wasm_exe.entry = .disabled;
        b.installArtifact(wasm_exe);
    }

    // Native executable (for benchmarking)
    if (!is_wasm) {
        const exe_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
            .strip = strip,
            .omit_frame_pointer = omit_frame_pointer,
            .error_tracing = error_tracing,
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
