
var landColor = d3.rgb("#666666"); 
var width = height = null;

var chart_svg = d3.select("#chart").append("svg");

var background = chart_svg.append("rect")
							.attr("fill", "#111");

var countryNamesByCode = {};

var projection = d3.geo.mercator()
                    .scale(180);

var path = d3.geo.path()
					.projection(projection);
 							
var rscale = d3.scale.sqrt();

var selectedYear = "2011";

var selectedCountry = null;


//var hivDeathByOriginCode = {};
var hivDeathByCountry = {};
var hivYears = [1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011];
var hivDeathColor =
  d3.scale.log()
    .range(["#9d3a2f", "#210605"])
    .interpolate(d3.interpolateHcl);

var tbDeathRateByCountry = {};
var tbYears = [1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011];
var tbDeathColor =  
  d3.scale.log()
    .range(["#2F9D96", "#052021"])
    .interpolate(d3.interpolateHcl);



var selectedDiseaseDeath;
var selectedYears;
var selectedColor;





function initSizes() {
  width = $(window).width();
  height = $(window).height() - 40;
  background
    .attr("width", width)
    .attr("height", height);
  projection.translate([width/2.3,height/2]);
  chart_svg
    .attr("width", width)
    .attr("height", height);
  rscale.range([0, height/45]);
};

initSizes();

function initCountryNames(world) {
  world.features.forEach(function(f) {
      countryNamesByCode[f.id] = f.properties.name;
  });
}

function highlightCountry(code){
    highlightedCountry = code;
    chart_svg.selectAll("path.land")
      .sort(function(a,b){
        //if (a.id === selectedCountry) return 1;
        //if (b.id === selectedCountry) return -1;
        if (a.id === code) return 1;
        if (b.id === code) return -1;
        return 0;
      });


}

function showTooltip(e, html) {
  var tt = $("#tooltip"), x = (e.pageX + 10), y = (e.pageY + 10);
  tt.html(html);
  if (y -10 + tt.height() > $(window).height()) {
    y = $(window).height() - tt.height() - 20;
  }
  if (x -10 + tt.width() > $(window).width()) {
    x = $(window).width() - tt.width() - 20;
  }
  tt.css("left", x + "px")
    .css("top", y + "px")
    .css("display", "block");
}


function hideTooltip() {
  $("#tooltip")
    .text("")
    .css("display", "none");
}

function selectDisease(code){
  if(code == "hiv"){
    selectedDiseaseDeath = hivDeathByCountry;
    selectedYears = hivYears;
    selectedColor = hivDeathColor;
  } else {
    selectedDiseaseDeath = tbDeathRateByCountry;
    selectedYears = tbYears;
    selectedColor = tbDeathColor;
  }

  updateChoropleth();
  updateColorLegend();
}


function selectCountry(code, dontUnselect) {

  if (selectedCountry === code) {
    if (dontUnselect) return;
    selectedCountry = null;
  } else {
    selectedCountry = code;
  }

  updateChoropleth();
  updateDetails();
  //updateTimeSeries();
}




function updateChoropleth() {

  var max =
    // calc max over time for all countries
    d3.max(selectedDiseaseDeath, function(d) {
      return d3.max(selectedYears.map(function(y) { return +d[y]; }));
    });

    selectedColor.domain([1, max]);

    var diseaseByCountry = d3.nest()
    .key(function(d) { return d.Code; })
    .rollup(function(d) { return d[0]; })
    .map(selectedDiseaseDeath);


    chart_svg.selectAll("path.land")
    .transition()
    .duration(50)
    .attr("fill", function(d) {

      var m = diseaseByCountry[d.id];
      if (m !== undefined) {
        var val = m[2011];
        if (!isNaN(val) && (val > 0 /* for log scale to work*/)) return selectedColor(val);
      }

      return landColor;   //.darker(0.5);
    });




  //updateColorLegend();


}

