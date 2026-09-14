/** Lint rules matched to the consumer repo's Kettle 9.4 usage. */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { XMLValidator } from 'fast-xml-parser';
import {
  parseModel, text, toArray, STEP_REFERENCE_TAGS, STEP_TARGET_REFERENCE_TAGS,
} from './model.js';
import { walkKettleFiles } from './search.js';
import { extractReferences } from '../repository/references.js';
import { scanRepository, dependencyClosure } from '../repository/graph.js';

export function isActiveHop(hop) {
  return hop.enabled !== 'N';
}

function report(filePath, issues) {
  return {
    path: filePath,
    issues,
    summary: {
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
    },
  };
}

function isStartEntry(e) {
  return e.type === 'SPECIAL' && text(e.raw.start) === 'Y';
}

function computeReachable(m) {
  const activeHops = m.hops.filter(isActiveHop);
  const adj = new Map();
  for (const h of activeHops) {
    if (!adj.has(h.from)) adj.set(h.from, []);
    adj.get(h.from).push(h.to);
  }
  let roots;
  if (m.kind === 'job') {
    roots = m.elements.filter(isStartEntry).map(e => e.name);
  } else if (m.elements.length === 1) {
    roots = [m.elements[0].name];
  } else {
    const targets = new Set(activeHops.map(h => h.to));
    roots = m.elements
      .map(e => e.name)
      .filter(n => !targets.has(n) && (adj.get(n) ?? []).length > 0);
  }
  const seen = new Set(roots);
  const stack = [...roots];
  while (stack.length) {
    for (const next of adj.get(stack.pop()) ?? []) {
      if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
  }
  return seen;
}

function checkDuplicateNames(names, push) {
  for (const n of new Set(names.filter((n, i) => names.indexOf(n) !== i))) {
    push('error', `Duplicate element name "${n}"`);
  }
}

function checkHopReferences(m, names, push) {
  for (const h of m.hops) {
    for (const [role, n] of [['from', h.from], ['to', h.to]]) {
      if (!names.includes(n)) {
        push('error', `Hop ${role} references missing element "${n}" (${h.from} -> ${h.to})`);
      }
    }
  }
}

function checkJobStartEntry(m, push) {
  const starts = m.elements.filter(isStartEntry);
  if (starts.length !== 1) {
    push('error', `Job must have exactly one start entry, found ${starts.length}`);
  }
}

function checkJobEntryFilenames(m, push, dir, repositoryContext) {
  for (const e of m.elements.filter(e => e.type === 'TRANS' || e.type === 'JOB')) {
    const method = text(e.raw.specification_method);
    if (method === 'rep_name' || method === 'rep_ref') {
      // Repository references do not require physical filename tag
      continue;
    }
    const fn = text(e.raw.filename);
    if (!fn) {
      if (!repositoryContext) {
        push('warning', `${e.type} entry "${e.name}" has no filename (repository reference?)`);
      }
      continue;
    }
    const resolved = fn
      .replaceAll('${Internal.Job.Filename.Directory}', dir)
      .replaceAll('${Internal.Entry.Current.Directory}', dir);
    if (resolved.includes('${')) {
      push('info', `${e.type} entry "${e.name}" filename uses unresolved variables: ${fn}`);
    } else if (!existsSync(resolved)) {
      push('error', `${e.type} entry "${e.name}" references missing file: ${resolved}`);
    }
  }
}

function checkUndefinedConnections(m, push) {
  const defined = new Set(m.connections);
  for (const e of m.elements) {
    const conn = text(e.raw.connection);
    if (conn && !defined.has(conn)) {
      push('error', `Element "${e.name}" uses undefined connection "${conn}"`);
    }
  }
}

function checkStepReferences(m, names, push) {
  for (const e of m.elements) {
    for (const tag of STEP_REFERENCE_TAGS) {
      for (const raw of toArray(e.raw[tag])) {
        const ref = text(raw);
        if (ref && !names.includes(ref)) {
          push('warning', `Step reference <${tag}> in "${e.name}" names missing step "${ref}"`);
        }
      }
    }
  }
}

function checkTargetReferenceHops(m, push) {
  if (m.kind !== 'trans') return;
  const hopSet = new Set(m.hops.filter(isActiveHop).map(h => `${h.from}\u0000${h.to}`));
  const flag = (from, target, where) => {
    if (target && !hopSet.has(`${from}\u0000${target}`)) {
      push('warning', `Step "${from}" routes to "${target}" via ${where} but has no hop to it`);
    }
  };
  for (const e of m.elements) {
    for (const tag of STEP_TARGET_REFERENCE_TAGS) {
      for (const raw of toArray(e.raw[tag])) {
        flag(e.name, text(raw), `<${tag}>`);
      }
    }
    for (const c of toArray(e.raw.cases?.case)) {
      flag(e.name, text(c.target_step), '<cases><case><target_step>');
    }
  }
}

function checkErrorHandlingHops(m, push) {
  if (m.kind !== 'trans') return;
  const names = new Set(m.elements.map(e => e.name));
  const hopSet = new Set(m.hops.filter(isActiveHop).map(h => `${h.from}\u0000${h.to}`));
  for (const err of m.errorHops ?? []) {
    if (err.enabled !== 'Y') continue;
    if (!err.source || !err.target) continue;
    if (!names.has(err.source)) {
      push('error', `Error handling names missing source step "${err.source}"`);
    }
    if (!names.has(err.target)) {
      push('error', `Error handling on "${err.source}" targets missing step "${err.target}"`);
    } else if (!hopSet.has(`${err.source}\u0000${err.target}`)) {
      push('warning', `Error handling on "${err.source}" routes to "${err.target}" but has no hop to it`);
    }
  }
}

const STEP_WRAPPER_NODES = Object.freeze(['type', 'distribute', 'copies', 'partitioning', 'GUI']);

function checkStepWrapper(m, push) {
  if (m.kind !== 'trans') return;
  for (const e of m.elements) {
    for (const tag of STEP_WRAPPER_NODES) {
      if (e.raw[tag] === undefined) {
        push('warning', `Step "${e.name}" is missing the wrapper node <${tag}> that Spoon writes for every step`);
      }
    }
  }
}

function checkReachability(m, push) {
  const reachable = computeReachable(m);
  for (const e of m.elements) {
    if (!reachable.has(e.name)) {
      push('warning', `Element "${e.name}" is not reachable from the start of the graph`);
    }
  }
}

function checkUndeclaredVariables(m, xml, push) {
  const declared = new Set(m.params.map(p => p.name));
  const setVars = new Set();
  if (m.kind === 'job') {
    for (const e of m.elements.filter(e => e.type === 'SET_VARIABLES')) {
      for (const f of toArray(e.raw.fields?.field)) setVars.add(text(f.variable_name));
    }
  }
  const used = new Set([...xml.matchAll(/\$\{([A-Za-z0-9_.]+)\}/g)].map(x => x[1]));
  for (const v of used) {
    if (!v.startsWith('Internal.') && !declared.has(v) && !setVars.has(v)) {
      push('info', `Variable \${${v}} is not a declared parameter (may be set by caller or environment)`);
    }
  }
}

function checkRepositoryReferences(xml, filePath, repositoryContext, candidateFiles, push) {
  if (!repositoryContext || !repositoryContext.repositoryPaths) return;
  const ownerIdentity = repositoryContext.repositoryPaths.fromPhysical(filePath);
  const refs = extractReferences(xml, ownerIdentity);

  for (const ref of refs) {
    if (ref.status === 'MANAGED_REPO_REFERENCE' && ref.targetRepositoryPath) {
      let targetExists = false;
      try {
        const targetId = repositoryContext.repositoryPaths.resolveArtifact({
          repositoryPath: ref.targetRepositoryPath,
          artifactKind: ref.targetKind
        }, { write: false });

        if (candidateFiles && candidateFiles.has(targetId.physicalPath)) {
          targetExists = candidateFiles.get(targetId.physicalPath) !== null;
        } else {
          targetExists = existsSync(targetId.physicalPath);
        }
      } catch {
        targetExists = false;
      }

      if (!targetExists) {
        push('error', `${ref.ownerType} "${ref.elementName}" references missing repository target "${ref.targetRepositoryPath}"`);
      }
    } else if (ref.status === 'STREAMING_CALLER_UNSUPPORTED') {
      push('warning', `Element "${ref.elementName}" uses unsupported streaming caller type "${ref.ownerType}"`);
    }
  }
}

export function validateXml(xml, filePath, { dir, repositoryContext, candidateFiles } = {}) {
  const issues = [];
  const push = (severity, message) => issues.push({ severity, message });

  const wf = XMLValidator.validate(xml);
  if (wf !== true) {
    push('error', `Malformed XML: ${wf.err?.msg} (line ${wf.err?.line})`);
    return report(filePath, issues);
  }

  let m;
  try {
    m = parseModel(xml, filePath);
  } catch (err) {
    push('error', `Cannot parse: ${err.message}`);
    return report(filePath, issues);
  }

  const names = m.elements.map(e => e.name);
  checkDuplicateNames(names, push);
  checkHopReferences(m, names, push);

  if (m.kind === 'job') {
    checkJobStartEntry(m, push);
    checkJobEntryFilenames(m, push, dir, repositoryContext);
  }

  checkUndefinedConnections(m, push);
  checkStepReferences(m, names, push);
  checkTargetReferenceHops(m, push);
  checkErrorHandlingHops(m, push);
  checkStepWrapper(m, push);
  checkReachability(m, push);
  checkUndeclaredVariables(m, xml, push);
  checkRepositoryReferences(xml, filePath, repositoryContext, candidateFiles, push);

  return report(filePath, issues);
}

export function validateFile(filePath, { repositoryContext } = {}) {
  let xml;
  try {
    xml = readFileSync(filePath, 'utf8');
  } catch (err) {
    return report(filePath, [{ severity: 'error', message: `Cannot read file: ${err.message}` }]);
  }
  return validateXml(xml, filePath, { dir: path.dirname(filePath), repositoryContext });
}

export function validateAll(root, { repositoryContext } = {}) {
  const reports = walkKettleFiles(root).map(f => validateFile(f, { repositoryContext }));
  const summary = { files: reports.length, errors: 0, warnings: 0, info: 0 };
  for (const r of reports) {
    summary.errors += r.summary.errors;
    summary.warnings += r.summary.warnings;
    summary.info += r.summary.info;
  }
  return { summary, files: reports.filter(r => r.issues.length > 0) };
}

export function validateRepositoryReadiness(ctx, identity, { candidateFiles } = {}) {
  const scan = scanRepository(ctx);
  const closure = dependencyClosure(scan, identity);
  const ready = closure.issues.length === 0 && closure.complete;
  return {
    ready,
    issues: closure.issues,
    closure
  };
}
