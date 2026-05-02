function UKFashion() {
  this.name = 'Fashion Chord Diagram — UK–US Fashion';
  this.id = 'fashion-chord-diagram';
  this.title = 'UK–US Fashion: Brands, Categories, Styles & Sentiment';

  // Layout
  this.scale = 0.96;
  this.centerNudgeY = 12;
  this.uiPanelW = 240;
  this.layout = {
    margin: 32,
    leftMargin: 56,
    rightMargin: width - (80 - this.uiPanelW),
    topMargin: 58,
    bottomMargin: 530,
    plotWidth() { return this.rightMargin - this.leftMargin; },
    plotHeight() { return this.bottomMargin - this.topMargin; }
  };

  // dropdowns matching CSV headers, case-insensitive
  this.availableDims = [
    'Brand', 'Category', 'Season', 'Color', 'Style Attributes',
    'Fashion Magazines', 'Fashion Influencers', 'Time Period Highest Purchase',
    'Description', 'Customer Reviews', 'Social Media Comments', 'feedback'
  ];
  this.dimA = 'Category';
  this.dimB = 'feedback';
  this.topN = 10;

  this.includeOthers = true;
  this.excludedCategories = ['Lingerie']; // not shown as own arc

  // state
  this.loaded = false;      // finished building view
  this.parsing = false;     // currently streaming/parsing CSV
  this.progress = 0;        // 0..1 (bytes or approx)
  this._parseToken = 0;     // cancel stale parses

  // accumulators for current pair
  this._countsA = new Map();
  this._countsB = new Map();
  this._matrix = new Map();
  this._hdrIdx = {};
  this._haveHdr = false;

  // session-global rows store (one-time build; reused on changes)
  this._rows = (window.__FASHION_ROWS__ || null);
  this._rowsPromise = null;

  // cache (per pair & version)
  this.cacheVersion = 'v1';
  this._cacheKey = () => `fashion_pair_${this.cacheVersion}_${this.dimA}|${this.dimB}`;

  // Geometry
  this.center = {
    x: (this.layout.leftMargin + this.layout.rightMargin) / 2,
    y: (this.layout.topMargin + this.layout.bottomMargin) / 2 + 6 + this.centerNudgeY
  };
  this.innerR = Math.min(this.layout.plotWidth(), this.layout.plotHeight()) * 0.45 * this.scale;
  this.outerR = this.innerR + 24 * this.scale;

  // Interaction / UI
  this.anim = { t: 0, dur: 45, active: true };
  this.hover = { arcSide: null, arcIndex: -1 };
  this.pin = null; // (click-to-pin still works)
  this.selA = null; this.selB = null; this.selTop = null;

  // Colors
  const A_TAB = ['#4c78a8', '#6aa4d9', '#2f5597', '#274b87', '#1c3b70'];
  const B_TAB = ['#e45756', '#f58518', '#eeca3b', '#54a24b', '#72b7b2', '#b279a2', '#ff9da6'];
  this.colA = i => color(A_TAB[i % A_TAB.length]);
  this.colB = j => color(B_TAB[j % B_TAB.length]);

  // Derived view
  this.nodesA = []; this.nodesB = []; this.matrix = {};

  // Utilities
  const norm = v => {
    const s = (v ?? '').toString().trim();
    return s.length ? s : 'Unknown';
  };
  const inc = (map, key, by = 1) => map.set(key, (map.get(key) || 0) + by);

  // Basic CSV line parser with quotes
  const parseCSVLine = (line) => {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
          else { q = false; }
        } else cur += ch;
      } else {
        if (ch === ',') { out.push(cur); cur = ''; }
        else if (ch === '"') { q = true; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  };

  // Cache helpers
  this._tryLoadCachedPair = function () {
    const key = this._cacheKey();
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const Mobj = JSON.parse(raw); // {A:{B:count}}
      this._matrix = new Map();
      this._countsA = new Map();
      this._countsB = new Map();
      Object.keys(Mobj).forEach(a => {
        const rowObj = Mobj[a];
        const rowMap = new Map();
        let aSum = 0;
        Object.keys(rowObj).forEach(b => {
          const cnt = rowObj[b] | 0;
          rowMap.set(b, cnt);
          aSum += cnt;
          this._countsB.set(b, (this._countsB.get(b) || 0) + cnt);
        });
        this._countsA.set(a, (this._countsA.get(a) || 0) + aSum);
        this._matrix.set(a, rowMap);
      });
      return true;
    } catch (e) {
      console.warn('Cache load failed:', e);
      return false;
    }
  };

  this._savePairToCache = function () {
    const key = this._cacheKey();
    try {
      const Mobj = {};
      this._matrix.forEach((rowMap, a) => {
        const row = {};
        rowMap.forEach((cnt, b) => { row[b] = cnt; });
        Mobj[a] = row;
      });
      const json = JSON.stringify(Mobj);
      if (json.length <= 4.5 * 1024 * 1024) {
        localStorage.setItem(key, json);
      } else {
        console.warn('Pair cache too large, skipping save.');
      }
    } catch (e) {
      console.warn('Cache save failed:', e);
    }
  };

  // build counts from in-memory rows
  this._buildPairFromRows = function (dimA0, dimB0) {
    if (!this._rows) return false;
    // reset accumulators
    this._countsA = new Map();
    this._countsB = new Map();
    this._matrix = new Map();
    // aggregate
    for (let i = 0; i < this._rows.length; i++) {
      const row = this._rows[i];
      const a = norm(row[dimA0]);
      const b = norm(row[dimB0]);
      inc(this._countsA, a);
      inc(this._countsB, b);
      if (!this._matrix.has(a)) this._matrix.set(a, new Map());
      const m = this._matrix.get(a);
      m.set(b, (m.get(b) || 0) + 1);
    }
    return true;
  };

  // Lifecycle
  this.preload = function () { /* no blocking loads */ };

  this.setup = function () {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    pixelDensity(dpr);
    frameRate(30);

    // UI
    if (this.selA) { this.selA.remove(); this.selB.remove(); this.selTop.remove(); }
    const panelX = this.layout.rightMargin + 24;
    const baseY = this.layout.topMargin - 36;

    this.selA = createSelect(); this.selA.position(panelX, baseY);
    this.availableDims.forEach(d => this.selA.option(d));
    this.selA.selected(this.dimA);
    this.selA.changed(() => {
      this.dimA = this.selA.value();
      this._restartAnim();
      if (this._tryLoadCachedPair()) {
        this.parsing = false; this.loaded = true; this.progress = 1;
        this._rebuildViewFromAccumulators();
      } else if (this._rows) {
        this._buildPairFromRows(this.dimA, this.dimB);
        this.loaded = true; this._rebuildViewFromAccumulators();
        this._savePairToCache();
      } else if (this._rowsPromise) {
        // wait for background rows build, then hydrate (no re-fetch)
        this._rowsPromise.then(() => {
          if (this._rows) {
            this._buildPairFromRows(this.dimA, this.dimB);
            this.loaded = true; this._rebuildViewFromAccumulators();
            this._savePairToCache();
          }
        });
      } else {
        this._streamAndParseCSV('data/fashion/fashion-data.csv'); // first ever visit without cache
      }
    });

    this.selB = createSelect(); this.selB.position(panelX, baseY + 44);
    this.availableDims.forEach(d => this.selB.option(d));
    this.selB.selected(this.dimB);
    this.selB.changed(() => {
      this.dimB = this.selB.value();
      this._restartAnim();
      if (this._tryLoadCachedPair()) {
        this.parsing = false; this.loaded = true; this.progress = 1;
        this._rebuildViewFromAccumulators();
      } else if (this._rows) {
        this._buildPairFromRows(this.dimA, this.dimB);
        this.loaded = true; this._rebuildViewFromAccumulators();
        this._savePairToCache();
      } else if (this._rowsPromise) {
        this._rowsPromise.then(() => {
          if (this._rows) {
            this._buildPairFromRows(this.dimA, this.dimB);
            this.loaded = true; this._rebuildViewFromAccumulators();
            this._savePairToCache();
          }
        });
      } else {
        this._streamAndParseCSV('data/fashion/fashion-data.csv');
      }
    });

    this.selTop = createSelect(); this.selTop.position(panelX, baseY + 88);
    [5, 8, 10, 12, 15, 20].forEach(n => {
      const label = (n <= 12) ? `Top ${n}` : `Top ${n - 2}–${n}`;
      this.selTop.option(label, String(n));
    });
    this.selTop.selected(String(this.topN));
    this.selTop.changed(() => { this.topN = int(this.selTop.value()); this._restartAnim(); this._rebuildViewFromAccumulators(); });

    [this.selA, this.selB, this.selTop].forEach(sel => {
      sel.style('padding', '8px');
      sel.style('border-radius', '10px');
      sel.style('border', '1px solid #cfd3da');
      sel.style('box-shadow', '0 1px 3px rgba(0,0,0,0.08)');
      sel.style('background', '#fff');
      sel.style('font-size', '12px');
      sel.style('width', (this.uiPanelW - 48) + 'px');
    });

    // Start with cache if available, else stream & parse once
    if (this._tryLoadCachedPair()) {
      this.parsing = false; this.loaded = true; this.progress = 1;
      this._rebuildViewFromAccumulators();

      // If rows not built yet this session, silently build them in background ONCE
      if (!this._rows) {
        this._rowsPromise = this._silentBuildAllRows('data/fashion/fashion-data.csv');
      }
    } else {
      this._streamAndParseCSV('data/fashion/fashion-data.csv');
    }
  };

  this.destroy = function () {
    if (this.selA) this.selA.remove();
    if (this.selB) this.selB.remove();
    if (this.selTop) this.selTop.remove();
  };

  this._restartAnim = function () { this.anim = { t: 0, dur: 45, active: true }; };

  // Streaming + parse (per pair)
  this._streamAndParseCSV = async function (url) {
    const token = ++this._parseToken;        // cancel previous parses
    const dimA0 = this.dimA, dimB0 = this.dimB; // snapshot pair

    this.parsing = true; this.loaded = false; this.progress = 0;
    this._countsA = new Map(); this._countsB = new Map(); this._matrix = new Map();
    this._hdrIdx = {}; this._haveHdr = false;

    // temp rows capture if not already present
    const captureRows = !this._rows;
    const tmpRows = captureRows ? [] : null;

    const processBatch = async (lines, idxA, idxB) => {
      if (token !== this._parseToken) return; // cancelled
      this._processLineBatchWithIndices(lines, idxA, idxB, token, tmpRows, captureRows);
      await new Promise(r => setTimeout(r, 0)); // yield
    };

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch CSV');
      const totalBytes = Number(res.headers.get('Content-Length') || 0);

      // If streams API available
      if (res.body && res.body.getReader) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let { value, done } = await reader.read();
        let buf = '';
        let processedBytes = 0;
        let idxA = -1, idxB = -1;

        const LINES_PER_BATCH = 5000;

        while (!done) {
          if (token !== this._parseToken) return; // cancelled
          processedBytes += value.byteLength;
          this.progress = totalBytes ? Math.min(1, processedBytes / totalBytes) : Math.min(0.95, this.progress + 0.02);

          buf += decoder.decode(value, { stream: true });
          let lines = buf.split(/\r?\n/);
          buf = lines.pop() || '';

          if (!this._haveHdr && lines.length) {
            const hdrs = parseCSVLine(lines.shift());
            for (let i = 0; i < hdrs.length; i++) this._hdrIdx[hdrs[i].toLowerCase()] = i;
            idxA = this._hdrIdx[(dimA0 || '').toLowerCase()];
            idxB = this._hdrIdx[(dimB0 || '').toLowerCase()];
            this._haveHdr = true;
          }

          for (let i = 0; i < lines.length; i += LINES_PER_BATCH) {
            const chunk = lines.slice(i, i + LINES_PER_BATCH);
            await processBatch(chunk, idxA, idxB);
          }
          ({ value, done } = await reader.read());
        }
        // flush last buffer
        if (buf.length) {
          if (!this._haveHdr) {
            const hdrs = parseCSVLine(buf);
            for (let i = 0; i < hdrs.length; i++) this._hdrIdx[hdrs[i].toLowerCase()] = i;
          } else {
            await processBatch([buf], this._hdrIdx[(dimA0 || '').toLowerCase()], this._hdrIdx[(dimB0 || '').toLowerCase()]);
          }
        }
      } else {
        // Fallback: get full text then batch by lines
        const text = await res.text();
        const lines = text.split(/\r?\n/);
        if (!lines.length) throw new Error('Empty CSV');

        const hdrs = parseCSVLine(lines.shift());
        for (let i = 0; i < hdrs.length; i++) this._hdrIdx[hdrs[i].toLowerCase()] = i;
        const idxA = this._hdrIdx[(dimA0 || '').toLowerCase()];
        const idxB = this._hdrIdx[(dimB0 || '').toLowerCase()];
        this._haveHdr = true;

        const LINES_PER_BATCH = 8000;
        for (let i = 0; i < lines.length; i += LINES_PER_BATCH) {
          const chunk = lines.slice(i, i + LINES_PER_BATCH);
          await processBatch(chunk, idxA, idxB);
          this.progress = Math.min(1, (i + chunk.length) / (lines.length || 1));
        }
      }

      // Finalize & cache
      if (token === this._parseToken) {
        // save rows for this session
        if (captureRows) {
          this._rows = tmpRows;
          window.__FASHION_ROWS__ = tmpRows;
        }
        this._rebuildViewFromAccumulators();
        this._savePairToCache();
        this.parsing = false; this.loaded = true; this.progress = 1;
      }
    } catch (e) {
      console.error(e);
      this.parsing = false;
    }
  };

  // capture full row values for all dims
  this._processLineBatchWithIndices = function (lines, idxA, idxB, token, tmpRows, captureRows) {
    if (idxA == null || idxB == null) return;

    // Prepare header index lookup list once
    const dimIdx = this.availableDims.map(d => this._hdrIdx[d.toLowerCase()]);

    for (let li = 0; li < lines.length; li++) {
      if (token !== this._parseToken) return;
      const line = lines[li];
      if (!line) continue;
      const cols = parseCSVLine(line);

      // capture full row values (one-time per session)
      if (captureRows && tmpRows) {
        const rowObj = {};
        for (let k = 0; k < this.availableDims.length; k++) {
          const di = dimIdx[k];
          rowObj[this.availableDims[k]] = norm(di == null ? '' : cols[di]);
        }
        tmpRows.push(rowObj);
      }

      // pair-specific aggregation
      const a = norm(cols[idxA]);
      const b = norm(cols[idxB]);
      inc(this._countsA, a);
      inc(this._countsB, b);
      if (!this._matrix.has(a)) this._matrix.set(a, new Map());
      const row = this._matrix.get(a);
      row.set(b, (row.get(b) || 0) + 1);
    }
  };

  // silent background rows build
  this._silentBuildAllRows = async function (url) {
    if (window.__FASHION_ROWS__) { this._rows = window.__FASHION_ROWS__; return; }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch CSV');
      const text = await res.text();
      const lines = text.split(/\r?\n/);
      if (!lines.length) return;
      const hdrs = parseCSVLine(lines.shift());
      this._hdrIdx = {}; for (let i = 0; i < hdrs.length; i++) this._hdrIdx[hdrs[i].toLowerCase()] = i;
      const dimIdx = this.availableDims.map(d => this._hdrIdx[d.toLowerCase()]);
      const rows = [];
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i]; if (!ln) continue;
        const cols = parseCSVLine(ln);
        const rowObj = {};
        for (let k = 0; k < this.availableDims.length; k++) {
          const di = dimIdx[k];
          rowObj[this.availableDims[k]] = norm(di == null ? '' : cols[di]);
        }
        rows.push(rowObj);
      }
      window.__FASHION_ROWS__ = rows;
      this._rows = rows;
    } catch (e) {
      console.warn('Silent rows build failed:', e);
    }
  };

  //Build view objects from accumulators
  this._rebuildViewFromAccumulators = function () {
    const countsA = new Map(this._countsA);
    const countsB = new Map(this._countsB);
    const matrix = new Map();
    this._matrix.forEach((mapB, aKey) => matrix.set(aKey, new Map(mapB)));

    // Exclude one Category from standalone arcs
    const isExcluded = v => this.excludedCategories
      .some(n => (v || '').toString().trim().toLowerCase() === n.toLowerCase());
    if (this.dimA === 'Category') for (const k of Array.from(countsA.keys())) if (isExcluded(k)) countsA.delete(k);
    if (this.dimB === 'Category') for (const k of Array.from(countsB.keys())) if (isExcluded(k)) countsB.delete(k);

    const pickTop = (map, n) => Array.from(map.entries()).sort((x, y) => y[1] - x[1]).slice(0, n).map(([k]) => k);
    const aTop = new Set(pickTop(countsA, this.topN));
    const bTop = new Set(pickTop(countsB, this.topN));

    const A_GRP = '__GROUPED_OTHER_A__', B_GRP = '__GROUPED_OTHER_B__';
    const M = {}; const agg = (o, k1, k2, v) => { if (!o[k1]) o[k1] = {}; o[k1][k2] = (o[k1][k2] || 0) + v; };
    matrix.forEach((mapB, aKey) => {
      const aShow = aTop.has(aKey) ? aKey : (this.includeOthers ? A_GRP : null);
      if (!aShow) return;
      mapB.forEach((cnt, bKey) => {
        const bShow = bTop.has(bKey) ? bKey : (this.includeOthers ? B_GRP : null);
        if (!bShow) return;
        agg(M, aShow, bShow, cnt);
      });
    });

    const totalsA = {}, totalsB = {};
    Object.keys(M).forEach(a => {
      totalsA[a] = 0; Object.keys(M[a]).forEach(b => {
        totalsA[a] += M[a][b]; totalsB[b] = (totalsB[b] || 0) + M[a][b];
      });
    });

    const order = obj => Object.keys(obj).sort((x, y) => obj[y] - obj[x]);
    const aKeys = order(totalsA);
    const bKeys = order(totalsB);

    const sumA = aKeys.reduce((s, k) => s + totalsA[k], 0) || 1;
    const sumB = bKeys.reduce((s, k) => s + totalsB[k], 0) || 1;

    const A_START = PI, A_END = TWO_PI, B_START = 0, B_END = PI;

    let acc = A_START; const nodesA = [];
    for (let i = 0; i < aKeys.length; i++) {
      const k = aKeys[i], span = (totalsA[k] / sumA) * (A_END - A_START);
      nodesA.push({
        key: k, label: (k === A_GRP ? 'Other' : k), count: totalsA[k],
        angle0: acc, angle1: acc + span, color: this.colA(i), subArcs: []
      });
      acc += span;
    }
    acc = B_START; const nodesB = [];
    for (let j = 0; j < bKeys.length; j++) {
      const k = bKeys[j], span = (totalsB[k] / sumB) * (B_END - B_START);
      nodesB.push({
        key: k, label: (k === B_GRP ? 'Other' : k), count: totalsB[k],
        angle0: acc, angle1: acc + span, color: this.colB(j), subArcs: []
      });
      acc += span;
    }

    // Sub-arcs
    nodesA.forEach(na => {
      const pairs = M[na.key] || {};
      const total = na.count || 1;
      let aAcc = na.angle0;
      const entries = Object.entries(pairs).sort((x, y) => y[1] - x[1]);
      entries.forEach(([bKey, cnt]) => {
        const span = (cnt / total) * (na.angle1 - na.angle0);
        na.subArcs.push({ keyB: bKey, count: cnt, a0: aAcc, a1: aAcc + span });
        aAcc += span;
      });
    });
    const rev = {};
    Object.keys(M).forEach(a => Object.keys(M[a]).forEach(b => {
      (rev[b] ||= []).push({ keyA: a, count: M[a][b] });
    }));
    nodesB.forEach(nb => {
      const total = nb.count || 1;
      let bAcc = nb.angle0;
      const entries = (rev[nb.key] || []).sort((x, y) => y.count - x.count);
      entries.forEach(({ keyA, count }) => {
        const span = (count / total) * (nb.angle1 - nb.angle0);
        nb.subArcs.push({ keyA, count, b0: bAcc, b1: bAcc + span });
        bAcc += span;
      });
    });

    this.nodesA = nodesA; this.nodesB = nodesB; this.matrix = M;
  };

  // Draw
  this.draw = function () {
    background(255);
    this._drawTitleAndStatus();

    // halos
    noStroke();
    fill(70, 120, 255, 12);
    arc(this.center.x, this.center.y, (this.outerR + 28 * this.scale) * 2, (this.outerR + 28 * this.scale) * 2, PI, TWO_PI, PIE);
    fill(255, 170, 60, 12);
    arc(this.center.x, this.center.y, (this.outerR + 28 * this.scale) * 2, (this.outerR + 28 * this.scale) * 2, 0, PI, PIE);

    // progress
    if (this.parsing || (!this.nodesA.length && !this.nodesB.length)) {
      noStroke(); fill('#777'); textAlign(CENTER, CENTER); textSize(12);
      const pct = Math.round(this.progress * 100);
      text(`Loading dataset… ${isNaN(pct) ? '' : pct + '%'}`, this.center.x, this.center.y);
      return;
    }

    // animation
    if (this.anim.active && this.anim.t < 1) this.anim.t = Math.min(1, this.anim.t + 1 / this.anim.dur); else this.anim.active = false;
    const ease = t => 1 - Math.pow(1 - t, 3); const T = ease(this.anim.t);

    // hover detect
    this.hover.arcSide = null; this.hover.arcIndex = -1;
    const ang = this._angleAtMouse();
    if (this._insideRing(this.innerR - 16, this.outerR + 16)) {
      for (let i = 0; i < this.nodesA.length; i++) { const n = this.nodesA[i]; if (ang >= n.angle0 && ang <= n.angle1) { this.hover.arcSide = 'A'; this.hover.arcIndex = i; break; } }
      if (this.hover.arcIndex === -1) for (let j = 0; j < this.nodesB.length; j++) { const n = this.nodesB[j]; if (ang >= n.angle0 && ang <= n.angle1) { this.hover.arcSide = 'B'; this.hover.arcIndex = j; break; } }
    }

    // ribbons
    for (let i = 0; i < this.nodesA.length; i++) {
      const nA = this.nodesA[i];
      for (const sa of nA.subArcs) {
        const j = this.nodesB.findIndex(nb => nb.key === sa.keyB);
        if (j < 0) continue;
        const nB = this.nodesB[j];
        const sb = nB.subArcs.find(x => x.keyA === nA.key && x.count === sa.count) || nB.subArcs.find(x => x.keyA === nA.key);
        if (!sb) continue;

        const a0 = lerp((nA.angle0 + nA.angle1) / 2, sa.a0, T);
        const a1 = lerp((nA.angle0 + nA.angle1) / 2, sa.a1, T);
        const b0 = lerp((nB.angle0 + nB.angle1) / 2, sb.b0, T);
        const b1 = lerp((nB.angle0 + nB.angle1) / 2, sb.b1, T);

        let alpha = 210;
        if (this.pin) {
          const arc = this.pin.arc;
          const active = arc && ((arc.side === 'A' && this.nodesA[arc.index].key === nA.key) || (arc.side === 'B' && this.nodesB[arc.index].key === nB.key));
          if (!active) alpha = 35;
        } else if (this.hover.arcSide) {
          const active = (this.hover.arcSide === 'A' && this.hover.arcIndex === i) || (this.hover.arcSide === 'B' && this.hover.arcIndex === j);
          if (!active) alpha = 55;
        }
        const c = lerpColor(nA.color, nB.color, 0.5); c.setAlpha(alpha);
        this._drawRibbon(a0, a1, b0, b1, c);
      }
    }

    // arcs + labels
    this._drawArcsAndLabels(T);
    this._drawLegendsForHiddenLabels();
    this._drawTooltip();
  };

  // helpers
  this._polar = function (ang, r) { return { x: this.center.x + Math.cos(ang) * r, y: this.center.y + Math.sin(ang) * r }; };
  this._angleAtMouse = function () { const dx = mouseX - this.center.x, dy = mouseY - this.center.y; const a = Math.atan2(dy, dx); return a < 0 ? a + TWO_PI : a; };
  this._insideRing = function (r0, r1) { const d = dist(mouseX, mouseY, this.center.x, this.center.y); return d >= r0 && d <= r1; };

  this._drawRibbon = function (a0, a1, b0, b1, col) {
    const RA = this.innerR, RB = this.innerR;
    const A0 = this._polar(a0, RA), A1 = this._polar(a1, RA);
    const B0 = this._polar(b0, RB), B1 = this._polar(b1, RB);
    const C1 = { x: this.center.x - 40, y: this.center.y }, C2 = { x: this.center.x + 40, y: this.center.y };
    noStroke(); fill(col);
    beginShape();
    vertex(A0.x, A0.y); bezierVertex(C1.x, C1.y, C2.x, C2.y, B1.x, B1.y);
    vertex(B0.x, B0.y); bezierVertex(C2.x, C2.y, C1.x, C1.y, A1.x, A1.y);
    endShape(CLOSE);
  };

  this._drawArcsAndLabels = function (T) {
    const thick = 18 * this.scale;
    const minLabelAngle = 0.12;

    const drawArc = (node, col, emph = false) => {
      const a0 = lerp(node.angle0, node.angle1, 0);
      const a1 = lerp(node.angle0, node.angle1, T);
      stroke(col); strokeWeight(emph ? thick + 2 : thick);
      noFill();
      arc(this.center.x, this.center.y, this.outerR * 2, this.outerR * 2, a0, a1);
    };

    this.hiddenA = []; this.hiddenB = [];

    // side A
    for (let i = 0; i < this.nodesA.length; i++) {
      const n = this.nodesA[i]; let col = n.color; let emph = false;
      if (this.pin) { const act = (this.pin.arc && this.pin.arc.side === 'A' && this.pin.arc.index === i); col.setAlpha(act ? 255 : 60); emph = !!act; }
      else if (this.hover.arcSide) { const act = (this.hover.arcSide === 'A' && this.hover.arcIndex === i); col.setAlpha(act ? 255 : 100); emph = !!act; }
      else col.setAlpha(215);
      drawArc(n, col, emph);

      const span = n.angle1 - n.angle0, mid = (n.angle0 + n.angle1) / 2;
      const p = this._polar(mid, this.outerR + 20 * this.scale);
      if (span >= minLabelAngle) {
        noStroke(); fill('#334'); textSize(11); textAlign(CENTER, CENTER);
        push(); translate(p.x, p.y); rotate(mid + HALF_PI); text(n.label, 0, 0); pop();
      } else {
        stroke('#889'); strokeWeight(2);
        const t0 = this._polar(mid, this.outerR + 6 * this.scale);
        const t1 = this._polar(mid, this.outerR + 12 * this.scale);
        line(t0.x, t0.y, t1.x, t1.y);
        this.hiddenA.push(n.label);
      }
    }

    // side B
    for (let j = 0; j < this.nodesB.length; j++) {
      const n = this.nodesB[j]; let col = n.color; let emph = false;
      if (this.hover.arcSide) { const act = (this.hover.arcSide === 'B' && this.hover.arcIndex === j); col.setAlpha(act ? 255 : 100); emph = !!act; }
      else col.setAlpha(215);
      drawArc(n, col, emph);

      const span = n.angle1 - n.angle0, mid = (n.angle0 + n.angle1) / 2;
      const p = this._polar(mid, this.outerR + 20 * this.scale);
      if (span >= minLabelAngle) {
        noStroke(); fill('#433'); textSize(11); textAlign(CENTER, CENTER);
        push(); translate(p.x, p.y); rotate(mid - HALF_PI); text(n.label, 0, 0); pop();
      } else {
        stroke('#998'); strokeWeight(2);
        const t0 = this._polar(mid, this.outerR + 6 * this.scale);
        const t1 = this._polar(mid, this.outerR + 12 * this.scale);
        line(t0.x, t0.y, t1.x, t1.y);
        this.hiddenB.push(n.label);
      }
    }
  };

  this._drawTitleAndStatus = function () {
    const cx = (this.layout.leftMargin + this.layout.rightMargin) / 2;
    noStroke(); textAlign(CENTER, CENTER);
    fill('#222'); textSize(18);
    text(this.title, cx, this.layout.topMargin - 48);
    const subtitle = `${this.dimA} ↔ ${this.dimB}  •  Top ${this.topN}`;
    fill('#555'); textSize(12);
    text(subtitle, cx, this.layout.topMargin - 24);
  };

  this._drawLegendsForHiddenLabels = function () {
    textAlign(LEFT, TOP); textSize(11);
    const ax = this.layout.leftMargin + 6, ay = this.layout.bottomMargin + 8;
    const bx = this.layout.rightMargin - 240, by = this.layout.bottomMargin + 8;
    if (this.hiddenA && this.hiddenA.length) { noStroke(); fill('#333'); text(`${this.dimA} (hidden):`, ax, ay); fill('#555'); text(this.hiddenA.join(', '), ax, ay + 14); }
    if (this.hiddenB && this.hiddenB.length) { noStroke(); fill('#333'); text(`${this.dimB} (hidden):`, bx, by); fill('#555'); text(this.hiddenB.join(', '), bx, by + 14); }
  };

  this._drawTooltip = function () {
    if (!(this.hover.arcSide && this.hover.arcIndex !== -1)) return;
    const n = (this.hover.arcSide === 'A') ? this.nodesA[this.hover.arcIndex] : this.nodesB[this.hover.arcIndex];
    const denom = (this.hover.arcSide === 'A')
      ? this.nodesA.reduce((s, x) => s + x.count, 0)
      : this.nodesB.reduce((s, x) => s + x.count, 0);
    const pct = Math.round((n.count / Math.max(1, denom)) * 1000) / 10;
    const noun = (n.count === 1) ? 'product' : 'products';
    const label = `${n.label} — ${n.count.toLocaleString()} ${noun}${denom ? ` (${pct}%)` : ''}`;

    textSize(13);
    const pad = 10; const w = textWidth(label) + pad * 2; const h = 30;
    let x = constrain(mouseX + 14, 8, width - w - 8);
    let y = constrain(mouseY - h - 12, 8, height - h - 8);
    noStroke(); fill(0, 40); rect(x + 2, y + 2, w, h, 7);
    stroke(0, 140); strokeWeight(1.2); fill(255); rect(x, y, w, h, 7);
    noStroke(); fill(20); textAlign(LEFT, CENTER); text(label, x + pad, y + h / 2);
  };
}
