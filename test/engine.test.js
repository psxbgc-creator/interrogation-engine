// Unit tests for the engine. Run: npm test  (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../src/interrogation.js');

/* A tiny scenario that exercises one feature per node. */
function makeScenario(overrides = {}) {
  return {
    id: 'unit',
    actors: { player: { id: 'p', name: 'P' }, suspect: { id: 's', name: 'S' }, ally: { id: 'a', name: 'A' } },
    zoneMeter: 'heat',
    meters: {
      heat: { min: 0, max: 100, start: 10, zones: [{ id: 'cool', to: 49, mood: 'calm' }, { id: 'hot', to: 100, mood: 'mad' }] },
      trust: { min: 0, max: 100, start: 0, full: 50, visible: true },
    },
    limits: { turns: 30, warn: 2 },
    presets: { A: { start: { heat: 10 } }, B: { start: { heat: 60 }, turns: 5 } },
    nodeStances: ['agree', 'press'],
    stances: {
      agree: { label: 'Agree', needs: ['say', 'reply'], rules: [{ do: { trust: '+30' }, line: 'reply', move: 'same' }] },
      press: { label: 'Press', needs: ['say', 'reply'], rules: [{ do: { heat: '+(opt.v||10)' }, line: 'reply', move: 'same' }] },
    },
    evidenceReusable: false,
    evidenceAlias: { doc: ['doc_p1', 'doc_p2'] },
    evidence: {
      doc_p1: { label: 'Doc page 1' },
      doc_p2: { label: 'Doc page 2' },
      junk: { label: 'Junk' },
      w_said: { kind: 'said', label: 'His words' },
    },
    evidenceRules: { rules: [
      { when: 'claimMatch', line: 'claim.hit', reveal: 'claim', move: 'claim' },
      { line: '@wrong', end: 'fail' },
    ] },
    ally: { uses: [
      { when: "topic=='intro'", prompt: 'Signal', say: 'Ally speaks', rules: [{ do: { heat: '+5' }, move: 'topic:lies' }] },
      { when: 'allyUses==1', prompt: 'Signal 2', say: 'Ally again', rules: [{ move: 'node:end' }] },
    ] },
    after: [{ when: "zone=='hot' && stance=='press'", warn: 1, line: '@hot' }],
    revelations: [
      { id: 'r1', label: 'one', line: 'I admit one.' },
      { id: 'r2', label: 'two', line: 'I admit two.' },
    ],
    outcomes: [{ id: 'full', when: 'revealed>=2' }, { id: 'partial', when: 'revealed>=1' }, { id: 'fail', when: true }],
    lines: { wrong: [{ when: true, text: 'Wrong!' }], hot: ['Calm down!'] },
    topics: [
      { id: 'intro', nodes: [
        { id: 'i1', line: 'Hello.',
          agree: { say: 'Nice.', reply: 'I said a thing.', gain: 'w_said' },
          press: { say: 'Hm?', reply: 'What?', v: 60 } },
      ] },
      { id: 'lies', nodes: [
        { id: 'l1', gate: true, line: 'Lie one.',
          claim: { ev: ['doc_p1', 'w_said'], reveal: 'r1', move: 'same', hit: { text: 'Caught.' }, hitBy: { w_said: { text: 'My own words!' } } },
          agree: { say: 'Sure.', reply: 'Yes.', move: 'stay' },
          press: { say: 'Really?', reply: 'Really.', move: 'stay' } },
        { id: 'l2', line: 'Lie two.',
          claim: { ev: 'doc_p2', reveal: 'r2', move: 'same', hit: { text: 'Caught again.' } },
          agree: { say: 'Ok.', reply: 'Ok.' },
          press: { say: 'No.', reply: 'No.' } },
      ] },
      { id: 'locked', requires: 'allyUses>=2', blocked: { text: 'Bye.' }, nodes: [
        { id: 'end', line: 'The end.', agree: { say: 'a', reply: 'b' }, press: { say: 'c', reply: 'd' } },
      ] },
    ],
    ...overrides,
  };
}
const pick = (s, pred) => I.options(s).find(pred);
const talk = (s, stance) => I.choose(s, pick(s, (o) => o.stance === stance));
const show = (s, ev) => I.choose(s, pick(s, (o) => o.ev === ev));
const lines = (events) => events.filter((e) => e.t === 'line').map((e) => e.text);

test('expressions: precedence, ternary, functions, unicode names', () => {
  const s = I.create(makeScenario(), { preset: 'A', vars: { 점수: 3 } });
  assert.equal(I.value(s, '1+2*3'), 7);
  assert.equal(I.value(s, '(1+2)*3'), 9);
  assert.equal(I.value(s, 'heat>5 ? 1 : 2'), 1);
  assert.equal(I.value(s, 'max(1, min(9, 4))'), 4);
  assert.equal(I.value(s, '!false && 2>=2'), true);
  assert.equal(I.value(s, '점수+1'), 4);
  assert.equal(I.value(s, 'full_trust'), 50);
  assert.throws(() => I.parse('1 +'), /ends too early/);
  assert.throws(() => I.parse('foo(1)'), /Unknown function/);
  assert.throws(() => I.value(s, 'nope'), /Unknown name/);
});

test('create: presets, meter clamping, first line', () => {
  const s = I.create(makeScenario(), { preset: 'B', start: { heat: 100 } });
  assert.equal(s.m.heat, 100); // 60 + 100, clamped
  assert.equal(s.max, 5);
  assert.deepEqual(lines(s.events), ['Hello.']);
  assert.equal(I.zoneOf(s.scn, s.m.heat).id, 'hot');
});

