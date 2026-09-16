# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Testing

- Run all tests: `npm test` (or `node --test`)
- Run a single test file: `node --test test/smoke.test.js`
- Run a group of tests:
  - `node --test test/edit*.test.js`
  - `node --test test/knowledge*.test.js`
  - `node --test test/repository*.test.js`
  - `node --test test/runtime.test.js`

### Verification & Release

- Verify production profile: `npm run verify:profile` (asserts exact 41-tool set equality, no lifecycle prompts/resources, no learning/promotion tools)
- Build Windows release executable: `npm run build:release -- --version <semver>` (bundles via esbuild, generates Node Single Executable Application blob, injects via postject, packages ZIP with doctor script and companion skills)

### Running the Server

- Run in source mode: `node src/index.js`
- Relevant environment variables:
  - `KETTLE_ROOT`: Explicit workspace directory boundary (defaults to auto-detected repository root or `process.cwd()`).
  - `PENTAHO_HOME`: Path to Pentaho Data Integration directory containing `Kitchen.bat` / `Pan.bat` (required only for optional runtime tools).
  - `PENTAHO_ENABLE_EXECUTE`: Set to `1` to opt into runtime execution (any other value leaves execution disabled).
  - `KETTLE_KNOWLEDGE_DIR`: Override path for the embedded knowledge base.

## Architecture & Code Structure

`pentaho-mcp-server` is an MCP stdio server providing deterministic, knowledge-first inspection, span-based lossless XML editing, static validation, and optional runtime execution for Pentaho Kettle (`.kjb` and `.ktr`) files. High-level reasoning (brainstorming, design, specification, plan approval) is handled outside MCP (e.g. by Superpowers / AI agent); the MCP server exposes 41 primitive tools.

### Core Modules

- **Workspace Boundary (`src/workspace/`)**:
  - `resolve-root.js`: Discovers workspace root mirroring Spoon (`~/.kettle/repositories.xml` -> `PENTAHO_HOME/repositories.xml` -> current working directory).
  - `boundary.js`: Enforces canonical containment (`createWorkspaceBoundary`). Resolves relative paths against root, allows absolute paths only within root, and rejects traversal (`..`), sibling-prefix escapes, and symlink/junction escapes. Case-insensitive on Windows.

- **Core Engine (`src/core/`)**:
  - Type-agnostic XML and graph operations using `fast-xml-parser`.
  - `span.js`: Span extraction enabling byte-exact modifications without rewriting or reformatting unchanged XML. Preserves CRLF, comments, and tag ordering.
  - `edit.js`, `artifact-edit.js`, `remove.js`: Perform additions, modifications, and removals of elements, hops, connections, and parameters, returning unified diffs.
  - `validate.js`: Structural validation (checks element existence, hop integrity, START entries, cycle detection, parameters, and variable references).
  - `search.js` & `summarize.js`: Search across `.kjb`/`.ktr` trees and generate structural summaries.

- **Knowledge Base (`src/knowledge/`)**:
  - `catalog.yaml`: Component registry categorizing steps and job entries as `canonical` or `observed` (`generator_eligible`).
  - `pentaho/`: Markdown specifications and XML templates for transformations (`trans/*.md`) and jobs (`job/*.md`).
  - `loader.js`: Immutable at runtime; read-only access via `kettle_knowledge_*` tools.

- **Repository Support (`src/repository/`)**:
  - Graph dependency tracking, connection management, reference migration, path translation, and Spoon `repositories.xml` synchronization.

- **Runtime Execution (`src/runtime/`)**:
  - Optional, phase-gated execution via `Kitchen.bat` / `Pan.bat`.
  - `policy.js`: Enforces two-layer execution gating: server-level `PENTAHO_ENABLE_EXECUTE=1` AND call-level `confirmed: true`.
  - `run.js` & `tail-buffer.js`: Spawns PDI processes with tree-kill timeouts (`taskkill /T /F` on Windows) and fixed 256 KiB stream tail-buffers to avoid memory exhaustion.
  - `windows-args.js` & `redact.js`: Windows command token sanitization and credential/variable redaction in logs.

- **Tools & MCP Server (`src/tools/` & `src/server.js`)**:
  - 9 tool factories in `src/tools/*.tools.js` combined via `registry.js` into exactly 41 tools across 8 functional groups: Read (4), Edit (9), Artifact (2), Removal (2), Connections (6), Repository (9), Validate (1), Knowledge (4), Runtime (4).
  - `server.js`: MCP protocol handler using `@modelcontextprotocol/sdk`. All tool calls return `{ ok: true, data }` or `{ ok: false, error }` JSON strings inside text content with `isError: true` on failure (never protocol-level RPC errors). Capabilities declare `{ tools: {} }` without prompts or resources.

## Important Invariants & Conventions

- **Production Tool Profile**: The tool surface is frozen at exactly 41 tools. No runtime learning, catalog modification, or lifecycle tools (`pentaho_*`) may be added. `npm run verify:profile` enforces this set equality.
- **Lossless Span Editing**: XML modifications must preserve surrounding whitespace, comments, tag ordering, and line endings (CRLF/LF). Core functions return unified diffs for verification before writing.
- **Knowledge-First Principle**: Do not generate Pentaho XML from memory. Always inspect the catalog template and field definitions using `kettle_knowledge_get` before generating or modifying steps and job entries.
- **Phase-Gated Runtime**: `kettle_runtime_loadcheck` and `kettle_runtime_execute` must only run after `kettle_validate` passes with zero structural errors.
- **Companion Skill**: The end-to-end development workflow is defined in `skills/developing-pentaho-jobs/SKILL.md` and uses `references/pentaho-spec-template.md` and `references/pentaho-plan-template.md`.
