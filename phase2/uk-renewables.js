function UKRenewablesbySource() {
  this.name = 'UK Renewable Energy by Source';
  this.id = 'uk-renewables';
  this.title = 'UK Renewable Energy by Source (1990–2020)';
  this.xAxisLabel = 'Year';
  this.yAxisLabel = 'Energy (TWh)';

  this.loaded = false;

  // Layout
  this.layout = {
    marginSize: 40,
    leftMargin: 80,
    rightMargin: width - 150,
    topMargin: 60,
    bottomMargin: height - 20,
    plotWidth: function () { return this.rightMargin - this.leftMargin; },
    plotHeight: function () { return this.bottomMargin - this.topMargin; }
  };

  // Data
  this.table = null;
  this.categories = [];
  this.data = [];
  this.years = [];
  this.stackedData = [];
  this.maxTotal = 0;

  this.palette = [
    '#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99',
    '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a',
    '#ffff99', '#b15928', '#8dd3c7', '#ffffb3', '#bebada',
    '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5'
  ];

  // Hover
  this.hoverCategory = null;
  this.hoverYearIndex = -1;
  this.hoverFade = 60;
  this._hoveredIndex = -1;

  // Alpha tween
  this.categoryVisibility = {};
  this.alphaByCat = {};

  // Single-pane dropdown
  this.dropdown = null;
  this.selectedCategory = 'Show All Categories';

  // Compare Mode UI
  this.compareToggle = null;
  this.compareMode = false;
  this.dropdownL = null;
  this.dropdownR = null;
  this.selectedL = 'Show All Categories';
  this.selectedR = 'Show All Categories';

  // Normalize Right
  this.normalizeToggle = null;
  this.normalizeRight = false;

  // Per-pane hover state
  this.hoverL = { cat: null, i: -1, j: -1 };
  this.hoverR = { cat: null, i: -1, j: -1 };

  // Left-to-right reveal
  this.revealProgress = 1;

  // Steam animation
  this.steam = {
    perCatProgress: [],
    perCatDelay: [],
    wobbleAmp: [],
    startedAt: 0,
    lift: 18,
    duration: 90,
    freq: 0.12,
    damping: 0.96
  };

  // Wisps
  this.steamWisps = [];
  function SteamWisp(x, y, col) {
    this.x = x; this.y = y;
    this.life = random(60, 120);
    this.age = 0;
    this.col = color(lerpColor(col, color(255), 0.7));
    this.path = [];
    this.update = function () {
      this.age++;
      const drift = (noise(this.age * 0.02, this.y * 0.01) - 0.5) * 1.2;
      this.x += drift; this.y -= 0.4;
      this.path.push({ x: this.x, y: this.y });
      if (this.path.length > 20) this.path.shift();
    };
    this.display = function () {
      noFill();
      stroke(
        red(this.col), green(this.col), blue(this.col),
        map(this.life - this.age, 0, this.life, 0, 50)
      );
      strokeWeight(4 - 3 * (this.age / this.life));
      beginShape();
      for (let p of this.path) curveVertex(p.x, p.y);
      endShape();
    };
    this.isDead = function () { return this.age > this.life; };
  }

  this._startSteam = () => {
    this.steam.startedAt = frameCount;
    this.steam.perCatProgress = new Array(this.categories.length).fill(0);
    this.steam.perCatDelay = this.categories.map((_, j) => j * 10);
    this.revealProgress = 0;
    this.steam.wobbleAmp = this.categories.map((_, j) => 10 + (j % 3) * 4);
  };

  // Lifecycle
  this.preload = function () {
    this.table = loadTable('data/renewable-energy/uk_renewable_energy.csv', 'csv', 'header');
  };

  this.setup = function () {
    const allColumns = this.table.columns;
    this.categories = allColumns.slice(3);
    this.years = this.table.getColumn('Year').map(y => int(y));

    for (let r = 0; r < this.table.getRowCount(); r++) {
      const row = this.table.rows[r];
      const values = [];
      for (let c = 3; c < allColumns.length; c++) values.push(float(row.get(allColumns[c])));
      this.data.push(values);
    }

    // compute max total across rows
    for (let i = 0; i < this.data.length; i++) {
      const total = this.data[i].reduce((a, b) => a + b, 0);
      if (total > this.maxTotal) this.maxTotal = total;
    }

    // symmetrical-baseline stacking rows (absolute TWh)
    this._buildStackedAbs();

    // default visibility for single-pane
    this.categories.forEach(c => { this.categoryVisibility[c] = true; this.alphaByCat[c] = 1; });

    // UI single selector
    this.dropdown = createSelect();
    this.dropdown.position(this.layout.rightMargin + 130, this.layout.topMargin - 40);
    this.dropdown.option('Show All Categories');
    this.categories.forEach(c => this.dropdown.option(c));
    this.selectedCategory = 'Show All Categories';
    styleSelect(this.dropdown);

    this.dropdown.changed(() => {
      const selected = this.dropdown.value();
      this.selectedCategory = selected;
      if (selected === 'Show All Categories') {
        this.categories.forEach(c => this.categoryVisibility[c] = true);
      } else {
        this.categories.forEach(c => this.categoryVisibility[c] = false);
        this.categoryVisibility[selected] = true;
      }
      Object.keys(this.alphaByCat).forEach(c => this.alphaByCat[c] = 0);
      this._startSteam();
    });

    // UI compare toggle
    this.compareToggle = createButton('Compare: OFF');
    this.compareToggle.position(this.layout.rightMargin + 420, this.layout.topMargin - 40);
    stylePill(this.compareToggle);
    this.compareToggle.mousePressed(() => {
      this.compareMode = !this.compareMode;
      this.compareToggle.html(this.compareMode ? 'Compare: ON' : 'Compare: OFF');
      this._ensureCompareDropdowns();

      if (this.compareMode) {
        const lastIdx = this.years.length - 1;
        let maxVal = -1, maxCat = this.categories[0];
        for (let j = 0; j < this.categories.length; j++) {
          const v = this.data[lastIdx][j];
          if (v > maxVal) { maxVal = v; maxCat = this.categories[j]; }
        }
        this.selectedL = 'Show All Categories';
        this.selectedR = maxCat;
        this.dropdownL.selected(this.selectedL);
        this.dropdownR.selected(this.selectedR);
        this.dropdown.hide();
        this.normalizeToggle.show(); // enable normalization control in compare mode
      } else {
        this.dropdown.show();
        this.normalizeToggle.hide();
      }
      this._startSteam();
    });

    // UI — normalize right toggle (hidden until compare mode)
    this.normalizeToggle = createButton('Normalize to % Share: OFF');
    this.normalizeToggle.position(this.layout.rightMargin + 420, this.layout.topMargin - 10);
    stylePill(this.normalizeToggle);
    this.normalizeToggle.mousePressed(() => {
      this.normalizeRight = !this.normalizeRight;
      this.normalizeToggle.html(this.normalizeRight ? 'Normalize to % Share: ON' : 'Normalize to % Share: OFF');
      this._startSteam();
    });
    this.normalizeToggle.hide();

    this._ensureCompareDropdowns();

    this.loaded = true;
    this._startSteam();
  };

  this._buildStackedAbs = function () {
    this.stackedData = [];
    for (let i = 0; i < this.data.length; i++) {
      const row = this.data[i];
      const total = row.reduce((a, b) => a + b, 0);
      const baseline = (this.maxTotal - total) / 2;
      let y0 = baseline;
      const stackedRow = [];
      for (let j = 0; j < row.length; j++) {
        const y1 = y0 + row[j];
        stackedRow.push({ y0, y1, value: row[j] }); // absolute values
        y0 = y1;
      }
      this.stackedData.push(stackedRow);
    }
  };

  this._ensureCompareDropdowns = function () {
    if (!this.dropdownL) {
      this.dropdownL = createSelect();
      this.dropdownL.option('Show All Categories');
      this.categories.forEach(c => this.dropdownL.option(c));
      this.dropdownL.selected(this.selectedL);
      styleSelect(this.dropdownL);
      this.dropdownL.changed(() => { this.selectedL = this.dropdownL.value(); this._startSteam(); });
    }
    if (!this.dropdownR) {
      this.dropdownR = createSelect();
      this.dropdownR.option('Show All Categories');
      this.categories.forEach(c => this.dropdownR.option(c));
      this.dropdownR.selected(this.selectedR);
      styleSelect(this.dropdownR);
      this.dropdownR.changed(() => { this.selectedR = this.dropdownR.value(); this._startSteam(); });
    }

    if (this.compareMode) {
      this.dropdownL.position(this.layout.rightMargin + 140, this.layout.topMargin - 50);
      this.dropdownR.position(this.layout.rightMargin + 140, this.layout.topMargin - 20);
      this.dropdownL.show();
      this.dropdownR.show();
    } else {
      this.dropdownL.hide();
      this.dropdownR.hide();
    }
  };

  this.destroy = function () {
    if (this.dropdown) { this.dropdown.remove(); this.dropdown = null; }
    if (this.compareToggle) { this.compareToggle.remove(); this.compareToggle = null; }
    if (this.dropdownL) { this.dropdownL.remove(); this.dropdownL = null; }
    if (this.dropdownR) { this.dropdownR.remove(); this.dropdownR = null; }
    if (this.normalizeToggle) { this.normalizeToggle.remove(); this.normalizeToggle = null; }
  };

  // Draw
  this.draw = function () {
    if (!this.loaded) return;

    background(255);
    this.drawTitle();

    // Shared vertical scales
    const chartHeight = this.layout.plotHeight();
    const yScaleAbs = d => map(d, 0, this.maxTotal, 0, chartHeight);
    const yScalePct = d => map(d, 0, 100, 0, chartHeight);

    // reveal
    if (this.revealProgress < 1) this.revealProgress += 0.02;
    let revealedIndex = floor(this.revealProgress * this.years.length);
    revealedIndex = constrain(revealedIndex, 1, this.years.length);

    // alpha tween (single-pane only)
    for (const c of this.categories) {
      const target = (this.selectedCategory === 'Show All Categories') ? 1 : (c === this.selectedCategory ? 1 : 0);
      this.alphaByCat[c] += (target - this.alphaByCat[c]) * 0.12;
    }

    // Single pane
    if (!this.compareMode) {
      const xStep = this.layout.plotWidth() / (this.years.length - 1);
      const singleHover = {}; // <-- added so tooltips work in non-compare mode
      this._drawPane({
        left: this.layout.leftMargin,
        right: this.layout.rightMargin,
        top: this.layout.topMargin,
        bottom: this.layout.bottomMargin,
        xStep,
        yScale: yScaleAbs,
        revealedIndex,
        filter: this.selectedCategory,
        hoverState: singleHover,
        showLegendAt: { x: this.layout.rightMargin + 10, y: this.layout.topMargin + 30 },
        paneLabel: null,
        normalize: false
      });

      // Year ticks
      textAlign(CENTER, TOP); noStroke(); fill(100);
      for (let i = 0; i < this.years.length; i += 5) {
        const x = this.layout.leftMargin + i * xStep;
        text(this.years[i], x, this.layout.bottomMargin + 5);
      }
      return;
    }

    //Side-by-Side panes
    const leftLegendW = 130;
    const gap = 40 + leftLegendW + 20; // base gap + legend + padding
    const fullW = this.layout.plotWidth();
    const paneW = (fullW - gap) / 2;

    const paneLeft = {
      left: this.layout.leftMargin,
      right: this.layout.leftMargin + paneW,
      top: this.layout.topMargin,
      bottom: this.layout.bottomMargin
    };
    const paneRight = {
      left: this.layout.leftMargin + paneW + gap,
      right: this.layout.leftMargin + paneW + gap + paneW,
      top: this.layout.topMargin,
      bottom: this.layout.bottomMargin
    };

    const xStepL = (paneLeft.right - paneLeft.left) / (this.years.length - 1);
    const xStepR = (paneRight.right - paneRight.left) / (this.years.length - 1);

    // Draw both panes
    this.hoverL = { cat: null, i: -1, j: -1 };
    this.hoverR = { cat: null, i: -1, j: -1 };

    this._drawPane({
      ...paneLeft,
      xStep: xStepL,
      yScale: yScaleAbs,
      revealedIndex,
      filter: this.selectedL,
      hoverState: this.hoverL,
      showLegendAt: { x: paneLeft.right + 10, y: paneLeft.top + 24 },
      paneLabel: 'Left',
      normalize: false
    });


    this._drawPane({
      ...paneRight,
      xStep: xStepR,
      yScale: this.normalizeRight ? yScalePct : yScaleAbs,
      revealedIndex,
      filter: this.selectedR,
      hoverState: this.hoverR,
      showLegendAt: { x: paneRight.right + 10, y: paneRight.top + 24 },
      paneLabel: 'Right',
      normalize: this.normalizeRight
    });

    // Shared year ticks along the bottom
    textAlign(CENTER, TOP); noStroke(); fill(100);
    for (let i = 0; i < this.years.length; i += 5) {
      const xl = paneLeft.left + i * xStepL;
      const xr = paneRight.left + i * xStepR;
      text(this.years[i], xl, paneLeft.bottom + 5);
      text(this.years[i], xr, paneRight.bottom + 5);
    }
  };

  // Draw one pane
  this._drawPane = function ({
    left, right, top, bottom,
    xStep, yScale, revealedIndex,
    filter, hoverState, showLegendAt, paneLabel,
    normalize
  }) {
    const chartHeight = bottom - top;
    const MIN_BAND_PX = 3;
    let pendingTooltip = null;


    const getBand = (yearIndex, catIndex, visibleMask) => {
      if (!normalize) {
        return this.stackedData[yearIndex][catIndex];
      }
      const row = this.data[yearIndex];
      const totalAll = max(row.reduce((sum, v) => sum + v, 0), 1e-9);

      let cumPct = 0;
      for (let j = 0; j < catIndex; j++) {
        cumPct += (row[j] / totalAll) * 100;
      }
      const valPct = (row[catIndex] / totalAll) * 100;

      return { y0: cumPct, y1: cumPct + valPct, value: row[catIndex], pct: valPct, total: totalAll };
    };


    const visibleMask = this.categories.map(cat => {
      return (filter === 'Show All Categories') ? true : (filter === cat);
    });

    // Draw stacks
    for (let j = 0; j < this.categories.length; j++) {
      const category = this.categories[j];

      // filter logic
      const showThis = visibleMask[j];
      if (!showThis) continue;

      // steam progress per category
      const elapsed = max(0, frameCount - this.steam.startedAt - this.steam.perCatDelay[j]);
      const raw = constrain(elapsed / this.steam.duration, 0, 1);
      const t = 1 - pow(1 - raw, 3);
      this.steam.perCatProgress[j] = t;
      this.steam.wobbleAmp[j] *= this.steam.damping;

      const col = color(this.palette[j % this.palette.length]);
      let baseAlpha = 200;

      // build envelope
      const tops = [];
      const bots = [];
      for (let i = 0; i < revealedIndex; i++) {
        const point = getBand(i, j, visibleMask);
        const x = left + i * xStep;

        const y0v = normalize ? point.y0 : point.y0; // value domain differs by yScale
        const y1v = normalize ? point.y1 : point.y1;

        const y0p = top + chartHeight - yScale(y0v);
        const y1p = top + chartHeight - yScale(y1v);
        const mid = (y0p + y1p) / 2;

        const wobble = this.steam.wobbleAmp[j] * sin(this.steam.freq * (frameCount + i * 0.8));
        const lift = this.steam.lift * t;
        const y1_final = lerp(mid, y1p, t) - lift + wobble * (1 - t * 0.7);
        const y0_final = lerp(mid, y0p, t) - lift + wobble * (1 - t * 0.7);

        tops.push({ x, y: y1_final });
        bots.push({ x, y: y0_final });
      }

      // ensure minimum thickness when focusing one category
      if (filter !== 'Show All Categories') {
        for (let i = 0; i < tops.length; i++) {
          const thickness = Math.abs(tops[i].y - bots[i].y);
          if (thickness < MIN_BAND_PX) {
            const midY = (tops[i].y + bots[i].y) / 2;
            tops[i].y = midY - MIN_BAND_PX / 2;
            bots[i].y = midY + MIN_BAND_PX / 2;
          }
        }
      }

      // draw band
      col.setAlpha(baseAlpha);
      fill(col); noStroke();
      beginShape();
      for (let i = 0; i < tops.length; i++) curveVertex(tops[i].x, tops[i].y);
      for (let i = bots.length - 1; i >= 0; i--) curveVertex(bots[i].x, bots[i].y);
      endShape(CLOSE);

      // spawn wisps near active bands
      if (t < 1) {
        const px = left + floor(random(revealedIndex)) * xStep;
        const py = tops.length ? tops[floor(random(tops.length))].y : top;
        if (random() < 0.03) this.steamWisps.push(new SteamWisp(px, py, col));
      }
    }

    // draw wisps
    for (let w = this.steamWisps.length - 1; w >= 0; w--) {
      this.steamWisps[w].update();
      this.steamWisps[w].display();
      if (this.steamWisps[w].isDead()) this.steamWisps.splice(w, 1);
    }

    // Hover detection per pane
    if (hoverState) {
      hoverState.cat = null; hoverState.i = -1; hoverState.j = -1;
      const i = constrain(round((mouseX - left) / xStep), 0, this.years.length - 1);
      if (i < revealedIndex) {
        const xAtI = left + i * xStep;
        const pad = 6;
        for (let j = 0; j < this.categories.length; j++) {
          const category = this.categories[j];
          if (!visibleMask[j]) continue;

          // Recompute positions for hover
          const point = getBand(i, j, visibleMask);
          const y0p = top + chartHeight - yScale(point.y0);
          const y1p = top + chartHeight - yScale(point.y1);
          const mid = (y0p + y1p) / 2;

          const elapsed = max(0, frameCount - this.steam.startedAt - this.steam.perCatDelay[j]);
          const raw = constrain(elapsed / this.steam.duration, 0, 1);
          const t = 1 - pow(1 - raw, 3);
          const wobble = this.steam.wobbleAmp[j] * sin(this.steam.freq * (frameCount + i * 0.8));
          const lift = this.steam.lift * t;

          let yTop = lerp(mid, y1p, t) - lift + wobble * (1 - t * 0.7);
          let yBottom = lerp(mid, y0p, t) - lift + wobble * (1 - t * 0.7);

          if (filter !== 'Show All Categories') {
            const thickness = Math.abs(yTop - yBottom);
            if (thickness < 3) {
              const midY = (yTop + yBottom) / 2;
              yTop = midY - 1.5;
              yBottom = midY + 1.5;
            }
          }

          if (abs(mouseX - xAtI) <= xStep / 2 &&
            mouseY >= min(yTop, yBottom) - pad &&
            mouseY <= max(yTop, yBottom) + pad) {
            hoverState.cat = category;
            hoverState.i = i;
            hoverState.j = j;
            break;
          }
        }
      }

      // Tooltip per pane
      if (hoverState.cat && hoverState.i !== -1) {
        const i = hoverState.i;
        const j = hoverState.j;

        const value = this.data[i][j];               // TWh
        const x = left + i * xStep;

        // Midpoint in pixels for the hovered band
        const band = getBand(i, j, visibleMask);
        const midVal = (band.y0 + band.y1) / 2;
        const midY = top + chartHeight - yScale(midVal);

        const label = `${hoverState.cat}\n${this.years[i]}: ${nf(value, 1, 2)} TWh`;

        const tw = textWidth(label) + 22;
        pendingTooltip = { x: x + 10, y: midY - 24, w: tw, h: 42, label };
      }

    }

    // Legend
    if (showLegendAt) {
      const legendMaxWidth = 130;
      const swatch = 12;
      const rowH = 18;
      let visibleCats = [];
      for (let i = 0; i < this.categories.length; i++) {
        const category = this.categories[i];
        const showThis = visibleMask[i];
        if (showThis) visibleCats.push({ idx: i, name: category });
      }

      const cardH = visibleCats.length * rowH + 12;
      const cardX = showLegendAt.x;
      const cardY = showLegendAt.y;

      // background card
      noStroke();
      fill(255, 235);
      rect(cardX, cardY, legendMaxWidth, cardH, 8);
      stroke(200);
      noFill();
      rect(cardX, cardY, legendMaxWidth, cardH, 8);

      // rows
      textAlign(LEFT, CENTER);
      textSize(10);
      let row = 0;
      for (const { idx, name } of visibleCats) {
        const col = color(this.palette[idx % this.palette.length]);
        col.setAlpha(200);
        noStroke(); fill(col);
        rect(cardX + 8, cardY + 6 + row * rowH + 2, swatch, swatch, 3);

        // clip long labels with ellipsis
        fill(50); noStroke();
        const maxLabelW = legendMaxWidth - 8 - swatch - 10;
        let label = name;
        while (textWidth(label) > maxLabelW && label.length > 1) {
          label = label.slice(0, -1);
        }
        if (label !== name) label = label.slice(0, Math.max(0, label.length - 1)) + '…';
        text(label, cardX + 8 + swatch + 6, cardY + 6 + row * rowH + 8);

        row++;
      }
    }
    if (pendingTooltip) {
      fill(255); stroke(0);
      rect(pendingTooltip.x, pendingTooltip.y, pendingTooltip.w, pendingTooltip.h, 6);
      noStroke(); fill(0); textAlign(LEFT, CENTER);
      text(pendingTooltip.label, pendingTooltip.x + 10, pendingTooltip.y + pendingTooltip.h / 2 - 3);
    }

  };

  // Title
  this.drawTitle = function () {
    fill(20); noStroke(); textAlign(CENTER, CENTER);
    textSize(16);
    text(this.title,
      this.layout.leftMargin + this.layout.plotWidth() / 2,
      this.layout.topMargin - this.layout.marginSize);
    textSize(11);
    const modeNote = this.compareMode
      ? 'Compare Mode: each pane can show All or a single category'
      : 'Each layer shows energy (TWh) from a renewable source by year';
    text(modeNote,
      this.layout.leftMargin + this.layout.plotWidth() / 2,
      this.layout.topMargin - this.layout.marginSize + 20);
  };

  // Helpers
  function styleSelect(sel) {
    sel.style('padding', '6px 8px');
    sel.style('font-size', '12px');
    sel.style('font-family', 'Helvetica, sans-serif');
    sel.style('border', '1px solid #ccc');
    sel.style('border-radius', '8px');
    sel.style('background-color', '#fff');
    sel.style('box-shadow', '0 1px 3px rgba(0,0,0,0.08)');
    sel.style('outline', 'none');
    sel.style('cursor', 'pointer');
  }
  function stylePill(btn) {
    btn.style('padding', '6px 10px');
    btn.style('font-size', '12px');
    btn.style('font-family', 'Helvetica, sans-serif');
    btn.style('border', '1px solid #ccd1d9');
    btn.style('border-radius', '999px');
    btn.style('background', 'linear-gradient(180deg,#fff,#f7f7f7)');
    btn.style('box-shadow', '0 1px 3px rgba(0,0,0,0.08)');
    btn.style('cursor', 'pointer');
  }
}
