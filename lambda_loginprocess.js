var AWS = require('aws-sdk');
var dynamo = new AWS.DynamoDB();

exports.loginprocess = function(event, context) {
    var action = event.action;

    switch(action){
      
      case 'login':
        loginCommuter(event,context);
      break;

      case 'resetPassword':
          checkIfCommuterExistsThenProceedWithAddedFunction(event,context);
      break;

      case 'changePassword':
        event.proceedTo = "gotoPassword";
        checkIfCommuterExistsThenProceedWithAddedFunction(event,context);
      break;
      
      case 'facebookLogin':
        retrieveCommuterProfileFromFacebookAppId(event,context);
      break;

    }
};


function loginCommuter(event,context){    

        //trim white space
      event.email = String(event.email).trim();
      event.password = String(event.password).trim();
      
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

                if(typeof data.Item != "undefined" && typeof data.Item.verified!= "undefined" && data.Item.verified.BOOL && typeof data.Item.signupcompleted!= "undefined" &&  data.Item.signupcompleted.BOOL){
                  if(event.password==data.Item.password.S){
                      returnCommuterProfile({"commuterid":data.Item.commuterid.N},context);
                  }
                  else{
                   context.done("No account found for user!"); 
                  }
                }
                else{
                  //context.done("No Results");
                  context.done("No account found for user!");
                }
                
            }
        });
}

function checkIfCommuterExistsThenProceedWithAddedFunction(event,context){
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
                if(typeof data.Item != "undefined" ){
                    switch(event.proceedTo){
                      case 'gotoPassword':
                        checkVerificationCodeChangePassword(event,context);  
                      break;

                      default:
                          addVerificationCode(event,context);
                      break;
                    }
                    
                }
                else{
                  context.done("No account found for user!"); 
                }
                
            }
        });
}

function returnCommuterProfile(event,context){    

      dynamo.getItem({
        "TableName": "commuters",
            "Key" : {
              "commuterid": {"N":String(event.commuterid)}
            }
        }, function(err, data) {
            if (err) {
                context.done(err);
            }
            else {
                context.succeed(JSON.parse(data.Item.data.S));
            }
        });
}

function retrieveCommuterProfileFromFacebookAppId(event,context){

   dynamo.getItem({
        "TableName": "facebookaccess",
            "Key" : {
              "appid": {"N":String(event.facebookuid)}
            }
        }, function(err, data) {
            if (err) {
                context.done(err);
            }
            else {

              if(typeof data.Item != "undefined"){
                  if(typeof data.Item.commuterid != "undefined"){
                    returnCommuterProfile({"commuterid":data.Item.commuterid.N},context);
                  }
                  else{
                    context.succeed(JSON.stringify({"signup_fbid":event.facebookuid}));
                  }
              }
              else{
                context.succeed(JSON.stringify({"signup_fbid":event.facebookuid}));
              }
            }
        });
}

function sendPasswordResetLink(event,context){

  var sourceemail = "EMAIL";
  var verficationlink = "appbundleid://?passwordresetcode=" + event.verificationcode; //to open app from email

  var htmlcode = '<a href=\"' + verficationlink + '\">' +  verficationlink + '</a>';

  var sesclient = new AWS.SES();
  var params = {
      'Source': sourceemail,
      'Destination': {
        'ToAddresses':[event.email]
      },
      'Message': {
        'Subject':{
            'Data': "Password Reset Link",
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
        context.succeed({"emailsent":true});
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

      dynamo.updateItem({
      "TableName": "commuteremails",
          "Key" : {
            "email": {"S":String(event.email)}
          },
          "UpdateExpression": "SET #v=:vcode",
          "ExpressionAttributeNames": { 
            "#v": "verificationcode"
          },
          "ExpressionAttributeValues": { 
            ":vcode": {"S": String(event.verificationcode)}
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
            sendPasswordResetLink(event,context);
          }
              
      } );
    }
    catch(e){
      console.log("Error");
      context.done(e);
    }
}

function checkVerificationCodeChangePassword(event,context){

    try{
      event.email = String(event.email).trim();
      event.password = String(event.password).trim();
      
      dynamo.updateItem({
      "TableName": "commuteremails",
          "Key" : {
            "email": {"S":String(event.email)}
          },
          "ConditionExpression": "#vc = :vcode",
          "UpdateExpression": "SET #p=:password",
          "ExpressionAttributeNames": { 
            "#p": "password",
            "#vc": "verificationcode"
          },
          "ExpressionAttributeValues": { 
            ":password": {"S": String(event.password)},
            ":vcode": {"S": String(event.verificationcode)}
          }
      }, function(err, data) {
          if (err) {
              context.done(err);
          }
          else {
              context.succeed({"passwordchanged":event.email});
          }
      } );
    }
    catch(e){
      context.done(e);
    }
} 