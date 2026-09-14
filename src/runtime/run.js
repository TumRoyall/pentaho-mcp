import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validateRepositoryReadiness, validateFile } from '../core/validate.js';
import { detectPdi } from './detect.js';
import { detectRepository } from '../repository/registration.js';
import { executionPolicy } from './policy.js';
import { redact } from './redact.js';
import { createTailBuffer } from './tail-buffer.js';
import { assertSafeWindowsToken, assertParameterName } from './windows-args.js';

const MAX_STREAM_BYTES = 256 * 1024;
const TERMINATE_GRACE_MS = 2000;

function defaultTerminate(child) {
  if (process.platform === 'win32') {
    if (child.pid != null) {
      spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true });
    } else {
      child.kill();
    }
    return;
  }
  child.kill('SIGTERM');
  setTimeout(() => {
    if (!child.killed) child.kill('SIGKILL');
  }, TERMINATE_GRACE_MS).unref?.();
}

function execute(command, args, options, spawnImpl, timeoutMs, terminate) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, options);
    const stdout = createTailBuffer(MAX_STREAM_BYTES);
    const stderr = createTailBuffer(MAX_STREAM_BYTES);
    let timedOut = false; let settled = false;
    const clear = () => { if (timer) clearTimeout(timer); };
    child.stdout?.on('data', chunk => stdout.append(chunk));
    child.stderr?.on('data', chunk => stderr.append(chunk));
    child.on('error', err => { if (settled) return; settled = true; clear(); reject(err); });
    const timer = setTimeout(() => {
      timedOut = true;
      terminate(child);
    }, timeoutMs);
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true; clear();
      resolve({ code, signal, stdout: stdout.value(), stderr: stderr.value(), timedOut });
    });
  });
}

export function buildRepositoryArgs({ identity, repositoryName, mode, parameters = {}, logLevel = 'Basic' }) {
  if (!identity || !identity.name || !identity.directory || !identity.artifactKind) {
    throw new Error('Valid repository identity (kind, directory, name) is required to build repository arguments');
  }
  if (!repositoryName) {
    throw new Error('Repository name is required to build repository CLI arguments');
  }

  const args = [
    `/rep:${repositoryName}`,
    `/dir:${identity.directory}`,
    `/${identity.artifactKind === 'job' ? 'job' : 'trans'}:${identity.name}`,
    `/level:${logLevel || 'Basic'}`,
  ];

  if (mode === 'loadcheck') {
    args.push('/listparam');
  }

  for (const [key, value] of Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    assertParameterName(key);
    args.push(`/param:${key}=${value}`);
  }

  return args;
}

