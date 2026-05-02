function LondonCityOutcome() {
  this.name = 'City of London: Crime Outcomes';
  this.id = 'city-crime-outcomes';
  this.title = 'City of London: Crime Outcomes';
  this.loaded = false;
  this.animationProgress = 0;

  this.preload = function () {
    var self = this;
    this.data = loadTable(
      './data/crime/outcome-type.csv',
      'csv',
      'header',
      function () {
        self.loaded = true;
      }
    );
  };

  this.setup = function () {
    textSize(16);
    this.outcomeLabels = this.data.getColumn('Outcome type');
    this.counts = this.data.getColumn('Count').map(Number);
    this.total = this.counts.reduce((a, b) => a + b, 0);
    this.colors = [];

    //assign random colors to each outcome category
    for (let i = 0; i < this.outcomeLabels.length; i++) {
      this.colors.push(color(random(100, 255), random(100, 255), random(100, 255)));
    }
  };

  this.destroy = function () { };

  this.draw = function () {
    if (!this.loaded) {
      console.log('Data not yet loaded.');
      return;
    }

    background(255);
    this.drawTitle();

    let cx = width / 2;
    let cy = height / 2 + 20;
    let radius = min(width, height) / 2.5;
    let lastAngle = 0;

    //animate pie chart drawing from 0% to 100%
    this.animationProgress = min(this.animationProgress + 0.02, 1);

    for (let i = 0; i < this.counts.length; i++) {
      let angle = map(this.counts[i], 0, this.total, 0, TWO_PI);
      let currentAngle = angle * this.animationProgress;

      let hover = this.isMouseInSlice(cx, cy, radius, lastAngle, lastAngle + currentAngle);

      if (hover) {
        //slightly lighten the color on hover
        fill(lerpColor(this.colors[i], color(255), 0.3));
        noStroke();

        let label = this.outcomeLabels[i];
        let val = this.counts[i];
        let percentage = ((val / this.total) * 100).toFixed(1) + '%';

        //display tooltip with outcome label and percentage
        push();
        fill(0);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(14);
        text(`${label}\n${val} (${percentage})`, cx, cy - radius + 440);
        pop();
      } else {
        fill(this.colors[i]);
        stroke(255);
        strokeWeight(1);
      }

      arc(cx, cy, radius, radius, lastAngle, lastAngle + currentAngle, PIE);
      lastAngle += currentAngle;
    }

    //draw legend for outcome categories
    let legendX = 30;
    let legendY = 80;
    textAlign(LEFT, CENTER);
    textSize(13);
    for (let i = 0; i < this.outcomeLabels.length; i++) {
      fill(this.colors[i]);
      rect(legendX, legendY + i * 22, 15, 15);
      fill(0);
      noStroke();
      text(this.outcomeLabels[i], legendX + 20, legendY + i * 22 + 7);
    }
  };

  //check if mouse position hovers over a pie slice
  this.isMouseInSlice = function (cx, cy, r, start, stop) {
    let angle = atan2(mouseY - cy, mouseX - cx);
    if (angle < 0) angle += TWO_PI;
    let d = dist(mouseX, mouseY, cx, cy);
    return d <= r && angle >= start && angle < stop;
  };

  this.drawTitle = function () {
    fill(0);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(18);
    text(this.title, width / 2, 30);
  };
}