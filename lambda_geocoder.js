var AWS = require('aws-sdk');
var https = require('https');

exports.geocoder = function(event, context) {
	switch(event.action){
		default:
			getCoordinatesFromAddress(event, context)		
		break;
	}
};

function getCoordinatesFromAddress(event, context){
	var getCoordinatesAddress = String(event.street).replace(/\s/g,"+");
	getCoordinatesAddress += (",+" +  String(event.city).replace(/\s/g,"+"));
	getCoordinatesAddress += ",+" +  event.state;
	getCoordinatesAddress += ",+" +  event.zip;

	var options = {
		hostname: 'maps.googleapis.com',
		port: 443,
		path: '/maps/api/geocode/json?address=' + getCoordinatesAddress  + '&key=APIKEY',
		method: 'GET'
	};

	var req = https.request(options, function(res) {
		var output = "";

		res.on('data', function(d) {
			output += d.toString();
		});

		res.on('end', function(d) {
			output = JSON.parse(output);
			output = output.results[0].geometry.location;
			output.address = {
				"street":event.street,
				"city":event.city,
				"state":event.state,
				"zip":event.zip
			}

			context.succeed(output);
		});

	});

	req.on('error', function(e) {
		context.done(error);
	});

	req.end();
}
