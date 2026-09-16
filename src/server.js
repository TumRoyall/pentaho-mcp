/**
 * MCP server wiring for kettle-mcp-dte.
 *
 * The workspace root is auto-detected (see workspace/resolve-root.js): a file
 * repository declared in ~/.kettle/repositories.xml, else one in
 * PENTAHO_HOME/repositories.xml, else the current working directory. It is the
 * default scope for list/search/validate and the write boundary for edit
 * tools; relative tool paths resolve against it.
 * KETTLE_KNOWLEDGE_DIR: optional override for the embedded knowledge base.
 *
 * Every result is `text` content containing {ok, data|error} JSON, so tool
 * failures are payloads the model can read, not protocol-level errors.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { buildTools } from './tools/registry.js';
import { validateToolArguments } from './tools/schema.js';
import { createWorkspaceBoundary } from './workspace/boundary.js';
import { resolveWorkspaceRoot } from './workspace/resolve-root.js';
import { createRepositoryPaths } from './repository/paths.js';
import { SERVER_VERSION } from './version.js';

export function makeContext({
  root,
  pentahoHome = process.env.PENTAHO_HOME,
  repositoryName = process.env.PENTAHO_REPOSITORY_NAME,
} = {}) {
  // Resolve the workspace root when one is not supplied explicitly (tests and
  // programmatic callers may pass one). Detection mirrors Spoon's repository
  // lookup and falls back to the working directory.
  let workspaceMode = 'file';
  let workspaceSource = 'explicit';
  let detectedRepositoryName = null;
  if (root == null) {
    const detected = resolveWorkspaceRoot({ pentahoHome });
    root = detected.root;
    workspaceMode = detected.mode;
    workspaceSource = detected.source;
    detectedRepositoryName = detected.repository?.name ?? null;
  }

  const boundary = createWorkspaceBoundary(root);
  const repositoryPaths = createRepositoryPaths(boundary);
  const resolvedRepositoryName = typeof repositoryName === 'string' && repositoryName.trim()
    ? repositoryName.trim()
    : detectedRepositoryName;
  return {
    ...boundary,
    repositoryPaths,
    workspaceMode,
    workspaceSource,
    repositoryName: resolvedRepositoryName,
    pentahoHome: typeof pentahoHome === 'string' && pentahoHome.trim()
      ? pentahoHome.trim()
      : null,
    executeEnabled: process.env.PENTAHO_ENABLE_EXECUTE === '1',
  };
}

/**
 * Wrap a payload as MCP text content. Failed tool calls set `isError: true` so
 * a compliant client can distinguish success from failure, while the readable
 * `{ok, data|error}` JSON stays in the text for clients that only render text.
 */
function textResult(payload, { isError = false } = {}) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    ...(isError ? { isError: true } : {}),
  };
}

export function createServer({ version = SERVER_VERSION } = {}) {
  const ctx = makeContext();
  const tools = buildTools(ctx);
  const byName = new Map(tools.map(t => [t.name, t]));
  const listing = tools.map(({ name, title, description, inputSchema, annotations }) => ({
    name, title, description, inputSchema, annotations,
  }));

  const server = new Server(
    { name: 'kettle-mcp-dte', version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: listing }));

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params;
    const tool = byName.get(name);
    if (!tool) return textResult({ ok: false, error: `Unknown tool: ${name}` }, { isError: true });
    const argError = validateToolArguments(tool, args ?? {});
    if (argError) return textResult({ ok: false, error: argError }, { isError: true });
    try {
      return textResult({ ok: true, data: await tool.handler(args ?? {}) });
    } catch (err) {
      return textResult({ ok: false, error: err?.message ?? String(err) }, { isError: true });
    }
  });

  server.onerror = err => console.error('[kettle-mcp-dte]', err);
  return { server, ctx, tools };
}

export async function startServer() {
  const { server, ctx } = createServer();
  process.on('SIGINT', () => { void server.close(); process.exit(0); });
  await server.connect(new StdioServerTransport());
  console.error(`kettle-mcp-dte running on stdio (root=${ctx.root}, mode=${ctx.workspaceMode}, source=${ctx.workspaceSource})`);
}
