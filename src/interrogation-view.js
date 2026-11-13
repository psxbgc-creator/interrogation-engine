/*!
 * Interrogation Engine — default view (InterrogationView)
 * Renders the events the engine emits. Names, colours, zones and lines all come from the
 * scenario; game-specific pieces (portraits, sounds, background, icons) come from `host`.
 *
 *   InterrogationView.open({ scenario, preset, start, vars, evidence, host, lang })
 *     → Promise<{ outcome, why, revealed, count, state }>
 *
 *   host (all optional):
 *     bust(actorId, mood) → image URL     portrait of the suspect for a mood
 *     bg                  → image URL     background image
 *     paintBg(canvas)                     draw a background when there is no image
 *     icon(spec)          → image URL     icon for an evidence item (evidence[x].icon)
 *     sfx(id)                             play a sound ('click', 'thud', 'phone', ...)
 *     onEvent(event, api)                 see every event as it is shown
 *     fast: true                          no pauses (tests)
 *
 * Interface text comes from InterrogationView.strings[lang], then scenario.ui overrides it.
 * Requires interrogation-view.css. MIT License.
 */
(function (root) {
  'use strict';

  const STRINGS = {
    en: {
      dialogLabel: 'Conversation',
      meterLabel: 'Tension',
      turnsLeft: 'Turns left',
      recorded: 'Recorded',
      detectiveMode: 'tap for detective mode (hide the meter)',
      showMeter: 'Show the meter',
      talkTab: 'Talk',
      evidenceTab: 'Evidence',
      saidTab: 'Their words',
      talkEmpty: 'Nothing more to say.',
      evidenceEmpty: 'You brought no evidence.',
      silence: '(Wait in silence)',
      allySignal: 'Signal {ally}',
      allyDone: '{ally}: no signals left',
      usedMark: 'already shown',
      gained: '✎ Noted — {label}',
      confirm: 'Show this now? Unless it rebuts a lie, the conversation ends. You can only show it once.',
      confirmYes: 'Show it',
      confirmNo: 'Not yet',
      continue: 'Continue',
      rotateTitle: 'Please turn your phone upright',
      rotateText: 'This scene only works in portrait.',
      end: { full: 'Everything is on the record.', partial: '{n} pieces on the record.', fail: 'The conversation is over.' },
    },
    ko: {
      dialogLabel: '대화',
      meterLabel: '심리선',
      turnsLeft: '남은 턴',
      recorded: '녹음',
      detectiveMode: '누르면 탐정 모드(계기를 숨김)',
      showMeter: '계기 보기',
      talkTab: '대화',
      evidenceTab: '증거',
      saidTab: '그가 한 말',
      talkEmpty: '더 할 말이 없다.',
      evidenceEmpty: '가져온 증거가 없다.',
      silence: '(말없이 기다린다)',
      allySignal: '{ally}에게 신호',
      allyDone: '{ally} 신호 · 끝',
      usedMark: '냈던 것',
      gained: '✎ 수첩에 적었다 — {label}',
      confirm: '지금 이걸 내밀까? 거짓말을 반박할 때가 아니면 대화가 끝난다. 한 번 내면 다시 못 낸다.',
      confirmYes: '내민다',
      confirmNo: '그만둔다',
      continue: '계속',
      rotateTitle: '폰을 세로로 돌려 주세요',
      rotateText: '이 장면은 세로 화면에서만 할 수 있어요.',
      end: { full: '모든 조각이 녹음됐다.', partial: '녹음된 조각은 {n}개.', fail: '대화가 끝났다.' },
    },
  };

  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

  const PHONE_ICON = '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"></rect><path d="M11 18.5h2"></path></svg>';
  const HIDE_METER_KEY = 'interrogation-hide-meter';

  function open({ scenario: S, preset, start, vars, evidence = [], host = {}, lang }) {
    return new Promise((resolve) => {
      const I = root.Interrogation;
      const s = I.create(S, { preset, start, vars, evidence });
      const language = lang || S.lang || 'en';
      const base = STRINGS[language] || STRINGS.en;
      const ui = { ...base, ...(S.ui || {}), end: { ...base.end, ...((S.ui || {}).end || {}) } };
      const A = S.actors;
      const zoneMeter = S.meters[S.zoneMeter];
      const names = { player: A.player.name, suspect: A.suspect.name, ally: A.ally?.name };

      let busy = false;
      let tab = 'talk';
      let hideMeter = false;
      try { hideMeter = localStorage.getItem(HIDE_METER_KEY) === '1'; } catch (e) { /* storage may be blocked */ }

      /* ---------- layout ---------- */
      const ov = el('section', 'ie-overlay');
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-label', S.title || ui.dialogLabel);
      ov.lang = language;
      document.body.append(ov);
      document.body.classList.add('ie-open');
      const bg = host.bg || null;
      ov.innerHTML = `
        <div class="ie-wrap">
          <div class="ie-stage">
            ${bg ? `<img class="ie-bg" src="${esc(bg)}" alt="">` : '<canvas class="ie-bg" width="1280" height="720"></canvas>'}
            <img class="ie-bust" alt="" hidden>
            <div class="ie-top">
              <div class="ie-rec" role="img"><i></i><b>REC</b><span class="ie-tape"></span></div>
              <div class="ie-turn"></div>
            </div>
            <button type="button" class="ie-therm" aria-pressed="false">
              <span class="ie-tw"><span class="ie-tube"></span><i class="ie-mark"></i></span>
              <small>${esc(zoneMeter.label || ui.meterLabel)}</small>
            </button>
            <div class="ie-meters"></div>
            <div class="ie-habit"></div>
            <div class="ie-toast" hidden></div>
          </div>
          <div class="ie-log" aria-live="polite"></div>
          <div class="ie-rotate" role="alert">${PHONE_ICON}<p>${esc(ui.rotateTitle)}</p><small>${esc(ui.rotateText)}</small></div>
          <div class="ie-sheet">
            <div class="ie-grip"></div>
            <div class="ie-tabs" role="tablist">
              <button type="button" data-tab="talk" role="tab">${esc(ui.talkTab)}</button>
              <button type="button" data-tab="evidence" role="tab">${esc(ui.evidenceTab)} · ${esc(ui.saidTab)} <b class="ie-count"></b></button>
            </div>
            <div class="ie-cards"></div>
            <div class="ie-foot"></div>
          </div>
        </div>`;
      const q = (sel) => ov.querySelector(sel);
      const bust = q('.ie-bust');
      const logEl = q('.ie-log');
      if (!bg && host.paintBg) host.paintBg(q('canvas.ie-bg'));

      const wait = (ms) => new Promise((r) => setTimeout(r, host.fast ? 0 : ms));
      const pace = (text) => wait(500 + Math.min(1400, String(text).length * 24));
      function face(mood) {
        const src = host.bust && host.bust(A.suspect.id, mood);
        if (src) { bust.src = src; bust.hidden = false; }
      }

      /* ---------- the log stays pinned to the newest line unless the player scrolls up ---------- */
      let pinned = true;
      const stick = () => { if (pinned) logEl.scrollTop = logEl.scrollHeight; };
      logEl.addEventListener('scroll', () => { pinned = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 48; }, { passive: true });
      if (root.ResizeObserver) new ResizeObserver(stick).observe(logEl);
      function add(cls, who, text) {
        logEl.querySelectorAll('.ie-msg.now').forEach((x) => x.classList.remove('now'));
        logEl.append(el('div', 'ie-msg now ' + cls, (who ? `<b>${esc(who)}</b>` : '') + `<span>${esc(text)}</span>`));
        while (logEl.children.length > 80) logEl.firstChild.remove();
        pinned = true;
        stick();
        requestAnimationFrame(stick);
      }

      /* ---------- status: recorder tape, turns, warnings, meter, visible helper meters, habit ---------- */
      const lo = zoneMeter.min ?? 0;
      const hi = zoneMeter.max ?? 100;
      const pct = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
      q('.ie-tube').innerHTML = zoneMeter.zones.slice().reverse().map((z, i, list) => {
        const below = list[i + 1] ? list[i + 1].to : lo;
        return `<i style="height:${pct(z.to) - pct(below)}%;background:${esc(z.color)}"></i>`;
      }).join('');

      function habit() {
        for (const [k, m] of Object.entries(S.meters)) for (const cue of m.cues || []) if (s.m[k] >= cue.at) return cue.habit;
        return I.zoneOf(S, s.m[S.zoneMeter]).habit || '';
      }

      function status() {
        const zone = I.zoneOf(S, s.m[S.zoneMeter]);
        const left = Math.max(0, s.max - s.turn);
        const turnEl = q('.ie-turn');
        turnEl.textContent = `${ui.turnsLeft} ${left}` + (s.warn ? `  ⚠ ${s.warn}/${S.limits.warn}` : '');
        turnEl.classList.toggle('low', left <= 3 || s.warn >= S.limits.warn - 1);

        q('.ie-tape').innerHTML = S.revelations.map((r) => `<i class="${s.revealed.has(r.id) ? 'on' : ''}"></i>`).join('');
        const found = S.revelations.filter((r) => s.revealed.has(r.id)).map((r) => r.label);
        q('.ie-rec').setAttribute('aria-label', `${ui.recorded} ${s.revealed.size}/${S.revelations.length}` + (found.length ? ': ' + found.join(', ') : ''));

        const therm = q('.ie-therm');
        therm.classList.toggle('off', hideMeter);
        therm.setAttribute('aria-pressed', hideMeter);
        therm.setAttribute('aria-label', hideMeter ? ui.showMeter : `${zoneMeter.label || ui.meterLabel}: ${zone.label}. ${ui.detectiveMode}`);
        q('.ie-mark').style.bottom = `calc(${pct(s.m[S.zoneMeter])}% - 1.5px)`;

        q('.ie-meters').innerHTML = Object.entries(S.meters)
          .filter(([k, m]) => k !== S.zoneMeter && m.visible)
          .map(([k, m]) => {
            const full = m.full ?? m.max ?? 100;
            const dots = Math.round((Math.min(s.m[k], full) / full) * 5);
            const bar = Array.from({ length: 5 }, (_, i) => `<i class="${i < dots ? 'on' : ''}"></i>`).join('');
            return `<span>${esc(m.label)}${s.m[k] >= full ? ' ✓' : ''}</span><span class="ie-dots" aria-label="${esc(m.label)} ${dots}/5">${bar}</span>`;
          }).join('');
        const h = habit();
        q('.ie-habit').textContent = h ? '— ' + h : '';
        q('.ie-habit').hidden = !h;
        q('.ie-count').textContent = s.evidence.length || '';
      }

      q('.ie-therm').onclick = () => {
        hideMeter = !hideMeter;
        try { localStorage.setItem(HIDE_METER_KEY, hideMeter ? '1' : '0'); } catch (e) { /* ignore */ }
        status();
      };
      q('.ie-tabs').onclick = (e) => {
        const b = e.target.closest('button[data-tab]');
        if (!b || busy) return;
        tab = b.dataset.tab;
        cards();
      };

      /* ---------- the sheet: talk options (silence and ally pinned at the bottom) or evidence ---------- */
      function cards() {
        const box = q('.ie-cards');
        const foot = q('.ie-foot');
        box.innerHTML = '';
        foot.innerHTML = '';
        box.scrollTop = 0;
        q('.ie-tabs').querySelectorAll('button').forEach((b) => {
          b.classList.toggle('on', b.dataset.tab === tab);
          b.setAttribute('aria-selected', b.dataset.tab === tab);
        });
        const opts = I.options(s);
        if (s.over) return;
        if (tab === 'talk') renderTalk(box, foot, opts);
        else renderEvidence(box, opts);
        stick();
      }

      function renderTalk(box, foot, opts) {
        const talk = opts.filter((o) => o.group === 'talk' && o.stance !== 'silence' && o.stance !== 'ally');
        if (!talk.length) box.append(el('p', 'ie-empty', esc(ui.talkEmpty)));
        for (const o of talk) {
          const label = ui.showStances ? `<span class="ie-kind">${esc(o.label)}</span>` : '';
          const b = el('button', 'ie-line k-' + o.stance, `${label}<span class="ie-text">${esc(o.text)}</span>`);
          b.type = 'button';
          b.onclick = () => act(o);
          box.append(b);
        }
        if (S.nodeStances.includes('silence')) {
          const sil = opts.find((o) => o.stance === 'silence');
          const b = el('button', 'ie-btn k-silence', esc(sil?.text || ui.silence));
          b.type = 'button';
          b.disabled = !sil;
          if (sil) b.onclick = () => act(sil);
          foot.append(b);
        }
        if (S.ally) {
          const ally = opts.find((o) => o.stance === 'ally');
          const done = s.flags.allyOut || s.allyUses >= (S.ally.uses?.length || 0);
          const text = ally ? ally.text : fill(done ? ui.allyDone : ui.allySignal, { ally: names.ally || '' });
          const b = el('button', 'ie-btn k-ally', esc(text));
          b.type = 'button';
          b.disabled = !ally;
          if (ally) b.onclick = () => act(ally);
          foot.append(b);
        }
        foot.classList.toggle('one', foot.children.length === 1);
      }

      function renderEvidence(box, opts) {
        // Unused items first, then unused "their words", then everything already shown.
        const order = (id) => (s.used.has(id) ? 2 : 0) + (S.evidence[id]?.kind === 'said' ? 1 : 0);
        const ids = s.evidence.slice().sort((a, b) => order(a) - order(b));
        if (!ids.length) box.append(el('p', 'ie-empty', esc(ui.evidenceEmpty)));
        for (const id of ids) {
          const it = S.evidence[id];
          if (!it) continue;
          const said = it.kind === 'said';
          const used = s.used.has(id);
          const o = opts.find((x) => x.ev === id);
          const icon = !said && host.icon && host.icon(it.icon);
          const tag = [said ? ui.saidTab : '', used ? ui.usedMark : ''].filter(Boolean).join(' · ');
          const b = el('button', 'ie-ev' + (said ? ' k-said' : '') + (used ? ' used' : ''),
            `${icon ? `<img class="ie-evimg" src="${esc(icon)}" alt="">` : ''}` +
            `<span class="ie-evname">${tag ? `<span class="ie-kind">${esc(tag)}</span>` : ''}` +
            `<span class="ie-text">${esc(it.label)}</span><small>${esc(it.desc || '')}</small></span>`);
          b.type = 'button';
          b.disabled = !o;
          if (o) b.onclick = () => confirmEvidence(o, it);
          box.append(b);
        }
      }

      // Evidence asks once before it is shown: in most scenarios a wrong one ends the conversation.
      function confirmEvidence(o, it) {
        if (ui.confirm === false) return act(o);
        const box = q('.ie-cards');
        box.innerHTML = '';
        q('.ie-foot').innerHTML = '';
        const w = el('div', 'ie-confirm', `<p><b>${esc(it.kind === 'said' ? it.desc || it.label : it.label)}</b></p><p>${esc(ui.confirm)}</p>`);
        const yes = el('button', 'primary', esc(ui.confirmYes));
        const no = el('button', 'ghost', esc(ui.confirmNo));
        yes.type = no.type = 'button';
        yes.onclick = () => act(o);
        no.onclick = () => cards();
        const row = el('div', 'ie-row');
        row.append(no, yes);
        w.append(row);
        box.append(w);
        yes.focus();
        stick();
      }

      /* ---------- playing events ---------- */
      const WHO_CLASS = { player: 'm-player', suspect: 'm-suspect', ally: 'm-ally' };
      async function play(events) {
        for (const e of events) {
          if (host.onEvent) host.onEvent(e, { face, add });
          switch (e.t) {
            case 'line':
              if (e.who === 'suspect') face(e.mood);
              add(WHO_CLASS[e.who] || 'm-narr', names[e.who], e.text);
              await pace(e.text);
              break;
            case 'narr':
              add('m-narr', '', e.text);
              await pace(e.text);
              break;
            case 'note':
              add('m-note', '', e.text);
              await wait(500);
              break;
            case 'sfx':
              if (host.sfx) host.sfx(e.id);
              break;
            case 'shake':
              ov.classList.add('shake');
              setTimeout(() => ov.classList.remove('shake'), 450);
              break;
            case 'reveal': {
              status();
              const rec = q('.ie-rec');
              rec.classList.add('blink');
              setTimeout(() => rec.classList.remove('blink'), 1500);
              const rv = S.revelations.find((x) => x.id === e.id);
              if (rv && rv.sms && A.observer) { // an optional observer (e.g. a detective listening in) reacts
                const toast = q('.ie-toast');
                toast.hidden = false;
                toast.textContent = `📳 ${A.observer.name}: ${rv.sms}`;
                if (host.sfx) host.sfx('phone');
                setTimeout(() => { toast.hidden = true; }, 2600);
              }
              break;
            }
            case 'move':
              if (e.changed) await wait(250);
              break;
            case 'warn':
              status();
              break;
            case 'gain': {
              add('m-note m-gain', '', fill(ui.gained, { label: e.label }));
              status();
              const t = q('.ie-tabs [data-tab=evidence]');
              t.classList.add('blink');
              setTimeout(() => t.classList.remove('blink'), 1500);
              await wait(500);
              break;
            }
          }
        }
        status();
        stick();
      }

      async function act(o) {
        if (busy || s.over) return;
        busy = true;
        q('.ie-cards').innerHTML = '';
        q('.ie-foot').innerHTML = '';
        if (host.sfx) host.sfx('click');
        await play(I.choose(s, o));
        if (s.over) return end();
        busy = false;
        cards();
      }

      function end() {
        const why = s.log.filter((e) => e.t === 'end').pop()?.why;
        const text = fill(ui.end[s.over + '_' + why] || ui.end[s.over] || s.over, { n: s.revealed.size });
        const box = q('.ie-cards');
        box.innerHTML = '';
        q('.ie-foot').innerHTML = '';
        q('.ie-tabs').hidden = true;
        const finish = () => {
          ov.remove();
          document.body.classList.remove('ie-open');
          resolve({ outcome: s.over, why, revealed: [...s.revealed], count: s.revealed.size, state: I.serialize(s) });
        };
        const done = el('div', 'ie-end', `<p>${esc(text)}</p>`);
        const b = el('button', 'primary', esc(ui.continue));
        b.type = 'button';
        b.onclick = finish;
        done.append(b);
        box.append(done);
        b.focus();
        stick();
      }

      /* ---------- start ---------- */
      face(I.zoneOf(S, s.m[S.zoneMeter]).mood);
      if (ui.intro) add('m-narr', '', ui.intro);
      play(s.events).then(() => { status(); cards(); });
      status();
    });
  }

  root.InterrogationView = { open, strings: STRINGS };
})(typeof window !== 'undefined' ? window : globalThis);
