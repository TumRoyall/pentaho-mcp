import { existsSync, readFileSync, readdirSync, realpathSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { detectPdi } from '../runtime/detect.js';
import { runPdi } from '../runtime/run.js';
import { artifactSelectorSchema, selectArtifact } from './repository-schema.js';

const str = description => ({ type: 'string', description });

const runProperties = {
  ...artifactSelectorSchema(),
  artifact: str('Physical KJB/KTR path relative to KETTLE_ROOT or repository path'),
  parameters: { type: 'object', additionalProperties: { type: 'string' } },
  timeoutMs: { type: 'integer', minimum: 1 },
  logLevel: {
    type: 'string',
    enum: ['Basic', 'Detailed', 'Debug', 'Rowlevel', 'Error', 'Nothing'],
    description: 'Logging level for PDI execution (default Basic)'
  }
};

const LOGS_SUBDIR = ['.pentaho-mcp', 'runtime-logs'];
const MAX_LOG_BYTES = 256 * 1024;
const LOG_RETENTION = 100;

function logsDirFor(ctx) {
  return path.join(ctx.root, ...LOGS_SUBDIR);
}

function runContext(ctx) {
  return {
    ...ctx,
    pentahoHome: ctx.pentahoHome,
    logsDir: logsDirFor(ctx),
    executeEnabled: ctx.executeEnabled,
    repositoryPaths: ctx.repositoryPaths,
    repositoryName: ctx.repositoryName,
  };
}

function readLogFile(logsDir, name) {
  const target = path.resolve(logsDir, name);
  const rel = path.relative(logsDir, target);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Log name escapes the runtime logs directory: ${name}`);
  }
  const canonical = existsSync(target) ? realpathSync(target) : target;
  const canonicalRel = path.relative(realpathSync(logsDir), canonical);
  if (canonicalRel.startsWith('..') || path.isAbsolute(canonicalRel)) {
    throw new Error(`Log file resolves outside the runtime logs directory: ${name}`);
  }
  const buffer = readFileSync(canonical);
  const bounded = buffer.length > MAX_LOG_BYTES ? buffer.subarray(buffer.length - MAX_LOG_BYTES) : buffer;
  return bounded.toString('utf8');
}

function pruneLogs(logsDir) {
  if (!existsSync(logsDir)) return;
  const names = readdirSync(logsDir).filter(name => name.endsWith('.log')).sort();
  for (const stale of names.slice(0, Math.max(0, names.length - LOG_RETENTION))) {
    try { unlinkSync(path.join(logsDir, stale)); } catch { /* best effort */ }
  }
}

async function runArtifact(ctx, args, mode) {
  const id = selectArtifact(ctx, args, { physicalKey: 'artifact', write: false });
  const result = await runPdi({ ...args, artifact: id.physicalPath, identity: id, kind: id.artifactKind, mode }, runContext(ctx));
  pruneLogs(logsDirFor(ctx));
  return result;
}

export function runtimeTools(ctx) {
  return [
    {
      name: 'kettle_runtime_detect',
      title: 'Detect PDI runtime',
      description: 'Detect optional local Kitchen.bat and Pan.bat beneath PENTAHO_HOME.',
      annotations: { title: 'Detect PDI runtime', readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: () => detectPdi(ctx.pentahoHome),
    },
    {
      name: 'kettle_runtime_loadcheck',
      title: 'Load-check artifact',
      description: 'Statically validate and ask local Kitchen/Pan to load an artifact without deployment.',
      annotations: { title: 'Load-check artifact', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      inputSchema: { type: 'object', properties: runProperties, required: ['artifact'], additionalProperties: false },
      handler: args => runArtifact(ctx, args, 'loadcheck'),
    },
    {
      name: 'kettle_runtime_execute',
      title: 'Execute artifact',
      description: 'Execute with Kitchen/Pan; every execution requires confirmed=true.',
      annotations: { title: 'Execute artifact', readOnlyHint: false, destructiveHint: true, openWorldHint: true },
      inputSchema: { type: 'object', properties: { ...runProperties, confirmed: { type: 'boolean' } }, required: ['artifact'], additionalProperties: false },
      handler: args => runArtifact(ctx, args, 'execute'),
    },
    {
      name: 'kettle_runtime_logs',
      title: 'Read runtime logs',
      description: 'Read sanitized runtime logs stored under the active project root.',
      annotations: { title: 'Read runtime logs', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          name: str('Optional single log file name to read'),
          limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Maximum number of newest logs to return', default: 20 },
        },
        additionalProperties: false,
      },
      handler: (args = {}) => {
        const logsDir = logsDirFor(ctx);
        if (!existsSync(logsDir)) return { files: [] };
        if (args.name != null) {
          return { files: [{ name: args.name, content: readLogFile(logsDir, args.name) }] };
        }
        const limit = Math.min(100, Math.max(1, Number.isInteger(args.limit) ? args.limit : 20));
        const names = readdirSync(logsDir)
          .filter(name => name.endsWith('.log'))
          .sort()
          .reverse()
          .slice(0, limit);
        return { files: names.map(name => ({ name, content: readLogFile(logsDir, name) })) };
      },
    },
  ];
}
