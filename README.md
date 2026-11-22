# Interrogation Engine

A small, data-driven engine for **tense one-on-one conversations** — interrogations, confessions, negotiations,
persuasion. Write a scene as one plain JavaScript object; the engine runs it, a ready-made mobile-first view
renders it, and a simulator tells you how it plays before anyone has played it.

[한국어 README](README.ko.md)

- **Lies you break with evidence — or with their own words.** A node can be a lie (`claim`). Only the right
  item rebuts it. Things the suspect boasted about earlier are written down and can be turned against them.
  Showing evidence at the wrong moment ends the conversation.
- **Continuity by construction.** A gated lie cannot be skipped, so the suspect only ever builds on what they
  have already admitted.
- **Meters with readable tells.** A zone meter (tension, heat…) with habits per zone, plus any helper meters
  (rapport, patience, suspicion…). Players can hide the meter and read the habits instead.
- **An ally on cue (optional).** A partner who interrupts on a pre-arranged signal.
- **The last push is silence.** Corner nodes can reward waiting instead of pressing.
- **A simulator.** Play thousands of games as a first-time player, check outcome rates against targets, run
  counter-examples ("agreeing with everything never wins"), and print transcripts to find lines that don't follow on.
- **No dependencies, no build step, no `eval`.** About 65 KB of readable, unminified JavaScript and CSS. Browser and Node.

## Try it

**[Open the playground in your browser](https://psxbgc-creator.github.io/interrogation-engine/)** — or open [`playground/index.html`](playground/index.html) locally (no server needed). Play the two example
scenarios, simulate them, read transcripts, or load your own scenario file.

## Quick start

```html
<link rel="stylesheet" href="src/interrogation-view.css">
<script src="src/interrogation.js"></script>
<script src="src/interrogation-view.js"></script>
<script src="scenarios/office-envelope.js"></script>
<script>
  InterrogationView.open({
    scenario: Interrogation.scenarios['office-envelope'],
    preset: 'A',
    evidence: ['keybook', 'badge', 'cctv', 'atm', 'receipt'],
    host: { bust: (id, mood) => `portraits/${id}-${mood}.png` },
  }).then((result) => console.log(result.outcome, result.count));
</script>
```

Without the view, in Node or your own UI:

```js
const Interrogation = require('./src/interrogation.js');
const scenario = require('./scenarios/parking-scrape.js');

const s = Interrogation.create(scenario, { preset: 'A', evidence: ['dashcam', 'paint'] });
console.log(s.events);                                  // the suspect's first line
const events = Interrogation.choose(s, Interrogation.options(s)[0]);
```

## A scenario at a glance

```js
{
  id: 'parking-scrape', lang: 'en',
  actors: { player: { name: 'You' }, suspect: { id: 'oh', name: 'Mr. Oh' } },
  zoneMeter: 'heat',
  meters: { heat: { zones: [ { id: 'calm', to: 39, habit: 'Twirls his car key.' }, ... ] }, patience: { visible: true } },
  nodeStances: ['agree', 'press', 'silence'],
  stances: { agree: { rules: [ { do: { patience: '+10' }, line: 'reply', move: 'same' } ] }, ... },
  evidence: { dashcam: { label: 'Dashcam still' }, s_late: { kind: 'said', label: '"I got home after 11"' } },
  revelations: [ { id: 'there', label: 'He parked at that time', line: '…Fine, I came in around eleven.' }, ... ],
  outcomes: [ { id: 'full', when: 'revealed>=3' }, { id: 'partial', when: 'revealed>=1' }, { id: 'fail', when: true } ],
  topics: [ { id: 'chat', nodes: [
    { id: 'c2', gate: true, line: 'I got in early last night. Nine-ish?',
      claim: { ev: ['dashcam', 's_late'], reveal: 'there', move: 'same', hit: { text: '…That, uh.' } },
      agree: { say: 'Early night, then.', reply: 'Yep.', move: 'stay' }, ... },
  ] } ],
}
```

Everything is optional except what a conversation needs: no ally, three stances or seven, any meters, any number
of outcomes. See **[docs/authoring.md](docs/authoring.md)** for the full guide and reference.

## What's here

| Path | |
|---|---|
| `src/interrogation.js` | The engine: state, rules, expressions, save/load, validation, simulation |
| `src/interrogation-view.js` | The default view (mobile-first, English and Korean interface text) |
| `src/interrogation-view.css` | Its styles |
| `scenarios/` | `office-envelope.js` (uses almost everything), `parking-scrape.js` (smallest), and Korean versions in `ko/` |
| `tools/check.js` | Validate and simulate scenarios |
| `tools/transcript.js` | Print one simulated game |
| `playground/` | Play, simulate, read transcripts in the browser |
| `test/` | Unit tests (`npm test`) |

## Commands

```
npm test                                                 # unit tests + check every scenario
node tools/check.js scenarios/my-scene.js --n 3000
node tools/transcript.js scenarios/office-envelope.js --preset B --noise 0.5 --seed 7
```

Requires Node 18 or newer for the tools and tests. The engine itself runs in any modern browser.

## Origin

Extracted from the confession scene of *21:40 — First Visit*, a Korean mystery game, where it was tuned through
playtesting. The lessons from that are at the end of the authoring guide.

## License

[MIT](LICENSE)
