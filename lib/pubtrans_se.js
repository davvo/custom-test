var fs = require('fs'),
    rbush = require('rbush'),
    resrobot = require('./resrobot'),
    mercator = require('globalmercator'),

    Canvas = require('canvas'),
    Promise = require('promise'),

    Image = require('canvas').Image,
    EventEmitter = require('events').EventEmitter;

function loadAllStations() {
    resrobot.getAllStations(function (err, stations) {
        if (err) {
            throw err;
        }
        var items = stations.map(function (station) {
            var coords = station.geometry.coordinates;
            return coords.concat(coords).concat([station]);
        });
        tree = rbush().load(items);
        fs.writeFile('stations.json', JSON.stringify(tree.toJSON(), null, '  '), function (err) {
            if (err) {
                throw err;
            }
            console.log("Wrote %d items to stations.json", items.length);
        });
    });
}

var tree = rbush().fromJSON(JSON.parse(fs.readFileSync('stations.json')));

setInterval(loadAllStations, 2 * 3600 * 1000);

var icons = {
    'B': 'img/buss-2x.png',
    'F': 'img/farja-2x.png',
    'J': 'img/tag-2x.png',
    'S': 'img/sparvagn-2x.png',
    'T': 'img/tag-2x.png',
    'U': 'img/tunnelbana-2x.png',
    'BF': 'img/buss.farja-2x.png',
    'BJ': 'img/tag.buss-2x.png',
    'BS': 'img/buss.sparvagn-2x.png',
    'BT': 'img/tag.buss-2x.png',
    'BU': 'img/buss.tunnelbana-2x.png',
    'FJ': 'img/tag.farja-2x.png',
    'FS': 'img/sparvagn.farja-2x.png',
    'JS': 'img/tag.sparvagn-2x.png',
    'JU': 'img/tag.tunnelbana-2x.png',
    'FJS': 'img/tag.sparvagn.farja-2x.png',
    'BFU': 'img/buss.tunnelbana.farja-2x.png',
    'BJF': 'img/tag.buss.farja-2x.png',
    'BJS': 'img/tag.buss.sparvagn-2x.png',
    'BJU': 'img/tag.buss.tunnelbana-2x.png',
    'BSU': 'img/buss.tunnelbana.sparvagn-2x.png',
    'BFJU': 'img/tag.buss.tunnelbana.farja-2x.png',
    'BFJS': 'img/tag.buss.tunnelbana.sparvagn-2x.png',
    'BJFS': 'img/tag.buss.sparvagn.farja-2x.png',
    'BFSU': 'img/buss.tunnelbana.sparvagn.farja-2x.png',
    'BFJSU': 'img/tag.buss.tunnelbana.sparvagn.farja-2x.png'
};

Object.keys(icons).forEach(function (key) {
    var path = icons[key];
    if (!fs.existsSync(path)) {
        throw new Error(key + ' -> ' + path);
    }
    var img = new Image();
    img.src = icons[key];
    icons[key] = img;
});

function getImage(feature) {
    var icon = icons[feature.properties.transports];
    if (!icon) {
        console.warn("Missing icon for %s", feature.properties.transports);
    }
    return icon;
}

function search(bounds, batchSize) {
    var ee = new EventEmitter(),
        features = tree.search(bounds);
    function emitFeatures(begin) {
        var end = Math.min(begin + (batchSize || 100), features.length),
            batch = features.slice(begin, end).map(function (feature) {
                return feature[4];
            });
        ee.emit('features', batch);
        if (end < features.length) {
            setImmediate(emitFeatures, end);
        } else {
            ee.emit('end');
        }
    }
    setImmediate(emitFeatures, 0);
    return ee;
}

module.exports = {

    pngStream: function (z, x, y, options) {
        var buffer = 20,
            scale = 2;

        var pixelBounds = mercator.tilePixelBounds(x, y, z),
            minLatLon = mercator.pixelsToLatLon(pixelBounds[0] - buffer, pixelBounds[1] - buffer, z),
            maxLatLon = mercator.pixelsToLatLon(pixelBounds[2] + buffer, pixelBounds[3] + buffer, z),
            lonLatBounds = minLatLon.reverse().concat(maxLatLon.reverse());

        var canvas = new Canvas(mercator.tileSize * scale, mercator.tileSize * scale),
            ctx = canvas.getContext('2d');

        var pixelmap = {},
            count = 0;

        var transports = (options.transports || '').split('');

        return new Promise(function (resolve, reject) {
            search(lonLatBounds).on('features', function (features) {
                var i, n = features.length;
                for (i = 0; i < n; ++i) {
                    var feature = features[i];
                    if (transports.length > 0 && !transports.some(function (transport) {
                        return feature.properties.transports.indexOf(transport) >= 0;
                    })) {
                        continue;
                    }
                    var img = getImage(feature);
                    if (img) {
                        var lonlat = feature.geometry.coordinates,
                            pixels = mercator.latLonToPixels(lonlat[1], lonlat[0], z),
                            offset = [pixels[0] - pixelBounds[0], pixels[1] - pixelBounds[1]];
                        var metaPx = Math.floor(offset[0]  / buffer) + 'x' + Math.floor(offset[1] / buffer);
                        if (!pixelmap[metaPx]) {
                            pixelmap[metaPx] = true;
                            ctx.drawImage(img, offset[0] - img.width / 2, offset[1] - img.height / 2);
                            ++count;
                        }
                    }
                }
            }).on('end', function () {
                resolve(canvas);
            });
        });

    }

}