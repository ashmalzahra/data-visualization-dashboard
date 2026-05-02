function VehicleTrafficComposition() {
  this.name = 'UK Vehicle Traffic Composition';
  this.id = 'vehicle-traffic-chart';
  this.squareSize = 30;
  this.gridCols = 10;
  this.gridRows = 10;

  this.layout = {
    topMargin: 100,
    leftMargin: 100
  };

  this.colors = {
    'Cars': color(76, 114, 176),
    'LGVs': color(129, 114, 179),
    'HGVs': color(204, 185, 116),
    'Buses': color(85, 168, 104),
    'Motorcycles': color(196, 78, 82)
  };

  this.loaded = false;
  this.yearRange = '';
  this.waffleData = {};   //stores percentage breakdown by category
  this.squareData = [];   //array of individual squares for the waffle chart

  this.preload = function () {
    var self = this;
    this.data = loadTable(
      './data/vehicle/region_traffic_by_vehicle_type.csv',
      'csv',
      'header',
      function (table) {
        self.loaded = true;
      }
    );
  };

  this.setup = function () {
    if (!this.loaded) return;

    //initialize
    let totals = {
      'Cars': 0,
      'Buses': 0,
      'Motorcycles': 0,
      'LGVs': 0,
      'HGVs': 0
    };

    let years = [];

    //sum up traffic volumes and collect all unique years
    for (let i = 0; i < this.data.getRowCount(); i++) {
      totals['Cars'] += this.data.getNum(i, 'cars_and_taxis');
      totals['Buses'] += this.data.getNum(i, 'buses_and_coaches');
      totals['Motorcycles'] += this.data.getNum(i, 'two_wheeled_motor_vehicles');
      totals['LGVs'] += this.data.getNum(i, 'LGVs');
      totals['HGVs'] += this.data.getNum(i, 'all_HGVs');

      let year = this.data.getString(i, 'year');
      if (!years.includes(year)) years.push(year);
    }

    years.sort();
    this.yearRange = `(${years[0]} – ${years[years.length - 1]})`;

    //convert into approximate percentages
    let totalSum = Object.values(totals).reduce((a, b) => a + b, 0);
    for (let key in totals) {
      this.waffleData[key] = round((totals[key] / totalSum) * 100);
    }

    let allSquares = [];
    for (let category in this.waffleData) {
      for (let i = 0; i < this.waffleData[category]; i++) {
        allSquares.push(category);
      }
    }

    shuffle(allSquares, true); //randomize square placement

    this.squareData = [];
    let index = 0;
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        if (index < allSquares.length) {
          this.squareData.push({
            x: col,
            y: row,
            category: allSquares[index]
          });
          index++;
        }
      }
    }
  };

  this.destroy = function () { };

  this.draw = function () {
    if (!this.loaded) {
      console.log('Data not yet loaded');
      return;
    }

    background(255);
    textAlign(CENTER, CENTER);
    textSize(20);
    text('Vehicle Type Distribution ' + this.yearRange, width / 2, this.layout.topMargin - 60);

    let hovered = null;

    for (let s of this.squareData) {
      let x = this.layout.leftMargin + s.x * this.squareSize;
      let y = this.layout.topMargin + s.y * this.squareSize;

      //check if mouse is hovering over this square
      if (mouseX > x && mouseX < x + this.squareSize &&
        mouseY > y && mouseY < y + this.squareSize) {
        hovered = { x, y, category: s.category };
      }

      fill(this.colors[s.category]);
      stroke(255);
      rect(x, y, this.squareSize, this.squareSize);
    }

    //legend with color and percentage labels
    let legendX = this.layout.leftMargin + this.gridCols * this.squareSize + 60;
    let legendY = this.layout.topMargin;

    textSize(14);
    textAlign(LEFT, CENTER);
    let i = 0;
    for (let category in this.colors) {
      fill(this.colors[category]);
      stroke(0);
      rect(legendX, legendY + i * 30, 20, 20);

      noStroke();
      fill(0);
      text(category + ' (' + this.waffleData[category] + '%)', legendX + 30, legendY + i * 30 + 10);
      i++;
    }

    //tooltip on hover
    if (hovered !== null) {
      fill(255);
      stroke(0);
      rect(mouseX + 10, mouseY - 20, 120, 25);
      noStroke();
      fill(0);
      textAlign(LEFT, CENTER);
      text(hovered.category, mouseX + 15, mouseY - 8);
    }
  };
}
