/* GIS.medicalDial — clinical day-arc heartbeat indicator
 *
 * Renders a half-disc SVG instrument dial (180° top arc), with 12pm at the
 * apex and the daytime hours 06 → 18 along the arc. The needle sweeps left
 * (6am, 9-o'clock) → top (12pm) → right (6pm, 3-o'clock) across the full
 * AM+PM cycle. At cycle reset the needle teleports back to 6am — only the
 * daytime hours exist on this dial. Tone shifts blood-red ↔ gold ↔ blood-red
 * across the arc, ECG strip beneath, ring pulse on each bucket boundary.
 *
 * Designed to sit on a map for video / GIF capture.
 *
 * Usage:
 *   const dial = GIS.medicalDial.create(containerEl, { width: 250 });
 *   // each animation frame:
 *   dial.update({ bucketIdx: 0, progress: 0.42, peakOnly: true });
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Classic PQRST waveform. phase in [-1, +1].
  function qrsContribution(phase) {
    const ap = Math.abs(phase);
    if (ap > 1) return 0;
    if (ap < 0.3) return 14 * Math.pow(1 - ap / 0.3, 2);
    if (phase >= -0.6 && phase < -0.3) return -2.5 * (1 - (ap - 0.3) / 0.3);
    if (phase >  0.3 && phase <=  0.6) return -3   * (1 - (ap - 0.3) / 0.3);
    if (phase >  0.6 && phase <=  1.0) return  3   * Math.sin((phase - 0.6) / 0.4 * Math.PI);
    if (phase >= -1  && phase < -0.6) return  2   * Math.sin((phase + 1)   / 0.4 * Math.PI);
    return 0;
  }

  // Day-arc tone. frac in [0, 1]: 0 = dawn (6am), 0.5 = noon, 1 = dusk (6pm).
  // Power > 1 keeps the edges deeply red; lightness drops too so dawn/dusk
  // feel "venous", noon feels bright.
  function toneFromFrac(frac) {
    const dayness = Math.sin(Math.max(0, Math.min(1, frac)) * Math.PI);
    const k = Math.pow(dayness, 1.6);
    const h = (354 + k * 44) % 360;
    const s = 78 + k * 6;
    const l = 44 + k * 18;
    return {
      tone:  `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`,
      soft:  `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, 0.5)`,
      faint: `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, 0.18)`
    };
  }

  function fmtTime(t) {
    const total = t * 24;
    const hh = Math.floor(total);
    const mm = Math.floor((total - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function build(container, opts) {
    const W = opts.width || 250;
    const H = Math.round(W * 0.56);  // ≈140 at width 250
    const R = Math.round(W * 0.32);  // arc radius
    const CX = W / 2;
    const CY = Math.round(H * 0.71);  // pivot below the arc's apex
    const ecgH = opts.ecgH || Math.round(W * 0.13);

    const root = document.createElement('div');
    root.className = 'gis-medical-dial';
    root.style.setProperty('--dial-tone',       'hsl(354, 78%, 44%)');
    root.style.setProperty('--dial-tone-soft',  'hsla(354, 78%, 44%, 0.5)');
    root.style.setProperty('--dial-tone-faint', 'hsla(354, 78%, 44%, 0.18)');
    root.style.cssText += `display: flex; flex-direction: column; align-items: center; pointer-events: none; font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace;`;

    const dial = document.createElementNS(SVG_NS, 'svg');
    dial.setAttribute('viewBox', `0 0 ${W} ${H}`);
    dial.setAttribute('width', W);
    dial.setAttribute('height', H);
    dial.style.display = 'block';

    // Half-disc arc — same shape as the dotted bg + foreground stroke.
    const arcD = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
    const arcBg = document.createElementNS(SVG_NS, 'path');
    arcBg.setAttribute('d', arcD);
    arcBg.setAttribute('fill', 'none');
    arcBg.setAttribute('stroke-width', '1');
    arcBg.style.stroke = 'var(--dial-tone-faint)';
    dial.appendChild(arcBg);

    const arcFg = document.createElementNS(SVG_NS, 'path');
    arcFg.setAttribute('d', arcD);
    arcFg.setAttribute('fill', 'none');
    arcFg.setAttribute('stroke-width', '2');
    arcFg.style.stroke = 'var(--dial-tone-soft)';
    dial.appendChild(arcFg);

    function tickPos(f, rad) {
      const theta = (1 - f) * Math.PI;
      return [CX + rad * Math.cos(theta), CY - rad * Math.sin(theta)];
    }

    // Hours 6 → 18, majors at 6/12/18.
    for (let h = 6; h <= 18; h++) {
      const f = (h - 6) / 12;
      const isMajor = (h === 6 || h === 12 || h === 18);
      const r1 = R;
      const r2 = isMajor ? R - 10 : R - 5;
      const [x1, y1] = tickPos(f, r1);
      const [x2, y2] = tickPos(f, r2);
      const tk = document.createElementNS(SVG_NS, 'line');
      tk.setAttribute('x1', x1.toFixed(2)); tk.setAttribute('y1', y1.toFixed(2));
      tk.setAttribute('x2', x2.toFixed(2)); tk.setAttribute('y2', y2.toFixed(2));
      tk.setAttribute('stroke-width', isMajor ? '1.5' : '1');
      tk.style.stroke = isMajor ? 'var(--dial-tone)' : 'var(--dial-tone-soft)';
      dial.appendChild(tk);
    }

    // Cardinal labels: 06, 12, 18 — placed inside the arc.
    [{f: 0, t: '06'}, {f: 0.5, t: '12'}, {f: 1, t: '18'}].forEach(({f, t}) => {
      const [x, y] = tickPos(f, R - 20);
      const lbl = document.createElementNS(SVG_NS, 'text');
      lbl.setAttribute('x', x.toFixed(2));
      lbl.setAttribute('y', (y + 3).toFixed(2));
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('font-size', '9');
      lbl.setAttribute('font-family', 'inherit');
      lbl.setAttribute('letter-spacing', '0.12em');
      lbl.style.fill = 'var(--dial-tone-soft)';
      lbl.textContent = t;
      dial.appendChild(lbl);
    });

    // Needle group — pivots from (CX, CY), default points up.
    const needleGroup = document.createElementNS(SVG_NS, 'g');
    needleGroup.style.transformOrigin = `${CX}px ${CY}px`;
    const needle = document.createElementNS(SVG_NS, 'line');
    needle.setAttribute('x1', CX); needle.setAttribute('y1', CY);
    needle.setAttribute('x2', CX); needle.setAttribute('y2', CY - R + 8);
    needle.setAttribute('stroke-width', '1.6');
    needle.setAttribute('stroke-linecap', 'round');
    needle.style.stroke = 'var(--dial-tone)';
    needleGroup.appendChild(needle);
    const pivot = document.createElementNS(SVG_NS, 'circle');
    pivot.setAttribute('cx', CX); pivot.setAttribute('cy', CY); pivot.setAttribute('r', 3);
    pivot.setAttribute('stroke', 'rgba(0,0,0,0.7)');
    pivot.setAttribute('stroke-width', '0.5');
    pivot.style.fill = 'var(--dial-tone)';
    needleGroup.appendChild(pivot);
    dial.appendChild(needleGroup);

    // HH:MM readout below the pivot.
    const readout = document.createElementNS(SVG_NS, 'text');
    readout.setAttribute('x', CX); readout.setAttribute('y', CY + 25);
    readout.setAttribute('text-anchor', 'middle');
    readout.setAttribute('font-size', '11');
    readout.setAttribute('font-family', 'inherit');
    readout.setAttribute('letter-spacing', '0.2em');
    readout.style.fill = 'var(--dial-tone)';
    readout.textContent = '—';
    dial.appendChild(readout);

    root.appendChild(dial);

    // ECG strip
    const ecg = document.createElementNS(SVG_NS, 'svg');
    ecg.setAttribute('viewBox', `0 0 ${W} 32`);
    ecg.setAttribute('preserveAspectRatio', 'none');
    ecg.setAttribute('width', W);
    ecg.setAttribute('height', ecgH);
    ecg.style.display = 'block';
    ecg.style.margin = '6px 0 0';
    const ecgPath = document.createElementNS(SVG_NS, 'path');
    ecgPath.setAttribute('fill', 'none');
    ecgPath.setAttribute('stroke-width', '1.2');
    ecg.appendChild(ecgPath);
    root.appendChild(ecg);

    let bucketLabel = null;
    if (opts.showLabel !== false) {
      bucketLabel = document.createElement('div');
      bucketLabel.style.cssText = `font-size: 11px; letter-spacing: 0.18em; margin-top: 2px; color: var(--dial-tone);`;
      bucketLabel.textContent = '—';
      root.appendChild(bucketLabel);
    }

    container.appendChild(root);

    return { root, arcFg, needleGroup, readout, ecgPath, bucketLabel, W };
  }

  function buildEcgPath(W, buckets, cycleProgress) {
    const H = 32, mid = H * 0.6;
    let path = `M 0 ${mid}`;
    const beats = buckets.map((_, i) => i / buckets.length);
    const HALF_WIDTH = 0.04;
    for (let x = 0; x <= W; x += 1.5) {
      const localPos = (x / W + cycleProgress) % 1;
      let added = 0;
      for (const b of beats) {
        let delta = localPos - b;
        if (delta > 0.5) delta -= 1;
        else if (delta < -0.5) delta += 1;
        if (Math.abs(delta) < HALF_WIDTH) added += qrsContribution(delta / HALF_WIDTH);
      }
      const y = mid - added;
      path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return path;
  }

  function create(container, opts) {
    opts = opts || {};
    const PULSE_FRACTION = opts.pulseFraction || 0.12;
    const DEFAULT_BUCKETS_FULL = ['wd_early', 'wd_mid', 'wd_pmpeak', 'wd_eve'];
    const DEFAULT_BUCKETS_PEAK = ['wd_early', 'wd_pmpeak'];
    const LABEL = { wd_early: 'AM', wd_mid: 'MIDDAY', wd_pmpeak: 'PM', wd_eve: 'EVENING' };

    const els = build(container, opts);

    function update(state) {
      const peakOnly = !!state.peakOnly;
      const buckets = state.buckets || (peakOnly ? DEFAULT_BUCKETS_PEAK : DEFAULT_BUCKETS_FULL);
      const idx = Math.max(0, Math.min(buckets.length - 1, state.bucketIdx | 0));
      const progress = Math.max(0, Math.min(1, state.progress || 0));
      const bucket = buckets[idx];

      // Linear sweep across the day arc — 0 at start of cycle (6am), 1 at
      // end (6pm). At cycle reset, the needle teleports from 6pm back to 6am.
      const frac = (idx + progress) / buckets.length;

      // Needle: -90° at 6am, 0° at noon, +90° at 6pm.
      const angleDeg = -90 + frac * 180;
      els.needleGroup.style.transform = `rotate(${angleDeg.toFixed(2)}deg)`;

      // HH:MM readout: 6am → 6pm window (= 0.25 → 0.75 of a 24h day).
      const hour24 = 0.25 + frac * 0.5;
      els.readout.textContent = fmtTime(hour24);

      const tones = toneFromFrac(frac);
      els.root.style.setProperty('--dial-tone',       tones.tone);
      els.root.style.setProperty('--dial-tone-soft',  tones.soft);
      els.root.style.setProperty('--dial-tone-faint', tones.faint);

      const cycleProgress = (idx + progress) / buckets.length;
      els.ecgPath.setAttribute('d', buildEcgPath(els.W, buckets, cycleProgress));
      els.ecgPath.setAttribute('stroke', tones.tone);

      if (els.bucketLabel) els.bucketLabel.textContent = LABEL[bucket] || bucket;

      // Heartbeat pulse on the arc — progress-driven so it stays smooth in
      // GIF captures regardless of frame timing.
      if (progress < PULSE_FRACTION) {
        const t = progress / PULSE_FRACTION;
        const k = (1 - t) * (1 - t) * (3 - 2 * (1 - t));
        els.arcFg.setAttribute('stroke-width', (2 + k * 2.5).toFixed(2));
        els.arcFg.style.opacity = (0.5 + k * 0.4).toFixed(2);
      } else {
        els.arcFg.setAttribute('stroke-width', '2');
        els.arcFg.style.opacity = '';
      }
    }

    return { update, root: els.root };
  }

  window.GIS = window.GIS || {};
  window.GIS.medicalDial = { create };
})();
