#!/usr/bin/env node
/*
 * Print one game as text: node tools/transcript.js <scenario file> [--preset A] [--noise 0.3] [--seed 1]
 * The game is played by the scenario's sim.policy. Raise --noise for a messier player.
 * Reading a few of these is the fastest way to find lines that don't follow on.
 */
const path = require('path');
const I = require(path.resolve(__dirname, '../src/interrogation.js'));

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
if (!args[0] || args[0].startsWith('--')) { console.error('usage: node tools/transcript.js <scenario file> [--preset A] [--noise 0.3] [--seed 1]'); process.exit(2); }

const S = require(path.resolve(args[0]));
const sim = S.sim || {};
const rng = I.rngOf(+opt('seed', 1));
const s = I.create(S, { preset: opt('preset', Object.keys(S.presets)[0]), evidence: sim.evidence, rng });
const who = (w) => (w === 'player' ? S.actors.player.name : w === 'ally' ? S.actors.ally?.name : S.actors.suspect.name);

const out = [];
const print = (events) => {
  for (const e of events) {
    if (e.t === 'line') out.push(`${who(e.who)}: ${e.text}`);
    else if (e.t === 'narr') out.push(e.text);
    else if (e.t === 'note') out.push(`  (${e.text})`);
    else if (e.t === 'gain') out.push(`  ✎ ${e.label}`);
    else if (e.t === 'present') out.push(`  [shows: ${e.label}]`);
    else if (e.t === 'reveal') out.push(`  ● piece ${e.index + 1}: ${e.label}`);
    else if (e.t === 'end') out.push(`=== end: ${e.outcome} (${e.why})`);
  }
};
if (S.ui?.intro) out.push(S.ui.intro);
print(s.events);
for (let g = 0; !s.over && g < 80; g++) {
  const o = I.policyPick(s, sim.policy, rng, +opt('noise', 0.3));
  if (!o) break;
  print(I.choose(s, o));
}
console.log(out.join('\n'));
