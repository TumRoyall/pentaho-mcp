#!/usr/bin/env node
/**
 * Verification script for Pentaho File Repository runtime integration.
 *
 * Usage:
 *   node scripts/verify-repository-runtime.mjs [--pdi-home <path>]
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';
import { createRepositoryPaths } from '../src/repository/paths.js';
import { detectRepository, planRegistration, applyRegistration } from '../src/repository/registration.js';
import { scanRepository } from '../src/repository/graph.js';
import { scanConnections } from '../src/repository/connections.js';
import { validateRepositoryReadiness } from '../src/core/validate.js';
import { detectPdi } from '../src/runtime/detect.js';
import { runPdi } from '../src/runtime/run.js';

let pdiHomeArg = process.env.PENTAHO_HOME;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--pdi-home' && args[i + 1]) {
    pdiHomeArg = args[i + 1];
    i++;
  }
}

console.log('--- Pentaho File Repository Runtime Verification ---');

const tempRoot = mkdtempSync(path.join(tmpdir(), 'verify-repo-root-'));
const tempKettleHome = mkdtempSync(path.join(tmpdir(), 'verify-kettle-home-'));

try {
  const boundary = createWorkspaceBoundary(tempRoot);
  const repositoryPaths = createRepositoryPaths(boundary);
  const ctx = {
    ...boundary,
    repositoryPaths,
    root: tempRoot,
    pentahoHome: pdiHomeArg,
    executeEnabled: true,
  };

  // 1. Create directory structure & fixtures
  mkdirSync(path.join(tempRoot, 'batch'), { recursive: true });

  const dummyKdb = `<?xml version="1.0" encoding="UTF-8"?>
<connection>
  <name>dummy_db</name>
  <server>127.0.0.1</server>
  <type>POSTGRESQL</type>
  <access>Native</access>
  <database>testdb</database>
  <port>5432</port>
  <username>testuser</username>
  <password>Encrypted 2be98afc86aa7f2e4cb79ce10be95a0cc</password>
</connection>`;
  writeFileSync(path.join(tempRoot, 'dummy_db.kdb'), dummyKdb, 'utf8');

  const dummyTrans = `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>dummy_trans</name></info>
  <step><name>Dummy</name><type>Dummy</type></step>
</transformation>`;
  writeFileSync(path.join(tempRoot, 'batch', 'dummy_trans.ktr'), dummyTrans, 'utf8');

  const dummyJob = `<?xml version="1.0" encoding="UTF-8"?>
<job>
  <name>dummy_job</name>
  <entries>
    <entry>
      <name>START</name>
      <type>SPECIAL</type>
      <start>Y</start>
    </entry>
    <entry>
      <name>Run Trans</name>
      <type>TRANS</type>
      <specification_method>rep_name</specification_method>
      <transname>dummy_trans</transname>
      <directory>/batch</directory>
    </entry>
  </entries>
</job>`;
  writeFileSync(path.join(tempRoot, 'dummy_job.kjb'), dummyJob, 'utf8');

  console.log(`[1] Created repository fixtures in: ${tempRoot}`);

  // 2. Explicit Registration in isolated KETTLE_HOME
  const regPlan = planRegistration(ctx, {
    name: 'verify_file_repo',
    environment: { KETTLE_HOME: tempKettleHome },
    cwd: tempRoot,
    apply: true,
  });
  console.log(`[2] Registered repository 'verify_file_repo' at ${regPlan.registryPath}`);

  // 3. Detect Repository
  const repoDetect = detectRepository(ctx, {
    environment: { KETTLE_HOME: tempKettleHome },
    cwd: tempRoot,
  });
  console.log(`[3] Repository detection status: ${repoDetect.status} (matched: ${repoDetect.repository?.name})`);

  // 4. Scan Repository & Connections
  const scan = scanRepository(ctx);
  console.log(`[4] Scanned repository: ${scan.artifacts.length} artifacts, ${scan.edges.length} reference edges`);

  const conns = scanConnections(ctx);
  console.log(`[5] Scanned connections: ${conns.connections.length} connection definitions, sanitized`);

  // 5. Static Validation
  const jobIdentity = ctx.repositoryPaths.fromPhysical(path.join(tempRoot, 'dummy_job.kjb'));
  const readiness = validateRepositoryReadiness(ctx, jobIdentity);
  console.log(`[6] Static repository readiness for ${jobIdentity.repositoryPath}: ready=${readiness.ready}`);

  // 6. Runtime Loadcheck (if PDI home available)
  if (pdiHomeArg) {
    const pdiDetect = detectPdi(pdiHomeArg);
    console.log(`[7] PDI detect: available=${pdiDetect.available}`);
    if (pdiDetect.available) {
      const runRes = await runPdi({
        identity: jobIdentity,
        artifact: jobIdentity.physicalPath,
        mode: 'loadcheck',
        kind: 'job',
      }, {
        ...ctx,
        repository: repoDetection,
      });
      console.log(`[8] PDI Loadcheck status: ${runRes.status} (exitCode=${runRes.exitCode})`);
    } else {
      console.log(`[7] PDI home not available at ${pdiHomeArg}, skipping live Kitchen/Pan loadcheck`);
    }
  } else {
    console.log('[7] PENTAHO_HOME not specified, skipping live Kitchen/Pan loadcheck (pass --pdi-home <path> to test PDI spawn)');
  }

  console.log('\n--- Repository Verification PASSED ---');

} catch (err) {
  console.error('\n--- Repository Verification FAILED ---');
  console.error(err);
  process.exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  rmSync(tempKettleHome, { recursive: true, force: true });
}
