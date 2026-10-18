import {test} from 'node:test';
import assert from 'node:assert/strict';

test('deployment exposes only the Worker handler', async () => {
  const deployed = await import('../deploy.js');
  assert.deepEqual(Object.keys(deployed), ['default']);
  assert.equal(typeof deployed.default.fetch, 'function');
  assert.equal(typeof deployed.default.scheduled, 'function');
});
