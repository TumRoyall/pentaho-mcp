import {
  findAllSpans,
  findElementSpan,
  findDirectChildSpan,
  innerText,
  escapeXml,
  unescapeXml
} from '../core/span.js';

export const REFERENCE_ADAPTERS = Object.freeze([
  { ownerKind: 'job', type: 'JOB', targetKind: 'job', nameTag: 'jobname', directoryTag: 'directory', methodTag: 'specification_method', objectIdTag: 'job_object_id', filenameTag: 'filename' },
  { ownerKind: 'job', type: 'TRANS', targetKind: 'trans', nameTag: 'transname', directoryTag: 'directory', methodTag: 'specification_method', objectIdTag: 'trans_object_id', filenameTag: 'filename' },
  { ownerKind: 'trans', type: 'JobExecutor', targetKind: 'job', nameTag: 'job_name', directoryTag: 'directory_path', methodTag: 'specification_method', objectIdTag: 'job_object_id', filenameTag: 'filename' },
  { ownerKind: 'trans', type: 'TransExecutor', targetKind: 'trans', nameTag: 'trans_name', directoryTag: 'directory_path', methodTag: 'specification_method', objectIdTag: 'trans_object_id', filenameTag: 'filename' },
  { ownerKind: 'trans', type: 'Mapping', targetKind: 'trans', nameTag: 'trans_name', directoryTag: 'directory_path', methodTag: 'specification_method', objectIdTag: 'trans_object_id', filenameTag: 'filename' },
  { ownerKind: 'trans', type: 'SimpleMapping', targetKind: 'trans', nameTag: 'trans_name', directoryTag: 'directory_path', methodTag: 'specification_method', objectIdTag: 'trans_object_id', filenameTag: 'filename' },
  { ownerKind: 'trans', type: 'SingleThreader', targetKind: 'trans', nameTag: 'trans_name', directoryTag: 'directory_path', methodTag: 'specification_method', objectIdTag: 'trans_object_id', filenameTag: 'filename' },
  { ownerKind: 'trans', type: 'MetaInject', targetKind: 'trans', nameTag: 'trans_name', directoryTag: 'directory_path', methodTag: 'specification_method', objectIdTag: 'trans_object_id', filenameTag: 'filename' },
]);

export function findAdapter(ownerKind, type) {
  return REFERENCE_ADAPTERS.find(a => a.ownerKind === ownerKind && a.type === type) || null;
}

export function extractReferences(xml, ownerIdentity) {
  const ownerKind = ownerIdentity.artifactKind || (xml.includes('<job>') ? 'job' : 'trans');
  const containerTag = ownerKind === 'job' ? 'entry' : 'step';
  const spans = findAllSpans(xml, containerTag);
  const references = [];

  for (const span of spans) {
    const rawName = innerText(xml, span, 'name');
    const rawType = innerText(xml, span, 'type');
    if (!rawName || !rawType) continue;

    const elementName = unescapeXml(rawName);
    const adapter = findAdapter(ownerKind, rawType);

    if (!adapter) {
      // Check for streaming caller step types extending StepWithMappingMeta
      if (rawType.toLowerCase().includes('kafka') || rawType.toLowerCase().includes('mqtt') || rawType.toLowerCase().includes('stream')) {
        references.push({
          elementName,
          ownerType: rawType,
          targetKind: 'trans',
          method: null,
          targetRepositoryPath: null,
          status: 'STREAMING_CALLER_UNSUPPORTED'
        });
      }
      continue;
    }

    const method = innerText(xml, span, adapter.methodTag);
    const targetName = innerText(xml, span, adapter.nameTag);
    const targetDir = innerText(xml, span, adapter.directoryTag);
    const filename = innerText(xml, span, adapter.filenameTag);
    const objectId = innerText(xml, span, adapter.objectIdTag);

    let targetRepositoryPath = null;
    let status = 'UNRESOLVED_REFERENCE';

    if (method === 'rep_name' || (!method && (targetName || targetDir))) {
      if (targetName) {
        let dir = targetDir || '/';
        if (!dir.startsWith('/')) dir = '/' + dir;
        if (dir.length > 1 && dir.endsWith('/')) dir = dir.slice(0, -1);
        targetRepositoryPath = dir === '/' ? `/${targetName}` : `${dir}/${targetName}`;
        status = 'MANAGED_REPO_REFERENCE';
      }
    } else if (method === 'filename' || filename) {
      status = 'LEGACY_FILE_REFERENCE';
    } else if (method === 'rep_ref' || objectId) {
      status = 'REPOSITORY_REF_MODE';
    }

    references.push({
      elementName,
      ownerType: rawType,
      targetKind: adapter.targetKind,
      method,
      targetRepositoryPath,
      targetName,
      directory: targetDir,
      filename,
      objectId,
      status
    });
  }

  return references;
}

function updateDirectChild(xml, parentSpan, childTag, newValue) {
  const childSpan = findDirectChildSpan(xml, parentSpan, childTag);
  const escaped = escapeXml(newValue);

  if (childSpan) {
    if (newValue === '' || newValue == null) {
      const emptyTag = `<${childTag}/>`;
      return xml.slice(0, childSpan.start) + emptyTag + xml.slice(childSpan.end);
    }
    const fullTag = `<${childTag}>${escaped}</${childTag}>`;
    return xml.slice(0, childSpan.start) + fullTag + xml.slice(childSpan.end);
  }

  if (newValue === '' || newValue == null) {
    return xml; // tag absent and value empty -> no change
  }

  // Insert tag inside parent element before the closing tag
  const parentCloseTag = xml.lastIndexOf('</', parentSpan.end);
  const indentMatch = xml.slice(parentSpan.start, parentSpan.end).match(/\r?\n(\s*)</);
  const indent = indentMatch ? indentMatch[1] : '    ';
  const tagToInsert = `${indent}<${childTag}>${escaped}</${childTag}>\n`;
  return xml.slice(0, parentCloseTag) + tagToInsert + xml.slice(parentCloseTag);
}

export function rewriteReference(xml, { ownerKind, elementName, target }) {
  const containerTag = ownerKind === 'job' ? 'entry' : 'step';
  const span = findElementSpan(xml, containerTag, elementName);
  if (!span) {
    throw new Error(`No ${containerTag} named "${elementName}" found in artifact`);
  }

  const rawType = innerText(xml, span, 'type');
  const adapter = findAdapter(ownerKind, rawType);
  if (!adapter) {
    throw new Error(`Element "${elementName}" of type "${rawType}" is not a supported reference caller`);
  }

  let updated = xml;

  // 1. Update specification_method to rep_name
  updated = updateDirectChild(updated, span, adapter.methodTag, 'rep_name');

  // Re-find span after edit
  const span1 = findElementSpan(updated, containerTag, elementName);

  // 2. Update target name tag
  updated = updateDirectChild(updated, span1, adapter.nameTag, target.name);

  // Re-find span
  const span2 = findElementSpan(updated, containerTag, elementName);

  // 3. Update target directory tag
  updated = updateDirectChild(updated, span2, adapter.directoryTag, target.directory);

  // Re-find span
  const span3 = findElementSpan(updated, containerTag, elementName);

  // 4. Empty filename tag if present
  updated = updateDirectChild(updated, span3, adapter.filenameTag, '');

  // Re-find span
  const span4 = findElementSpan(updated, containerTag, elementName);

  // 5. Empty objectId tag if present
  updated = updateDirectChild(updated, span4, adapter.objectIdTag, '');

  return updated;
}
