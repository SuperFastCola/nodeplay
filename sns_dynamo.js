var AWS = require('aws-sdk');
var snsclient = new AWS.SNS();
var dynamo = new AWS.DynamoDB();
var live = false; 
var dev = {
  "apns_app":"ARN",
  "url":"ENDPOINT"
};
var prod = {
  "apns_app":"ARN",
  "url":"ENDPOINT"
};


exports.messager = function(event, context) {
    var action = event.action;

    switch(action){
      case 'subscribe':
        subscribeWithToken(event,context);
      break;

      case 'sendmessage':
        getCommuterForMessage(event,context);
      break;

      case 'getconversation':
        getConversationFromID(event,context);
      break;
    }
  };


function addConversationToCommuter(event,context){

    var eventItem = {
      conversationid: ((typeof event.Item.conversationid.N != "undefined")?event.Item.conversationid.N:event.conversationid),
      commuterid: ((typeof event.Item.to.N != "undefined")?event.Item.to.N:event.commuterid)
    };

    try{
      dynamo.updateItem({
      "TableName": "access",
          "Key" : {
            "commuterid": {"N":String(eventItem.commuterid)}
          },
          "UpdateExpression": "SET conversations.#id = if_not_exists(conversations.#id,:id)",
          "ExpressionAttributeNames":{
            "#id": eventItem.conversationid
          },
          "ExpressionAttributeValues": { 
            ":id": {"N": String(eventItem.conversationid)}
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
                addConversationIdToFromCommuter(event,context);
              }
              
      } );
    }
    catch(e){
      context.done(e);
    }
}

function deleteEndPointAndReSubscribeDevice(event,context){
   var params = {
      "EndpointArn":String(event.endpoint)
    }; 

    snsclient.deleteEndpoint(params,function(err,data){        
        if (err){
            context.done(err); 
        }
        else{
          delete event.endpoint;
          subscribeWithToken(event, context);
        }
    });
}

function subscribeWithToken(event,context){
   var params = {
      "Token":String(event.token),
      "CustomUserData":String(event.commuterid),
        "PlatformApplicationArn":((live)?prod.apns_app:dev.apns_app)
    };  
    
    console.log(event.token);
    
    snsclient.createPlatformEndpoint(params,function(err,data){        

      if (err){

          if(String(err).indexOf("already exists") !=-1 && String(err).indexOf("different attributes")){
            event.endpoint = String(err).match(/endpoint\s(.*)\salready/i)[1];
            deleteEndPointAndReSubscribeDevice(event,context);
          }
          else{
            context.done(err);  
          }
      }
      else{

            var result ={
              "commuterid" : params.CustomUserData,
              "devicetoken" :params.Token,
              "endpoint" : data.EndpointArn,
              "application": params.PlatformApplicationArn
            };
            
            updateCommuterObject(result, context);
      }
    });
}

function updateCommuterObject(event,context){

    console.log("updateCommuterObject");

    dynamo.putItem({
          "TableName": "access",
          "Item" : {
            "commuterid": { "N" : event.commuterid },
            "devicetoken":{ "S" : String(event.devicetoken) },
            "endpoint":{"S" : String(event.endpoint) },
            "conversations":{"M" :{}},
            "application": {"S" : String(event.application)}
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
            context.succeed("Subcribed");
          }
      });
}

function addConversationToCommuter(event,context){

    var eventItem = {
      conversationid: ((typeof event.Item.conversationid.N != "undefined")?event.Item.conversationid.N:event.conversationid),
      commuterid: ((typeof event.Item.to.N != "undefined")?event.Item.to.N:event.commuterid)
    };

    try{
      dynamo.updateItem({
      "TableName": "access",
          "Key" : {
            "commuterid": {"N":String(eventItem.commuterid)}
          },
          "UpdateExpression": "SET conversations.#id = if_not_exists(conversations.#id,:id)",
          "ExpressionAttributeNames":{
            "#id": eventItem.conversationid
          },
          "ExpressionAttributeValues": { 
            ":id": {"N": String(eventItem.conversationid)}
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
                addConversationIdToFromCommuter(event,context);
              }
              
      } );
    }
    catch(e){
      context.done(e);
    }
}

function addConversationIdToFromCommuter(event,context){

     console.log("addConversationIdToFromCommuter");

    var eventItem = {
      conversationid: event.Item.conversationid.N,
      commuterid: event.Item.from.N
    };

    try{
      dynamo.updateItem({
      "TableName": "access",
          "Key" : {
            "commuterid": {"N":String(eventItem.commuterid)}
          },
          "UpdateExpression": "SET conversations.#id = if_not_exists(conversations.#id,:id)",
          "ExpressionAttributeNames":{
            "#id": eventItem.conversationid
          },
          "ExpressionAttributeValues": { 
            ":id": {"N": String(eventItem.conversationid)}
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
                 context.succeed("Added COnversation ID to from Commuter");
              }
      } );
    }
    catch(e){
      context.done(e);
    }
}