function updateColorLegend(){

  var container = d3.select("#color-legend");
  var margin = {left:40, top:30, right:20, bottom:20};
  var w = 150 - margin.left - margin.right,
      h = 60 - margin.top - margin.bottom;

  var rect, gradient;

  var svg, defs, g = container.select("g.color-legend");

  //clear previous legend to be appended
  g.remove();

  if (g.empty()) {
    svg = container.append("svg")
      .attr("width", w + margin.left + margin.right)
      .attr("height", h + margin.top + margin.bottom);
    gradient = svg.append("defs")
      .append("linearGradient")
        .attr({ id : "scale-gradient", x1 :"0%", y1 :"0%", x2 : "100%", y2:"0%" });
    gradient.append("stop")
      .attr({ offset:"0%", "stop-color": selectedColor.range()[0] });
    gradient.append("stop")
      .attr({ offset:"100%", "stop-color": selectedColor.range()[1] });

    g = svg.append("g")
        .attr("class", "color-legend")
        .attr("transform", "translate("+margin.left+","+margin.top+")");

    rect = g.append("rect")
      .attr({
        "class": "gradient",
        stroke : "#aaa",
        "stroke-width" : "0.3",
        width: w, height: h,
        fill: "url(#scale-gradient)"
      })


    g.append("text")
      .attr({ "class":"title", x : w/2, y : -7, "text-anchor":"middle" })
      .text("Death Rate");

    g.append("text")
      .attr({ "class":"axis", x : 0, y : h + 13, "text-anchor":"middle" })
      .text("Few");

    g.append("text")
      .attr({ "class":"axis", x : w, y : h + 13, "text-anchor":"middle" })
      .text("Many");
  }

  rect = g.select("rect.gradient");
}

function updateDetails() {
  var details = d3.select("#details");

  details.select(".year")
    .text(selectedYear);

  var diseaseByCountry = d3.nest()
    .key(function(d) { return d.Code; })
    .rollup(function(d) { return d[0]; })
    .map(selectedDiseaseDeath);

  var countryName, deathByYear;

  if (highlightedCountry != null  ||  selectedCountry != null) {
    var iso3 = (selectedCountry || highlightedCountry);
    countryName = countryNamesByCode[iso3];
    var m = diseaseByCountry[iso3];
    var val = "N/A";
    if (m !== undefined) {
        val = parseFloat(m[2011]).toFixed(2);   
    }



    details.select(".death .value").text(val);
    
    //details.select(".migrants .title").text(msg("details.migrants.title.selected-country"));
    //details.select(".remittances .title").text(msg("details.remittances.title.selected-country"));
  } 

  details.select(".country").text(countryName);
}




queue()
  .defer(d3.json, "data/world-countries.json")
  .defer(d3.csv, "data/hiv-death1000.csv")
  .defer(d3.csv, "data/tb-deathrate.csv")
  .await(function(err, world, hivDeath, tbDeathRate){
    var leftMargin = 350; // Math.max(100, width*0.4);
    var fitMapProjection = function() {
      fitProjection(projection, world, [[leftMargin, 60], [width - 20, height-120]], true);
    };
    
    fitMapProjection();

    chart_svg.append("g")
       	.attr("class", "map")
      	.selectAll("path")
        .data(world.features)
        .enter().append("path")
        .attr("class", "land")
        .attr("fill", landColor)
        .attr("data-code", function(d) { return d.id; })
        .on("click", function(d) { selectCountry(d.id); })
        .on("mouseover", function(d) {highlightCountry(d.id)});

    var updateMap = function() {
      chart_svg.selectAll("g.map path")
        .attr("d", path);
    };

    updateMap();

    var gcountries = chart_svg.append("g")
      .attr("class", "countries");

    initCountryNames(world);

    hivDeathByCountry = hivDeath;
    tbDeathRateByCountry = tbDeathRate;

    $("#chart g.map path.land")
      .on("mousemove", function(e) {
       var d = e.target.__data__;
       var iso3 = (d.id  ||  d.iso3);
       var text = "<b>"+"ateonuh"+"</b>";

       if(highlightedCountry != null){
        text = "<b>"+countryNamesByCode[iso3]+"</b>";
       }

       if(text != null){
        showTooltip(e,text);
       }
    })
    .on("mouseout", hideTooltip);

    $("#disease-radio").click(function(){
      var code = $('input:radio[name=disease]:checked').val();
      selectDisease(code);
    });

    //initialzie HIV first
    selectedDiseaseDeath = hivDeathByCountry;
    selectedYears = hivYears;
    selectedColor = hivDeathColor;


    updateChoropleth();
    updateColorLegend();

});
 