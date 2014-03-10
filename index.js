var pubtrans_se = require('./lib/pubtrans_se');

var PngQuant = require('pngquant'),
    express = require('express'),
    app = express();

function streamPng(png, res) {
    var bufs = [];
    png.pngStream().pipe(new PngQuant()).on('error', function (err) {
        res.send(500, err.message);
    }).on('data', function (data) {
        bufs.push(data);
    }).on('end', function () {
        var data = Buffer.concat(bufs);
        res.set({
            'Content-Type': 'image/png',
            'Content-Length': data.length,
        });
        res.end(data, 'binary');
    });
}

app.get('/:z/:x/:y.png', function (req, res) {
    pubtrans_se.pngStream(req.params.z, req.params.x, req.params.y, req.query).then(function (png) {
        streamPng(png, res);
    }, function (err) {
        res.send(500, err.message);
    });
});

app.listen(8080);
console.log("Listening on port 8080");