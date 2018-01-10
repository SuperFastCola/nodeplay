var AWS = require('aws-sdk');
var s3 = new AWS.S3();

exports.handler = (event, context, callback) => {
    
    // I currently do a manually confirmation code and use curl to generate access token
    //This can all be automated
    if(typeof event.nonews != "undefined" && event.nonews.match(/\w/)){
        putNewsObject(event,context);
    }
    else if(typeof event.newsitem != "undefined" && event.newsitem.match(/\w/)){
        facebookData(event,context); 
    }
    else if(typeof event.newsitem != "undefined" && event.code.match(/\w/) ) {
        console.log("CODE: " + event.code);
        context.succeed({message:"Thank You for Authorizing"}); 
    }
    else{
        facebookData(event,context); 
    }
};


function facebookData(event,context){

        var config = require('./config');

        var item = (typeof event.newsitem != "undefined" && event.newsitem.match(/[0-9]{1,2}/))?Number(event.newsitem):0;

        var FB = require('fb');
        FB.options({version: 'v2.6'});

        var at = null;

        FB.api('oauth/access_token', {
            client_id: config.facebook.appId,
            client_secret: config.facebook.appSecret,
            grant_type: 'client_credentials'
        }, function (res) {
            if(!res || res.error) {
                console.log(!res ? 'error occurred' : res.error);
                return;
            }

            at = res.access_token;

            FB.api(config.facebook.appNamespace, { fields: ['id', 'name', 'posts.order(reverse_chronological)'], access_token: at }, function (res) {

                FB.api((res.posts.data[item].id), { fields: ['picture', 'message', 'created_time', 'description', 'link'], access_token: at }, function (res) {
                    res.challenge = event.challenge;
                    putNewsObject(res,context);
                });
            });
        });
}

function putNewsObject(event,context){

    if(typeof event.nonews != "undefined"){
        event = '';
    }

    var bucket = "s3.repo.com";
    var key = "nouvelles.json";
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



