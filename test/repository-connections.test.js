import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';
import { createRepositoryPaths } from '../src/repository/paths.js';
import { scanConnections, getSanitizedConnection, putConnection, deleteConnection } from '../src/repository/connections.js';

test('scanConnections sanitizes secrets and tracks connection usages', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-conn-test-'));
  try {
    const boundary = createWorkspaceBoundary(root);
    const repositoryPaths = createRepositoryPaths(boundary);
    const ctx = { ...boundary, repositoryPaths, root };

    // 1. Create a root .kdb file containing a synthetic password
    const kdbXml = `<?xml version="1.0" encoding="UTF-8"?>
<connection>
  <name>warehouse</name>
  <server>db.example.com</server>
  <type>POSTGRESQL</type>
  <access>Native</access>
  <database>analytics</database>
  <port>5432</port>
  <username>db_user</username>
  <password>SYNTHETIC_SECRET_123</password>
</connection>`;
    writeFileSync(path.join(root, 'warehouse.kdb'), kdbXml, 'utf8');

    // 2. Create a job using connection "warehouse"
    const jobXml = `<?xml version="1.0" encoding="UTF-8"?>
<job>
  <name>job_dw</name>
  <connection>
    <name>warehouse</name>
    <server>db.example.com</server>
    <type>POSTGRESQL</type>
    <access>Native</access>
    <database>analytics</database>
    <port>5432</port>
    <username>db_user</username>
  </connection>
</job>`;
    writeFileSync(path.join(root, 'job_dw.kjb'), jobXml, 'utf8');

    // 3. Scan connections
    const report = scanConnections(ctx);
    assert.equal(report.connections.length, 1);
    assert.equal(report.connections[0].name, 'warehouse');
    assert.equal(report.connections[0].passwordStatus, 'present');

    // CRITICAL SECURITY ASSERTION: Secret must never appear in report output
    const jsonStr = JSON.stringify(report);
    assert.equal(jsonStr.includes('SYNTHETIC_SECRET_123'), false, 'Secret password found in scan report output!');

    // 4. Get connection detail
    const connDetail = getSanitizedConnection(ctx, 'warehouse');
    assert.equal(connDetail.name, 'warehouse');
    assert.equal(connDetail.definition.database, 'analytics');
    assert.equal(JSON.stringify(connDetail).includes('SYNTHETIC_SECRET_123'), false);

    // 5. Update connection with variable password
    const updated = putConnection(ctx, {
      name: 'warehouse',
      definition: {
        server: 'db.example.com',
        database: 'analytics_v2',
        password: '${DB_PASSWORD}'
      },
      expectedHash: connDetail.hash
    });
    assert.equal(updated.name, 'warehouse');

    // 6. Delete connection should fail when consumers exist
    assert.throws(
      () => deleteConnection(ctx, { name: 'warehouse', expectedHash: updated.hash }),
      /consumer|referenced|usage/i
    );

  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
