/*!
 * Interrogation Engine — a data-driven engine for tense one-on-one conversations:
 * interrogations, confessions, negotiations, persuasion.
 *
 * The engine knows nothing about any particular story. Everything a scene needs
 * (lines, rules, numbers, outcomes) lives in a *scenario* object. The engine only
 * reads it and advances the conversation, emitting plain event objects that a view
 * (see interrogation-view.js) or your own UI can render.
 *
 * Works in the browser (window.Interrogation) and in Node (require).
 * MIT License.
 *
 * Core ideas (see docs/authoring.md for the full guide)
 *   meters      One "zone meter" with coloured zones (e.g. tension) plus any number of
 *               helper meters (e.g. rapport, suspicion). Each can be visible or hidden.
 *   topics      An ordered list of topics, each an ordered list of nodes. At every node the
 *   → nodes     suspect says a line and the player picks one *stance* (agree, press, ...).
 *               A picked line never comes back. Each stance has rules; the first rule
 *               whose condition holds is applied.
 *   claims      A node may be a lie (`claim`). Only the right evidence — or something the
 *               suspect said earlier (`gain`) — rebuts it. Presenting anything at the
 *               wrong moment is up to the scenario's evidence rules (usually: game over).
 *   gate        A gated node will not move on until its lie is rebutted, so the suspect
 *               only ever builds on what they have already admitted.
 *   ally        Optional partner who can be signalled a fixed number of times.
 *   after       Global rules checked after every turn (warnings, walk-outs, ...).
 *   outcomes    The first outcome whose condition holds when the conversation ends.
 *   expressions Small, safe expressions such as "rapport>=full_rapport && zone=='orange'".
 *               Parsed by hand — no eval. Supports && || ! == != < <= > >= + - * /,
 *               a ? b : c, and min max round abs floor ceil.
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. Expressions (hand-written parser, no eval)
   * ------------------------------------------------------------------ */

  const OPERATORS = ['&&', '||', '==', '!=', '>=', '<=', '>', '<', '+', '-', '*', '/', '!', '(', ')', '?', ':', ','];
  const PRECEDENCE = { '?': 1, '||': 2, '&&': 3, '==': 4, '!=': 4, '>=': 5, '<=': 5, '>': 5, '<': 5, '+': 6, '-': 6, '*': 7, '/': 7 };
  const FUNCTIONS = { min: Math.min, max: Math.max, round: Math.round, abs: Math.abs, floor: Math.floor, ceil: Math.ceil };
  // Identifiers may contain any letter (so scenarios can use names in any language).
  const IDENT_START = /[\p{L}_]/u;
  const IDENT_PART = /[\p{L}\p{N}_.]/u;

  function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < src.length && /[0-9.]/.test(src[j])) j++;
        tokens.push({ kind: 'number', value: parseFloat(src.slice(i, j)) });
        i = j;
        continue;
      }
      if (c === "'" || c === '"') {
        let j = i + 1;
        while (j < src.length && src[j] !== c) j++;
        if (j >= src.length) throw new Error('Unclosed string in expression: ' + src);
        tokens.push({ kind: 'string', value: src.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
      if (IDENT_START.test(c)) {
        let j = i;
        while (j < src.length && IDENT_PART.test(src[j])) j++;
        const word = src.slice(i, j);
        tokens.push(word === 'true' || word === 'false' ? { kind: 'bool', value: word === 'true' } : { kind: 'name', value: word });
        i = j;
        continue;
      }
      const op = OPERATORS.find((o) => src.startsWith(o, i));
      if (!op) throw new Error(`Unexpected character "${c}" in expression: ${src}`);
      tokens.push({ kind: 'op', value: op });
      i += op.length;
    }
    return tokens;
  }

  function parse(src) {
    const tokens = tokenize(src);
    let pos = 0;
    const peek = () => tokens[pos];
    const take = (expected) => {
      const t = tokens[pos];
      if (expected && (!t || t.value !== expected)) throw new Error(`Expected "${expected}" in expression: ${src}`);
      pos++;
      return t;
    };

    function primary() {
      const t = take();
      if (!t) throw new Error('Expression ends too early: ' + src);
      if (t.kind === 'number' || t.kind === 'string' || t.kind === 'bool') return { kind: 'literal', value: t.value };
      if (t.kind === 'name') {
        if (peek() && peek().value === '(') {
          take('(');
          const args = [];
          if (peek() && peek().value !== ')') {
            args.push(expression(0));
            while (peek() && peek().value === ',') { take(','); args.push(expression(0)); }
          }
          take(')');
          if (!FUNCTIONS[t.value]) throw new Error(`Unknown function "${t.value}" in expression: ${src}`);
          return { kind: 'call', fn: t.value, args };
        }
        return { kind: 'name', name: t.value };
      }
      if (t.value === '(') { const e = expression(0); take(')'); return e; }
      if (t.value === '!') return { kind: 'not', expr: primary() };
      if (t.value === '-') return { kind: 'negate', expr: primary() };
      throw new Error('Malformed expression: ' + src);
    }

    function expression(minPrecedence) {
      let left = primary();
      for (;;) {
        const op = peek();
        if (!op || op.kind !== 'op' || !(op.value in PRECEDENCE) || PRECEDENCE[op.value] < minPrecedence) break;
        take();
        if (op.value === '?') {
          const yes = expression(0);
          take(':');
          const no = expression(PRECEDENCE['?']);
          left = { kind: 'ternary', test: left, yes, no };
          continue;
        }
        const right = expression(PRECEDENCE[op.value] + 1);
        left = { kind: 'binary', op: op.value, left, right };
      }
      return left;
    }

    const ast = expression(0);
    if (pos < tokens.length) throw new Error('Unexpected text after expression: ' + src);
    return ast;
  }

  function evaluate(node, lookup) {
    switch (node.kind) {
      case 'literal': return node.value;
      case 'name': return lookup(node.name);
      case 'not': return !evaluate(node.expr, lookup);
      case 'negate': return -evaluate(node.expr, lookup);
      case 'ternary': return evaluate(node.test, lookup) ? evaluate(node.yes, lookup) : evaluate(node.no, lookup);
      case 'call': return FUNCTIONS[node.fn](...node.args.map((a) => evaluate(a, lookup)));
      case 'binary': {
        if (node.op === '&&') return evaluate(node.left, lookup) && evaluate(node.right, lookup);
        if (node.op === '||') return evaluate(node.left, lookup) || evaluate(node.right, lookup);
        const a = evaluate(node.left, lookup);
        const b = evaluate(node.right, lookup);
        switch (node.op) {
          case '==': return a == b; // eslint-disable-line eqeqeq -- scenario authors compare numbers and strings loosely
          case '!=': return a != b; // eslint-disable-line eqeqeq
          case '>=': return a >= b;
          case '<=': return a <= b;
          case '>': return a > b;
          case '<': return a < b;
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return a / b;
        }
      }
    }
    throw new Error('Unknown expression node: ' + node.kind);
  }

  const compiled = new Map();
  /** Compile a condition or value. `undefined`, `null` and `true` mean "always". */
  function compile(src) {
    if (src == null || src === true) return () => true;
    if (typeof src === 'number') return () => src;
    let fn = compiled.get(src);
    if (!fn) {
      const ast = parse(String(src));
      fn = (lookup) => evaluate(ast, lookup);
      compiled.set(src, fn);
    }
    return fn;
  }

  /* ------------------------------------------------------------------ *
   * 2. Small helpers over the state
   * ------------------------------------------------------------------ */

  const clampMeter = (meter, v) => Math.max(meter.min ?? 0, Math.min(meter.max ?? 100, v));
  const asArray = (x) => [].concat(x ?? []);

  function zoneOf(scn, v) {
    const zones = scn.meters[scn.zoneMeter].zones;
    return zones.find((z) => v <= z.to) || zones[zones.length - 1];
  }
  const currentZone = (s) => zoneOf(s.scn, s.m[s.scn.zoneMeter]);
  const topicOf = (s) => s.scn.topics[s.topic];
  const nodeOf = (s) => { const t = topicOf(s); return t && t.nodes[s.node]; };
  const isTalk = (opt) => opt.group === 'talk' && opt.stance !== 'ally';

  /**
   * Names an expression can use. Anything not listed falls back to scenario variables.
   *   <meter>          current value of any meter          full_<meter>   that meter's `full`
   *   flags.x          a flag (0 when unset)                 vars.x         a scenario variable
   *   revealed.x       was revelation x revealed?            used.x         was evidence x presented?
   *   opt.x            a field of the option being chosen    zone           id of the current zone
   *   turn / turns     turns taken / turn limit              warn           warnings so far
   *   revealed / total revelations so far / in total         allyUses       ally signals used
   *   topic / nodeId   current topic id / node id            node           node index
   *   lastStance       stance picked last turn               stance         stance being picked now
   *   claim            evidence ids that rebut the current lie (comma separated, '' if none)
   *   claimMatch       does the evidence being presented rebut the current lie?
   *   evKind           kind of the evidence being presented ('said' or 'item')
   */
  function lookupFor(s, opt, extra) {
    return (name) => {
      if (extra && name in extra) return extra[name];
      if (name in s.m) return s.m[name];
      if (name.startsWith('full_')) return s.scn.meters[name.slice(5)]?.full;
      if (name.startsWith('flags.')) return s.flags[name.slice(6)] ?? 0;
      if (name.startsWith('used.')) return s.used.has(name.slice(5));
      if (name.startsWith('vars.')) return s.vars[name.slice(5)];
      if (name.startsWith('opt.')) return opt ? opt[name.slice(4)] : undefined;
      if (name.startsWith('revealed.')) return s.revealed.has(name.slice(9));
      switch (name) {
        case 'zone': return currentZone(s).id;
        case 'turn': return s.turn;
        case 'turns': return s.max;
        case 'warn': return s.warn;
        case 'revealed': return s.revealed.size;
        case 'total': return s.scn.revelations.length;
        case 'allyUses': return s.allyUses;
        case 'topic': return topicOf(s)?.id;
        case 'topicIndex': return s.topic;
        case 'node': return s.node;
        case 'nodeId': return nodeOf(s)?.id || '';
        case 'lastStance': return s.last;
        case 'stance': return opt?.stance;
        case 'claim': return s.claim ? asArray(s.claim.ev).join(',') : '';
        case 'evKind': return opt && opt.ev ? (s.scn.evidence[opt.ev]?.kind || 'item') : '';
        case 'claimMatch':
          return !!(opt && opt.ev && s.claim && asArray(s.claim.ev).includes(opt.ev) && !s.revealed.has(s.claim.reveal));
      }
      if (name in s.vars) return s.vars[name];
      throw new Error('Unknown name in expression: ' + name);
    };
  }
  const test = (s, cond, opt, extra) => !!compile(cond)(lookupFor(s, opt, extra));
  const value = (s, src, opt, extra) => compile(src)(lookupFor(s, opt, extra));

  /* ------------------------------------------------------------------ *
   * 3. Creating a conversation
   * ------------------------------------------------------------------ */

  /**
   * Start a conversation.
   * @param scn       scenario object
   * @param options.preset   key of scn.presets (defaults to the first)
   * @param options.start    meter offsets added to the preset's start values
   * @param options.vars     scenario variables
   * @param options.evidence ids of the evidence the player brings (aliases are expanded)
   * @param options.rng      random number generator (only the simulator needs one)
   */
  function create(scn, { preset, start = {}, vars = {}, evidence = [], rng = Math.random } = {}) {
    const P = (preset && scn.presets[preset]) || Object.values(scn.presets)[0] || {};
    const s = {
      scn,
      presetId: preset,
      vars: { ...(scn.vars || {}), ...(P.vars || {}), ...vars },
      rng,
      m: {},                  // meter values
      turn: 0,
      max: P.turns ?? scn.limits.turns,
      warn: 0,
      topic: 0,               // index into scn.topics
      node: 0,                // index into the topic's nodes
      usedOpt: new Set(),     // talk options already picked ("topic:node:stance")
      revealed: new Set(),    // revelation ids
      used: new Set(),        // evidence ids already presented
      evidence: expandEvidence(scn, evidence),
      allyUses: 0,
      flags: {},
      last: null,             // last stance picked
      hist: [],               // zone-meter history, one entry per turn
      claim: null,            // the lie on the table, if any
      over: null,             // outcome id once finished
      events: [],             // events of the last step
      log: [],                // every event so far
    };
    for (const [k, meter] of Object.entries(scn.meters)) {
      let v = (P.start && P.start[k]) ?? meter.start ?? 0;
      if (start[k] != null) v += start[k];
      s.m[k] = clampMeter(meter, v);
    }
    s.hist.push(s.m[scn.zoneMeter]);
    enterNode(s, s.events, true, false);
    return s;
  }

  /** One document can count as several cards: evidenceAlias {log: ['log_p1','log_p2']} */
  const expandEvidence = (scn, list) => [...list].flatMap((e) => scn.evidenceAlias?.[e] || [e]);

  function emit(s, events, e) { events.push(e); s.log.push(e); }
  const moodFor = (s, mood) => mood || currentZone(s).mood;

  /**
   * Enter the current node: a narration when the topic changes (`topic.enter`), or a
   * rotating aside right after a revelation (`lines.afterReveal`), then the suspect's line.
   * A node line may be a string or a list of {when, text} variants.
   */
  function enterNode(s, events, first, topicChanged) {
    const n = nodeOf(s);
    if (!n) return;
    const t = topicOf(s);
    emit(s, events, { t: 'node', topic: t.id, node: s.node, first: !!first });
    if (s.flags.justRevealed && s.scn.lines?.afterReveal && !(topicChanged && t.enter)) {
      const aside = pickLine(s, '@afterReveal', {});
      if (aside) emit(s, events, { t: 'narr', text: aside.text });
    }
    if (topicChanged && t.enter) emit(s, events, { t: 'narr', text: t.enter });
    let line = n.line;
    if (Array.isArray(line)) line = line.find((x) => typeof x === 'string' || test(s, x.when));
    if (typeof line === 'string') line = { text: line };
    if (line) emit(s, events, { t: 'line', who: 'suspect', text: line.text, mood: moodFor(s, line.mood || n.mood) });
    s.claim = n.claim || null;
    if (s.claim) emit(s, events, { t: 'claim', ev: s.claim.ev });
  }

  /* ------------------------------------------------------------------ *
   * 4. What the player can do now
   * ------------------------------------------------------------------ */

  /**
   * Every choice available right now. Each option is
   *   { id, stance, label, text, v, group: 'talk' | 'evidence', ev? }
   * Pass one of them (or its id) to choose().
   */
  function options(s) {
    if (s.over) return [];
    const n = nodeOf(s);
    if (!n) return [];
    const out = [];
    const key = `${s.topic}:${s.node}:`;
    for (const stance of s.scn.nodeStances) {
      if (!n[stance] || s.usedOpt.has(key + stance)) continue;
      const def = s.scn.stances[stance];
      out.push({ id: key + stance, stance, label: def.label, text: n[stance].say ?? def.say ?? '', v: n[stance].v, group: 'talk' });
    }
    const ally = s.scn.ally;
    if (ally && !s.flags.allyOut) {
      const use = ally.uses[s.allyUses];
      if (use && test(s, use.when)) {
        out.push({ id: 'ally', stance: 'ally', label: use.label || ally.label, text: use.prompt || ally.prompt, v: value(s, use.v ?? 0), group: 'talk' });
      }
    }
    for (const id of s.evidence) {
      if (s.used.has(id) && !s.scn.evidenceReusable) continue;
      const e = s.scn.evidence[id];
      if (!e) continue;
      out.push({ id: 'ev:' + id, stance: 'evidence', ev: id, label: e.label, text: e.desc, v: e.v ?? 0, group: 'evidence' });
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 5. Effects
   * ------------------------------------------------------------------ */

  /** Number specs: 5 adds 5; "+expr" / "-expr" add / subtract; "=expr" sets. */
  function applyNumber(cur, spec, s, opt) {
    if (typeof spec === 'number') return cur + spec;
    const str = String(spec).trim();
    const op = str[0];
    const body = str.slice(1);
    if (op === '=') return value(s, body, opt);
    if (op === '+') return cur + value(s, body, opt);
    if (op === '-') return cur - value(s, body, opt);
    return cur + value(s, str, opt);
  }

  function changeMeters(s, changes, opt) {
    for (const [k, spec] of Object.entries(changes || {})) {
      const meter = s.scn.meters[k];
      if (!meter) throw new Error('Unknown meter: ' + k);
      s.m[k] = clampMeter(meter, applyNumber(s.m[k], spec, s, opt));
    }
  }
  function changeFlags(s, changes, opt) {
    for (const [k, spec] of Object.entries(changes || {})) s.flags[k] = applyNumber(s.flags[k] || 0, spec, s, opt);
  }

  /**
   * Resolve a line reference:
   *   "reply", "burst", ...  a field of the picked stance at the current node
   *   "@pool"                scn.lines.pool
   *   "claim.hit"            the current lie's `hit` (or `hitBy[evidenceId]`)
   * A list of strings rotates; a list of {when, text} picks the first that matches.
   */
  function pickLine(s, ref, opt) {
    if (!ref) return null;
    let line;
    if (ref.startsWith('@')) {
      line = s.scn.lines[ref.slice(1)];
    } else if (ref.startsWith('claim.')) {
      const field = ref.slice(6);
      line = s.claim && ((opt && opt.ev && s.claim[field + 'By'] && s.claim[field + 'By'][opt.ev]) || s.claim[field]);
    } else {
      const n = nodeOf(s);
      line = n && n[opt.stance] && n[opt.stance][ref];
    }
    if (line == null) return null;
    if (Array.isArray(line)) {
      if (line.length && typeof line[0] === 'object' && 'text' in line[0]) return line.find((x) => test(s, x.when, opt)) || null;
      const k = 'rot:' + ref;
      s.flags[k] = s.flags[k] || 0;
      const x = line[s.flags[k] % line.length];
      s.flags[k]++;
      return typeof x === 'string' ? { text: x } : x;
    }
    return typeof line === 'string' ? { text: line } : line;
  }

  /** A line object may carry narr (before), text, after (narration after) and note. */
  function say(s, events, line, who, mood) {
    if (!line) return;
    if (line.narr) emit(s, events, { t: 'narr', text: line.narr });
    if (line.text) emit(s, events, { t: 'line', who: line.who || who, text: line.text, mood: moodFor(s, line.mood || mood) });
    if (line.after) emit(s, events, { t: 'narr', text: line.after });
    if (line.note) emit(s, events, { t: 'note', text: line.note });
  }

  /**
   * Apply one rule. A rule may have:
   *   do {meter: spec}   flag {name: spec}   sfx   shake   line   mood   narr
   *   warn n   lose n (extra turns)   move   reveal   end
   */
  function applyRule(s, events, rule, opt, turn) {
    changeMeters(s, rule.do, opt);
    changeFlags(s, rule.flag, opt);
    if (rule.move === 'claim' && s.claim && s.claim.do) changeMeters(s, s.claim.do, opt);
    if (rule.sfx) emit(s, events, { t: 'sfx', id: rule.sfx });
    if (rule.shake) emit(s, events, { t: 'shake' });
    if (rule.line) say(s, events, pickLine(s, rule.line, opt), 'suspect', rule.mood);
    if (rule.narr) emit(s, events, { t: 'narr', text: rule.narr });
    if (rule.warn) { s.warn += rule.warn; emit(s, events, { t: 'warn', n: s.warn }); }
    if (rule.lose) turn.lose += rule.lose;
    if (rule.move) turn.move = rule.move === 'claim' ? (s.claim?.move || 'same') : rule.move;
    if (rule.reveal) reveal(s, events, rule.reveal);
    if (rule.end) turn.end = rule.end;
  }
  const firstRule = (s, rules, opt, extra) => (rules || []).find((r) => test(s, r.when, opt, extra));

  /* ------------------------------------------------------------------ *
   * 6. Revelations
   * ------------------------------------------------------------------ */

  /** `how` is 'claim' (the lie just rebutted) or a revelation id ('id:x' or 'x'). */
  function reveal(s, events, how) {
    let r;
    if (how === 'claim') {
      r = s.claim && s.scn.revelations.find((x) => x.id === s.claim.reveal);
      if (!r || s.revealed.has(r.id)) return false;
      s.claim = null;
    } else {
      const id = String(how).replace(/^id:/, '');
      r = s.scn.revelations.find((x) => x.id === id);
    }
    if (!r || s.revealed.has(r.id)) return false;
    if (r.when && !test(s, r.when)) return false;
    s.revealed.add(r.id);
    s.flags.justRevealed = 1;
    emit(s, events, { t: 'reveal', id: r.id, index: s.scn.revelations.indexOf(r), label: r.label, via: how });
    say(s, events, { text: r.line, mood: r.mood }, 'suspect');
    if (r.after) say(s, events, r.after, 'suspect');
    return true;
  }

  /* ------------------------------------------------------------------ *
   * 7. One turn
   * ------------------------------------------------------------------ */

  /** Pick an option (object or id). Returns the events of this turn. */
  function choose(s, optOrId) {
    if (s.over) return [];
    const events = [];
    s.events = events;
    const opt = typeof optOrId === 'string' ? options(s).find((o) => o.id === optOrId) : optOrId;
    if (!opt) throw new Error('Not available right now: ' + optOrId);
    const scn = s.scn;
    const turn = { lose: 0, move: null, end: null };
    s.flags.justRevealed = 0;
    if (isTalk(opt)) s.usedOpt.add(opt.id);

    // The player's move.
    if (opt.stance === 'ally') {
      const use = scn.ally.uses[s.allyUses] || {};
      emit(s, events, { t: 'narr', text: use.cue || scn.ally.cue });
      emit(s, events, { t: 'line', who: 'ally', text: use.say || scn.ally.say });
    } else if (opt.stance === 'evidence') {
      const item = scn.evidence[opt.ev];
      s.used.add(opt.ev);
      emit(s, events, { t: 'present', ev: opt.ev, label: item.label });
      if (scn.lines?.presentNarr) emit(s, events, { t: 'narr', text: scn.lines.presentNarr.replace('{label}', item.label) });
    } else {
      const def = scn.stances[opt.stance];
      if (def.narr) emit(s, events, { t: 'narr', text: def.narr });
      else emit(s, events, { t: 'line', who: 'player', text: nodeOf(s)[opt.stance].say ?? def.say });
    }

    // Which rules apply: the ally use's, the evidence rules, the node's own, or the stance's.
    const node = nodeOf(s);
    const nodeOpt = isTalk(opt) ? node[opt.stance] : null;
    let rules;
    if (opt.stance === 'ally') rules = scn.ally.uses[s.allyUses]?.rules || scn.ally.rules;
    else if (opt.stance === 'evidence') rules = scn.evidenceRules?.rules;
    else rules = nodeOpt.rules || scn.stances[opt.stance].rules;

    if (nodeOpt) changeFlags(s, nodeOpt.flag, opt);
    if (opt.stance === 'ally') changeFlags(s, scn.ally.flag, opt);
    const rule = firstRule(s, rules, opt, {});
    if (rule) applyRule(s, events, rule, opt, turn);

    // Something the suspect said is written down — only if they actually said it.
    if (nodeOpt && rule && (rule.line === 'reply' || rule.gain)) {
      for (const g of asArray(nodeOpt.gain)) {
        if (scn.evidence[g] && !s.evidence.includes(g)) {
          s.evidence.push(g);
          emit(s, events, { t: 'gain', ev: g, label: scn.evidence[g].label, quote: scn.evidence[g].desc });
        }
      }
    }
    if (nodeOpt && turn.move && nodeOpt.move) turn.move = nodeOpt.move; // per-line move override
    if (nodeOpt && nodeOpt.claim && (!turn.move || turn.move === 'stay')) {   // a reply that is itself a lie
      s.claim = nodeOpt.claim;
      emit(s, events, { t: 'claim', ev: nodeOpt.claim.ev });
    }
    if (turn.move === 'stay') turn.move = null;

    // When every talk option at this node is used up, move on — unless a gate still holds.
    if (!turn.move && !turn.end && opt.group === 'talk') {
      const n = nodeOf(s);
      const gated = n && n.gate && s.claim;
      const left = n && scn.nodeStances.some((k) => n[k] && !s.usedOpt.has(`${s.topic}:${s.node}:${k}`));
      if (n && !gated && !left) turn.move = 'same';
    }
    if (opt.stance === 'ally') s.allyUses++;
    s.last = opt.stance;

    // Global rules: all that match (no interjections once the conversation is ending).
    for (const g of scn.after || []) {
      if (turn.end && (g.line || g.warn)) continue;
      if (test(s, g.when, opt)) applyRule(s, events, g, opt, turn);
    }

    if (turn.move) move(s, events, turn);

    s.turn += 1 + turn.lose;
    s.hist.push(s.m[scn.zoneMeter]);

    const ranOut = !nodeOf(s);
    const allFound = s.revealed.size >= scn.revelations.length;
    const tooManyWarnings = s.warn >= scn.limits.warn;
    if (allFound || turn.end || tooManyWarnings || s.turn >= s.max || ranOut) {
      const named = turn.end && scn.outcomes.some((o) => o.id === turn.end);
      s.over = named ? turn.end : (scn.outcomes.find((o) => test(s, o.when)) || {}).id || 'end';
      const why = allFound ? 'all' : turn.end || (tooManyWarnings ? 'warn' : ranOut ? 'script' : 'time');
      emit(s, events, { t: 'end', outcome: s.over, why });
    } else if (turn.move) {
      enterNode(s, events, false, events.some((e) => e.t === 'move' && e.changed));
    }
    return events;
  }

  /** Moves: 'same' (next node), 'next' (next topic), 'topic:id', 'node:id', 'stay'. */
  function move(s, events, turn) {
    const scn = s.scn;
    const before = s.topic;
    const m = turn.move;
    if (m === 'same') {
      s.node++;
      if (s.node >= topicOf(s).nodes.length) { s.topic++; s.node = 0; }
    } else if (m === 'next') {
      s.topic++; s.node = 0;
    } else if (m.startsWith('topic:')) {
      const ti = scn.topics.findIndex((t) => t.id === m.slice(6));
      if (ti >= 0) { s.topic = ti; s.node = 0; }
    } else if (m.startsWith('node:')) {
      const id = m.slice(5);
      for (let ti = 0; ti < scn.topics.length; ti++) {
        const ni = scn.topics[ti].nodes.findIndex((n) => n.id === id);
        if (ni >= 0) { s.topic = ti; s.node = ni; break; }
      }
    }
    emit(s, events, { t: 'move', changed: s.topic !== before });
    const t = topicOf(s);
    if (t && t.requires && !test(s, t.requires)) {   // a locked topic ends the conversation
      if (t.blocked) say(s, events, t.blocked, 'suspect');
      turn.end = turn.end || 'blocked';
    }
  }

  /* ------------------------------------------------------------------ *
   * 8. Save and load
   * ------------------------------------------------------------------ */

  const SAVE_VERSION = 2;
  function serialize(s) {
    return {
      v: SAVE_VERSION, scn: s.scn.id, preset: s.presetId, vars: s.vars, m: s.m, turn: s.turn, max: s.max, warn: s.warn,
      topic: s.topic, node: s.node, usedOpt: [...s.usedOpt], revealed: [...s.revealed], used: [...s.used],
      evidence: s.evidence, allyUses: s.allyUses, flags: s.flags, last: s.last, hist: s.hist, over: s.over,
      claim: s.claim || null, log: s.log,
    };
  }
  function restore(scn, data, rng = Math.random) {
    if (!data || !(data.v === 1 || data.v === SAVE_VERSION)) throw new Error('Unsupported save version: ' + (data && data.v));
    if (data.scn && scn.id && data.scn !== scn.id) throw new Error(`Save is for scenario "${data.scn}", not "${scn.id}"`);
    const s = create(scn, { preset: data.preset, vars: data.vars, evidence: data.evidence, rng });
    Object.assign(s, {
      m: data.m, turn: data.turn, max: data.max, warn: data.warn, topic: data.topic, node: data.node,
      usedOpt: new Set(data.usedOpt), revealed: new Set(data.revealed), used: new Set(data.used),
      allyUses: data.allyUses, flags: data.flags, last: data.last, hist: data.hist, over: data.over,
      claim: data.claim || null, events: [], log: data.log || [],
    });
    return s;
  }

  /* ------------------------------------------------------------------ *
   * 9. Validation — catch authoring mistakes before anyone plays
   * ------------------------------------------------------------------ */

  function validate(scn) {
    const errors = [];
    const check = (src, where) => {
      try { if (typeof src === 'string') parse(src); } catch (e) { errors.push(`${where}: ${e.message}`); }
    };
    const zm = scn.meters && scn.meters[scn.zoneMeter];
    if (!zm) errors.push('zoneMeter does not name a meter');
    else if (!zm.zones?.length) errors.push('the zone meter has no zones');
    else {
      let prev = (zm.min ?? 0) - 1;
      for (const z of zm.zones) { if (!(z.to > prev)) errors.push('zones out of order at ' + z.id); prev = z.to; }
    }
    const stances = scn.nodeStances || [];
    for (const k of stances) if (!scn.stances?.[k]) errors.push('no definition for stance ' + k);
    if (!scn.topics?.length) errors.push('no topics');
    if (!scn.outcomes?.length) errors.push('no outcomes');

    const shown = new Set();
    for (const t of scn.topics || []) {
      if (!t.nodes?.length) errors.push(`topic ${t.id}: no nodes`);
      check(t.requires, `topic ${t.id} requires`);
      (t.nodes || []).forEach((n, ni) => {
        const at = `${t.id}[${n.id || ni}]`;
        if (!n.line) errors.push(`${at}: no line`);
        for (const k of stances) {
          if (!n[k]) { errors.push(`${at}: no ${k} option`); continue; }
          for (const f of scn.stances[k]?.needs || []) if (n[k][f] == null) errors.push(`${at}.${k}: missing ${f}`);
          for (const g of asArray(n[k].gain)) if (!scn.evidence?.[g]) errors.push(`${at}.${k}: gain names unknown evidence ${g}`);
          for (const r of n[k].rules || []) {
            check(r.when, `${at}.${k} rule`);
            if (typeof r.reveal === 'string' && r.reveal !== 'claim') shown.add(r.reveal.replace(/^id:/, ''));
            if (r.line && r.line.startsWith('@') && !scn.lines?.[r.line.slice(1)]) errors.push(`${at}.${k}: unknown line pool ${r.line}`);
          }
        }
        if (n.claim) {
          if (n.claim.reveal) shown.add(n.claim.reveal);
          if (!asArray(n.claim.ev).every((e) => scn.evidence?.[e])) errors.push(`${at}: claim names unknown evidence ${n.claim.ev}`);
        }
        if (Array.isArray(n.line)) for (const x of n.line) if (typeof x === 'object') check(x.when, `${at} line`);
      });
    }
    const ids = new Set(scn.revelations.map((r) => r.id));
    for (const id of shown) if (!ids.has(id)) errors.push('unknown revelation ' + id);
    for (const r of scn.revelations) {
      if (!shown.has(r.id)) errors.push('revelation is never reached: ' + r.id);
      check(r.when, 'revelation ' + r.id);
    }
    for (const [k, list] of Object.entries(scn.evidenceAlias || {})) for (const e of list) if (!scn.evidence?.[e]) errors.push(`evidenceAlias ${k}: unknown evidence ${e}`);

    const ruleSets = [
      ...Object.entries(scn.stances || {}).map(([k, v]) => [k, v.rules]),
      ['evidence', scn.evidenceRules?.rules],
      ['ally', scn.ally?.rules],
      ...(scn.ally?.uses || []).map((u, i) => [`ally use ${i + 1}`, u.rules]),
      ['after', scn.after],
    ];
    for (const [k, rules] of ruleSets) {
      for (const r of rules || []) {
        check(r.when, k + ' rule');
        if (r.line && r.line.startsWith('@') && !scn.lines?.[r.line.slice(1)]) errors.push(`${k} rule: unknown line pool ${r.line}`);
        for (const [m, v] of Object.entries(r.do || {})) {
          if (!scn.meters?.[m]) errors.push(`${k} rule: unknown meter ${m}`);
          if (typeof v === 'string') check(v.replace(/^[=+-]/, ''), k + ' rule effect');
        }
      }
    }
    for (const u of scn.ally?.uses || []) check(u.when, 'ally use');
    for (const o of scn.outcomes || []) check(o.when, 'outcome ' + o.id);
    for (const p of scn.sim?.policy || []) check(p.when, 'sim policy');
    return errors;
  }

  /* ------------------------------------------------------------------ *
   * 10. Simulation — play many games with a policy to measure outcomes
   * ------------------------------------------------------------------ */

  /** Small, fast, seedable random number generator. */
  function rngOf(seed) {
    let x = seed >>> 0;
    return () => ((x = (Math.imul(x ^ (x >>> 15), 2246822507) + 0x6D2B79F5) >>> 0) / 4294967296);
  }

  /**
   * Pick an option the way a policy says.
   *   policy  list of { when, pick: [stance | 'evidence:claim' ...], pre?, chance? }
   *   noise   chance of picking a random talk option instead (a first-time player)
   * Rules with pre:true are looked at before the noise roll (an obvious chance, such as
   * holding the evidence that rebuts the lie on the table), each with its own chance.
   */
  function policyPick(s, policy, rng, noise) {
    const opts = options(s);
    if (!opts.length) return null;
    const T = s.m[s.scn.zoneMeter];
    const find = (k) => (k === 'evidence:claim'
      ? opts.find((o) => o.stance === 'evidence' && test(s, 'claimMatch', o))
      : opts.find((o) => o.stance === k));
    for (const rule of policy) {
      if (!rule.pre || !test(s, rule.when, null, { T })) continue;
      if (rng() >= (rule.chance ?? 1)) continue;
      for (const k of rule.pick) { const o = find(k); if (o) return o; }
    }
    if (rng() < noise) { // a guess: never presents evidence (that can end the game)
      const talk = opts.filter(isTalk);
      return talk[Math.floor(rng() * talk.length)] || opts[0];
    }
    const extra = { T, pressV: find('press')?.v ?? 99, allyV: find('ally')?.v ?? 99 };
    for (const rule of policy) {
      if (!test(s, rule.when, null, extra)) continue;
      for (const k of rule.pick) { const o = find(k); if (o) return o; }
    }
    return opts[0];
  }

  function simulate(scn, { preset, start, vars, evidence, policy, noise = 0.2, n = 1000, seed = 1 } = {}) {
    const count = {};
    for (const o of scn.outcomes) count[o.id] = 0;
    let turns = 0;
    const pol = policy || scn.sim.policy;
    for (let i = 0; i < n; i++) {
      const rng = rngOf(seed * 7919 + i * 104729);
      const s = create(scn, {
        preset,
        start: typeof start === 'function' ? start(i) : start,
        vars: typeof vars === 'function' ? vars(i) : vars,
        evidence,
        rng,
      });
      let guard = 0;
      while (!s.over && guard++ < 200) {
        const o = policyPick(s, pol, rng, noise);
        if (!o) break;
        choose(s, o);
      }
      count[s.over] = (count[s.over] || 0) + 1;
      turns += s.turn;
    }
    const pct = {};
    for (const k in count) pct[k] = (count[k] / n) * 100;
    return { count, pct, avgTurns: turns / n };
  }

  /* ------------------------------------------------------------------ */

  const api = {
    version: '1.0.0',
    create, options, choose, serialize, restore, validate, simulate, policyPick, rngOf,
    zoneOf, topicOf, nodeOf, test, value, parse,
    scenarios: {},
    register(scn) { api.scenarios[scn.id] = scn; return scn; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Interrogation = api;
})(typeof window !== 'undefined' ? window : globalThis);
