# Pentaho MCP

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP-stdio-blue.svg)](https://modelcontextprotocol.io/)
[![Tools Surface](https://img.shields.io/badge/tools-41%20production-orange.svg)](docs/tools-reference.md)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)](docs/install.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **Production-grade Model Context Protocol (MCP) for Pentaho Kettle (`.kjb` / `.ktr`) artifacts**: Lossless span-based XML inspection and editing, embedded Pentaho knowledge catalog, static structural validation, file repository management, and optional phase-gated local PDI runtime execution.
>
> 🌐 **Language / Ngôn ngữ**: **English** | [Tiếng Việt](README.vi.md)

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [41 Production Tools Surface](#-41-production-tools-surface)
- [System Architecture](#-system-architecture)
- [Recommended 5-Phase Workflow](#-recommended-5-phase-workflow)
- [Quickstart](#-quickstart)
  - [1. Download the Windows Release (.exe)](#1-download-the-windows-release-exe-for-end-users)
  - [2. Source Mode (For Developers)](#2-source-mode-for-developers)
- [Client Configuration](#-client-configuration)
  - [Claude Code](#claude-code)
  - [Cursor](#cursor)
  - [Windsurf](#windsurf)
  - [Kiro](#kiro)
  - [Codex CLI](#codex-cli)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [Companion Skill](#-companion-skill)
- [Non-Goals & Safety Invariants](#-non-goals--safety-invariants)
- [Documentation Hub](#-documentation-hub)
- [Contributing & License](#-contributing--license)

---

## 💡 Overview

**Pentaho MCP** (advertised as `pentaho-mcp` on stdio) is a specialized **Model Context Protocol (MCP)** tool suite that enables AI coding assistants (such as Claude Code, Cursor, Windsurf, Kiro, and Codex) to safely inspect, create, edit, validate, and execute Pentaho Data Integration (PDI / Kettle) **Jobs (`.kjb`)** and **Transformations (`.ktr`)**.

The system follows a strict architectural separation: **Deterministic Primitives + External Reasoning**:
- **Pentaho MCP**: Provides deterministic, lossless primitives: byte-exact XML span editing, hop coordinate calculations, schema-compliant step insertion, static graph validation, and repository reference migration.
- **The AI Client / Superpowers Workflow**: Performs the high-level reasoning: requirement analysis, design brainstorming, formal specification, and execution planning.

---

## ✨ Key Features

- 🎯 **Lossless Span-Based XML Editing**: Uses `fast-xml-parser` to pinpoint element byte offsets and only modifies the targeted byte spans. Preserves 100% of the original tag ordering, formatting, XML comments, whitespace, and CRLF/LF line endings expected by Pentaho Spoon.
- 🧠 **Embedded Knowledge-First Catalog**: Bundles a rich knowledge catalog (`catalog.yaml` and Markdown specifications in `src/knowledge/pentaho/`). AI agents never hallucinate Pentaho XML tags; they inspect canonical templates via `kettle_knowledge_get` before creating or updating steps/entries.
- ⚡ **Zero-PDI Core Dependency**: All read, create, edit, hop wiring, parameter modification, repository tracking, and static validation operations run on pure Node.js — **no Java, PDI, or Spoon installation required** for core features.
- 🛡️ **Canonical Workspace Boundary Containment**: Enforces strict directory boundaries via `src/workspace/boundary.js`. Rejects path traversals (`..`), sibling-prefix escapes, and symlink/junction escapes outside the resolved workspace root.
- 🗄️ **Full Repository & Database Connection Support**: Native handling for Pentaho File Repositories, repository-aware references (`rep_name` in repository mode, absolute `<filename>` otherwise), `.kdb` shared database connection files, and automatic Spoon `repositories.xml` detection.
- 🚦 **Phase-Gated Runtime Execution**: Optional local PDI execution (`Kitchen.bat` / `Pan.bat`) protected by dual safeguards: environment opt-in (`PENTAHO_ENABLE_EXECUTE=1`), invocation-level confirmation (`confirmed: true`), and mandatory pre-run static validation.

---

## 🛠️ 41 Production Tools Surface

The production surface exposes **exactly 41 tools** (strictly enforced via set-equality check in `verify:profile`), categorized into 8 functional groups:

| Group | Count | Representative Tools | Primary Purpose |
|-------|:-----:|----------------------|-----------------|
| **Read** | 4 | `kettle_list`<br>`kettle_summary`<br>`kettle_get_element`<br>`kettle_search` | List workspace artifacts, summarize elements & hop graphs, inspect step details (including full SQL), and perform bounded full-workspace searches. |
| **Edit** | 9 | `kettle_create_file`<br>`kettle_add_element`<br>`kettle_set_field`<br>`kettle_set_field_path`<br>`kettle_set_fields`<br>`kettle_edit_hops`<br>`kettle_add_error_hop`<br>`kettle_rename_element`<br>`kettle_clone` | Create empty `.kjb`/`.ktr` files, insert steps/entries from knowledge templates, update single or nested fields, populate repeatable tables, wire hops, and clone elements. |
| **Artifact** | 2 | `kettle_set_parameters`<br>`kettle_copy_connection` | Manage artifact-level parameters and safely copy `<connection>` blocks between artifacts without writing plaintext passwords (variables or encrypted values only). |
| **Removal** | 2 | `kettle_remove_element`<br>`kettle_edit_error_hop` | Safely remove steps/entries (blocks if references exist unless `removeReferences: true` is set for atomic cascade), and enable/disable/delete error handling routes. |
| **Connections** | 6 | `kettle_connection_list`<br>`kettle_connection_get`<br>`kettle_connection_put`<br>`kettle_connection_delete`<br>`kettle_connection_usage`<br>`kettle_connection_rename` | Manage lifecycle and track usages of shared database connections (`.kdb`) within a Pentaho File Repository. |
| **Repository** | 9 | `kettle_repository_list`<br>`kettle_repository_mkdir`<br>`kettle_set_reference`<br>`kettle_repository_references`<br>`kettle_repository_move`<br>`kettle_repository_migrate_references`<br>`kettle_repository_recover`<br>`kettle_repository_detect`<br>`kettle_repository_register` | Pentaho File Repository operations: move/rename files with automatic cross-reference updates, detect Spoon registries, and register workspaces into `repositories.xml`. |
| **Validate** | 1 | `kettle_validate` | Static structural validation of single artifacts or entire workspace trees (detects orphaned hops, cycles, missing START entries, unresolved parameters). |
| **Knowledge** | 4 | `kettle_knowledge_list`<br>`kettle_knowledge_get`<br>`kettle_knowledge_analyze_xml`<br>`kettle_knowledge_coverage` | Query the embedded component catalog, fetch canonical step/job templates, analyze external sample XML, and evaluate catalog coverage. |
| **Runtime** | 4 | `kettle_runtime_detect`<br>`kettle_runtime_loadcheck`<br>`kettle_runtime_execute`<br>`kettle_runtime_logs` | Probe local PDI installation, run non-executing loadchecks, execute pipelines via Kitchen/Pan, and retrieve redacted tail-buffered runtime logs. |

👉 For full parameters, input schemas, and call examples, see the [41 Tools Reference Guide (`docs/tools-reference.md`)](docs/tools-reference.md).

---

## 🏛️ System Architecture

```mermaid
flowchart LR
    subgraph Client_Layer[Client & Reasoning Layer]
        AI[AI Assistant: Claude Code / Cursor / Codex]
        SP[Superpowers / Companion Skill] -. guides .-> AI
    end

    subgraph MCP_Layer[Pentaho MCP]
        STDIO[Stdio Transport JSON-RPC]
        SRV[Protocol Core: src/server.js]
        REG[Registry: 9 Tool Factories]
        BND[Boundary Policy: src/workspace/boundary.js]
        
        STDIO --> SRV --> REG
        REG --> BND
        
        CORE[Core Engine: Span-Based XML & Graph]
        KNOW[Knowledge Base: catalog.yaml + Markdown]
        REPO[Repository Engine: Paths & References]
        RT[Runtime Engine: Kitchen / Pan Process Runner]
        
        REG --> CORE
        REG --> KNOW
        REG --> REPO
        REG --> RT
    end

    subgraph Storage[Workspace & Local Environment]
        WS[(Workspace: .kjb / .ktr / .kdb)]
        PDI[(Local PDI: Kitchen.bat / Pan.bat)]
        SPOON[(Spoon: ~/.kettle/repositories.xml)]
    end

    CORE --> WS
    REPO --> WS
    REPO -. sync .-> SPOON
    RT -. phase-gated execution .-> PDI
```

---

## 🔄 Recommended 5-Phase Workflow

To ensure reliable, error-free ETL artifacts, development is structured into a 5-phase lifecycle guarded by a **Dual Mutation Gate**:

```mermaid
flowchart TD
    P1[Phase 1: BA Requirement & Brainstorming] -->|Design Approval| P2[Phase 2: Formal Specification]
    P2 -->|Spec Approval| P3[Phase 3: Implementation Planning]
    P3 -->|Plan Approval| GATE{DUAL MUTATION GATE<br>Both Spec & Plan approved?}
    GATE -->|Yes| P4[Phase 4: Knowledge-First XML Execution]
    GATE -->|No| P3
    P4 --> P5[Phase 5: Static Validation & Phase-Gated Runtime]
    P5 --> Handoff[Final Handoff & Review]
```

1. **Phase 1 — Requirements & Design**: Clarify sources, targets, parameters, and failure strategies. Only read-only tools (`kettle_list`, `kettle_summary`, `kettle_knowledge_*`) may be invoked.
2. **Phase 2 — Specification**: Draft a formal specification covering boundaries, artifact inventory, variables, job/transformation definitions, and acceptance criteria.
3. **Phase 3 — Planning**: Produce an artifact-by-artifact execution plan: leaf `.ktr` transformations first -> dependent `.ktr` -> orchestrating `.kjb` jobs last.
4. **Phase 4 — Execution**: The mutation gate opens only after both Spec and Plan are approved. Before configuring any step or entry, inspect its canonical schema with `kettle_knowledge_get`.
5. **Phase 5 — Verification & Handoff**: Run `kettle_validate` across individual files and the entire workspace tree. Only when **zero structural errors** remain can optional runtime verification (`loadcheck`, `execute`) be performed.

👉 Read the complete playbook in the [5-Phase Workflow Guide (`docs/workflow-guide.md`)](docs/workflow-guide.md).

---

## 🚀 Quickstart

### 1. Download the Windows Release (.exe, For End Users)

No Node.js or `npm install` needed: the server, its dependencies, the knowledge base, and the companion skill ship in one ZIP.

1. Download `pentaho-mcp-<version>-win-x64.zip` and `checksums.sha256` from [GitHub Releases](https://github.com/TumRoyall/pentaho-mcp/releases).
2. Verify, extract to a stable folder, unblock, and run the health check:

```powershell
$zip = 'pentaho-mcp-1.0.0-win-x64.zip'
(Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()   # must match checksums.sha256
Expand-Archive $zip -DestinationPath C:\Tools\pentaho-mcp -Force
Get-ChildItem C:\Tools\pentaho-mcp -Recurse | Unblock-File
powershell -ExecutionPolicy Bypass -File C:\Tools\pentaho-mcp\doctor.ps1 -PentahoHome C:\Pentaho\data-integration
```

3. Register `C:/Tools/pentaho-mcp/pentaho-mcp.exe` with your AI client (below).

👉 Step-by-step guide (download script, upgrade, uninstall): [Installation Manual (`docs/install.md`)](docs/install.md).

### 2. Source Mode (For Developers)

**Prerequisites**: Node.js >= 20.

```powershell
git clone https://github.com/TumRoyall/pentaho-mcp.git
cd pentaho-mcp
npm install
npm test
npm run verify:profile
node src/index.js
```

Releases are published by pushing a `v*` tag (`.github/workflows/release.yml`).

---

## 🔌 Client Configuration

> **Workspace root:** no environment variable sets the workspace root. It follows the folder you open the client in. If that folder is (or is inside) a file repository registered in Spoon (`~/.kettle/repositories.xml` or `PENTAHO_HOME/repositories.xml`), or contains exactly one, the server works in repository mode at that repository; otherwise in file mode at the folder. A repository registered elsewhere never takes over the folder you opened. Repository mode writes `<directory>/batch/daily/job</directory>`-style headers and `rep_name` references; file mode writes `<directory>/</directory>` and absolute `<filename>` references. All paths passed to tools are still validated against the resolved root by the workspace boundary.

### Claude Code

Recommended: register once at **user scope** with the CLI (works in every project; the workspace root is the folder where you run `claude`). All options go before `--`:

```powershell
claude mcp add --scope user --transport stdio pentaho-mcp `
  -e PENTAHO_HOME=C:/Pentaho/data-integration `
  -- C:/Tools/pentaho-mcp/pentaho-mcp.exe
claude mcp list   # pentaho-mcp should show ✓ Connected
```

To share with a team instead, commit a `.mcp.json` at the **Pentaho project root** (not inside `.claude/`); Claude Code asks for approval the first time:

```json
{
  "mcpServers": {
    "pentaho-mcp": {
      "type": "stdio",
      "command": "C:/Tools/pentaho-mcp/pentaho-mcp.exe",
      "args": [],
      "env": {
        "PENTAHO_HOME": "${PENTAHO_HOME:-C:/Pentaho/data-integration}"
      }
    }
  }
}
```

*(Source mode: use `-- node C:/path/to/pentaho-mcp/src/index.js`, or `"command": "node"` with that path in `args`. Add `PENTAHO_ENABLE_EXECUTE=1` only to allow real Kitchen/Pan runs.)*

### Cursor

Add to `.cursor/mcp.json` (or via Settings -> MCP Servers):

```json
{
  "mcpServers": {
    "pentaho-mcp": {
      "command": "C:/Tools/pentaho-mcp/pentaho-mcp.exe",
      "args": [],
      "env": {
        "PENTAHO_HOME": "C:/Pentaho/data-integration"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "pentaho-mcp": {
      "command": "node",
      "args": ["C:/path/to/pentaho-mcp/src/index.js"],
      "env": {
        "PENTAHO_HOME": "C:/Pentaho/data-integration"
      }
    }
  }
}
```

### Kiro

Configure in `.kiro/settings/mcp.json` (workspace) or `%USERPROFILE%/.kiro/settings/mcp.json` (global):

```json
{
  "mcpServers": {
    "pentaho-mcp": {
      "command": "C:/Tools/pentaho-mcp/pentaho-mcp.exe",
      "args": [],
      "env": {
        "PENTAHO_HOME": "C:/Pentaho/data-integration"
      }
    }
  }
}
```

### Codex CLI

Add to `.codex/config.toml`:

```toml
[mcp_servers.pentaho-mcp]
command = "C:/Tools/pentaho-mcp/pentaho-mcp.exe"
args = []

[mcp_servers.pentaho-mcp.env]
PENTAHO_HOME = "C:/Pentaho/data-integration"
```

---

## ⚙️ Configuration & Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|:--------:|
| `PENTAHO_HOME` | Path to local Pentaho Data Integration directory containing `Kitchen.bat` / `Pan.bat`. Also checked for a `repositories.xml` during workspace root detection. | Unset | Only for Runtime |
| `PENTAHO_REPOSITORY_NAME` | Optional repository name override. Falls back to the repository name detected from `repositories.xml`. | Detected from `repositories.xml` | Optional |
| `PENTAHO_ENABLE_EXECUTE` | Opt-in gate for executing pipelines. Only `"1"` enables execution; all other values disable it. | `"0"` (disabled) | Optional |
| `KETTLE_KNOWLEDGE_DIR` | Custom override path for the embedded knowledge base directory. | `src/knowledge/pentaho` | Optional |

The workspace root is **auto-detected per start-up and cannot be set by an environment variable** — see [Client Configuration](#-client-configuration). All tool paths stay confined to that root by the workspace boundary; relative paths resolve against it, and absolute paths are valid only when contained within it.

👉 For containment rules and security details, see the [Configuration Guide (`docs/configuration.md`)](docs/configuration.md).

---

## 🧩 Companion Skill

This repository includes a specialized companion skill located at **`skills/developing-pentaho-jobs/`**:
- `SKILL.md`: 5-phase lifecycle orchestration, mutation gating, knowledge lookups, and static acceptance criteria.
- `references/pentaho-spec-template.md`: Formal Pentaho specification template.
- `references/pentaho-plan-template.md`: Artifact-by-artifact implementation plan template.

*Note: Skills are not automatically activated by being present in the repository; copy the skill directory into your client's designated skills path (see [Installation Guide](docs/install.md)).*

---

## 🚫 Non-Goals & Safety Invariants

To keep Pentaho MCP deterministic, robust, and safe:
- ❌ **No Automated Deployments or Git Mutations**: Pentaho MCP never commits, pushes, or alters Git branches.
- ❌ **No Runtime Knowledge Mutation**: The embedded knowledge catalog is immutable and read-only.
- ❌ **No Business Data Validation**: `kettle_validate` verifies structural XML correctness for Spoon/Kitchen execution; it does not audit ETL data business logic.
- ❌ **No MCP Prompts or Resources**: Pentaho MCP advertises `capabilities = { tools: {} }` only, with no prompts or resources.

---

## 📖 Documentation Hub

Detailed documentation is available in the [`docs/`](docs/README.md) directory:

- 🗺️ **[Documentation Hub (docs/README.md)](docs/README.md)**: Role-based reading paths and navigation map.
- 🏗️ **[System Architecture](docs/architecture.md)**: Deep dive into the span-based XML engine, module map, and containment policy.
- ⚙️ **[Configuration & Boundaries](docs/configuration.md)**: Workspace confinement, environment variables, and process limits.
- 🛠️ **[41 Tools Reference Guide](docs/tools-reference.md)**: Complete parameter and schema documentation for all 41 tools.
- 📋 **[5-Phase Workflow Playbook](docs/workflow-guide.md)**: Step-by-step guide for turning BA requirements into validated Kettle artifacts.
- 💻 **[Development & Contribution](docs/development.md)**: Repository setup, testing conventions, and Windows release packaging.
- 🚀 **[Installation Manual](docs/install.md)**: Detailed setup instructions for source and packaged modes.
- 🩺 **[Operations & Troubleshooting](docs/operations.md)**: Health checks via `doctor.ps1`, log retention, and diagnostic procedures.
- 🔍 **[Documentation Facts](docs/documentation-facts.md)**: Single Source of Truth reference table.
- 📊 **[PDI 9.4 Compatibility Evidence](docs/pdi94-evidence-report.md)** & **[File Repository Evidence](docs/pdi94-repository-evidence.md)**: Verified test evidence on Pentaho 9.4.

---

## 🤝 Contributing & License

- **Contributions**: Please read [CONTRIBUTING.md](CONTRIBUTING.md) for development workflows, testing guidelines, and PR checklists.
- **License**: Distributed under the [MIT License](LICENSE).
