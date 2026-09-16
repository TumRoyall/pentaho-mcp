# Contributing to Pentaho MCP

Thank you for your interest in contributing to **Pentaho MCP**!

We welcome contributions, bug reports, feature requests, and improvements to our embedded Pentaho component knowledge base.

---

## 📑 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Architecture & Design Principles](#architecture--design-principles)
- [Development Setup](#development-setup)
- [Running Tests & Verifications](#running-tests--verifications)
- [Adding or Updating Tools](#adding-or-updating-tools)
- [Expanding the Pentaho Knowledge Catalog](#expanding-the-pentaho-knowledge-catalog)
- [Coding Standards & Invariants](#coding-standards--invariants)
- [Pull Request Checklist](#pull-request-checklist)

---

## Code of Conduct

Please be respectful, collaborative, and constructive when interacting with maintainers and other contributors. We are committed to providing an open, welcoming, and harassment-free environment for everyone.

---

## Architecture & Design Principles

Before contributing code, please review these core architectural invariants:

1. **Deterministic Primitives + External Reasoning**:
   - Pentaho MCP exposes deterministic, lossless operations (byte-exact span editing, schema validation, repository mapping).
   - High-level reasoning, brainstorming, and execution planning belong to the AI client and Superpowers companion skills (`skills/developing-pentaho-jobs/`).
2. **Lossless Span-Based XML Editing**:
   - Never use full-document XML serializers that rewrite or reformat the DOM.
   - All mutations must use byte-offset span replacements (`src/core/span.js`), preserving whitespace, tag order, comments, and CRLF line endings.
3. **Canonical Workspace Boundary Containment**:
   - All file operations must go through `src/workspace/boundary.js` (`createWorkspaceBoundary`).
   - Absolute paths must resolve within `KETTLE_ROOT`. Path traversals (`..`), sibling-prefix escapes, and symlink/junction escapes outside the root are strictly rejected.
4. **Zero-PDI Core Dependency**:
   - Core capabilities (read, create, edit, remove, repository, connection, static validation, knowledge) must only depend on pure Node.js (>= 20) with no Java or PDI installation.
   - Local PDI runtime execution (`Kitchen.bat` / `Pan.bat`) is optional, phase-gated, and requires explicit user confirmation (`confirmed: true`).
5. **No Runtime Knowledge Mutation**:
   - The knowledge base is immutable at runtime. There are no learning, promotion, or dynamic catalog mutation tools.

---

## Development Setup

### Prerequisites

- **Node.js**: >= 20.x (LTS recommended)
- **Git**: Latest version
- **OS**: Windows (preferred for packaging `.exe`), Linux, or macOS

### Clone and Install

```bash
git clone https://github.com/TumRoyal/pentaho-mcp-server.git
cd pentaho-mcp-server
npm install
```

---

## Running Tests & Verifications

The test suite uses Node.js's native test runner (`node:test`) and strict assertions:

```bash
# Run the entire test suite
npm test

# Verify production profile (asserts exact 41-tool set and zero prompts/resources)
npm run verify:profile

# Run specific tests
node --test test/smoke.test.js
node --test test/edit.test.js
node --test test/knowledge.test.js test/knowledge-coverage.test.js
node --test test/repository.test.js
```

### Packaging & Release Smoke Test (Windows)

To build and smoke-test the standalone Windows `.exe` bundle:

```powershell
npm run build:release -- --version 1.0.0
```

---

## Adding or Updating Tools

The production surface maintains **exactly 41 tools** across 9 factories. If you need to propose a new tool:

1. Create or modify the tool in the relevant factory under `src/tools/` (e.g. `read.tools.js`, `edit.tools.js`, `repository.tools.js`).
2. Factory functions must accept `workspaceBoundary` (`createWorkspaceBoundary`) and return an array of `{ name, description, inputSchema, handler }`.
3. Register the factory in `src/tools/registry.js`.
4. If adding or renaming tools, update the expected tool set in `scripts/verify-production-profile.mjs`, `packaging/doctor.ps1`, `docs/tools-reference.md`, and `docs/documentation-facts.md`.
5. Add rigorous unit and integration tests under `test/`.

---

## Expanding the Pentaho Knowledge Catalog

To add or update Pentaho step (`.ktr`) or job entry (`.kjb`) templates:

1. **Source Authentic XML**:
   - Extract canonical XML from a working `.kjb`/`.ktr` artifact in Pentaho Spoon (version 9.4+ preferred).
   - Sanitize all passwords, connection strings, hostnames, and paths using variables (e.g., `${VAR_HOST}`, `${Internal.Entry.Current.Directory}`).
2. **Analyze Candidate XML**:
   - Use `kettle_knowledge_analyze_xml` to inspect the candidate block and check for findings (hardcoded paths, plain credentials).
3. **Add Component Specification**:
   - Add the specification Markdown file under `src/knowledge/pentaho/trans/<TYPE>.md` (transformations) or `src/knowledge/pentaho/job/<TYPE>.md` (jobs).
   - Follow the 5-part structure: Template XML, Configuration Fields, YAML-to-XML mapping, Working Example, and Known Gotchas.
4. **Register in `catalog.yaml`**:
   - Add an entry under `components.transformation` or `components.job` in `src/knowledge/pentaho/catalog.yaml`:
     - `type`: Component identifier (e.g., `TableInput`)
     - `xml_type`: XML tag identifier (e.g., `TableInput`)
     - `file`: Relative path to markdown documentation
     - `status`: `canonical` (thoroughly tested) or `observed` (known gaps)
     - `generator_eligible`: `true` for canonical, `false` for observed
5. **Verify Catalog Coverage**:
   - Run `node --test test/knowledge-coverage.test.js` to ensure catalog integrity.

---

## Coding Standards & Invariants

- **Language & Runtime**: Modern ECMAScript Modules (ESM, `"type": "module"` in `package.json`).
- **Dependencies**: Keep runtime dependencies strictly minimal. Currently limited to `@modelcontextprotocol/sdk` and `fast-xml-parser`. Do not introduce new runtime dependencies without maintainer approval.
- **Path Handling**: Always use cross-platform path resolution. On Windows, account for case-insensitive drive letters and paths. Use POSIX forward slashes for internal repository references (`/public/jobs/run.kjb`).
- **Error Envelopes**: All tool handlers must return `{ ok: true, data: ... }` or `{ ok: false, error: "..." }`. Edit tools return unified diffs on success.
- **No Secrets**: Never commit plaintext credentials, internal hostnames, or production connection strings.

---

## Pull Request Checklist

Before submitting a Pull Request, please ensure:

- [ ] `npm test` passes completely without failures or unhandled rejections.
- [ ] `npm run verify:profile` reports `production profile OK: 41 tools (exact set)`.
- [ ] All new functions or bug fixes include corresponding unit tests in `test/`.
- [ ] All file system operations honor `workspaceBoundary` containment.
- [ ] Knowledge base additions include provenance, sanitized variables, and updated tests.
- [ ] Documentation (`docs/tools-reference.md`, `docs/documentation-facts.md`, `README.md`, `README.vi.md`) is updated if any tool schemas or behaviors changed.
- [ ] `git diff --check` reports no whitespace or formatting errors.
