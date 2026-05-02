function PayGapTimeSeries() {
  this.name = 'Pay gap: 1997-2017';
  this.id = 'pay-gap-timeseries';
  this.title = 'Gender Pay Gap: Average difference between male and female pay.';
  this.xAxisLabel = 'year';
  this.yAxisLabel = '%';

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
      './data/pay-gap/all-employees-hourly-pay-by-gender-1997-2017.csv',
      'csv',
      'header',
      function (table) {
        self.loaded = true;
      }
    );
  };

  this.setup = function () {
    textSize(16);
    this.startYear = this.data.getNum(0, 'year');
    this.endYear = this.data.getNum(this.data.getRowCount() - 1, 'year');
    this.minPayGap = 0;
    this.maxPayGap = max(this.data.getColumn('pay_gap'));
  };

  this.destroy = function () { };

  this.draw = function () {
    if (!this.loaded) {
      console.log('Data not yet loaded');
      return;
    }

    background(255);
    this.drawTitle();

    drawYAxisTickLabels(this.minPayGap,
                        this.maxPayGap,
                        this.layout,
                        this.mapPayGapToHeight.bind(this),
                        0);

    drawAxis(this.layout);

    drawAxisLabels(this.xAxisLabel,
                   this.yAxisLabel,
                   this.layout);

    let previous = null;
    const numYears = this.endYear - this.startYear;
    const xLabelSkip = ceil(numYears / this.layout.numXTickLabels);

    for (let i = 0; i < this.data.getRowCount(); i++) {
      let current = {
        year: this.data.getNum(i, 'year'),
        payGap: this.data.getNum(i, 'pay_gap')
      };

      if (previous != null) {
        stroke(0);
        strokeWeight(2);
        line(
          this.mapYearToWidth(previous.year),
          this.mapPayGapToHeight(previous.payGap),
          this.mapYearToWidth(current.year),
          this.mapPayGapToHeight(current.payGap)
        );

        if (i % xLabelSkip === 0) {
          drawXAxisTickLabel(current.year, this.layout, this.mapYearToWidth.bind(this));
        }
      }

      previous = current;
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

  this.mapYearToWidth = function (value) {
    return map(value,
               this.startYear,
               this.endYear,
               this.layout.leftMargin,
               this.layout.rightMargin);
  };

  this.mapPayGapToHeight = function (value) {
    return map(value,
               this.minPayGap,
               this.maxPayGap,
               this.layout.bottomMargin,
               this.layout.topMargin);
  };
}