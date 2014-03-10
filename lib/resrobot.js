var fs = require('fs'),
    request = require('request'),
    readline = require('readline');
    parseString = require('xml2js').parseString;

function xmlApi(action) {
    return request.get({
        url: 'http://xmlapieniro.resrobot.se/xmlapi/' + action + 'XML.action',
        qs: {
            user: 'eniro',
            password: 'pAc72.Ray!',
            apiVersion: '2.1',
            coordSys: 'WGS84'
        }
    });
}

module.exports = {

    getTransportModeList: function (callback) {
        var buffers = [];
        xmlApi('TransportModeList').on('data', function(data) {
            buffers.push(data);
        }).on('end', function () {
            var xml = Buffer.concat(buffers).toString();
            parseString(xml, function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, result.transportmodelistresult.transport.map(function (transport) {
                        return {
                            type: transport.$.type,
                            displayType: transport.$.displaytype,
                            name: transport._
                        };
                    }));
                }
            });
        });
    },

    getProducerList: function (callback) {
        var buffers = [];
        xmlApi('ProducerList').on('data', function(data) {
            buffers.push(data);
        }).on('end', function () {
            var xml = Buffer.concat(buffers).toString();
            parseString(xml, function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, result.producerlistresult.producer.map(function (producer) {
                        return {
                            id: producer.$.id,
                            name: producer.name[0],
                            url: producer.homepageurl[0]
                        };
                    }));
                }
            });
        });
    },

    getAllStations: function (callback) {
        var stations = [];
        readline.createInterface({
            input: xmlApi('AllStations'),
            output: process.stdout,
            terminal: false
        }).on('line', function(line) {
            parseString(line, function (err, result) {
                try {
                    var location = result.location;
                    var station = {
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [parseFloat(location.$.x), parseFloat(location.$.y)]
                        },
                        properties: {
                            id: location.$.id,
                            name: location.name[0],
                            transports: '',
                            producers: []
                        }
                    };
                    var types = {};
                    location.transportlist[0].transport.forEach(function (item) {
                        types[item.$.displaytype] = true;
                    });
                    station.properties.transports = Object.keys(types).join('');
                    location.producerlist[0].producer.forEach(function (item) {
                        station.properties.producers.push(item.$);
                    });
                    stations.push(station);
                } catch (err) {
                    // oops
                }
            });
        }).on('close', function () {
            callback(null, stations);
        });
    }
};