export function classifyLoadcheck({ exitCode, stdout = '', stderr = '', pdiVersion, evidence } = {}) {
  if (exitCode === 0) {
    return 'PASS';
  }

  const combined = `${stdout}\n${stderr}`;

  // Explicit failure patterns
  const failureRegex = /(Unable to load|Could not load|Can't find|Cannot find|Error loading|ERROR:|Exception:)/i;
  if (failureRegex.test(combined)) {
    return 'FAIL';
  }

  // Parameter listing evidence patterns
  const paramEvidenceRegex = /(Parameter\s*:|Parameter\s+description|List of parameters|\[PDI Parameter\])/i;

  if (exitCode === 7) {
    if (paramEvidenceRegex.test(combined)) {
      return 'PASS';
    }
    return 'INDETERMINATE';
  }

  return 'FAIL';
}

export async function runPdi(request, context) {
  if (request.mode === 'execute') {
    const decision = executionPolicy({ confirmed: request.confirmed, executeEnabled: context.executeEnabled });
    if (decision === 'EXECUTE_DISABLED') return { status: 'EXECUTE_DISABLED' };
    if (decision !== 'ALLOW') return { status: 'CONFIRM_REQUIRED' };
  }

  const detection = context.detection ?? detectPdi(context.pentahoHome);
  if (!detection.available) return { status: 'UNAVAILABLE', detection };

  // Detect repository configuration
  const explicitRepo = context.repository != null;
  const repoDetection = context.repository ?? detectRepository(context);

  if (explicitRepo && repoDetection.status !== 'READY') {
    return {
      status: 'REPOSITORY_NOT_READY',
      repositoryStatus: repoDetection.status,
      issues: repoDetection.issues ?? [`Repository status is ${repoDetection.status}`],
    };
  }

  const isRepoMode = repoDetection.status === 'READY' && Boolean(repoDetection.repository?.name);
  let command;
  let args;
  let cwdPath;

  if (isRepoMode) {
    const repositoryName = repoDetection.repository.name;
    const identity = request.identity ?? context.repositoryPaths?.fromPhysical(path.resolve(request.artifact));
    if (!identity) {
      throw new Error('Unable to determine repository identity for execution target');
    }

    if (request.mode === 'execute' || request.mode === 'loadcheck') {
      const readiness = validateRepositoryReadiness(context, identity);
      if (!readiness.ready) {
        return { status: 'STATIC_VALIDATION_FAILED', structural: readiness };
      }
    }

    const kind = request.kind ?? identity.artifactKind;
    command = kind === 'trans' ? detection.pan : detection.kitchen;
    args = buildRepositoryArgs({
      identity,
      repositoryName,
      mode: request.mode,
      parameters: request.parameters,
      logLevel: request.logLevel,
    });
    cwdPath = path.dirname(identity.physicalPath);

  } else {
    // Legacy file-mode fallback when repository is not configured
    const artifact = path.resolve(request.artifact);
    if (request.mode === 'execute' || request.mode === 'loadcheck') {
      const structural = validateFile(artifact);
      if (structural.summary.errors) return { status: 'STATIC_VALIDATION_FAILED', structural };
    }

    const kind = request.kind ?? (artifact.toLowerCase().endsWith('.ktr') ? 'trans' : 'job');
    command = kind === 'trans' ? detection.pan : detection.kitchen;
    args = [`/file:${artifact}`, '/norep', `/level:${request.logLevel || 'Basic'}`];
    if (request.mode === 'loadcheck') args.push('/listparam');
    for (const [key, value] of Object.entries(request.parameters ?? {}).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
      assertParameterName(key);
      args.push(`/param:${key}=${value}`);
    }
    cwdPath = path.dirname(artifact);
  }

  const batchLauncher = /\.(bat|cmd)$/i.test(command);
  const needsShell = process.platform === 'win32' && batchLauncher;

  if (batchLauncher) {
    assertSafeWindowsToken(command, 'command');
    for (const arg of args) assertSafeWindowsToken(arg, 'argument');
  }

  const quote = value => `"${String(value).replace(/"/g, '\\"')}"`;
  const spawnCommand = needsShell ? quote(command) : command;
  const spawnArgs = needsShell ? args.map(quote) : args;

  const raw = await execute(spawnCommand, spawnArgs, {
    cwd: cwdPath,
    shell: needsShell,
    windowsHide: true,
    env: { ...process.env, ...(context.environment ?? {}) },
  }, context.spawnImpl ?? spawn, Math.max(1, request.timeoutMs ?? 120_000), context.terminate ?? defaultTerminate);

  const stdout = redact(raw.stdout, request.parameters);
  const stderr = redact(raw.stderr, request.parameters);

  let status;
  if (raw.timedOut) {
    status = 'TIMEOUT';
  } else if (request.mode === 'loadcheck') {
    status = classifyLoadcheck({ exitCode: raw.code, stdout, stderr });
  } else {
    status = raw.code === 0 ? 'PASS' : 'FAIL';
  }

  let logFile = null;
  if (context.logsDir) {
    mkdirSync(context.logsDir, { recursive: true });
    logFile = path.join(context.logsDir, `${Date.now()}-${request.kind || 'artifact'}-${request.mode}.log`);
    writeFileSync(logFile, `status=${status}\nexitCode=${raw.code ?? ''}\nsignal=${raw.signal ?? ''}\n\nSTDOUT\n${stdout}\n\nSTDERR\n${stderr}\n`, 'utf8');
  }

  return { status, exitCode: raw.code, signal: raw.signal, stdout, stderr, logFile };
}
