#!/usr/bin/env node
/*
 * Check scenarios: node tools/check.js [scenario files...] [--n 2000]
 *
 *   1. validate()          authoring mistakes (missing lines, unknown names, bad expressions)
 *   2. sim.targets         outcome rates per preset for a first-time player (sim.policy + sim.noise)
 *   3. sim.checks          counter-examples ("agreeing with everything never wins", ...)
 *   4. continuity          no line is said twice in one game, every revelation can happen,
 *                          and saving then loading gives back the same state
 *
 * With no files, every .js file under scenarios/ is checked. Exits 1 on any problem.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const I = require(path.join(ROOT, 'src/interrogation.js'));

const args = process.argv.slice(2);
const nAt = args.indexOf('--n');
const N = nAt >= 0 ? +args.splice(nAt, 2)[1] : 2000;

function listScenarios(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? listScenarios(p) : d.name.endsWith('.js') ? [p] : [];
  });
}
const files = args.length ? args.map((f) => path.resolve(f)) : listScenarios(path.join(ROOT, 'scenarios'));

const pct = (r) => Object.entries(r.pct).map(([k, x]) => `${k} ${x.toFixed(1)}%`).join(' · ');
const problems = [];

for (const file of files) {
  const S = require(file);
  const sim = S.sim || {};
  console.log(`■ ${S.id} (${path.relative(ROOT, file)})`);

  const errors = I.validate(S);
  if (errors.length) { problems.push(...errors.map((e) => `${S.id}: ${e}`)); continue; }

  const cases = (i) => (sim.cases ? sim.cases(i) : {});
  const policyOf = (p) => (typeof p === 'string' ? [...sim.policies[p], ...sim.policy] : p);
  const base = { noise: sim.noise ?? 0.2, evidence: sim.evidence, start: (i) => cases(i).start, vars: (i) => cases(i).vars };

  for (const p of Object.keys(S.presets)) {
    const r = I.simulate(S, { ...base, preset: p, n: N, seed: 3 });
    console.log(`  ${p} ${S.presets[p].label || ''}: ${pct(r)} · ${r.avgTurns.toFixed(1)} turns on average`);
    for (const [k, [lo, hi]] of Object.entries(sim.targets?.[p] || {})) {
      if (r.pct[k] < lo || r.pct[k] > hi) problems.push(`${S.id} ${p}: ${k} ${r.pct[k].toFixed(1)}% (target ${lo}–${hi})`);
    }
  }

  for (const c of sim.checks || []) {
    const r = I.simulate(S, { ...base, preset: c.preset, n: 400, noise: c.noise ?? base.noise, policy: policyOf(c.policy), evidence: c.evidence || sim.evidence, seed: 5 });
    const failed = [...Object.entries(c.max || {}).filter(([k, m]) => r.pct[k] > m), ...Object.entries(c.min || {}).filter(([k, m]) => r.pct[k] < m)];
    console.log(`  check: ${c.name} — ${pct(r)}${failed.length ? '  ✗' : '  ✓'}`);
    if (failed.length) problems.push(`${S.id} check failed: ${c.name}`);
  }

  const reached = new Set();
  const keys = Object.keys(S.presets);
  for (let i = 0; i < 300; i++) {
    const rng = I.rngOf(i + 11);
    const s = I.create(S, { preset: keys[i % keys.length], evidence: sim.evidence, vars: cases(i).vars, start: cases(i).start, rng });
    const said = new Set();
    const heard = new Set();
    for (let g = 0; !s.over && g < 200; g++) {
      const o = I.policyPick(s, sim.policy, rng, 0.35);
      if (!o) break;
      if (o.stance !== 'evidence' && o.stance !== 'ally' && o.stance !== 'silence') {
        if (said.has(o.text)) { problems.push(`${S.id}: player line repeated — ${o.text}`); break; }
        said.add(o.text);
      }
      if (g === 6) {
        const saved = JSON.stringify(I.serialize(s));
        if (JSON.stringify(I.serialize(I.restore(S, JSON.parse(saved), rng))) !== saved) problems.push(`${S.id}: save/load mismatch`);
      }
      for (const e of I.choose(s, o)) {
        if (e.t === 'line' && e.who === 'suspect') {
          if (heard.has(e.text)) problems.push(`${S.id}: suspect says the same line twice — ${e.text.slice(0, 50)}`);
          heard.add(e.text);
        }
      }
    }
    for (const id of s.revealed) reached.add(id);
  }
  for (const r of S.revelations) if (!reached.has(r.id)) problems.push(`${S.id}: revelation never happened in 300 games — ${r.id}`);
}

const unique = [...new Set(problems)];
if (unique.length) {
  console.log(`\n${unique.length} problem(s):`);
  for (const p of unique.slice(0, 20)) console.log('  - ' + p);
  process.exit(1);
}
console.log('\nAll good.');
