var AWS = require('aws-sdk');
var dynamo = new AWS.DynamoDB();

exports.favorites = function(event, context) {
    var action = event.action;

    switch(action){
      
      case 'getFavorites':
        getFavoritesForCommuter(event,context);
      break;

      case 'putFavorites':
        setFavoritesForCommuter(event,context);
      break;
    }
};

function setFavoritesForCommuter(event,context){

    var actionVerb = (event.favorite=="true" || event.favorite=="1")?"ADD":"DELETE";
    dynamo.updateItem({
    "TableName": "favorites",
        "Key" : {
          "commuterid": {"N":String(event.commuterid)}
        },
        "UpdateExpression": actionVerb + " #favs :favdata",
        "ExpressionAttributeNames": { 
          "#favs": "favorites"
        },
        "ExpressionAttributeValues": { 
          ":favdata": {"NS" :[String(event.toggleid)]
              
          }
        }
    }, function(err, data) {
        if (err) {
            context.done(err);
        }
        else {
          context.succeed(event);
      }
    });
}

function getFavoritesForCommuter(event,context){
    dynamo.getItem({
        "TableName": "favorites",
        "Key" : {
            "commuterid": {"N":String(event.userOrigins.commuterid)}
         }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
              
            if(typeof data.Item.favorites != "undefined"){
                if(data.Item.favorites.NS.length>0){
                  event.favorites = [];
                  for(var i in data.Item.favorites.NS){
                    event.favorites.push(data.Item.favorites.NS[i]);
                  }
                  retrieveFavoritesDataForCommuter(event,context);
                }
                else{
                    context.done({"error":"no favorites found"});
                }  
            }
            else{
                context.done({"error":"no favorites found"});
            }
          }
      } );
}

function retrieveFavoritesDataForCommuter(event,context){
  var keys = [];
  for(var i in event.favorites){
    keys.push({"commuterid":{"N":String(event.favorites[i])}});
  }
    
  var dataObject = {
      "RequestItems": {
        "commuters": {
            "Keys": keys
        }
      }
  };
    
  dynamo.batchGetItem(dataObject, function(err, data) {
      if (err) {
          context.done(err);
      }
      else {

          event.userDestinations = [];

          if(data.Responses.commuters.length>0){
            for(var y in data.Responses.commuters){
              var current = JSON.parse(data.Responses.commuters[y].data.S);
                event.userDestinations.push({
                "firstName":current.firstName,
                "lastName":current.lastName,
                "photoUrl":(typeof current.photoUrl != "undefined" && current.photoUrl!==null)?current.photoUrl:null, 
                "lastCommuteActivity":current.lastCommuteActivity,
                "originDistance":0,
                "destinationDistance":0,
                "cellPhone":(typeof current.cellPhone != "undefined" && current.cellPhone!==null)?current.cellPhone:null,
                "email":(typeof current.email != "undefined" && current.email!==null)?current.email:null,
                "favorite":"1",
                "allowChat":true,
                "commuterId":current.id,
                "home":{
                  "lat":current.homeLat,
                  "lon":current.homeLon
                },
                "work":{
                  "lat":current.workLat,
                  "lon":current.workLon
                }
              });
              }
              getDistanceFromCoordinates(event,context);
          }
          else{
               context.done({"error":"no results"});
          }
      }
    });
}

function getDistanceFromCoordinates(event, context){
  
  var https = require('https');

  var origins = null;
  var originsParams = "";
  var destinations = null;
  var totalDestinations = 0;
  var totalCommutersToCompare = 0;
  var destinationsParams = "";
    
  if(typeof event.userOrigins != "undefined"){
    
    origins = event.userOrigins;
    originsParams = (String(origins.home.lat) + "," + String(origins.home.lon));
    originsParams += "|" + (String(origins.work.lat) + "," + String(origins.work.lon));
    
    if(typeof event.userDestinations != "undefined"){
        destinations = event.userDestinations;
        totalCommutersToCompare = destinations.length;

        console.log("HOME DISTANCES FIRST");
        for(var i = 0;i<destinations.length;i++){
            destinationsParams+= (String(destinations[i].home.lat) + "," + String(destinations[i].home.lon) + "|"); 
            destinationsParams+= (String(destinations[i].work.lat) + "," + String(destinations[i].work.lon)); 
            if(typeof destinations[i+1] != "undefined"){
              destinationsParams+="|";
            }
        }

        totalDestinations = totalCommutersToCompare*2;
    }
    
  }

  var options = {
    hostname: 'maps.googleapis.com',
    port: 443,
    path: '/maps/api/distancematrix/json?origins=' + originsParams  + '&destinations=' + destinationsParams + '&units=imperial&key=APIKEY',
    method: 'GET'
  };

  var req = https.request(options, function(res) {
    var output = "";

    res.on('data', function(d) {
      output += d.toString();
    });

    res.on('end', function(d) {
      output = JSON.parse(output);

      var currentCompare = 0;
      var keys = [];
      var start = 0;
      var end = 1;
      var inc = 2;

      for(var c=0; c<totalCommutersToCompare;c++ ){
        for(var x in output.rows){
          if(x%2===0){
            keys[0] = "home_to_home";
            keys[1] = "home_to_work";
          }
          else{
            keys[0] = "work_to_home";
            keys[1] = "work_to_work"; 
          }

          if(keys[0]=="home_to_home"){
            destinations[c].originDistance = output.rows[x].elements[start].distance.text;
          }

          if(keys[1]=="work_to_work"){
            destinations[c].destinationDistance = output.rows[x].elements[end].distance.text;
          }

          destinations[c][keys[0]] = output.rows[x].elements[start].distance.text;
          destinations[c][keys[1]] = output.rows[x].elements[end].distance.text;
        }
        start+=inc;
        end+=inc;      
      }

      context.succeed(event);

    });//res.on('end', function(d)

  }); //req = https.request(options, function(res)

  req.on('error', function(e) {
    context.done(error);
  });

  req.end();
}