function getCommuterForMessage(event,context){

    dynamo.getItem({
      "TableName": "access",
          "Key" : {
            "commuterid": {"N":String(event.tocommuterid)}
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {

            if(typeof data.Item.endpoint != "undefined" || data.Item.endpoint===null){
              var results = {
                "endpoint":data.Item.endpoint.S,
                "tocommuterid":data.Item.commuterid.N,
                "fromcommuterid":event.fromcommuterid,
                "conversationid":Number(Number(event.fromcommuterid) * Number(event.tocommuterid)),
                "message":event.message
              };
              sendMessage(results,context);
            }
            else{
              context.done("This user is not registered to receive messages");
            }
          }
      });
}

function getConversationFromID(event,context){    
      dynamo.getItem({
        "TableName": "conversations",
            "Key" : {
              "conversationid": {"N":String(event.conversationid)}
            },
            "ProjectionExpression":"participants"
        }, function(err, data) {
            if (err) {
                context.done(err);
            }
            else {  
              if(typeof data.Item != "undefined"){
                  var results = data.Item.participants.M;
                  var finalMessages = [];
                  for(var i in results){
              
                    for(var y in results[i].M.messages.L){
                      var message = {
                        timestamp : Number(results[i].M.messages.L[y].M.timestamp.N),
                        content : String(results[i].M.messages.L[y].M.content.S),
                        commuterid : Number(i),
                      };
                      finalMessages.push(message);
                    }
                  }

                  //sort table by
                  finalMessages.sort(function(a, b){
                    if (a.timestamp < b.timestamp) //sort string ascending
                      return -1;
                    if (a.timestamp > b.timestamp)
                      return 1;
                    return 0; //default return value (no sorting)
                  });
                  context.succeed(finalMessages);
              }
              else{
                context.done("Conversation not found");
              }
            }
        });
}

function getConversationAndUpdate(event,context){    
      dynamo.getItem({
        "TableName": "conversations",
            "Key" : {
              "conversationid": {"N":String(event.conversationid)}
            }
        }, function(err, data) {
            if (err) {
                console.log("Error");
                context.done(err);
            }
            else {  

                  var ts = new Date();

                  try{

                  if(typeof data.Item == "undefined"){
                    var participants = {};

                    participants[String(event.fromcommuterid)] = {
                        "M":{
                          "messages": {
                              "L":new Array(
                                  {"M":
                                    {
                                      "content": {"S":event.message},
                                      "timestamp": {"N":String(ts.getTime())}
                                    }
                                  }
                                )
                          }
                      }
                    };

                      participants[String(event.tocommuterid)] = {
                        "M":{
                          "messages": {
                              "L":[]
                          }
                      }
                    };

                    data.Item = {
                        "conversationid": { "N" : String(event.conversationid) },
                        "from":{ "N" : String(event.fromcommuterid) },
                        "to":{"N" : String(event.tocommuterid) },
                        "participants": {"M" : participants }
                    };
                  }
                  else{
                      //check for messages older than 7 days and delete
                      var previousfrom = data.Item.participants.M[String(event.fromcommuterid)].M.messages.L;
                      var previousto = data.Item.participants.M[String(event.tocommuterid)].M.messages.L;                      
                      var sevendaysold = ts.getTime() - (7 * 24 * 60 * 60 * 1000);

                      for(var i in previousfrom){
                        if(previousfrom[i].M.timestamp.N < sevendaysold){
                            previousfrom.splice(i,1);
                        }
                      }

                      for(i in previousto){
                        if(previousto[i].M.timestamp.N < sevendaysold){
                            previousto.splice(i,1);
                        }
                      }

                      data.Item.participants.M[String(event.fromcommuterid)].M.messages.L = previousfrom;
                      data.Item.participants.M[String(event.tocommuterid)].M.messages.L = previousto;

                      data.Item.participants.M[String(event.fromcommuterid)].M.messages.L.push(
                        {
                          "M":{
                             "content": {"S":event.message},
                              "timestamp": {"N":String(ts.getTime())}
                            }
                        }
                        );
                    }

                  }
                  catch(e){
                    console.log(e);
                  }
                  updateConversation(data,context);
            }
        });
}


function updateConversation(event,context){
    event.TableName = "conversations";
    dynamo.putItem(event, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
            addConversationToCommuter(event,context);
          }
      });
}

function sendMessage(event,context){
  var APNSKey = (live)?"APNS":"APNS_SANDBOX";
  var messageObject = {
    "default": String(event.message)
  };

  messageObject[APNSKey] = JSON.stringify(
  {"aps":{
    "alert":event.message,
    "badge": 1,
    "conversationid":event.conversationid,
    "from":event.fromcommuterid,
    "to":event.tocommuterid}
  });

  var params = {
        "MessageStructure":"json",
        "Message":JSON.stringify(messageObject),
        "TargetArn":String(event.endpoint)
  };

    snsclient.publish(params,function(err,data){        
      if (err) {
          console.log(err);
              context.done(err);
          }
          else {
            getConversationAndUpdate(event,context);
      }
    });       
}