/*
 * Example scenario: "The Envelope"
 *
 * The office social fund — an envelope with $400 in it — has gone missing from the safe.
 * You have coffee in the break room with Daniel Han, the team's admin, who keeps the fund.
 * Your coworker Mina has agreed to chime in twice when you give her a signal.
 *
 * Flow
 *   1. Small talk builds rapport. Two boasts get noted down ("their words").
 *   2. Signal Mina (1st): "Did anyone find the fund envelope?" Three lies follow
 *      (the key, leaving early, never touching the envelope). Rebut each with evidence
 *      or with his own words.
 *   3. Signal Mina (2nd): "I saw you take money out of it." He claims he only counted it.
 *      The ATM slip corners him.
 *   4. Cornered and on edge, silence makes him confess on his own ("I only borrowed it").
 *      Pressing him instead makes him clam up (partial).
 *
 * This file uses every feature except evidenceAlias. For the smallest possible scenario
 * see parking-scrape.js.
 */
(function (root) {
  const I = root.Interrogation || (typeof require !== 'undefined' ? require('../src/interrogation.js') : null);

  const SCENARIO = {
    id: 'office-envelope',
    title: 'The Envelope',
    lang: 'en',
    actors: {
      player: { id: 'me', name: 'You' },
      suspect: { id: 'han', name: 'Daniel' },
      ally: { id: 'mina', name: 'Mina' },
    },

    // ---- Meters ------------------------------------------------------------
    zoneMeter: 'tension',
    meters: {
      tension: {
        label: 'Tension', min: 0, max: 100, start: 30,
        zones: [
          { id: 'blue', to: 24, label: 'relaxed', color: '#4f86c6', mood: 'happy', habit: 'Sips his coffee.' },
          { id: 'gold', to: 59, label: 'talkative', color: '#d9a92b', mood: 'smug', habit: 'Adds things nobody asked about.' },
          { id: 'orange', to: 84, label: 'on edge', color: '#e07b2e', mood: 'suspicious', habit: 'Crumples his paper cup.' },
          { id: 'red', to: 100, label: 'about to snap', color: '#d0453c', mood: 'angry', habit: 'Pushes his chair back.' },
        ],
      },
      rapport: { label: 'Rapport', min: 0, max: 100, start: 0, full: 50, visible: true },
      suspicion: { label: 'Suspicion', min: 0, max: 100, start: 0, cues: [{ at: 60, habit: 'Stops smiling and watches you.' }] },
    },
    limits: { turns: 18, warn: 4 },
    presets: {
      A: { label: 'Friendly coworker', start: { tension: 28, rapport: 15, suspicion: 0 }, turns: 20 },
      B: { label: 'From internal audit', start: { tension: 50, rapport: 0, suspicion: 40 }, turns: 16 },
    },

    // ---- Stances: how the player can answer at any node ---------------------
    nodeStances: ['agree', 'press', 'defend', 'silence'],
    stances: {
      agree: {
        label: 'Agree', needs: ['say', 'reply'],
        rules: [
          { when: 'rapport>=full_rapport', do: { suspicion: '+22', tension: '-3' }, line: '@flattered', move: 'same' },
          { do: { rapport: '+25', suspicion: '-4', tension: '+3' }, line: 'reply', move: 'same' },
        ],
      },
      press: {
        label: 'Press', needs: ['say', 'reply'],
        rules: [{ do: { tension: '+(opt.v||12)', rapport: '-10', suspicion: '+(rapport<30?6:0)' }, line: 'reply', move: 'same' }],
      },
      defend: {
        label: 'Take a side', needs: ['say', 'burst', 'cold'],
        rules: [
          { when: 'rapport<30', do: { suspicion: '+20', tension: '+6', rapport: '-5' }, line: 'cold', move: 'same' },
          { do: { tension: '=max(tension,min(82,max(tension+8,64)))', rapport: '-25', suspicion: '-30' }, sfx: 'thud', line: 'burst', mood: 'angry', move: 'same' },
        ],
      },
      silence: {
        label: 'Silence', needs: ['reply'], say: '(Wait in silence)', narr: '— You say nothing and wait.',
        rules: [
          { when: "lastStance=='silence'", do: { tension: '-3' }, line: '@silenceTwice', lose: 1, move: 'stay' },
          { do: { tension: '-7' }, line: 'reply', move: 'stay' },
        ],
      },
    },

    // ---- Evidence and "their words" ----------------------------------------
    evidenceReusable: false,
    evidence: {
      keybook: { label: 'Key log', desc: 'The safe key was signed out to Daniel Han' },
      badge: { label: 'Door log', desc: "Daniel's badge, out at 9:40 p.m. that night" },
      cctv: { label: 'Hallway camera still', desc: '8:52 p.m. — Daniel walking to the break room with the envelope' },
      atm: { label: 'ATM deposit slip', desc: 'Found in the shredder bin. 10:05 p.m., $400 deposited' },
      receipt: { label: 'Coffee receipt', desc: 'Two americanos that afternoon, from the café downstairs' },
      s_key: { kind: 'said', label: '"I carry the safe key"', desc: '"I do all the admin. I even carry the safe key myself."' },
      s_late: { kind: 'said', label: '"I turned the lights off last night"', desc: '"I\'m here late every night. I bet I turned the lights off last night too."' },
    },
    evidenceRules: {
      rules: [
        { when: 'claimMatch', do: { tension: '+4' }, sfx: 'thud', line: 'claim.hit', mood: 'suspicious', reveal: 'claim', move: 'claim' },
        { line: '@wrongEvidence', mood: 'angry', end: 'fail' },
      ],
    },

    // ---- The ally: two pre-arranged signals --------------------------------
    ally: {
      label: 'Signal Mina',
      uses: [
        {
          when: "topic=='talk'", label: 'Signal Mina (1)', prompt: 'Give Mina the first signal',
          cue: '— You glance at Mina. That was the signal.',
          say: 'Daniel, did anyone ever find the fund envelope?', v: 10,
          rules: [
            { when: 'rapport<30', do: { suspicion: '+30', tension: '+15' }, flag: { allyOut: '=1' }, line: '@allyTooEarly', move: 'topic:money' },
            { do: { tension: '+10' }, line: '@allyGood', move: 'topic:money' },
          ],
        },
        {
          when: 'allyUses==1', label: 'Signal Mina (2)', prompt: 'Give Mina the second signal',
          cue: '— You look at Mina again. The second signal.',
          say: '…Daniel. I saw you that night. You took money out of the envelope.', v: 12,
          rules: [
            { when: 'revealed.open', do: { tension: '+12' }, move: 'node:counted' },
            { do: { suspicion: '+25', tension: '+10' }, flag: { allyOut: '=1' }, line: '@allyWasted', mood: 'angry' },
          ],
        },
      ],
    },

    // ---- Checked after every turn -------------------------------------------
    after: [
      { when: 'suspicion>=100', do: { suspicion: '=45', rapport: '-25', tension: '=max(tension,62)' }, warn: 1, lose: 1, line: '@guard', mood: 'suspicious' },
      { when: "rapport<=0 && topic!='talk'", line: '@walkout', mood: 'angry', end: 'fail' },
      { when: "zone=='red' && revealed<total && stance!='evidence' && stance!='ally'", do: { tension: '=72' }, warn: 1, shake: true, line: '@red', mood: 'angry' },
    ],

    // ---- What you are trying to get on the record ---------------------------
    revelations: [
      { id: 'key', label: 'He had the safe key', line: "…Fine, I have it. I'm the admin. But I never opened the safe.", mood: 'smug' },
      { id: 'late', label: 'He stayed late that night', line: '…I stayed a bit late. I had expenses to finish. That\'s all.', mood: 'sweat' },
      { id: 'open', label: 'He opened the envelope', line: '…I opened it, okay? To count it. The admin is allowed to count the fund.', mood: 'sweat' },
      { id: 'took', label: 'He took the money', line: '…I borrowed it. My card payment was overdue. I was going to put it back on payday. I swear. …I swear.', mood: 'broken' },
    ],
    outcomes: [
      { id: 'full', when: 'revealed>=4' },
      { id: 'partial', when: 'revealed>=2' },
      { id: 'fail', when: true },
    ],

    // ---- Shared lines -------------------------------------------------------
    lines: {
      flattered: [
        { when: 'suspicion<50', text: 'Ha, why are you buttering me up today?', mood: 'smug' },
        { when: true, text: '(The smile fades.) What do you want?', mood: 'suspicious' },
      ],
      guard: [{ when: true, text: '…I should get back to my desk. (Puts his cup down.)', note: 'Daniel is on his guard now.' }],
      red: [
        '(Raises his voice.) Are you accusing me?',
        { text: '(Pushes his chair back.) If this is an interrogation, get the manager in here.', note: 'Too hard. Ease off.' },
        '…Why do you keep asking that?',
      ],
      silenceTwice: ["…If you've got nothing to say, I'm going. (Time passes.)"],
      wrongEvidence: [
        { when: "evKind=='said'", narr: '— You read back what he said earlier.', text: "…So? What about it? You were writing down what I said? I'm leaving.", note: 'Wrong moment.' },
        { when: true, narr: '— Daniel looks at what you show him. His face hardens.', text: "…What is this? Am I being investigated? I'm leaving.", note: 'Wrong moment. Daniel shuts down.' },
      ],
      walkout: [{ when: true, text: "I'm busy. I'll see you later.", note: 'Daniel has closed up.' }],
      afterReveal: ['— Daniel turns his paper cup in his hands.', '— Daniel straightens his tie.', '— Daniel looks out the window.'],
      allyGood: [{ when: true, text: "…(His smile freezes.) Oh, that. The manager's looking for it.", mood: 'smug', after: '— Mina stirs her coffee and says nothing. Daniel turns back to you.' }],
      allyTooEarly: [{ when: true, text: '(Sets his cup down hard.) Mina, why bring that up here?', mood: 'angry', after: '— Mina awkwardly leaves. Too early.' }],
      allyWasted: [{ when: true, text: "…Saw what? Mina, watch what you say.", mood: 'angry', after: '— Mina leaves the room.' }],
      cornerBreak: [{ when: true, narr: '— The silence stretches. Only the fridge hums.', text: '…Why aren\'t you saying anything?', mood: 'sweat' }],
      cornerRecover: [{ when: true, narr: '— The silence stretches.', text: "…(He steadies his breath.) If that's all, I'm going. I've said enough.", mood: 'smug' }],
    },

    ui: {
      intro: '— The break room. Daniel sets down two paper cups. Mina is standing by the water cooler.',
      end: {
        full: 'All four pieces are on the record.',
        partial: '{n} pieces on the record.',
        partial_corner: 'Daniel clams up. {n} pieces on the record.',
        fail_fail: 'The conversation broke off.',
        fail_blocked: 'Daniel went back to his desk.',
        fail: 'Lunch break is over.',
      },
    },

    // ---- Simulation: a first-time player, and what should hold -------------
    sim: {
      noise: 0.5,
      evidence: ['keybook', 'badge', 'cctv', 'atm', 'receipt'],
      targets: { A: { full: [45, 85] }, B: { full: [20, 60] } },
      policy: [
        { pre: true, chance: 0.75, when: "claim!=''", pick: ['evidence:claim'] },
        { pre: true, chance: 0.6, when: "nodeId=='corner' && (zone=='orange' || zone=='red')", pick: ['silence'] },
        { pre: true, chance: 0.7, when: "topic=='talk' && rapport>=40", pick: ['ally'] },
        { pre: true, chance: 0.9, when: "nodeId=='t3'", pick: ['ally'] },
        { pre: true, chance: 0.7, when: "nodeId=='m4' && allyUses==1", pick: ['ally'] },
        { when: "claim!=''", pick: ['evidence:claim'] },
        { when: "nodeId=='corner' && (zone=='orange' || zone=='red')", pick: ['silence'] },
        { when: "nodeId=='corner'", pick: ['defend', 'silence'] },
        { when: "topic=='talk'", pick: ['agree', 'silence'] },
        { when: 'rapport<25', pick: ['agree', 'silence'] },
        { when: true, pick: ['press', 'agree', 'silence'] },
      ],
      checks: [
        { name: 'Agreeing with everything never gets a full confession', preset: 'A', policy: [{ when: true, pick: ['agree', 'silence'] }], noise: 0, max: { full: 0 } },
        { name: 'No full confession without the camera still', preset: 'A', evidence: ['keybook', 'badge', 'atm', 'receipt'], max: { full: 0 } },
      ],
    },

    // ---- The script ----------------------------------------------------------
    topics: [
      {
        id: 'talk', name: 'Small talk',
        nodes: [
          {
            id: 't1', line: "Admin work is killing me lately. Collecting the social fund is on me too.",
            agree: { say: 'You do all the admin by yourself? That\'s a lot.', reply: "Right? I do all the admin. I even carry the safe key myself. Can't trust anyone else with it.", gain: 's_key' },
            press: { say: 'Where do you keep the fund?', reply: '…In the safe. Why?', v: 15 },
            defend: { say: 'People who never pay in must drive you crazy.', burst: "They do! Everyone treats me like a debt collector!", cold: 'It is what it is.' },
            silence: { reply: "(Sips his coffee.) …You're quiet today." },
          },
          {
            id: 't2',
            line: [
              { when: "lastStance=='agree'", text: 'Finally someone gets it. And now year-end expenses on top.' },
              { when: true, text: 'Anyway, year-end expenses on top of everything.' },
            ],
            agree: { say: 'Expense season — you must be here late every night.', reply: 'Tell me about it. Everyone else leaves on the dot.', move: 'same' },
            press: { say: 'How late do you usually stay for expenses?', reply: '…Depends.', v: 12 },
            defend: { say: 'You should get overtime for that.', burst: 'Overtime? This company? Please!', cold: 'There is no overtime.' },
            silence: { reply: "I'm here late every night. I bet I turned the lights off last night too. Ha.", gain: 's_late' },
          },
          {
            id: 't3', line: "Anyway, thanks for the coffee. I'd better get back—",
            agree: { say: 'Sure, go ahead.', reply: "Let's do this again." },
            press: { say: 'Wait, one more thing.', reply: 'What? Make it quick.', v: 10 },
            defend: { say: 'Mina said she wanted a word too.', burst: 'Mina? What does Mina want with me?', cold: 'Mina?' },
            silence: { reply: '(Checks his watch.) …' },
          },
        ],
      },
      {
        id: 'money', name: 'The fund', requires: 'allyUses>=1',
        blocked: { text: "Right, I'm heading back. Thanks for the coffee.", note: 'You never signalled Mina.' },
        nodes: [
          {
            id: 'm1', gate: true,
            line: [
              { when: 'flags.allyOut', text: "(Glances at the door Mina left by.) The envelope? Only the manager has the safe key. I wouldn't know." },
              { when: true, text: "The envelope? It was in the safe. Only the manager has the key. I wouldn't know." },
            ],
            claim: {
              ev: ['keybook', 's_key'], reveal: 'key', move: 'same',
              hit: { narr: '— You show him the key log. The safe key, signed out to Daniel Han.', text: '…When did you see that?' },
              hitBy: { s_key: { narr: '— You open your notebook. "You said you carry the safe key yourself."', text: "…(The smile freezes.) That's just a figure of speech." } },
            },
            agree: { say: 'Then I should ask the manager.', reply: "Exactly. I wouldn't know.", move: 'stay' },
            press: { say: "You really don't have a key?", reply: 'I said I don\'t.', v: 10, move: 'stay' },
            defend: { say: "If the admin doesn't know, nobody does.", burst: 'Why do I have to know everything!', cold: "I don't know either.", move: 'stay' },
            silence: { reply: '…The manager has the key.' },
          },
          {
            id: 'm2', gate: true, line: "Anyway, I left early that day. Six-thirty? I didn't go near the safe.",
            claim: {
              ev: ['badge', 's_late'], reveal: 'late', move: 'same',
              hit: { narr: "— You show him the door log. Out at 9:40 p.m., Daniel's badge.", text: '…That, um…' },
              hitBy: { s_late: { narr: '— You open your notebook. "You said you turned the lights off last night."', text: "…No, I didn't mean it like that." } },
            },
            agree: { say: 'So you went home early.', reply: 'Yeah, nothing to do that day.', move: 'stay' },
            press: { say: 'Six-thirty, really?', reply: 'Yes, really.', v: 10, move: 'stay' },
            defend: { say: 'Whoever stayed late that night must have done it.', burst: 'Done it? Watch your mouth!', cold: 'I guess so.', move: 'stay' },
            silence: { reply: '…Six-thirty.' },
          },
          {
            id: 'm3', gate: true, line: "Even if I stayed, I never touched the envelope. The safe was exactly as it was.",
            claim: {
              ev: 'cctv', reveal: 'open', move: 'same',
              hit: { narr: '— You show him the camera still. 8:52 p.m., Daniel carrying the envelope to the break room.', text: '……' },
            },
            agree: { say: 'Good thing the safe was untouched.', reply: "Right. I didn't touch it.", move: 'stay' },
            press: { say: "You didn't touch it at all?", reply: 'I said I didn\'t.', v: 10, move: 'stay' },
            defend: { say: "With the money gone, you're the one who'll get blamed.", burst: 'Exactly — so why should I take the blame?!', cold: "Yeah, it's a mess.", move: 'stay' },
            silence: { reply: '…The safe was fine.' },
          },
          {
            id: 'm4', line: 'Anyway, I put the money right back. Someone must have taken it after.',
            agree: { say: 'Someone else could have opened it later.', reply: "Exactly. I'm a victim here too.", move: 'stay' },
            press: { say: 'Did anyone open the safe after you?', reply: 'How would I know?', v: 12, move: 'stay' },
            defend: { say: 'Mina says she was here late that night.', burst: '…Mina? Then go ask Mina!', cold: 'Mina was?', move: 'stay' },
            silence: { reply: '(Checks his watch.) …I really have to go.' },
          },
        ],
      },
      {
        // Opens only with Mina's second signal.
        id: 'confront', name: 'The witness', requires: 'allyUses>=2 && !flags.allyOut',
        blocked: { text: "Right, I'm heading back. I think we're done here.", note: 'One step short.' },
        nodes: [
          {
            id: 'counted', mood: 'angry', line: '(Slams his cup down.) Mina, watch what you say! I only counted it. I counted it and put it straight back!',
            claim: {
              ev: 'atm', move: 'node:corner',
              hit: { narr: '— You show him the ATM slip from the shredder bin. 10:05 p.m., $400.', text: "…That's my own money." },
            },
            agree: { say: '…I see.', reply: "Exactly. I'm going.", rules: [{ line: 'reply', end: 'corner' }] },
            press: { say: 'You really put it back?', reply: 'How many times do I have to say it!', v: 10, move: 'stay' },
            defend: { say: 'Why would Mina lie?', burst: "Mina's out to get me!", cold: 'You believe Mina?', move: 'stay' },
            silence: { reply: '…I put it back. Really.' },
          },
          {
            id: 'corner', mood: 'sweat', line: "(His hands shake.) …So what? Is there proof it was the fund? It could be the same amount by chance.",
            press: { say: 'You took the fund money and deposited it.', reply: "Careful. …Get HR in here. I'm not saying another word.", rules: [{ do: { tension: '+15' }, line: 'reply', mood: 'angry', end: 'corner' }] },
            silence: {
              reply: '…',
              rules: [
                { when: "zone=='orange' || zone=='red'", line: '@cornerBreak', reveal: 'took', end: 'done' },
                { line: '@cornerRecover', end: 'corner' },
              ],
            },
            agree: { say: 'Could be a coincidence.', reply: "…Right. A coincidence. I'm going.", rules: [{ line: 'reply', end: 'corner' }] },
            defend: { say: 'If this stays unsolved, Mina is the one who gets suspected.', burst: "…Mina's got nothing to do with this.", cold: "…Mina's got nothing to do with this.", rules: [{ do: { tension: '+8' }, line: 'burst', move: 'stay' }] },
          },
        ],
      },
    ],
  };

  if (I) I.register(SCENARIO);
  if (typeof module !== 'undefined' && module.exports) module.exports = SCENARIO;
})(typeof window !== 'undefined' ? window : globalThis);
