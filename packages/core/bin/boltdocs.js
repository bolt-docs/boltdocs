#!/usr/bin/env node


/**
 * Stable entry point for the Boltdocs CLI.
 * This file exists in the repository to ensure that pnpm can correctly
 * create symlinks during initial installation on CI environments (like Vercel),
 * even before the 'dist' folder has been built.
 */

// We use dynamic import because the core package is now ESM.
import('../dist/node/cli-entry.mjs')
