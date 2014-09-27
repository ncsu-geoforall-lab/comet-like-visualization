/*
Copyright (C) 2013-2014 by Vaclav Petras and Cameron Beccario

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software Foundation,
either version 2 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

If you not have received a copy of the GNU General Public License along
with this program, see http://www.gnu.org/licenses/.
*/

/**
 * Returns a random number between min (inclusive) and max (exclusive).
 */
function rand(min, max) {
    return min + Math.random() * (max - min);
}


function report(e) {
    log.error(e);
    displayStatus(null, e.error ? e.error == 404 ? "No Data" : e.error + " " + e.message : e);
}

    /**
     * An object to perform logging when the browser supports it.
     */
    var log = {
        debug:   function(s) { if (console && console.log) console.log(s); },
        info:    function(s) { if (console && console.info) console.info(s); },
        error:   function(e) { if (console && console.error) console.error(e.stack ? e + "\n" + e.stack : e); },
        time:    function(s) { if (console && console.time) console.time(s); },
        timeEnd: function(s) { if (console && console.timeEnd) console.timeEnd(s); }
    };

function binarySearch(a, v) {
    var low = 0, high = a.length - 1;
    while (low <= high) {
	var mid = low + ((high - low) >> 1), p = a[mid];
	if (p < v) {
	    low = mid + 1;
	}
	else if (p === v) {
	    return mid;
	}
	else {
	    high = mid - 1;
	}
    }
    return -(low + 1);
}


/**
 * Draw particles with the specified vector field. Frame by frame, each particle ages by one and moves according to
 * the vector at its current position. When a particle reaches its max age, reincarnate it at a random location.
 *
 * Per frame, draw each particle as a line from its current position to its next position. The speed of the
 * particle chooses the line style--faster particles are drawn with lighter styles. For performance reasons, group
 * particles of the same style and draw them within one beginPath()-stroke() operation.
 *
 * Before each frame, paint a very faint alpha rectangle over the entire canvas to provide a fade effect on the
 * particles' previously drawn trails.
 */
