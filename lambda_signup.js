var AWS = require('aws-sdk');
var dynamo = new AWS.DynamoDB();

exports.signup = function(event, context) {
    var action = event.action;

    switch(action){
      
      case 'checkForEmail':
        getCommuterForEmail(event,context);
      break;

      case 'emailVerified':
        setEmailAsVerified(event,context);
      break;

      case 'updateCommuter':
        updateCommuterProfile(event,context);
      break;

      case 'confirmVerificaton':
        confirmEmailAddress(event,context);
      break;

      case 'createNewCommuterID':
        updateCommuterTotal(event,context);
      break;

      case 'createCommuter':
        addNewCommuterObject(event,context);
      break;
    }
   };


function getLastCommuterID(event,context){
      dynamo.getItem({
        "TableName": "counter",
        "Key" : {
            "count": {"N":String(1)}
         }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
              context.succeed({"newcommuterid": Number(data.Item.commutertotal.N)});
          }
      } );
}

function addNewCommuterObject(event,context){
   
   var newcommuter = JSON.parse(event.commuter);

  dynamo.putItem({
      "TableName": "commuters",
        "Item" : {
            "commuterid": {"N":String(newcommuter.id)},
            "data":{"S":JSON.stringify(newcommuter)}
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
            addNewTemplate(event,context);
          }
              
      } );
}

function addNewTemplate(event,context){
    var newcommuter = JSON.parse(event.commuter);

     dynamo.putItem({
          "TableName": "templates",
            "Item" : {
                "commuterid": {"N":String(newcommuter.id)},
                "templates":{"S":JSON.stringify([newcommuter.firstTemplate])}
              }
          }, function(err, data) {
              if (err) {
                  context.done(err);
              }
              else {
                setSignUpAsCompleted(event,context);
              }
     });
}

function updateCommuterTotal(event,context){
      dynamo.updateItem({
        "TableName": "counter",
        "Key" : {
            "count": {"N":String(1)}
         },
        "UpdateExpression": "SET commutertotal = commutertotal + :amt",
        "ExpressionAttributeValues": { 
          ":amt": {"N": String(1)}
        }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
              getLastCommuterID(event,context);
          }
      } );
}

function setEmailAsVerified(event,context){
    try{
      event.email = String(event.email).trim();
      
      dynamo.updateItem({
      "TableName": "commuteremails",
          "Key" : {
            "email": {"S":String(event.email)}
          },
          "UpdateExpression": "SET #v=:verified",
          "ExpressionAttributeNames": { 
            "#v": "verified"
          },
          "ExpressionAttributeValues": { 
            ":verified": {"BOOL": true}
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
              context.succeed("Email Verified");
          }
      } );
    }
    catch(e){
      context.done(e);
    }
} 


function sendVerification(event,context){

  var sourceemail = "EMAIL";
  var verficationlink = "appbundleid://?verificationcode=" + event.verificationcode; //to open app from email

  var htmlcode = '<a href=\"' + verficationlink + '\">' +  verficationlink + '</a>';

  var sesclient = new AWS.SES();
  var params = {
      'Source': sourceemail,
      'Destination': {
        'ToAddresses':[event.email]
      },
      'Message': {
        'Subject':{
            'Data': "SignUp Verification",
            'Charset': 'UTF-8'
          },
        'Body':{
          'Html':{
            'Data': htmlcode,
            'Charset': 'UTF-8'
          }
        }
      },
        'ReplyToAddresses': [sourceemail],
        'ReturnPath': sourceemail
      };

    sesclient.sendEmail(params, function(err, data) {
      if (err) {
        context.done(err);
      }
      else {
        context.succeed("Verification Email Sent");
      }
  });

}


//generate unique file name for photo on server
function generateUniqueCode(){
  var assembledname = "";
  var chars  = ["a","b","","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","1","2","3","4","5","6","7","8","9","0"];
  var max = chars.length - 1;
  var min = 0;
  
  for(var i=0;i<chars.length;i++){
    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
    var randomChar = Math.floor(Math.random() * (max - min + 1)) + min;    
    if(randomChar%2){
      assembledname += chars[randomChar].toUpperCase();
    }else{
      assembledname += chars[randomChar];
    }
    
  }
  return assembledname;
}

function addVerificationCode(event,context){

   try{
      if(typeof event.verificationcode == "undefined" || event.verificationcode === null){
        context.done("No Verification Code Sent");
      }

      dynamo.putItem({
      "TableName": "commuteremails",
        "Item" : {
            "email": {"S":String(event.email)},
            "verificationcode": {"S":String(event.verificationcode)},
            "verified": {"BOOL":false},
            "signupcompleted": {"BOOL":false},
            "commuterid":{"N":String(0)}
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
            sendVerification(event,context);
          }
              
      } );
    }
    catch(e){
      console.log("Error");
      context.done(e);
    }
}

function getCommuterForEmail(event,context){    

        //trim white space
      event.email = String(event.email).trim();

      dynamo.getItem({
        "TableName": "commuteremails",
            "Key" : {
              "email": {"S":String(event.email)}
            }
        }, function(err, data) {
            if (err) {
                context.done(err);
            }
            else {

                console.log(data);

                if(typeof data.Item != "undefined" && typeof data.Item.verified!= "undefined" && data.Item.verified.BOOL && typeof data.Item.signupcompleted!= "undefined" &&  data.Item.signupcompleted.BOOL){
                  context.succeed("Email Exists");    
                }
                else{
                  addVerificationCode(event,context);
                }
                
            }
        });
}

function updateCommuterProfile(event,context){
    dynamo.putItem({
          "TableName": "commuters",
          "Item" : {
            "commuterid": { "N" : String(event.commuter.id) },
            "data": { "S" : JSON.stringify(event.commuter) }
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
            context.succeed(event.commuter);
          }
      });
}

function putFacebookID(event,context){
    dynamo.putItem({
          "TableName": "facebookaccess",
          "Item" : {
            "appid": { "N" : String(event.facebookid) },
            "commuterid": { "N" : String(event.id) }
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
            context.succeed({"completed":event.id}); 
          }
      });
}

function setSignUpAsCompleted(event,context){

    var newcommuter = JSON.parse(event.commuter);

    try{
      newcommuter.email = String(newcommuter.email).trim();
      
      dynamo.updateItem({
      "TableName": "commuteremails",
          "Key" : {
            "email": {"S":String(newcommuter.email)}
          },
          "UpdateExpression": "SET #v=:completed,#c=:commuterid,#p=:password",
          "ExpressionAttributeNames": { 
            "#v": "signupcompleted",
            "#c": "commuterid",
            "#p": "password"
          },
          "ExpressionAttributeValues": { 
            ":completed": {"BOOL": true},
            ":commuterid": {"N": String(newcommuter.id)},
            ":password": {"S": String(newcommuter.password)}
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {

              if(typeof newcommuter.facebookid != "undefined" && Boolean(newcommuter.facebookid)){
                putFacebookID(newcommuter,context);
              }
              else{
                context.succeed({"completed":newcommuter.id});  
              }
          }
      } );
    }
    catch(e){
      context.done(e);
    }
} 