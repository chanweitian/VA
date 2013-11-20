$(document).ready(function() {
	var landColor = d3.rgb("#666666"); 
	var width = height = null;

	var chart_svg = d3.select("#chart").append("svg");

	var background = chart_svg.append("rect").attr("fill", "#111");

	var visReady = false;

	var countryNamesByCode = {};

	var projection = d3.geo.mercator()
	.scale(180);

	var path = d3.geo.path()
	.projection(projection);

	var rscale = d3.scale.sqrt();

	var selectedDiseaseDeath;
	var selectedYears;
	var selectedColor;

	var selectedYear;
	var selectedCountry = null, highlightedCountry = null;

	var countryFeaturesByCode = {}, countryNamesByCode = {};

	var hivTotals, hivDeathRatesByCountry,
	tbTotals, tbDeathRatesByCountry,
	healthcareTotals, healthcareByCountry,
	nourishmentTotals, nourishmentByCountry;

//	var hivDeathByOriginCode = {};
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
	
	var nourishmentRateByCountry = {};
	var nourishmentYears = [1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011];
	var nourishmentColor = 
		d3.scale.log()
		.range(["#cf905f", "#331f0f"])
		.interpolate(d3.interpolateHcl);

	var generalYears = [1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011];
	var generalYearsDomain = [1990,2011];

	var casesByOriginCode = {};

	function str2num(str) {
		// empty string gives 0 when using + to convert
		if (str === null || str === undefined || str.length == 0) return NaN;
		return +str;
	}

	var isPlural = function(v, exp) {
		var v = Math.abs(Math.round(v/exp));
		return v >= 2;
	}

	var numberFormat = (function() {
		var short_fmt = d3.format(",.0f");
		var nfmt = d3.format(",.1f");
		var fmt = function(v) {  // remove trailing .0
			var formatted = nfmt(v);
			var m = formatted.match(/^(.*)\.0$/);
			if (m !== null) formatted = m[1];
			return formatted;
		};
		return function(v) {
			if (v == null  ||  isNaN(v)) return msg("amount.not-available");
			if (isPlural(v, 1e9)) return msg("amount.billions",  fmt(v / 1e9));
			if (v >= 1e9) return msg("amount.billions.singular",  fmt(v / 1e9));
			if (isPlural(v, 1e6)) return msg("amount.millions",  fmt(v / 1e6));
			if (v >= 1e6) return msg("amount.millions.singular",  fmt(v / 1e6));
			if (v >= 1e3) return msg("amount.thousands", fmt(v / 1e3));
			if (v < 1e3) return msg("amount.normal",fmt(v));
			return short_fmt(v);
		};
	})();

	var moneyFormat = function(v) {
		if (v == null  ||  isNaN(v)) return msg("amount.not-available");
		return msg("money", numberFormat(v));
	};

	var perhunderedThousandsFormat = function(v) { return numberFormat(v); };

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

	var timelineMargins = {left:80,top:10,bottom:5,right:80};
	var timelineWidth = 750,
	timelineHeight = 180;

	var timelineSvg = d3.select("#timeline").append("svg")
	.attr("width", timelineWidth + timelineMargins.left + timelineMargins.right);

	var timeline = timelineSvg.append("g")
	.attr("class", "chart")
	.attr("transform","translate("+timelineMargins.left+","+timelineMargins.top+")");

	$("#timeline svg").attr("height", (timelineHeight + timelineMargins.top + timelineMargins.bottom));

	var yearScale = d3.scale.linear()
	.domain(generalYearsDomain);

	var tseriesScale = d3.scale.linear()
	.range([timelineHeight, 2]);

	var t1seriesScale = d3.scale.linear()
	.range([timelineHeight, 2]);

	var tseriesLine = d3.svg.line()
	.interpolate("monotone")
	.defined(function(d) {
		return !isNaN(d.value)});

	var t1seriesLine = d3.svg.line()
	.interpolate("monotone")
	.defined(function(d) {
		return !isNaN(d.value)});

	var yearAxis = d3.svg.axis()
	.scale(yearScale)
	.orient("top")
	.ticks(timelineWidth / 70)
	.tickSize(10, 5, timelineHeight)
	.tickSubdivide(1)
	.tickPadding(5)
	.tickFormat(function(d) { return d; });

	var magnitudeAxisLeft = d3.svg.axis()
	.scale(t1seriesScale)
	.orient("left")
	.ticks(timelineHeight / 40)
	.tickSize(5, 0, 0)
	.tickPadding(2)
	.tickFormat(perhunderedThousandsFormat);

	var magnitudeAxis = d3.svg.axis()
	.scale(tseriesScale)
	.orient("right")
	.ticks(timelineHeight / 40)
	.tickSize(5, 0, 0)
	.tickPadding(2)
	.tickFormat(perhunderedThousandsFormat);

	var yearAnimation = (function() {
		var anim = {};
		var timerId = null;
		var interval = 300;
		var playing = false;
		var yearInterval = null;

		var stop = function() {
			if (timerId !== null) {
				clearInterval(timerId);
				timerId = null;
			}
		};
		var start = function() {
			if (timerId === null) {
				timerId = setInterval(next, interval);
			}
		};
		var restart = function() {
			if (playing) start();
		};
		var years = function() {
			if (yearInterval !== null) return yearInterval;
			return generalYears;
		};
		var rewind = function() {
			selectYear(years()[0], interval);
			setTimeout(restart, interval * 2);
		};
		var next = function() {
			if (yearInterval !== null  &&  years().indexOf(year) < 0) {
				year = years()[0];
			}
			var year = selectedYear + 1;
			if (year > years()[years().length - 1]) {
				stop();
				setTimeout(rewind, interval * 4);
			} else {
				selectYear(year, interval);
			}
		};
		anim.years = function(years) {
			yearInterval = (years != null ? years.splice(0) : null);
			return anim;
		};
		anim.restart = function() {
			playing = true;
			rewind();
			return anim;
		};
		anim.isPlaying = function() {
			return playing;
		};
		anim.start = function() {
			playing = true;
			start();
			return anim;
		};
		anim.stop = function() {
			playing = false;
			stop();
			return anim;
		};

		anim.interval = function(msec) {
			if (arguments.length === 0) return interval;
			interval = msec;
			return anim;
		};

		return anim;
	})();

	var mySwiper = new Swiper('#guide',{
		//Your options here:
		mode:'horizontal',
		onSlideChangeEnd : function() {
			if (visReady) slideSelected();
		}
	});

	function showGuide() {
		$("#guide").fadeIn();
		$("#countrySelect").fadeOut();
		$("#timeline .play-parent").css("visibility", "hidden");
//		$("#per-capita").fadeOut();
		yearAnimation.stop();
		slideSelected();
	};

	$("#show-intro").click(showGuide);

	function hideGuide() {
		$("#guide").fadeOut();
		$("#countrySelect").fadeIn();
		$("#color-legend").fadeIn();
//		$("#per-capita").fadeIn();
		$("#timeline .play-parent").css("visibility", "visible");
		yearAnimation.stop();
		showHIV();
		showTB();
		showHealthcare();
	};
	
	function hideNourishment() {
		d3.selectAll("#timeline g.tseries .nourishment").transition().duration(300).attr("opacity", "0");
	}
	
	function showNourishment() {
		d3.selectAll("#timeline g.tseries .nourishment").transition().duration(300).attr("opacity", "1.0");
	}
	
	function hideHIV() {
		d3.selectAll("#timeline g.tseries .hiv").transition().duration(300).attr("opacity", "0");
	}

	function showHIV() {
		d3.selectAll("#timeline g.tseries .hiv").transition().duration(300).attr("opacity", "1.0");
	}

	function hideTB() {
		d3.selectAll("#timeline g.tseries .tb").transition().duration(300).attr("opacity", "0");
	}

	function showTB() {
		d3.selectAll("#timeline g.tseries .tb").transition().duration(300).attr("opacity", "1.0");
	}

	function hideHealthcare() {
		d3.selectAll("#timeline g.tseries .healthcare").transition().duration(300).attr("opacity", "0");
	}

	function showHealthcare() {
		d3.selectAll("#timeline g.tseries .healthcare").transition().duration(300).attr("opacity", "1.0");
	}

	function slideSelected() {
		yearAnimation.stop();
		$("#guide .anim")
		.removeClass("playing")
		.text(msg("intro.animation.play"));

		switch (mySwiper.activeSlide) {
		case 0: //  Intro
			$("#color-legend").fadeIn();
			selectCountry("USA", true);
			selectYear(2011);
			showHIV();
			showTB();
			showHealthcare();
			showNourishment();
			break;
		
		case 1: // The HIV-Tuberculosis Conundrum
			$("#color-legend").fadeOut();
			selectCountry("ZAF");
			selectYear(2011);
			hideHealthcare();
			showHIV();
			showTB();
			hideNourishment();
			break;

		case 2: // A First-Class Healthcare System
			$("#color-legend").fadeOut();
			selectCountry("SWE");
			selectYear(2011);
			showHealthcare();
			showHIV();
			showTB();
			showNourishment();
			break;

		case 3:  // Is there an Efficiency Point?
			$("#color-legend").fadeOut();
			selectCountry("MEX");
			selectYear(2011);
			hideTB();
			hideHIV();
			showHealthcare();
			hideNourishment();
			break;
			
		case 4: //  The Arab Spring
			$("#color-legend").fadeIn();
			selectCountry("IRN", true);
			selectYear(2011);
			showHIV();
			showTB();
			showHealthcare();
			showNourishment();
			break;

		case 5: //  Explore the data yourself
			$("#color-legend").fadeIn();
			selectCountry("IND", true);
			selectYear(2011);
			showHIV();
			showTB();
			showHealthcare();
			showNourishment();
			break;
		}

	};

	var next = function() {
		if (visReady) {
			mySwiper.swipeNext();
		}
	};
	var prev = function() {
		if (visReady) {
			mySwiper.swipePrev();
		}
	};


	$("#guide .next").click(next);
	$("#guide .prev").click(prev);
	$("#guide .anim").click(function() {
		if (!visReady) return;
		if ($(this).hasClass("playing")) {
			$("#guide .anim")
			.removeClass("playing")
			.text(msg("intro.animation.play"));
			yearAnimation.stop();
		} else {
			var years = $(this).data("years");
			if (years != null) years = years.split(",").map(str2num);
			$("#guide .anim")
			.addClass("playing")
			.text(msg("intro.animation.stop"));

			if ($(this).data("clicked")) {
				yearAnimation.years(years).start();
			} else {
				yearAnimation.years(years).restart();
				$(this).data("clicked", true);
			}
		}
	});

	$("#timeline .play-parent").click(function() {
		if ($(this).hasClass("playing")) {
			$("#timeline .play")
			.removeClass("playing")
			.text(msg("intro.animation.play"));
			$("#timeline .play-parent")
			.removeClass("playing");
			yearAnimation.stop();
		} else {
			$("#timeline .play")
			.addClass("playing")
			.text(msg("intro.animation.stop"));
			$("#timeline .play-parent")
			.addClass("playing");
			if ($(this).data("clicked")) {
				yearAnimation.start();
			} else {
				yearAnimation.restart();
				$(this).data("clicked", true);
			}
		}
	});


	$("body").keydown(function(e) {
		if ($("#guide").is(":visible")) {
			if (e.keyCode == 37) prev();
			else if (e.keyCode == 39) next();
		}
	});


	$("#guide .skip").click(function() {
		if (visReady) hideGuide();
	});
	$("#guide .last").click(hideGuide);

	$(document).keyup(function(e) { if (e.keyCode == 27) hideGuide(); });

	function initCountryNames(world) {
		world.features.forEach(function(f) {
			countryNamesByCode[f.id] = f.properties.name;
		});
	}

	function calcCasesTotalsPerCountry() {
		var result = {}, c, ci, countries = d3.keys(hivDeathRatesByCountry);
		for (ci = 0; ci < countries.length; ci++) {
			c = countries[ci];
			result[c] = calcPerCountryValues(hivDeathRatesByCountry[c], c);
		}
		return result;
	}

	$(document).keyup(function(e) { if (e.keyCode == 27) selectCountry(null); });
	background.on("click", function() { selectCountry(null); });
	
	function highlightCountry(code){
		highlightedCountry = code;
		chart_svg.selectAll("path.land")
		.sort(function(a,b){
			if (a.id === selectedCountry) return 1;
			if (b.id === selectedCountry) return -1;
			if (a.id === code) return 1;
			if (b.id === code) return -1;
			return 0;
		});
		//updateTimeSeries();
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
		} else if (code == "nourishment"){
			selectedDiseaseDeath = nourishmentRateByCountry;
			selectedYears = nourishmentYears;
			selectedColor = nourishmentColor;
		} else{
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
		updateTimeSeries();
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
		.classed("selected", function(d) { return d.id === selectedCountry; })
		.transition()
		.duration(50)
		.attr("fill", function(d) {

			var m = diseaseByCountry[d.id];
			if (m !== undefined) {
				var val = m[selectedYear];
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
			});


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

	/* @param originCode  If null, total is returned */
	function calcPerCountryValue(value, year, originCode) {
		var m, v = str2num(value);
		if (!isNaN(v)) {
			m = calcTotalCases(year, originCode);
			if (!isNaN(m)) {
				return (v / m);
			}
		}
		return NaN;
	}

	/* @param data        An object year -> value
	 *        originCode  If null, total is returned */
	function calcPerCountryValues(data, originCode) {
		var byCountry = {}, yi, y, m, v;
		for (yi = 0; yi < generalYears.length; yi++) {
			y = generalYears[yi];
			byCountry[y] = calcPerCountryValue(data[y], y, originCode);
		}
		return byCountry;
	}

	function updateTimeSeries() {

		var hiv, tb, nourishment, healthcare;

		var country = (selectedCountry || highlightedCountry);

		if (country == null) {
			hiv = hivTotals;
			tb = tbTotals;
			nourishment = nourishmentTotals;
			healthcare = healthcareTotals;
		} else {
			hiv = hivDeathRatesByCountry[country];
			tb = tbDeathRatesByCountry[country];
			nourishment = nourishmentByCountry[country];
			healthcare = healthcareByCountry[country];
		}
		d3.select("#timeline g.tseries .legend .hiv text").text(msg("details.tseries.legend.hiv"));


		var rmax;
		var dmax;
		var cmax;
		var nmax;

		var hivSlice = d3.values(hiv).slice();
		var tbSlice = d3.values(tb).slice();
		var healthcareSlice = d3.values(healthcare).slice();
		var nourishmentSlice = d3.values(nourishment).slice();


		if (country==null){

			var hivArray = d3.values(hiv);
			var tbArray = d3.values(tb);
			var hcArray = d3.values(healthcare);
			var nourishArray = d3.values(nourishment);

			for(var i=0; i<hivArray.length; i++) { hivArray[i] = +hivArray[i] } 
			for(var i=0; i<tbArray.length; i++) { tbArray[i] = +tbArray[i] } 
			for(var i=0; i<hcArray.length; i++) { hcArray[i] = +hcArray[i] } 
			for(var i=0; i<nourishArray.length; i++) { nourishArray[i] = +nourishArray[i] } 

			rmax = d3.max(hivArray);
			dmax = d3.max(tbArray);
			cmax = d3.max(hcArray);
			nmax = d3.max(nourishArray);
		}else{
			hivSlice = hivSlice.splice(1,hivSlice.length-1);
			tbSlice = tbSlice.splice(0,tbSlice.length-2);
			healthcareSlice = healthcareSlice.slice(1,healthcareSlice.length-1);
			nourishmentSlice = nourishmentSlice.slice(1,nourishmentSlice.length-1);
			
			var hivArray = d3.values(hivSlice);
			var tbArray = d3.values(tbSlice);
			var hcArray = d3.values(healthcareSlice);
			var nourishArray = d3.values(nourishmentSlice);

			for(var i=0; i<hivArray.length; i++) { hivArray[i] = +hivArray[i] } 
			for(var i=0; i<tbArray.length; i++) { tbArray[i] = +tbArray[i] } 
			for(var i=0; i<hcArray.length; i++) { hcArray[i] = +hcArray[i] } 
			for(var i=0; i<nourishArray.length; i++) { nourishArray[i] = +nourishArray[i] } 

			rmax = d3.max(hivArray);
			dmax = d3.max(tbArray);
			cmax = d3.max(hcArray);
			nmax = d3.max(nourishArray);
		}


		var max;
		if (isNaN(rmax)){
			max = dmax;
		} else if (isNaN(dmax)){
			max = rmax;
		} else if (isNaN(nmax)){
			max = nmax;
		} else {
			max = Math.max(rmax, dmax);//add in nmax to visualize nourishment values
		}

		max *= 1.15;

		tseriesScale.domain([0, max]);
		t1seriesScale.domain([0, cmax]);

		d3.selectAll("#timeline g.tseries .tb").attr("visibility", "visible");

		renderTimeSeries("tb", tb);
		renderTimeSeries("hiv", hiv);
		//renderTimeSeries("nourishment", nourishment);
		renderTimeSeries1("healthcare", healthcare);

		timeline.select("g.magnitudeAxis").call(magnitudeAxis);
		timeline.select("g.magnitudeAxisLeft").call(magnitudeAxisLeft);
	}

	function updateDetails() {
		var details = d3.select("#details");

		details.select(".year")
		.text(selectedYear);
		
		var countryName;

		if (highlightedCountry != null  ||  selectedCountry != null) {

			var iso3 = (selectedCountry || highlightedCountry);
			countryName = countryNamesByCode[iso3];

			var tbDetails = tbDeathRatesByCountry[iso3];
			var tbValue = "N/A";
			if(tbDetails != undefined){
				var tbValue = parseFloat(tbDetails[selectedYear]).toFixed(2);
				if (tbValue == undefined || isNaN(tbValue)){
					tbValue = "N/A";   
				}
			}

					
			var hivDetails = hivDeathRatesByCountry[iso3];
			var hivValue = "N/A";
			if(hivDetails != undefined){
				hivValue = parseFloat(hivDetails[selectedYear]).toFixed(2);
				if (hivValue == undefined || isNaN(hivValue)){
					hivValue = "N/A";  
				}
			}

			var nourishmentDetails = nourishmentByCountry[iso3];
			var nourishmentValue = "N/A";
			if(nourishmentDetails != undefined){
				nourishmentValue = parseFloat(nourishmentDetails[selectedYear]).toFixed(2);
				if (nourishmentValue == undefined || isNaN(nourishmentValue)){
					nourishmentValue = "N/A";  
				}
			}
			
			var healthcareDetails = healthcareByCountry[iso3];
			var healthcareValue = "N/A";
			if(healthcareDetails != undefined){
				healthcareValue = parseFloat(healthcareDetails[selectedYear]).toFixed(2);
				if (healthcareValue == undefined || isNaN(healthcareValue)){
					healthcareValue = "N/A";   
				}
			}
			
			details.select(".hiv .value").text(hivValue);
			details.select(".tb .value").text(tbValue);
			details.select(".nourishment .value").text(nourishmentValue);
			
			if (healthcareValue == "N/A"){
				details.select(".healthcare .value").text(healthcareValue);
			}else{
				details.select(".healthcare .value").text("USD $" + healthcareValue);
			}

		} 

		details.select(".country").text(countryName);
	}

	function interpolate(t, a, b) { return a + (b - a) * t; }

	/* @param values is a map year=>value */
	function interpolateNumOfCases(values, year) {
		if (values == null) return NaN;
		var val = str2num(values[year]);

		if (isNaN(val)) {
			if (year >= 2011) {
				val = str2num(values[2010]);
			}
			else if ((year % 10) !== 0) {
				// assuming we have data only for each 10th year (which ends with 0)
				var l = Math.floor(year/10)*10, r = Math.ceil(year/10)*10;
				var t = (year - l) / (r - l);
				val = interpolate(t, str2num(values[l]), str2num(values[r]));
			}
		}

		return val;
	}

	function calcTotalCases(year, origin) {
		if (origin != undefined)
			return interpolateNumOfCases(casesByOriginCode[origin], year);

		return d3.keys(casesByOriginCode).reduce(function(sum, origin) {
			var val = interpolateNumOfCases(casesByOriginCode[origin], year);
			if (!isNaN(val)) {
				if (isNaN(sum)) sum = 0;
				sum += val;
			}
			return sum;
		}, NaN);

	}

	function nestBy(data, rollup) {
		return d3.nest()
		.key(function(d) { return d.Code; })
		.rollup(function(d) { return d[0]; })
		.map(data);
	}

	function calcTotalsByYear(values) {
		var totals = {}, i, yi, countryData, y, val, max = NaN;

		for (i=0; i<values.length; i++) {
			countryData = values[i];

			for (yi=0; yi<generalYears.length; yi++) {
				y = generalYears[yi];
//				if (totals[y] === undefined) totals[y] = NaN;

				val = str2num(countryData[y]);
				if (!isNaN(val)) {
//					if (isNaN(totals[y])) totals[y] = 0;
					if (totals[y] === undefined) totals[y] = 0;
					totals[y] += val;
				}
			}
		}
//		return remittanceYears.map(function(d,i) { return { year:d, value: totals[i] } });
		return totals;
	}

	function selectYear(year, duration) {
		var r = d3.extent(yearScale.domain());
		if (year < r[0]) year = r[0];
		if (year > r[1]) year = r[1];
		selectedYear = year;

		var t = d3.select("#visualisation")
		.transition()
		.ease("linear")
		.duration(duration);

		t.select("#timeline g.selectorHand")
		.attr("transform", "translate("+(yearScale(year))+",0)");

		//updateBubbleSizes(t); //not part of our functionality
//		if (selectedCountry !== null)
		updateTimeSeries();
		updateChoropleth();
		updateDetails();
	}

	function initTimeSeries1(name) {
		var tseries = timeline.select("g.tseries");

		if (tseries.empty()) {
			tseries = timeline.append("g")
			.attr("class", "tseries");
		}

		var path = tseries.select("path." + name);
		if (path.empty) {
			t1seriesLine
			.x(function(d) { return yearScale(d.year); })
			.y(function(d) { return t1seriesScale(d.value); });

			tseries.append("path")
			.attr("class", name)
			.attr("fill", "none");
		}

		if (tseries.select("g.legend").empty()) {
			var legend = tseries.append("g")
			.attr("class", "legend")
			.attr("transform",
//					"translate("+ Math.round(timelineWidth * 0.8 - 200)+ ", "+Math.round(timelineHeight*0.4) +")"
					"translate(10,100)"
			);
		}
	}

	function initTimeSeries(name) {
		var tseries = timeline.select("g.tseries");

		if (tseries.empty()) {
			tseries = timeline.append("g")
			.attr("class", "tseries");
		}

		var path = tseries.select("path." + name);
		if (path.empty) {
			if(name=="healthcare"){
				t1seriesLine
				.x(function(d) { return yearScale(d.year); })
				.y(function(d) { return t1seriesScale(d.value); });
			}else{
				tseriesLine
				.x(function(d) { return yearScale(d.year); })
				.y(function(d) { return tseriesScale(d.value); });
			}

			tseries.append("path")
			.attr("class", name)
			.attr("fill", "none");
		}

		if (tseries.select("g.legend").empty()) {
			var legend = tseries.append("g")
			.attr("class", "legend")
			.attr("transform",
//					"translate("+ Math.round(timelineWidth * 0.8 - 200)+ ", "+Math.round(timelineHeight*0.4) +")"
					"translate(120,10)"
			);

			var gg = legend.append("g")
			.attr("class", "hiv")
			.attr("transform", "translate(0, 10)");

			gg.append("circle")
			.attr("cx", 5)
			.attr("r", 5);
			gg.append("text")
			.attr("x", 15)
			.text(msg("details.tseries.legend.hiv"));

			gg = legend.append("g")
			.attr("class", "tb")
			.attr("transform", "translate(0, 30)");

			gg.append("circle")
			.attr("cx", 5)
			.attr("r", 5);
			gg.append("text")
			.attr("x", 15)
			.text(msg("details.tseries.legend.tb"));

			gg = legend.append("g")
			.attr("class", "healthcare")
			.attr("transform", "translate(0, 50)");

			gg.append("circle")
			.attr("cx", 5)
			.attr("r", 5);
			gg.append("text")
			.attr("x", 15)
			.text(msg("details.tseries.legend.healthcare"));
		}
	}

	function renderTimeSeries1(name, data) {
		var tseries = timeline.select("g.tseries");
		var path = tseries.select("path." + name);

		if (data == null) data = {};
		var years = generalYears; // d3.keys(data).sort();



		tseries.datum(years.map(function(y) { 
			return { year:y,  value: data[y] }; }), years)
			.select("path." + name)
			.attr("d", function(d) {
				var line = t1seriesLine(d);
				if (line == null) line = "M0,0";
				return line;
			});

	}

	function renderTimeSeries(name, data) {
		var tseries = timeline.select("g.tseries");
		var path = tseries.select("path." + name);

		if (data == null) data = {};
		var years = generalYears; // d3.keys(data).sort();



		tseries.datum(years.map(function(y) { 
			return { year:y,  value: data[y] }; }), years)
			.select("path." + name)
			.attr("d", function(d) {
				var line = tseriesLine(d);
				if (line == null) line = "M0,0";
				return line;
			});

	}

	$("#timeline .play").click(function() {
		if ($(this).hasClass("playing")) {
			$("#timeline .play")
			.removeClass("playing")
			.text(msg("intro.animation.play"));
			yearAnimation.stop();
		} else {
			$("#timeline .play")
			.addClass("playing")
			.text(msg("intro.animation.stop"));
			if ($(this).data("clicked")) {
				yearAnimation.start();
			} else {
				yearAnimation.restart();
				$(this).data("clicked", true);
			}
		}
	});

	queue()
	.defer(d3.json, "data/world-countries.json")
	.defer(d3.csv, "data/hiv-death1000.csv")
	.defer(d3.csv, "data/tb-deathrate.csv")
	.defer(d3.csv, "data/HealthExpenditurePerCapita.csv")
	.defer(d3.csv, "data/UndernourishmentPrevalence.csv")
	.await(function(err, world, hivDeath, tbDeathRate, healthExpenditure, overweightPrevalence){
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
		.on("click", function(d) { 
			selectCountry(d.id); })
		.on("mouseover", function(d) {highlightCountry(d.id)});

		var updateMap = function() {
			chart_svg.selectAll("g.map path")
			.attr("d", path);
		};

		updateMap();

		var arcs = chart_svg.append("g").attr("class", "arcs");

		var flows = hivDeath.forEach(function(flow) {
			if (casesByOriginCode[flow.Code] === undefined) {
				casesByOriginCode[flow.Code] = [];
			}
			casesByOriginCode[flow.Code].push(flow);

		});

		var gcountries = chart_svg.append("g")
		.attr("class", "countries");

		initCountryNames(world);

		hivDeathByCountry = hivDeath;
		hivDeathRatesByCountry=nestBy(hivDeath);
		hivTotals = calcTotalsByYear(hivDeath);

		tbDeathRateByCountry = tbDeathRate;
		tbDeathRatesByCountry=nestBy(tbDeathRate);
		tbTotals = calcTotalsByYear(tbDeathRate);
		
		nourishmentRateByCountry = overweightPrevalence;
		nourishmentByCountry = nestBy(overweightPrevalence);
		nourishmentTotals= calcTotalsByYear(overweightPrevalence);
		
		healthcareByCountry=nestBy(healthExpenditure);
		healthcareTotals=calcTotalsByYear(healthExpenditure);

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

//		initialzie HIV first
		selectedDiseaseDeath = hivDeathByCountry;
		selectedYears = hivYears;
		selectedColor = hivDeathColor;

		updateChoropleth();

		yearScale.range([0, timelineWidth]);

		initTimeSeries("hiv");
		initTimeSeries("tb");
		initTimeSeries("nourishment");
		initTimeSeries1("healthcare");

		var timelineAxisGroup = timeline.append("g")
		.attr("class", "timeAxis")
		.attr("transform", "translate(0,"+timelineHeight+")");

		var timelineRightAxisGroup = timeline.append("g")
		.attr("class", "magnitudeAxis")
		.attr("transform", "translate("+(timelineWidth)+",0)");

		var timelineLeftAxisGroup = timeline.append("g")
		.attr("class","magnitudeAxisLeft")
		.attr("transform","translate(0,0)");

		timelineAxisGroup.call(yearAxis);

		updateTimeSeries();
		updateColorLegend();

		var selectorHandHeight = Math.max(timelineHeight - 30, 60);

		var selectorHand = timeline.append("g")
		.attr("class", "selectorHand")
		.attr("transform", "translate("+(yearScale(selectedYear))+",0)");

		selectorHand.append("line")
		.attr("y1", timelineHeight - selectorHandHeight)
		.attr("y2", timelineHeight);


		var haloGradient = timelineSvg.append("defs")
		.append("radialGradient")
		.attr({
			id : "selectorHandHalo",
			cx : "50%", cy : "50%", r : "50%", fx : "50%", fy : "50%"
		});

		haloGradient.append("stop")
		.attr({ offset: "0%", "stop-color": "#fff", "stop-opacity": "0.0" });

		haloGradient.append("stop")
		.attr({ offset: "35%", "stop-color": "#fff", "stop-opacity": "0.05" });

		haloGradient.append("stop")
		.attr({ offset: "80%",  "stop-color": "#fff", "stop-opacity": "0.23" });

		haloGradient.append("stop")
		.attr({ offset: "100%",  "stop-color": "#fff", "stop-opacity": "0.25" });


		selectorHand.append("circle")
		.attr("class", "center")
		.attr("cx", 0)
		.attr("cy", timelineHeight - selectorHandHeight)
		.attr("r", 4);

		selectorHand.append("circle")
		.attr("class", "halo")
		.attr("opacity", "0.4")
		.attr("fill", "url(#selectorHandHalo)")
		.attr("cx", 0)
		.attr("cy", timelineHeight - selectorHandHeight)
		.attr("r", 30);

		var selectorHandDrag = d3.behavior.drag()
		.origin(Object)
		.on("drag", dragSelectorHand);

		d3.select("#timeline .selectorHand")
		.on("mouseover", function(){
			d3.select(this).select("circle.halo")
			.transition()
			.duration(250)
			.attr("opacity", "1.0");
		})
		.on("mouseout", function(){
			d3.select(this).select("circle.halo")
			.transition()
			.duration(250)
			.attr("opacity", "0.5");
		})
		.call(selectorHandDrag);


		d3.select("#timeline g.chart")
		.on("click", function() {
			var c = d3.mouse(this);
			selectYearForPosition(c[0]);
		});

		function dragSelectorHand(d) {
			var c = d3.mouse(this.parentNode);   // get mouse position relative to its container
			selectYearForPosition(c[0]);
		}

		function selectYearForPosition(cx) {
			var year = Math.round(yearScale.invert(cx));
			selectYear(year, true);
		}
		
		$("#chart g.map path.land")
        .add("#chart g.countries circle")
        .on("mousemove", function(e) {
          var d = e.target.__data__;
          var iso3 = (d.id  ||  d.iso3);
          var vals, val, text = null;

          if (selectedCountry != null) {
            if (selectedCountry !== iso3) {
              val = interpolateNumOfCases(selectedCountry, iso3, selectedYear);
              text = "<b>"+countryNamesByCode[iso3]+"</b>";
            }
          }

          if (text === null) {
            if (highlightedCountry != null) {
              vals = selectedDiseaseDeath[highlightedCountry];
              if (vals != null) {
                val = vals[selectedYear];
                text = "<b>"+countryNamesByCode[iso3]+"</b>";
              }
            }
          }

          if (text !== null) showTooltip(e, text);
        })
        .on("mouseout", hideTooltip)

		$("#sources .info")
		.on("mouseover", function(e) {
			showTooltip(e, msg($(this).data("info")));
		})
		.on("mouseout", hideTooltip);



		$("#details").fadeIn();
		$("#show-intro").fadeIn();

		visReady = true;
		slideSelected();

		var onResize = function() {
			initSizes();
			fitMapProjection();
			updateMap();
		};
		$(window).resize(onResize);
	});
});