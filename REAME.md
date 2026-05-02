# 📊 UK Data Visualisation Gallery

> An interactive, browser-based data visualisation gallery built with p5.js — 13 charts spanning UK crime, economy, population, climate, and fashion, each with custom interactivity, animations, and comparison tools.

![p5.js](https://img.shields.io/badge/p5.js-ED225D?style=for-the-badge&logo=p5dotjs&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSV](https://img.shields.io/badge/Data-CSV-blue?style=for-the-badge)

---

## 📗 Table of Contents

- [📖 About the Project](#-about-the-project)
- [🗂 Project Structure](#-project-structure)
- [Live Demo](#live-demo)
- [📊 Visualisations](#-visualisations)
  - [Phase 1 — Core Charts](#phase-1--core-charts)
  - [Phase 2 — Advanced Charts](#phase-2--advanced-charts)
- [✨ Shared Interaction Design](#-shared-interaction-design)
- [💻 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Running Locally](#running-locally)
- [📁 Data Sources](#-data-sources)
- [🔭 Possible Future Improvements](#-future-improvements)
- [👤 Author](#-author)
- [🤝 Contributing](#-contributing)
- [📝 License](#-license)

---

## 📖 About the Project <a name="-about-the-project"></a>

This is a two-phase coursework project for Introduction to Programming 2 (ITP2). It is a gallery of interactive data visualisations covering a range of UK datasets — from crime outcomes and CO₂ emissions to ethnic population distributions and UK–US fashion trade flows.

All charts are rendered on a single HTML5 canvas using **p5.js**, with no charting libraries (no D3, no Chart.js). Every axis, tooltip, animation, colour scale, comparison mode, and interaction is implemented from scratch in vanilla JavaScript.

The gallery runs as a single-page application. A navigation menu at the top lets users switch between visualisations, each of which loads its own dataset and manages its own lifecycle (`preload → setup → draw → destroy`).

---

## 🗂 Project Structure <a name="-project-structure"></a>

```
data-vis-Midterm Project/
│
├── index.html              # Entry point and script loader
├── sketch.js               # Gallery controller — manages switching between visuals
├── gallery.js              # Navigation menu builder
├── helper-functions.js     # Shared drawing utilities (axes, ticks, labels)
├── style.css               # Minimal canvas styling
│
├── lib/
│   └── p5.min.js           # p5.js core library
│
├── phase1/                 # Phase 1 charts (author-created)
│   ├── co2-emissions.js
│   ├── crime-outcomes.js
│   ├── city-of-london-crimes.js
│   ├── fsa-prosecutions.js
│   └── vehicle-traffic-chart.js
│
├── phase2/                 # Phase 2 charts (author-created)
│   ├── uk-food-spending.js
│   ├── avg-rainfall.js
│   ├── uk-inflation.js
│   ├── popultaion-by-ethnicity.js
│   ├── regional-population.js
│   ├── vehicle-age.js
│   ├── uk-renewables.js
│   └── uk-us-fashion.js
│
└── data/                   # All datasets (CSV)
    ├── climate/
    ├── consumer/
    ├── crime/
    ├── fashion/
    ├── fsa/
    ├── inflation/
    ├── population/
    ├── rainfall/
    ├── renewable-energy/
    └── vehicle/
```

---

## Live Demo <a name="live-demo"></a>

[Live Demo Link]()

---

## 📊 Visualisations <a name="visualisations"></a>

### Phase 1 — Core Charts <a name="phase-1--core-charts"></a>

These five charts were built in Phase 1, focusing on clean data parsing, animated reveals, and foundational interactivity.

---

#### 📉 CO₂ Emissions UK (2000–2020)
**File:** `phase1/co2-emissions.js` · **Data:** UK CO₂ emissions (tons per capita)

A time-series line chart showing the UK's carbon footprint over two decades. Data points are revealed one by one with a frame-rate-based animation, giving the chart a drawing effect on load. Built using the shared `helper-functions.js` axis/tick system.

---

#### 📊 UK Crime Outcomes — March 2019
**File:** `phase1/crime-outcomes.js` · **Data:** UK crime outcome types, March 2019

A bar chart of the most common crime resolution outcomes. Bars animate in sequentially (one per 5 frames), with rotated x-axis labels to prevent overlap. Y-axis includes evenly spaced grid lines for readability.

---

#### 🥧 City of London: Crime Outcomes
**File:** `phase1/city-of-london-crimes.js` · **Data:** City of London crime outcome breakdown

An animated pie chart that sweeps from 0% to 100% on load. Hover detection is computed geometrically per slice (polar coordinates), and hovering highlights the slice and shows a tooltip with the outcome label, count, and percentage. Legend rendered alongside.

---

#### 📈 FSA Successful Prosecutions
**File:** `phase1/fsa-prosecutions.js` · **Data:** Food Standards Agency prosecutions by region

A multi-line chart grouped by enforcement region, with two interactive HTML sliders for selecting a custom year range. Lines update in real time as the sliders move. Each region is assigned a distinct colour with a matching legend. Sliders are created and destroyed with the chart lifecycle to avoid DOM leaks.

---

#### 🟦 UK Vehicle Traffic Composition
**File:** `phase1/vehicle-traffic-chart.js` · **Data:** UK regional traffic by vehicle type

A waffle chart (10×10 grid) showing the percentage breakdown of vehicle types (Cars, LGVs, HGVs, Buses, Motorcycles) across all years in the dataset. Each square is colour-coded, shuffled for visual balance, and hoverable for a tooltip showing the vehicle category.

---

### Phase 2 — Advanced Charts <a name="phase-2--advanced-charts"></a>

Phase 2 introduced eight significantly more complex charts, each with advanced interaction patterns, caching strategies, and comparison modes. A consistent UX convention was established across all charts: **click to pin, Shift+click to compare, ESC to clear**.

---

#### 🔵 Bread vs Meat Spending: UK 1997–2022
**File:** `phase2/uk-food-spending.js` · **Data:** UK household food spending trends

A connected scatter plot mapping bread & cereals spend (x-axis) against meat spend (y-axis) over time, with a chronological polyline showing the trajectory. Features a **draggable year-range brush embedded directly inside the legend** — drag left/right to filter the visible year range in real time. Hover highlights the nearest point with a tooltip; double-click the brush to reset. CSV parsing uses defensive header detection with a regex fallback for inconsistent year column names.

---

#### 🕸 UK Monthly Average Rainfall
**File:** `phase2/avg-rainfall.js` · **Data:** UK average monthly rainfall (mm) by year

A radar chart normalising rainfall data into a 12-spoke radial grid (one spoke per month). Years are toggled on/off via **pill-shaped HTML buttons** that auto-play on load, revealing years one by one. When a year is toggled on, its polygon eases in above a cached static layer and then merges into it once the animation completes — keeping frame time flat regardless of how many years are visible. A collapsible `?` help panel explains the controls.

---

#### 🟥 UK Monthly Inflation (1989–2023)
**File:** `phase2/uk-inflation.js` · **Data:** UK CPI inflation rate by month and year

A heatmap with a month × year grid. Rows reveal themselves sequentially on load with a timed fade-in. Colours use a sequential palette scaled to the min/max inflation range. Click a year to pin it; hold Shift and click a second year to enter compare mode, which renders a **compact diverging strip** below the grid showing month-level deltas between the two selected years. Tooltips are viewport-clamped so they never overflow the canvas edge. ESC clears all selections.

---

#### 🗺 UK Ethnicity by Region (Census 2021)
**File:** `phase2/popultaion-by-ethnicity.js` · **Data:** Population by ethnicity and region, Census 2021

A **hex-tile choropleth** mapping UK regions to a geographically arranged hex grid using axial coordinates. Tile colours are quantile-binned per metric. Keyboard controls: `←`/`→` to cycle ethnicity groups, `↑`/`↓` to switch metric (`% of region` vs `% of ethnic group`). Click to pin a region; Shift+click a second region to compare, with a dashed connector line drawn between them. Colour values tween smoothly on metric change using a lerp-based animation.

---

#### 🏗 UK Regional Population & Density
**File:** `phase2/regional-population.js` · **Data:** UK regional population 2001, 2011, 2021

A **pseudo-3D bar chart** rendered entirely on a 2D canvas using matrix transforms (`applyMatrix`, `rotate`, `translate`). Bars are extruded upward from a grid plane and drawn back-to-front using a painter's-algorithm pass to handle occlusion correctly. Labels fade out at steep camera angles to avoid clipping. Users can **drag to orbit** with inertia (velocity decays via damping) and scroll to zoom. A reveal-from-ground animation runs on load. Dropdowns switch between Region/Country level and Population/Density metric.

---

#### 📦 Vehicle Age by Point of Impact
**File:** `phase2/vehicle-age.js` · **Data:** UK vehicle collision data

A **box-and-whisker plot** grouping vehicle age at time of collision by point of first impact (Front, Back, Offside, Nearside, Did not impact). The parser handles messy input values — single integers, ranges like `"3–5"`, and coded entries — before computing Q1, Median, Q3, IQR, and Tukey fences. Outliers are rendered as jittered orbiting points to remain visible without cluttering the boxes. Click a box to pin a tooltip; Shift+click a second box to show a **median comparison line** anchored to both true medians.

---

#### 🌊 UK Renewable Energy by Source (1990–2020)
**File:** `phase2/uk-renewables.js` · **Data:** UK renewable energy generation by source (TWh)

A **streamgraph** using inside-out (wiggle) ordering and a symmetric baseline so bands undulate around the central axis, minimising baseline drift. A subtle timer-driven wobble animation keeps large bands visually alive. The chart has two modes: a **single-pane** view with a category dropdown, and a **dual-pane compare** view where the left pane shows absolute values and the right pane normalises to % per year — with per-pane scales so modes don't bleed into each other. Category toggling uses deterministic re-ordering to prevent visual jitter on re-render.

---

#### 🎵 UK–US Fashion: Chord Diagram
**File:** `phase2/uk-us-fashion.js` · **Data:** UK–US fashion dataset (~176 MB CSV)

A **chord diagram** visualising co-occurrence between any two user-selected dimensions from the fashion dataset (e.g. Brand ↔ Category, Style ↔ Sentiment). Given the dataset size, the CSV is parsed via the **Fetch ReadableStream API** with a `TextDecoder`, buffering partial lines chunk-by-chunk without freezing the UI. A progress bar shows parsing status. Results are aggregated into a Top-N + "Other" adjacency matrix and **cached in `localStorage`** keyed by dimension pair and cache version, so re-visits are near-instant. A cancel token stops stale parses when dimensions are switched mid-load. Arcs enforce a minimum angular span to prevent label squeeze on narrow segments.

---

## ✨ Shared Interaction Design <a name="-shared-interaction-design"></a>

A consistent interaction language was established across all Phase 2 charts:

| Gesture | Action |
|---|---|
| **Click** | Pin a data point, year, region, or box |
| **Shift + Click** | Select a second item for side-by-side comparison |
| **ESC** | Clear all pins and comparisons |
| **Arrow Keys** *(hex map)* | Cycle ethnicity groups and toggle metric |
| **Drag** *(3D bars, scatter brush)* | Orbit camera or filter year range |
| **Hover** | Show contextual tooltip with data values |

On-canvas microcopy (e.g. `Shift=Compare · ESC=Clear`) is rendered where compare features exist, so interactions are discoverable without external documentation. Tooltip text meets WCAG AA contrast (≥4.5:1), with a 1px halo applied to labels sitting on high-contrast backgrounds (e.g. heatmap reds, streamgraph dark bands).

---

## 💻 Getting Started <a name="-getting-started"></a>

### Prerequisites <a name="prerequisities"></a>

- A modern web browser (Chrome, Firefox, Edge, or Safari)
- No build tools, package managers, or installations required

### Running Locally <a name="running-locally"></a>

> ⚠️ **A local server is required.** The project loads CSV files via relative paths, and browsers block these requests when the page is opened via `file://`. Double-clicking `index.html` will cause all datasets to fail silently.


Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension, right-click `index.html`, and select **Open with Live Server**.


> **Note on the fashion chart:** `data/fashion/fashion-data.csv` is ~176 MB. The first parse takes 10–30 seconds depending on hardware. Subsequent loads use the `localStorage` cache and are near-instant.

---

## 📁 Data Sources <a name="-data-sources"></a>

| Dataset | File | Description |
|---|---|---|
| UK CO₂ Emissions | `data/climate/uk_co2_emissions_2000_2020.csv` | Tons per capita, 2000–2020 |
| UK Crime Outcomes | `data/crime/crime-march-2019-outcomes.csv` | Outcome types, March 2019 |
| City of London Crimes | `data/crime/outcome-type.csv` | Outcome breakdown by type |
| FSA Prosecutions | `data/fsa/fsa-successful-prosecutions.csv` | Successful cases by region and year |
| Vehicle Traffic | `data/vehicle/region_traffic_by_vehicle_type.csv` | Regional traffic by vehicle class |
| UK Food Spending | `data/consumer/uk_food_trends.csv` | Household spending by category, 1997–2022 |
| Average Rainfall | `data/rainfall/avg_rainfall.csv` | Monthly rainfall (mm) by year |
| UK Inflation | `data/inflation/Inflation by Month.csv` | CPI inflation rate, 1989–2023 |
| Ethnicity by Region | `data/population/population-by-ethnicity-and-region-2021.csv` | Census 2021 ethnicity data |
| UK Regional Population | `data/population/UK Regional Population Data.csv` | Population & density, 2001–2021 |
| Vehicle Collisions | `data/vehicle/vehicle-data.csv` | Vehicle age by point of impact |
| UK Renewables | `data/renewable-energy/uk_renewable_energy.csv` | Generation by source (TWh), 1990–2020 |
| UK–US Fashion | `data/fashion/fashion-data.csv` | Brand, category, style, sentiment (~176 MB) |

---

## 🔭 Possible Future Improvements <a name="future-improvements"></a>

- Responsive canvas sizing across different screen resolutions
- Export individual charts as PNG or SVG
- Unified light/dark mode toggle across the gallery
- Keyboard navigation between gallery menu items
- Lazy-loading of heavy datasets on chart selection rather than at page load
- Persistent user preferences (pinned years, selected metrics) stored across sessions

---

## 👤 Author <a name="-author"></a>

👤 **Ashmal Zahra**

- GitHub: [@ashmalzahra](https://github.com/ashmalzahra)
- Twitter: [@AshmalZahraa](https://twitter.com/AshmalZahraa)
- LinkedIn: [ashmal-zahra](https://www.linkedin.com/in/ashmal-zahra)

---

## 🤝 Contributing <a name="-contributing"></a>

Contributions, issues, and feature requests are welcome!

Feel free to check the [issues page](https://github.com/ashmalzahra/data-visualization-dashboard/issues).

---

## 📝 License <a name="-license"></a>

This project is [MIT](./LICENSE) licensed.

---

<p align="center">Built with p5.js 📊 — no charting libraries, just canvas and code.</p>