// Every bundled scenario must validate and finish games without throwing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const I = require('../src/interrogation.js');

const dir = path.join(__dirname, '..', 'scenarios');
const files = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));

for (const file of files) {
  const S = require(file);
  test(`scenario ${S.id} validates and plays`, () => {
    assert.deepEqual(I.validate(S), []);
    const r = I.simulate(S, { preset: Object.keys(S.presets)[0], evidence: S.sim.evidence, n: 100, noise: 0.5 });
    assert.equal(Object.values(r.count).reduce((a, b) => a + b, 0), 100);
  });
}
