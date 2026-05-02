function Co2EmissionsTimeSeries() {
  this.name = 'CO₂ Emissions UK: 2000–2020';
  this.id = 'co2-emissions-timeseries';
  this.title = 'CO₂ Emissions (Tons per Capita)';
  this.xAxisLabel = 'Year';
  this.yAxisLabel = 'Tons/Capita';

  var marginSize = 35;

  this.layout = {
    marginSize: marginSize,
    leftMargin: marginSize * 2,
    rightMargin: width - marginSize,
    topMargin: marginSize,
    bottomMargin: height - marginSize * 2,
    pad: 5,
    plotWidth: function () {
      return this.rightMargin - this.leftMargin;
    },
    plotHeight: function () {
      return this.bottomMargin - this.topMargin;
    },
    grid: true,
    numXTickLabels: 10,
    numYTickLabels: 8
  };

  this.loaded = false;

  this.preload = function () {
    var self = this;
    this.data = loadTable(
      './data/climate/uk_co2_emissions_2000_2020.csv',
      'csv',
      'header',
      function (table) {
        self.loaded = true;
      }
    );
  };

  this.setup = function () {
    textSize(16);
    this.startYear = this.data.getNum(0, 'Year');
    this.endYear = this.data.getNum(this.data.getRowCount() - 1, 'Year');
    this.minEmission = 0;
    this.maxEmission = max(this.data.getColumn('CO2 Emissions (Tons/Capita)'));

    //control how many data points are animated
    this.revealIndex = 1;
  };

  this.destroy = function () { };

  this.draw = function () {
    if (!this.loaded) {
      console.log('Data not yet loaded');
      return;
    }

    background(255);
    this.drawTitle();

    drawYAxisTickLabels(this.minEmission,
      this.maxEmission,
      this.layout,
      this.mapEmissionToHeight.bind(this),
      0);

    drawAxis(this.layout);
    drawAxisLabels(this.xAxisLabel, this.yAxisLabel, this.layout);

    let previous = null;
    const numYears = this.endYear - this.startYear;

    //skip labels to avoid overlap
    const xLabelSkip = ceil(numYears / this.layout.numXTickLabels);

    // only reveal up to the current animated index
    let limit = min(this.revealIndex, this.data.getRowCount());

    for (let i = 0; i < limit; i++) {
      let current = {
        year: this.data.getNum(i, 'Year'),
        emission: this.data.getNum(i, 'CO2 Emissions (Tons/Capita)')
      };

      if (previous != null) {
        //draw line between this point and the previous one
        stroke(0);
        strokeWeight(2);
        line(
          this.mapYearToWidth(previous.year),
          this.mapEmissionToHeight(previous.emission),
          this.mapYearToWidth(current.year),
          this.mapEmissionToHeight(current.emission)
        );

        //draw year label below every few ticks
        if (i % xLabelSkip === 0) {
          drawXAxisTickLabel(current.year, this.layout, this.mapYearToWidth.bind(this));
        }
      }

      previous = current;
    }

    //slowly increase number of points drawn over time
    if (this.revealIndex < this.data.getRowCount()) {
      if (frameCount % 3 === 0) this.revealIndex++;
    }
  };

  this.drawTitle = function () {
    fill(0);
    noStroke();
    textAlign(CENTER, CENTER);
    text(this.title,
      (this.layout.plotWidth() / 2) + this.layout.leftMargin,
      this.layout.topMargin - (this.layout.marginSize / 2));
  };

  //map a year to x-coordinate on screen
  this.mapYearToWidth = function (value) {
    return map(value,
      this.startYear,
      this.endYear,
      this.layout.leftMargin,
      this.layout.rightMargin);
  };

  //map an emission value to y-coordinate on screen
  this.mapEmissionToHeight = function (value) {
    return map(value,
      this.minEmission,
      this.maxEmission,
      this.layout.bottomMargin,
      this.layout.topMargin);
  };
}
