function TechDiversityGender() {

  this.name = 'Tech Diversity: Gender';
  this.id = 'tech-diversity-gender';

  this.layout = {
    leftMargin: 130,
    rightMargin: function() { return width; },
    topMargin: 30,
    bottomMargin: function() { return height; },
    pad: 5,

    plotWidth: function() {
      return this.rightMargin() - this.leftMargin;
    },

    grid: true,
    numXTickLabels: 10,
    numYTickLabels: 8,
  };

  this.femaleColour = color(255, 0, 0);
  this.maleColour = color(0, 255, 0);

  this.loaded = false;
  this.preload = function() {
    var self = this;
    this.data = loadTable(
      './data/tech-diversity/gender-2018.csv', 'csv', 'header',
      function(table) {
        self.loaded = true;
      }
    );
  };

  this.setup = function() {
    textSize(16);
  };

  this.destroy = function() {
  };

  this.draw = function() {
    if (!this.loaded) {
      console.log('Data not yet loaded');
      return;
    }

    // Calculate midX here since plotWidth() now depends on current width
    this.midX = (this.layout.plotWidth() / 2) + this.layout.leftMargin;

    // Draw category labels (Female, 50%, Male)
    this.drawCategoryLabels();

    let lineHeight = (this.layout.bottomMargin() - this.layout.topMargin) / this.data.getRowCount();

    for (let i = 0; i < this.data.getRowCount(); i++) {
      let lineY = (lineHeight * i) + this.layout.topMargin;

      let company = {
        name: this.data.getString(i, 'company'),
        female: this.data.getNum(i, 'female'),
        male: this.data.getNum(i, 'male')
      };

      // Draw company name
      fill(0);
      noStroke();
      textAlign(RIGHT, TOP);
      text(company.name,
           this.layout.leftMargin - this.layout.pad,
           lineY);

      // Draw female bar
      fill(this.femaleColour);
      rect(this.layout.leftMargin,
           lineY,
           this.mapPercentToWidth(company.female),
           lineHeight - this.layout.pad);

      // Draw male bar
      fill(this.maleColour);
      rect(this.layout.leftMargin + this.mapPercentToWidth(company.female),
           lineY,
           this.mapPercentToWidth(company.male),
           lineHeight - this.layout.pad);
    }

    // Draw 50% vertical line
    stroke(150);
    strokeWeight(1);
    line(this.midX,
         this.layout.topMargin,
         this.midX,
         this.layout.bottomMargin());
  };

  this.drawCategoryLabels = function() {
    fill(0);
    noStroke();
    textAlign(LEFT, TOP);
    text('Female',
         this.layout.leftMargin,
         this.layout.pad);

    textAlign(CENTER, TOP);
    text('50%',
         this.midX,
         this.layout.pad);

    textAlign(RIGHT, TOP);
    text('Male',
         this.layout.rightMargin(),
         this.layout.pad);
  };

  this.mapPercentToWidth = function(percent) {
    return map(percent,
               0,
               100,
               0,
               this.layout.plotWidth());
  };
}