var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var instagram = "access_token";

exports.handler = (event, context, callback) => {
    
    // I currently do a manually confirmation code and use curl to generate access token
    //This can all be automated
    if(typeof event.code != "undefined" && event.code.match(/\w/) ) {
        console.log("CODE: " + event.code);
        context.succeed({message:event.code}); 
    }
    else{
        event.challenge = JSON.stringify(event);
        instagramRequest(event,context); 
    }
}

function instagramRequest(event,context){
    const https = require('https');
    
    var instaurl = String('https://api.instagram.com/v1/users/self/media/recent/?access_token=' + instagram);

    https.get(instaurl, (resp) => {
        let data = '';
    
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
    
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            event.challenge = JSON.parse(data);
            putInstagramDataObject(event,context);
        });
    
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

function putInstagramDataObject(event,context){

    var bucket = "s3.repo.com";
    var key = "instagram.json";
    var params = {
        Bucket: bucket,
        Key: key,
        ACL: "public-read",
        Body: JSON.stringify(event)
    };

    s3.putObject(params,function(err,data){
          if(err){
                context.fail(err);
            }
            else{
                event.challenge = JSON.stringify(event);
                context.succeed(event.challenge); 
            }   
    });
}
