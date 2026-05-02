function FSAProsecutions() {
  this.name = 'FSA Successful Prosecutions';
  this.id = 'fsa-successful-prosecutions';

  this.xAxisLabel = 'Year';
  this.yAxisLabel = 'Number of Successful Cases';

  let marginSize = 35;

  this.layout = {
    leftMargin: 100,
    rightMargin: width - marginSize * 0.5,
    topMargin: 80,
    bottomMargin: height - 100,
    plotWidth: function () {
      return this.rightMargin - this.leftMargin;
    },
    plotHeight: function () {
      return this.bottomMargin - this.topMargin;
    }
  };

  this.loaded = false;
  this.dataByArea = {}; //store data grouped by region
  this.years = [];

  this.preload = function () {
    let self = this;
    this.data = loadTable(
      './data/fsa/fsa-successful-prosecutions.csv',
      'csv',
      'header',
      function (table) {
        self.loaded = true;
      }
    );
  };

  this.setup = function () {
    if (!this.loaded) return;

    let yearSet = new Set();

    //parse and group data by area and year
    for (let i = 0; i < this.data.getRowCount(); i++) {
      let row = this.data.getRow(i);
      let year = new Date(row.getString('PeriodStart')).getFullYear();
      let area = row.getString('Area');
      let value = int(row.getString('NumberOfSuccessfulCases'));

      yearSet.add(year);
      if (!this.dataByArea[area]) {
        this.dataByArea[area] = {};
      }
      this.dataByArea[area][year] = value;
    }

    this.years = Array.from(yearSet).sort();
    this.minYear = this.years[0];
    this.maxYear = this.years[this.years.length - 1];

    //slider to choose visible year range
    this.startSlider = createSlider(this.minYear, this.maxYear - 1, this.minYear, 1);
    this.startSlider.position(400, 10);

    this.endSlider = createSlider(this.minYear + 1, this.maxYear, this.maxYear, 1);
    this.endSlider.position(600, 10);

    //determine max Y value across all areas/years
    this.minY = 0;
    this.maxY = 0;
    for (let area in this.dataByArea) {
      for (let year of this.years) {
        let val = this.dataByArea[area][year] || 0;
        if (val > this.maxY) this.maxY = val;
      }
    }

    //colors per area
    this.colors = {};
    let areaNames = Object.keys(this.dataByArea);
    for (let i = 0; i < areaNames.length; i++) {
      this.colors[areaNames[i]] = color(map(i, 0, areaNames.length, 50, 255), 100, 200);
    }
  };

  this.destroy = function () {
    //clean up sliders when leaving the visual
    this.startSlider.remove();
    this.endSlider.remove();
  };

  this.draw = function () {
    if (!this.loaded) return;

    background(255);
    textAlign(CENTER, CENTER);
    textSize(16);

    //prevent invalid slider range
    if (this.startSlider.value() >= this.endSlider.value()) {
      this.startSlider.value(this.endSlider.value() - 1);
    }

    this.startYear = this.startSlider.value();
    this.endYear = this.endSlider.value();

    let visibleYears = this.years.filter(y => y >= this.startYear && y <= this.endYear);
    let xStep = this.layout.plotWidth() / (visibleYears.length - 1);

    //title with selected year range
    text(this.name + ` (${this.startYear}–${this.endYear})`, width / 2, this.layout.topMargin - 30);

    drawAxis(this.layout);
    drawYAxisTickLabels(this.minY, this.maxY, this.layout, this.mapY.bind(this), 1);

    for (let area in this.dataByArea) {
      stroke(this.colors[area]);
      strokeWeight(2);
      noFill();
      beginShape();
      for (let i = 0; i < visibleYears.length; i++) {
        let year = visibleYears[i];
        let val = this.dataByArea[area][year] || 0;
        let x = this.layout.leftMargin + i * xStep;
        let y = this.mapY(val);
        vertex(x, y);
      }
      endShape();
    }

    //legend
    let legendX = this.layout.rightMargin - 250;
    let legendY = this.layout.topMargin;
    let i = 0;

    for (let area in this.colors) {
      fill(this.colors[area]);
      noStroke();
      rect(legendX, legendY + i * 40, 10, 10);

      fill(0);
      textAlign(LEFT, TOP);
      textSize(12);

      //label for long area name
      let label = area.includes('abp') ? 'animal welfare / cattle ID / ABP\n(Animal By-Products)' : area;
      text(label, legendX + 15, legendY + i * 40);

      i++;
    }

    for (let i = 0; i < visibleYears.length; i++) {
      let year = visibleYears[i];
      let x = this.layout.leftMargin + i * xStep;
      drawXAxisTickLabel(year, this.layout, () => x);
    }

    //y-axis label
    push();
    translate(this.layout.leftMargin - 60, height / 2);
    rotate(-HALF_PI);
    textAlign(CENTER, CENTER);
    fill(0);
    text(this.yAxisLabel, 0, 0);
    pop();

    //x-axis label
    textAlign(CENTER, CENTER);
    fill(0);
    text(this.xAxisLabel, this.layout.leftMargin + this.layout.plotWidth() / 2, height - 40);
  };

  this.mapY = function (val) {
    return map(val, this.minY, this.maxY, this.layout.bottomMargin, this.layout.topMargin);
  };
}
