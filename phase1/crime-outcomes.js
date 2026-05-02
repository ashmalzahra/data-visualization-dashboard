function UKCrimeOutcomes() {
  this.name = 'UK Crime Outcomes';
  this.id = 'uk-crime-outcomes';

  this.layout = {
    leftMargin: 100,
    rightMargin: function () { return width - 112; },
    topMargin: 50,
    bottomMargin: function () { return height - 140; },
    pad: 5,

    plotWidth: function () {
      return this.rightMargin() - this.leftMargin;
    },

    grid: true,
    numYTickLabels: 8
  };

  this.loaded = false;

  //tracks bars to be drawn
  this.barRevealIndex = 0;

  this.preload = function () {
    var self = this;
    this.data = loadTable(
      './data/crime/crime-march-2019-outcomes.csv',
      'csv',
      'header',
      function (table) {
        self.loaded = true;
      }
    );
  };

  this.setup = function () {
    textSize(16);
  };

  this.destroy = function () { };

  this.draw = function () {
    if (!this.loaded) {
      console.log('Data not yet loaded');
      return;
    }

    background(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    text("Most Common Crime Outcomes - March 2019", width / 2, this.layout.topMargin - 20);

    let maxCount = max(this.data.getColumn('count'));
    let barWidth = this.layout.plotWidth() / this.data.getRowCount();

    //draw y-axis and horizontal grid lines
    stroke(0);
    line(this.layout.leftMargin, this.layout.topMargin, this.layout.leftMargin, this.layout.bottomMargin());

    let numTicks = this.layout.numYTickLabels;
    for (let i = 0; i <= numTicks; i++) {
      let y = map(i, 0, numTicks, this.layout.bottomMargin(), this.layout.topMargin);
      let val = floor(map(i, 0, numTicks, 0, maxCount));
      noStroke();
      fill(0);
      textAlign(RIGHT, CENTER);
      text(val, this.layout.leftMargin - 10, y);

      stroke(220);
      line(this.layout.leftMargin, y, this.layout.rightMargin(), y);
    }

    //draw bars up to current animation index
    for (let i = 0; i < this.barRevealIndex && i < this.data.getRowCount(); i++) {
      let outcome = {
        outcome_type: this.data.getString(i, 'outcome_type'),
        count: this.data.getNum(i, 'count')
      };

      let x = this.layout.leftMargin + i * barWidth;
      let y = map(outcome.count, 0, maxCount, this.layout.bottomMargin(), this.layout.topMargin);
      let h = this.layout.bottomMargin() - y;

      fill(100, 150, 255, 200);
      noStroke();
      rect(x, y, barWidth - 5, h);

      //rotate and display outcome labels under each bar
      push();
      translate(x + barWidth / 2, this.layout.bottomMargin() + 10);
      rotate(PI / 6);
      textAlign(LEFT, CENTER);
      fill(0);
      textSize(11);
      text(outcome.outcome_type, 0, 0);
      pop();
    }

    //y-axis label
    push();
    translate(this.layout.leftMargin - 60, height / 2);
    rotate(-HALF_PI);
    textAlign(CENTER, CENTER);
    text("Number of Cases", 0, 0);
    pop();

    //x-axis label
    textAlign(CENTER, CENTER);
    textSize(13);
    fill(100, 150, 255);
    text("Outcome Type", this.layout.leftMargin + this.layout.plotWidth() / 2, height - 40);

    //bars drawn every few frames
    if (this.barRevealIndex < this.data.getRowCount() && frameCount % 5 === 0) {
      this.barRevealIndex++;
    }
  };
}
