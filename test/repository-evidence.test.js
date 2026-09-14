import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('required executable adapters have versioned evidence', () => {
  const e = JSON.parse(readFileSync(new URL('./fixtures/file-repository/evidence.json', import.meta.url), 'utf8'));
  assert.match(e.pdiVersion, /^9\.4/);
  assert.ok(e.sourceRevision);
  const requiredTypes = ['TRANS', 'JOB', 'JobExecutor', 'TransExecutor', 'Mapping', 'SimpleMapping', 'SingleThreader', 'MetaInject'];
  for (const type of requiredTypes) {
    const a = e.adapters.find(x => x.type === type);
    assert.ok(a?.source && a?.fixture, type);
    const fixtureUrl = new URL(`./fixtures/file-repository/${a.fixture}`, import.meta.url);
    assert.ok(existsSync(fixtureUrl), `Fixture file missing for ${type}: ${a.fixture}`);
  }
});
