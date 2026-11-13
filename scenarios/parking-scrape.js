/*
 * Example scenario: "The Scrape" — the smallest useful scenario.
 *
 * Underground parking. Your car door has a long scrape down it. The neighbour from the
 * next space, Mr. Oh, is waiting for the elevator.
 *
 * What makes this one different from office-envelope.js:
 *   - no ally
 *   - only three stances (agree, press, silence)
 *   - different meters: "heat" with three zones, and "patience" instead of rapport
 *   - three revelations
 *
 * Flow: get him chatting and note down when he got home → break two lies with the dashcam
 * still (or his own words) and the paint mark → stay silent while he is on edge.
 */
(function (root) {
  const I = root.Interrogation || (typeof require !== 'undefined' ? require('../src/interrogation.js') : null);

  const SCENARIO = {
    id: 'parking-scrape',
    title: 'Parking Level 2',
    lang: 'en',
    actors: {
      player: { id: 'me', name: 'You' },
      suspect: { id: 'oh', name: 'Mr. Oh' },
    },

    zoneMeter: 'heat',
    meters: {
      heat: {
        label: 'Heat', min: 0, max: 100, start: 25,
        zones: [
          { id: 'calm', to: 39, label: 'calm', color: '#4f86c6', habit: 'Twirls his car key on one finger.' },
          { id: 'edgy', to: 69, label: 'edgy', color: '#e07b2e', mood: 'angry', habit: 'Jabs the elevator button again and again.' },
          { id: 'hot', to: 100, label: 'about to blow', color: '#d0453c', mood: 'angry', habit: 'His voice gets louder.' },
        ],
      },
      patience: { label: 'Patience', min: 0, max: 100, start: 60, full: 100, visible: true },
    },
    limits: { turns: 12, warn: 3 },
    presets: {
      A: { label: 'Chat as a neighbour', start: { heat: 20, patience: 70 }, turns: 13 },
      B: { label: 'Confront him at once', start: { heat: 58, patience: 25 }, turns: 9 },
    },

    nodeStances: ['agree', 'press', 'silence'],
    stances: {
      agree: { label: 'Agree', needs: ['say', 'reply'], rules: [{ do: { patience: '+10', heat: '-3' }, line: 'reply', move: 'same' }] },
      press: { label: 'Press', needs: ['say', 'reply'], rules: [{ do: { heat: '+(opt.v||15)', patience: '-15' }, line: 'reply', move: 'same' }] },
      silence: {
        label: 'Silence', needs: ['reply'], say: '(Just look at him)', narr: '— You look at Mr. Oh and say nothing.',
        rules: [
          { when: "lastStance=='silence'", do: { heat: '-2', patience: '-10' }, line: '@silenceTwice', lose: 1, move: 'stay' },
          { do: { heat: '-5' }, line: 'reply', move: 'stay' },
        ],
      },
    },

    evidenceReusable: false,
    evidence: {
      dashcam: { label: 'Dashcam still', desc: '11:12 p.m. — a white SUV reversing into your door' },
      paint: { label: 'White paint mark', desc: 'White paint in the scrape. Your car is navy.' },
      flyer: { label: 'Building notice', desc: '"Garage lighting work this week." Handed out by the elevator.' },
      s_late: { kind: 'said', label: '"I got home after 11 last night"', desc: '"Work dinner again last night. Got home after eleven. I\'m dead tired."' },
    },
    evidenceRules: {
      rules: [
        { when: 'claimMatch', do: { heat: '+6' }, line: 'claim.hit', reveal: 'claim', move: 'claim' },
        { line: '@wrongEvidence', end: 'fail' },
      ],
    },

    after: [
      { when: 'patience<=0', line: '@walkout', end: 'fail' },
      { when: "zone=='hot' && revealed<total && stance!='evidence'", do: { heat: '=60' }, warn: 1, line: '@hot' },
    ],

    revelations: [
      { id: 'there', label: 'He parked at that time', line: "…Fine, I came in around eleven. Doesn't mean I scraped anything." },
      { id: 'touched', label: 'His car touched yours', line: '…Maybe it touched. Barely. Not enough to scrape like that.' },
      { id: 'admit', label: 'He admitted the scrape', line: "…Okay, okay. It was me. I was going to tell you this morning. I'll call my insurance." },
    ],
    outcomes: [
      { id: 'full', when: 'revealed>=3' },
      { id: 'partial', when: 'revealed>=1' },
      { id: 'fail', when: true },
    ],

    lines: {
      hot: [{ text: '(Louder.) Are you calling me a liar?', note: 'Too hard.' }, '…Watch it.'],
      silenceTwice: ["…If you've got nothing to say, I'm going up."],
      wrongEvidence: [
        { when: "evKind=='said'", text: "…What does it matter when I got home? I'm going up.", note: 'Wrong moment.' },
        { when: true, text: "…What's this? I'm busy.", note: 'Wrong moment. Mr. Oh steps into the elevator.' },
      ],
      walkout: [{ when: true, text: 'Enough. Talk to the building office if you have a problem.', note: "Mr. Oh's patience ran out." }],
      cornerBreak: [{ when: true, narr: '— The elevator arrives and the doors close again. Mr. Oh does not get in.', text: '…Oh, for crying out loud.' }],
      cornerRecover: [{ when: true, narr: '— The elevator doors open.', text: "…I'm going up. If you have proof, go through the insurance." }],
    },

    ui: {
      intro: '— Parking level 2, by the elevator. Mr. Oh is twirling his car key.',
      end: {
        full: 'Mr. Oh admitted it.',
        partial: 'He admitted {n} things.',
        partial_corner: 'Mr. Oh got in the elevator. He admitted {n} things.',
        fail_fail: 'The conversation broke off.',
        fail: 'Mr. Oh went upstairs.',
      },
    },

    sim: {
      noise: 0.5,
      evidence: ['dashcam', 'paint', 'flyer'],
      targets: { A: { full: [45, 90] }, B: { full: [50, 95] } },
      policy: [
        { pre: true, chance: 0.75, when: "claim!=''", pick: ['evidence:claim'] },
        { pre: true, chance: 0.6, when: "nodeId=='corner' && zone!='calm'", pick: ['silence'] },
        { when: "claim!=''", pick: ['evidence:claim'] },
        { when: "nodeId=='corner' && zone!='calm'", pick: ['silence'] },
        { when: "nodeId=='corner'", pick: ['press', 'silence'] },
        { when: 'patience<30', pick: ['agree', 'silence'] },
        { when: true, pick: ['agree', 'press', 'silence'] },
      ],
      checks: [
        { name: 'Pressing only never gets an admission', preset: 'A', policy: [{ when: true, pick: ['press'] }], noise: 0, max: { full: 0 } },
        { name: 'No full admission without the paint mark', preset: 'A', evidence: ['dashcam', 'flyer'], max: { full: 0 } },
      ],
    },

    topics: [
      {
        id: 'chat', name: 'By the elevator',
        nodes: [
          {
            id: 'c1', line: '(Yawns.) Why is the garage so packed this morning?',
            agree: { say: "Everyone's leaving for work. Late night?", reply: "Work dinner again last night. Got home after eleven. I'm dead tired.", gain: 's_late' },
            press: { say: 'Did you see my car? The whole door is scraped.', reply: '…What? No, I didn\'t.', v: 18 },
            silence: { reply: '(Twirls his key.) …What?' },
          },
          {
            id: 'c2', gate: true, line: 'Anyway, I got in early last night. Parked and went straight up. Nine-ish?',
            claim: {
              ev: ['dashcam', 's_late'], reveal: 'there', move: 'same',
              hit: { narr: '— You show him the dashcam still on your phone. 11:12 p.m., a white SUV.', text: '…That, uh.' },
              hitBy: { s_late: { narr: '— "You just said you got home after eleven."', text: "…That's just something I said." } },
            },
            agree: { say: 'Early night, then.', reply: 'Yep, early.', move: 'stay' },
            press: { say: 'Nine o\'clock, really?', reply: 'I said so, didn\'t I?', v: 12, move: 'stay' },
            silence: { reply: '…Around nine.' },
          },
          {
            id: 'c3', gate: true, line: "Even so, my car never touched yours. I'm a good parker.",
            claim: {
              ev: 'paint', reveal: 'touched', move: 'same',
              hit: { narr: "— You show him the white paint in the scrape. Mr. Oh's SUV is white.", text: '……' },
            },
            agree: { say: "You're a careful driver.", reply: 'Twenty years behind the wheel.', move: 'stay' },
            press: { say: 'It never touched?', reply: 'Never.', v: 12, move: 'stay' },
            silence: { reply: "…I'd know if it touched." },
          },
          {
            id: 'corner', line: '(Grips his key.) …So what? Touching and scraping are two different things.',
            press: {
              say: 'You scraped my car, Mr. Oh.',
              reply: [
                { when: "zone=='calm'", text: "…Me? (His face goes red.) I told you, it only touched!" },
                { when: true, text: 'Watch what you say. Go through the insurance.' },
              ],
              rules: [
                { when: "zone=='calm'", do: { heat: '+25' }, line: 'reply', move: 'stay' },
                { do: { heat: '+15' }, line: 'reply', end: 'corner' },
              ],
            },
            silence: {
              reply: '…',
              rules: [
                { when: "zone!='calm'", line: '@cornerBreak', reveal: 'admit', end: 'done' },
                { line: '@cornerRecover', end: 'corner' },
              ],
            },
            agree: { say: 'Maybe it was just a touch.', reply: "Right. I'm going up.", rules: [{ line: 'reply', end: 'corner' }] },
          },
        ],
      },
    ],
  };

  if (I) I.register(SCENARIO);
  if (typeof module !== 'undefined' && module.exports) module.exports = SCENARIO;
})(typeof window !== 'undefined' ? window : globalThis);