function animate(settings, field) {
    var bounds = settings.displayBounds;
    var buckets = settings.styles.map(function() { return []; });
    var particles = [];
    for (var i = 0; i < settings.particleCount; i++) {
	particles.push(field.randomize({age: rand(0, settings.maxParticleAge)}));
    }

    function evolve() {
	buckets.forEach(function(bucket) { bucket.length = 0; });
	particles.forEach(function(particle) {
	    if (particle.age > settings.maxParticleAge) {
		field.randomize(particle).age = 0;
	    }
	    var x = particle.x;
	    var y = particle.y;
	    var v = field(x, y);  // vector at current position
	    var m = v[2];
	    if (m === NIL) {
		particle.age = settings.maxParticleAge;  // particle has escaped the grid, never to return...
	    }
	    else {
		var xt = x + v[0];
		var yt = y + v[1];
		if (m > INVISIBLE && field(xt, yt)[2] > INVISIBLE) {
		    // Path from (x,y) to (xt,yt) is visible, so add this particle to the appropriate draw bucket.
		    particle.xt = xt;
		    particle.yt = yt;
		    buckets[settings.styleIndex(m)].push(particle);
		}
		else {
		    // Particle isn't visible, but it still moves through the field.
		    particle.x = xt;
		    particle.y = yt;
		}
	    }
	    particle.age += 1;
	});
    }

    var g = d3.select(FIELD_CANVAS_ID).node().getContext("2d");
    g.lineWidth = 1.5;
    g.fillStyle = settings.fadeFillStyle;

    function draw() {
	// Fade existing particle trails.
	var prev = g.globalCompositeOperation;
	g.globalCompositeOperation = "destination-in";
	g.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
	g.globalCompositeOperation = prev;

	// Draw new particle trails.
	buckets.forEach(function(bucket, i) {
	    if (bucket.length > 0) {
		g.beginPath();
		g.strokeStyle = settings.styles[i];
		bucket.forEach(function(particle) {
		    g.moveTo(particle.x, particle.y);
		    g.lineTo(particle.xt, particle.yt);
		    particle.x = particle.xt;
		    particle.y = particle.yt;
		});
		g.stroke();
	    }
	});
    }

    (function frame() {
	try {
	    if (settings.animate) {
		// var start = +new Date;
		evolve();
		draw();
		// var duration = (+new Date - start);
		setTimeout(frame, settings.frameRate /* - duration*/);
	    }
	}
	catch (e) {
	    report(e);
	}
    })();
}


    /**
     * Returns a function f(x, y) that defines a vector field. The function returns the vector nearest to the
     * point (x, y) if the field is defined, otherwise the "nil" vector [NaN, NaN, NIL (-2)] is returned. The method
     * randomize(o) will set {x:, y:} to a random real point somewhere within the field's bounds.
     */
    function createField(columns) {
        var nilVector = [NaN, NaN, NIL];
        var field = function(x, y) {
            var column = columns[Math.round(x)];
	    //return [rand(0,5), 1, 10];
            if (column) {
                var v = column[Math.round(y)];
                if (v) {
                    return v;
                }
            }
            return nilVector;
        }

        // Create a function that will set a particle to a random location in the field. To do this uniformly and
        // efficiently given the field's sparse data structure, we build a running sum of column widths, starting at 0:
        //     [0, 10, 25, 29, ..., 100]
        // Each value represents the index of the first point in that column, and the last element is the total
        // number of points. Choosing a random point means generating a random number between [0, total), then
        // finding the column that contains this point by doing a binary search on the array. For example, point #27
        // corresponds to w[2] and therefore columns[2]. If columns[2] has the form [1041, a, b, c, d], then point
        // #27's coordinates are {x: 2, y: 1043}, where 1043 == 27 - 25 + 1 + 1041, and the value at that point is 'c'.

        field.randomize = function() {
            var w = [0];
            for (var i = 1; i <= columns.length; i++) {
                var column = columns[i - 1];
                w[i] = w[i - 1] + (column ? column.length - 1 : 0);
            }
            var pointCount = w[w.length - 1];

            return function(o) {
		while (true) {
		    o.x = Math.floor(rand(0, settings.displayBounds.width));
		    o.y = Math.floor(rand(0, settings.displayBounds.height));
		    if (probabilityMap && rand(0, 1) < probabilityMap[o.x][o.y])
			return o;
		    else
			return o;
		}
		// disabled code below
                var p = Math.floor(rand(0, pointCount));  // choose random point index
                var x = binarySearch(w, p);  // find column that contains this point
                x = x < 0 ? -x - 2 : x;  // when negative, x refers to _following_ column, so flip and go back one
                while (!columns[o.x = x]) {  // skip columns that have no points
                    x++;
                }
                // use remainder of point index to index into column, then add the column's offset to get actual y
                o.y = p - w[x] + 1 + columns[x][0];
                return o;
            }
        }();

        return field;
    }


function asColorStyle(r, g, b, a) {
    return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
}

    /**
     * An object {width:, height:} that describes the extent of the browser's view in pixels.
     */
    var view = function() {
        var w = window, d = document.documentElement, b = document.getElementsByTagName("body")[0];
        var x = w.innerWidth || d.clientWidth || b.clientWidth;
        var y = w.innerHeight || d.clientHeight || b.clientHeight;
        return {width: x, height: y};
    }();


var INVISIBLE = -1;  // an invisible vector
var NIL = -2;       // non-existent vector

var bounds = {
    x: 0,
    y: 0,
    width: columns.length,
    height: columns[0].length
}
var isFF = /firefox/i.test(navigator.userAgent);
var styles = [];
var settings = {
   // projection: projection,
    displayBounds: bounds,
    particleCount: Math.round(bounds.width * bounds.height / 100),
    maxParticleAge: 200,  // max number of frames a particle is drawn before regeneration
    velocityScale: +(bounds.height / 700).toFixed(3),  // particle speed as number of pixels per unit vector
    fieldMaskWidth: isFF ? 2 : Math.ceil(bounds.height * 0.06),  // Wide strokes on FF are very slow
    fadeFillStyle: isFF ? "rgba(0, 0, 0, 0.95)" : "rgba(0, 0, 0, 0.97)",  // FF Mac alpha behaves differently
    frameRate: 10,  // desired milliseconds per frame
    animate: true,
    styles: styles,
    styleIndex: function(m) {  // map wind speed to a style
	return Math.floor(Math.min(m, 10) / 10 * (styles.length - 1));
    }
};

for (var j = 50; j <= 180; j += 5) {
    styles.push(asColorStyle(255, j, 30, 1));
}

var FIELD_CANVAS_ID = "#field-canvas";

d3.select(FIELD_CANVAS_ID).attr("width", bounds.width).attr("height", bounds.height);

field = createField(columns);
animate(settings, field);