test('evidence aliases expand into separate cards', () => {
  const s = I.create(makeScenario(), { evidence: ['doc', 'junk'] });
  assert.deepEqual(s.evidence, ['doc_p1', 'doc_p2', 'junk']);
});

test('a picked line is used up; gain only when the reply is actually said', () => {
  const scn = makeScenario();
  const s = I.create(scn, { evidence: ['doc'] });
  const ev = talk(s, 'agree');
  assert.ok(ev.some((e) => e.t === 'gain' && e.ev === 'w_said'));
  assert.ok(s.evidence.includes('w_said'));
  // the node moved on, so agree at the next node is a different option id
  assert.notEqual(s.node + ':' + s.topic, '0:0');
});

test('wrong evidence ends the conversation; gated lie holds until rebutted', () => {
  const scn = makeScenario();
  const s = I.create(scn, { evidence: ['doc', 'junk'] });
  I.choose(s, 'ally');                       // to the lies topic
  assert.equal(I.nodeOf(s).id, 'l1');
  talk(s, 'agree');
  talk(s, 'press');                          // every talk option used, but the gate holds
  assert.equal(I.nodeOf(s).id, 'l1');
  assert.equal(I.options(s).filter((o) => o.group === 'talk' && o.stance !== 'ally').length, 0);
  const ev = show(s, 'junk');
  assert.deepEqual(lines(ev), ['Wrong!']);
  assert.equal(s.over, 'fail');
});

test('rebutting with the right card reveals and moves on; each card works once', () => {
  const s = I.create(makeScenario(), { evidence: ['doc'] });
  I.choose(s, 'ally');
  const ev = show(s, 'doc_p1');
  assert.deepEqual(lines(ev).slice(0, 2), ['Caught.', 'I admit one.']);
  assert.ok(s.revealed.has('r1'));
  assert.equal(I.nodeOf(s).id, 'l2');
  assert.equal(pick(s, (o) => o.ev === 'doc_p1'), undefined); // already shown
});

test('their own words rebut too, with their own hit line', () => {
  const s = I.create(makeScenario(), { evidence: ['doc'] });
  talk(s, 'agree'); // gains w_said and moves to the next topic... which is locked behind the ally
  // gained words are listed even though the conversation may have ended
  assert.ok(s.evidence.includes('w_said'));
  const t = I.create(makeScenario(), { evidence: ['doc'] });
  t.evidence.push('w_said');
  I.choose(t, 'ally');
  const ev = show(t, 'w_said');
  assert.equal(lines(ev)[0], 'My own words!');
});

test('locked topic ends the conversation as blocked', () => {
  const s = I.create(makeScenario(), { evidence: ['doc'] });
  I.choose(s, 'ally');
  show(s, 'doc_p1');
  const ev = show(s, 'doc_p2'); // all revelations → ends as full anyway
  assert.equal(s.over, 'full');
  assert.equal(ev.at(-1).why, 'all');

  const t = I.create(makeScenario({ revelations: [...makeScenario().revelations, { id: 'r3', label: 'x', line: 'x' }],
    topics: makeScenario().topics.map((tp) => tp.id === 'locked' ? { ...tp, nodes: [{ ...tp.nodes[0], agree: { say: 'a', reply: 'b', rules: [{ reveal: 'r3' }] } }] } : tp) }), { evidence: ['doc'] });
  I.choose(t, 'ally');
  show(t, 'doc_p1');
  const ev2 = show(t, 'doc_p2');
  assert.equal(t.over, 'full');
  assert.equal(ev2.at(-1).why, 'blocked');
  assert.ok(lines(ev2).includes('Bye.'));
});

test('after rules: warnings add up and end the game at the limit', () => {
  const s = I.create(makeScenario(), { preset: 'B' }); // already hot
  talk(s, 'press');
  assert.equal(s.warn, 1);
  assert.equal(s.over, null);
});

test('save and load round-trip, with version and scenario checks', () => {
  const scn = makeScenario();
  const s = I.create(scn, { evidence: ['doc'] });
  I.choose(s, 'ally');
  const saved = JSON.parse(JSON.stringify(I.serialize(s)));
  assert.equal(saved.v, 2);
  const r = I.restore(scn, saved);
  assert.deepEqual(JSON.parse(JSON.stringify(I.serialize(r))), saved);
  assert.equal(I.nodeOf(r).id, 'l1');
  assert.throws(() => I.restore(scn, { ...saved, v: 99 }), /Unsupported save version/);
  assert.throws(() => I.restore({ ...scn, id: 'other' }, saved), /is for scenario/);
});

test('validate finds authoring mistakes', () => {
  const bad = makeScenario({
    nodeStances: ['agree', 'press', 'shrug'],
    outcomes: [{ id: 'x', when: 'revealed >' }],
  });
  bad.topics[0].nodes[0].agree = { say: 'no reply' };
  const errors = I.validate(bad);
  assert.ok(errors.some((e) => e.includes('no definition for stance shrug')));
  assert.ok(errors.some((e) => e.includes('missing reply')));
  assert.ok(errors.some((e) => e.startsWith('outcome x')));
  assert.deepEqual(I.validate(makeScenario()), []);
});

test('simulate is deterministic for a seed', () => {
  const scn = makeScenario({ sim: { policy: [{ when: "claim!=''", pick: ['evidence:claim'] }, { when: true, pick: ['ally', 'agree'] }] } });
  const a = I.simulate(scn, { evidence: ['doc'], n: 50, noise: 0.3, seed: 9 });
  const b = I.simulate(scn, { evidence: ['doc'], n: 50, noise: 0.3, seed: 9 });
  assert.deepEqual(a, b);
  assert.equal(Object.values(a.count).reduce((x, y) => x + y, 0), 50);
});
