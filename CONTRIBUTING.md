# Contributing to Boltdocs

First off, thank you for considering contributing to Boltdocs! It's researchers and developers like you that make this documentation engine powerful and flexible for everyone.

For a deeper dive into the philosophy and advanced architecture of the project, please visit the [Boltdocs DeepWiki](https://deepwiki.com/bolt-docs/boltdocs).

## How Boltdocs Works

Boltdocs is not just a static site generator; it's a **documentation engine** built on top of modern web standards. Understanding the core architecture will help you contribute better:

### 1. The Virtual Layer
Boltdocs uses **Vite Virtual Modules** to bridge the gap between user configuration and the client-side application. When you run the dev server, the engine scans your `boltdocs.config.ts` and your `docs/` directory to generate virtual modules like:
- `virtual:boltdocs-config`: The processed user configuration.
- `virtual:boltdocs-routes`: A dynamic mapping of your file structure to React components.
- `virtual:boltdocs-layout`: The user-defined layout (or the default one).

### 2. Hybrid Rendering
We use a hybrid approach to ensure maximum performance:
- **Dev Mode**: Uses Vite's ESM-based HMR for instant updates.
- **Production**: A custom SSG (Static Site Generation) process renders your documents into optimized HTML/JS bundles.

### 3. Component Architecture
The UI is composed of atomic primitives (`packages/core/src/client/components/primitives`) and base blocks like `Navbar`, `Sidebar`, and `OnThisPage`. This modularity allows users to override individual parts without forking the entire framework.

---

## Development Setup

This project is a monorepo managed by [pnpm workspaces](https://pnpm.io/workspaces) and orchestrated with [Turborepo](https://turbo.build/repo).

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [pnpm](https://pnpm.io/installation) (v8 or higher)

### Getting Started

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/<your-username>/boltdocs.git
   cd boltdocs
   ```

2. **Install Dependencies**:
   This will install all package dependencies and initialize the workspace links.
   ```bash
   pnpm install
   ```

3. **Start Development**:
   Run the dev server in the `docs` package to see your changes in real-time.
   ```bash
   pnpm run dev
   ```

## Making a Pull Request

1. **Branching Strategy**: Use clear branch names based on the type of work:
   - `feature/` for new capabilities.
   - `fix/` for bug reports.
   - `docs/` for purely documentation improvements.
   - `refactor/` for code structure changes.

2. **Commit Guidelines**: We follow [Conventional Commits](https://www.conventionalcommits.org/). This ensures a clean and automated changelog generation.

3. **Testing**: Before pushing, ensure all tests pass. We use [Vitest](https://vitest.dev/) for unit and integration testing.
   ```bash
   pnpm run test
   ```
   If you are adding new core utilities or parser features, please update the consolidated test suites (`tests/utils.test.ts` or `tests/routes/parser.test.ts`) rather than creating new granular test files.

4. **Verifying Changes**: Ensure your changes don't break the build or the example site in the `docs` directory.

## Code of Conduct

We are committed to providing a welcoming and inspiring community. Please be respectful and professional in all interactions.
