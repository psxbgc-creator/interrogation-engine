# Writing a scenario

A scenario is one JavaScript object. The engine reads it; nothing about your story lives in the engine.
The fastest way to start is to copy [`scenarios/parking-scrape.js`](../scenarios/parking-scrape.js) (smallest)
or [`scenarios/office-envelope.js`](../scenarios/office-envelope.js) (uses nearly everything) and change it.

- [How a conversation works](#how-a-conversation-works)
- [Design: the ladder of lies](#design-the-ladder-of-lies)
- [Reference](#reference)
- [Expressions](#expressions)
- [Events](#events)
- [Testing your scenario](#testing-your-scenario)
- [Embedding in a game](#embedding-in-a-game)
- [Lessons from a shipped game](#lessons-from-a-shipped-game)

## How a conversation works

1. The suspect says the line of the current **node**.
2. The player answers with one **stance** (agree, press, take a side, silence — you define them), presents
   **evidence**, or signals the **ally**. A talk option, once picked, never comes back.
3. The first matching **rule** of that stance changes **meters**, picks a line, and may move on, reveal
   something, warn, or end the conversation.
4. **After rules** run (all that match), then the next node begins.
5. When every **revelation** is out, the turns run out, there are too many warnings, the script runs out,
   or a rule says `end`, the first matching **outcome** is the result.

## Design: the ladder of lies

The scenes that read well were all built the same way:

1. **Rapport first.** Agreeing makes the suspect talk. Let them boast — and note a boast down with `gain`.
   That boast later becomes a weapon against their own lie.
2. **A trigger.** Something (often an ally's pre-arranged signal) brings up the topic they want to avoid.
3. **A ladder of lies.** Each lie is a step back from the admission just before it:
   *"there was no game" → "the staff played among themselves" → "I left at six" → "I was supervising, but the
   safety lock stayed on" → …* Put each lie on its own node with a `claim`, and make it a `gate` so the
   conversation cannot skip past it. The suspect then only ever builds on what they have already admitted.
4. **Evidence only rebuts.** Presenting the right item (or their own words) when a lie is on the table reveals
   the next piece. Presenting anything at any other time ends the conversation. That is what makes evidence
   feel like a rebuttal and not a key.
5. **The corner.** The last lie is broken; they are on edge. Pressing makes them clam up (a partial result).
   Silence — the last little push — makes them fill the silence and confess, downplaying it.

## Reference

### Top level

| Field | Meaning |
|---|---|
| `id`, `title`, `lang` | Identifier, display title, interface language (`'en'`, `'ko'`) |
| `actors` | `{ player, suspect, ally?, observer? }`, each `{ id, name }` |
| `zoneMeter` | Name of the meter that has zones |
| `meters` | See below |
| `limits` | `{ turns, warn }` — turn limit and warning limit |
| `presets` | Approaches the player can choose: `{ A: { label, start: {meter: value}, turns?, vars? } }` |
| `vars` | Scenario variables, usable in expressions |
| `nodeStances` | The stances offered at every node, e.g. `['agree', 'press', 'defend', 'silence']` |
| `stances` | Definitions of those stances |
| `evidence` | Items and "their words" |
| `evidenceAlias` | One brought item that becomes several cards: `{ log: ['log_night', 'log_lock'] }` |
| `evidenceReusable` | `false` (recommended): a card can be shown once |
| `evidenceRules` | `{ rules }` applied when evidence is presented |
| `ally` | Optional partner with numbered signals |
| `after` | Rules checked after every turn |
| `revelations` | The pieces you are trying to get on the record |
| `outcomes` | Results, first match wins |
| `lines` | Shared line pools referenced as `'@name'` |
| `topics` | The script |
| `ui` | Interface text overrides (see the view) and `intro`, `end` |
| `sim` | Simulation settings |

### Meters

```js
meters: {
  tension: { label: 'Tension', min: 0, max: 100, start: 30,
    zones: [ { id: 'calm', to: 39, label: 'calm', color: '#4f86c6', mood: 'happy', habit: 'Sips his coffee.' }, ... ] },
  rapport: { label: 'Rapport', min: 0, max: 100, start: 0, full: 50, visible: true },
  suspicion: { min: 0, max: 100, cues: [{ at: 60, habit: 'Stops smiling.' }] },
}
```

- Zones must be in increasing `to` order. A zone's `mood` is used for the portrait when a line has none;
  its `habit` is shown on screen (players in "detective mode" read the habit instead of the meter).
- `visible: true` shows a helper meter as five dots; `full` is its "full" value (`full_rapport` in expressions).
- `cues` show a habit once a hidden meter passes a value.

### Stances and rules

```js
stances: {
  press: { label: 'Press', needs: ['say', 'reply'],
    rules: [ { do: { tension: '+(opt.v||12)', rapport: '-10' }, line: 'reply', move: 'same' } ] },
  silence: { label: 'Silence', needs: ['reply'], say: '(Wait)', narr: '— You wait.',
    rules: [ { when: "lastStance=='silence'", line: '@silenceTwice', lose: 1, move: 'stay' },
             { do: { tension: '-7' }, line: 'reply', move: 'stay' } ] },
}
```

- `needs` lists the fields every node must give this stance (the validator checks them).
- `say` / `narr`: a default player line, or a narration instead of a player line.
- A node can replace a stance's rules for itself with its own `rules`.

A **rule** may contain:

| Field | Effect |
|---|---|
| `when` | Condition (expression). Missing = always |
| `do` | Meter changes: `5` adds, `'+expr'`/`'-expr'` add/subtract, `'=expr'` sets |
| `flag` | Flag changes, same syntax |
| `line` | `'reply'` (a field of the node's option), `'@pool'`, or `'claim.hit'` |
| `mood` | Portrait mood for that line |
| `narr` | A narration line |
| `sfx`, `shake` | Ask the view for a sound / a shake |
| `warn` | Add warnings (too many ends the game) |
| `lose` | Extra turns spent |
| `move` | `'same'` next node · `'next'` next topic · `'topic:id'` · `'node:id'` · `'stay'` · `'claim'` (the claim's own `move`) |
| `reveal` | `'claim'` (the lie just rebutted) or a revelation id |
| `end` | End the conversation; if it names an outcome id, that is the outcome |

### Topics and nodes

```js
topics: [
  { id: 'money', name: 'The fund', requires: 'allyUses>=1',
    blocked: { text: "I'm heading back.", note: 'You never signalled Mina.' },
    enter: '— He wipes his forehead.',
    nodes: [
      { id: 'm1', gate: true, line: 'Only the manager has the key.',
        claim: { ev: ['keybook', 's_key'], reveal: 'key', move: 'same',
                 hit: { narr: '— You show him the key log.', text: '…When did you see that?' },
                 hitBy: { s_key: { text: "That's just a figure of speech." } } },
        agree: { say: 'Then I should ask the manager.', reply: "I wouldn't know.", move: 'stay' },
        press: { say: 'Really?', reply: 'Really.', v: 10, move: 'stay' } },
    ] },
]
```

- `requires`: a topic that only opens when the condition holds. Moving into it otherwise ends the conversation
  as `blocked`, after its `blocked` line.
- `enter`: a narration when the topic begins.
- Node `line`: a string, or `[{ when, text }, ...]` variants (e.g. depending on `lastStance`).
- Node options: `say` (player line), the fields its stance `needs`, plus optional `v` (a number rules can read
  as `opt.v`), `move` (overrides the rule's move), `rules`, `flag`, `gain`, and `claim` (the reply itself is a lie).
- `claim`: the lie on the table. `ev` is the evidence (one id or a list) that rebuts it; `reveal` the revelation
  it gives; `move` where to go after; `hit` the reaction; `hitBy[evidenceId]` a reaction per item; `do` extra
  meter changes when it is rebutted.
- `gate: true`: the node will not move on while its claim stands, even when every talk option is used.
- `gain: 's_key'`: when the suspect actually says this reply, the evidence `s_key` (usually `kind: 'said'`) is
  added to the player's evidence.

When every talk option at a node has been used, the conversation moves to the next node by itself (unless gated).

### Evidence

```js
evidence: {
  keybook: { label: 'Key log', desc: 'Signed out to Daniel Han', icon: 'docs:key_log' },
  s_key: { kind: 'said', label: '"I carry the safe key"', desc: '"I even carry the safe key myself."' },
}
```

`icon` is passed to `host.icon()`. `kind: 'said'` marks the suspect's own words; they are shown separately and
are only available once gained. The usual evidence rules:

```js
evidenceRules: { rules: [
  { when: 'claimMatch', line: 'claim.hit', reveal: 'claim', move: 'claim' },
  { line: '@wrongEvidence', end: 'fail' },
] }
```

### Ally

```js
ally: { label: 'Signal Mina', uses: [
  { when: "topic=='talk'", label: 'Signal Mina (1)', prompt: 'Give Mina the first signal',
    cue: '— You glance at Mina.', say: 'Did anyone find the envelope?', v: 10,
    rules: [ { when: 'rapport<30', flag: { allyOut: '=1' }, line: '@allyTooEarly', move: 'topic:money' },
             { line: '@allyGood', move: 'topic:money' } ] },
  { when: 'allyUses==1', ... },
] }
```

Each use is available while its `when` holds. Setting the flag `allyOut` removes the ally for the rest of the game.

### Revelations and outcomes

```js
revelations: [ { id: 'key', label: 'He had the safe key', line: '…Fine, I have it.', mood: 'smug', sms: 'Got it.' } ],
outcomes: [ { id: 'full', when: 'revealed>=4' }, { id: 'partial', when: 'revealed>=2' }, { id: 'fail', when: true } ],
```

`sms` shows a short message from `actors.observer` (someone listening in) when the piece is revealed.

### Lines

```js
lines: {
  red: ['(Raises his voice.) Are you accusing me?', { text: '…', note: 'Too hard. Ease off.' }],   // rotates
  wrongEvidence: [ { when: "evKind=='said'", text: 'So what?' }, { when: true, text: 'What is this?' } ], // first match
  afterReveal: ['— He turns his cup in his hands.'],   // after each revelation, rotating
  presentNarr: '— You put the {label} on the table.',  // optional narration when evidence is shown
}
```

A line object may carry `narr` (before), `text`, `mood`, `after` (narration after) and `note` (a hint to the player).

## Expressions

Conditions and values are short expressions, parsed without `eval`:
`&& || ! == != < <= > >= + - * /`, `a ? b : c`, and `min max round abs floor ceil`.

| Name | Value |
|---|---|
| any meter name, `full_<meter>` | current value / its `full` |
| `zone` | id of the current zone |
| `turn`, `turns`, `warn` | turns taken, turn limit, warnings |
| `revealed`, `total`, `revealed.<id>` | pieces revealed, pieces in total, a given piece |
| `used.<id>` | was that evidence shown? |
| `flags.<name>`, `vars.<name>` (or just the name) | flags and scenario variables |
| `topic`, `nodeId`, `node`, `topicIndex` | where we are |
| `stance`, `lastStance` | the stance being picked now / picked last turn |
| `allyUses` | ally signals used |
| `claim` | ids that rebut the current lie (`''` if none) |
| `claimMatch`, `evKind` | does the evidence being shown rebut the lie? / its kind |
| `opt.<field>` | a field of the option being picked (e.g. `opt.v`) |

## Events

`create()` and `choose()` return events — render them however you like:

| `t` | Fields |
|---|---|
| `node` | `topic`, `node`, `first` |
| `line` | `who` (`player`/`suspect`/`ally`), `text`, `mood` |
| `narr`, `note` | `text` |
| `present` | `ev`, `label` |
| `claim` | `ev` |
| `gain` | `ev`, `label`, `quote` |
| `reveal` | `id`, `index`, `label`, `via` |
| `warn` | `n` |
| `sfx`, `shake` | `id` / — |
| `move` | `changed` (topic changed) |
| `end` | `outcome`, `why` (`all`, `time`, `warn`, `script`, `blocked`, or the rule's `end`) |

## Testing your scenario

```
node tools/check.js scenarios/my-scene.js
node tools/transcript.js scenarios/my-scene.js --preset B --noise 0.5 --seed 3
```

`sim` in the scenario describes a first-time player:

```js
sim: {
  noise: 0.5,                                   // half the time, a random talk option
  evidence: ['keybook', 'badge', 'cctv'],
  targets: { A: { full: [45, 85] } },           // acceptable outcome rates per preset
  policy: [                                     // first matching rule picks; pre-rules are looked at before the noise roll
    { pre: true, chance: 0.75, when: "claim!=''", pick: ['evidence:claim'] },
    { when: true, pick: ['press', 'agree', 'silence'] },
  ],
  checks: [ { name: 'Agreeing never wins', preset: 'A', policy: [{ when: true, pick: ['agree'] }], noise: 0, max: { full: 0 } } ],
}
```

Tune targets for a first-time player (noise around 0.5). A policy that knows every rule makes the game feel far
easier on paper than it is in the hands of real players. And read transcripts — they find broken continuity much
faster than numbers do.

## Embedding in a game

```html
<link rel="stylesheet" href="interrogation-view.css">
<script src="interrogation.js"></script>
<script src="interrogation-view.js"></script>
<script src="scenarios/my-scene.js"></script>
<script>
  InterrogationView.open({
    scenario: Interrogation.scenarios['my-scene'],
    preset: 'A',
    evidence: ['keybook', 'badge'],
    host: { bust: (id, mood) => `portraits/${id}-${mood}.webp`, bg: 'room.webp', sfx: (id) => audio.play(id) },
  }).then((r) => console.log(r.outcome, r.count, r.why, r.state));
</script>
```

Interface text comes from `InterrogationView.strings[lang]` (`en`, `ko`); any key can be overridden in the
scenario's `ui` (for example `ui.confirm`, `ui.silence`, `ui.end.full`). Add a language by adding an entry to
`InterrogationView.strings`. Set `ui.confirm = false` to show evidence without asking first, and
`ui.showStances = true` to label talk options with their stance.

Or skip the view and drive the engine yourself:

```js
const s = Interrogation.create(scenario, { preset: 'A', evidence: ['keybook'] });
render(s.events);
const events = Interrogation.choose(s, Interrogation.options(s)[0]);
```

## Lessons from a shipped game

This engine came out of *21:40 — First Visit*, a Korean mystery game. What playtesting taught:

- Letting players choose which evidence to bring broke continuity — a missing item meant a lie could not be
  rebutted and the script went on as if it had been. Bring everything you collected; make each card usable once;
  split one document into pages (`evidenceAlias`) when it has to rebut several lies.
- Showing the stance name on each option ("Agree", "Press") made players pick labels instead of words. Hide them.
- An ally who interrupts on a pre-arranged signal reads far better than an ally the player directs freely.
- The best moment in the game is a boast from the rapport phase coming back to break a lie.
