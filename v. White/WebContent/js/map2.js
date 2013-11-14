
var landColor = d3.rgb("#666666"); 
var width = height = null;

var chart_svg = d3.select("#chart").append("svg");

var background = chart_svg.append("rect")
							.attr("fill", "#111");

var projection = d3.geo.projection(d3.geo.hammer.raw(1.75, 2))
						.rotate([-10, -45])
						.scale(180);
var path = d3.geo.path()
					.projection(projection);
							
var rscale = d3.scale.sqrt();

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


d3.json('data/world-countries.json', function(collection) {
  group.selectAll('path')
  .data(collection.features)
  .enter().append('path')
  .attr('d', d3.geo.path().projection(projection))
  .attr('id', function(d){return d.properties.name.replace(/\s+/g, '')})
  .style('fill', 'gray')
  .style('stroke', 'white')
  .style('stroke-width', 1);
}) ;
