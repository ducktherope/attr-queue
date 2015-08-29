function logInformation (logtype, payload) {
    currentTime = dateObject.getTime();

    messageJson = '{ "logtype":"' + logtype + '" ' +
                     '"signature":"' + globalApplicationSignature + '" ' +
                     '"time":"' + currentTime + '" ' +
                     '"msg":"' + globalMsg + '" ' +
                     '"id":"' + globalId + '" ' +
                     '"payload":"' + payload + '" };'

console.log(messageJson);
    attrLogger.send(messageJson);
}

// Generate an app signature allowing us to track multiple processes running
// in the future via queue logging.
function generateApplicationSignature() {
    var os = require('os');
    var processGid;

    var hostName = os.hostname();

    if (process.getgid) {
       processGid = process.getgid();
    }

    var applicationSignature = hostName + '|' + process.pid + '|' + processGid;
    return applicationSignature;
}

function logHttpError(errorText) {
    logInformation('FATALFAILURE',  'FATALERROR:' + errorText);

    messageErrorJson = '{ "signature":"' + globalApplicationSignature + '" ' +
                     '"time":"' + currentTime + '" ' +
                     '"msg":"' + globalMsg + '" ' +
                     '"id":"' + globalId + '" ' +
                     '"error":"' + errorText + '" };'
    attrLoggerError.send(messageErrorJson);
}

function logHttpSuccess(successText) {
    logInformation('SUCCESS',  'SUCCESS:' + successText);
}

// Insure the incoming data only meetsthe criteria we allow to move forward
// with a clean postback.
function validateMessageData (messageDataRaw) {
    var messageDataSplit = messageDataRaw.split('|');

    var messageWebType = messageDataSplit[0].replace(/^message=/,'');
    var messageUrl = messageDataSplit[1];
        messageUrl = messageUrl.replace(/\[AMPERSAND\]/g, '&');
    var messageKey = messageDataSplit[2];
    var messageValue = messageDataSplit[3];

    // Check to make sure all valid fields have data.
    if (! messageWebType){ logHttpError('Missing web method', globalMsg,
                                        globalId); return undefined};
    if (! messageUrl){ logHttpError('Missing web url', globalMsg, globalId);
                                    return undefined};
    if (! messageKey){ logHttpError('Missing key data', globalMsg, globalId);
                                    return undefined};
    if (! messageValue){ logHttpError('Missing value data', globalMsg,
                                      globalId); return undefined};

    if (messageUrl.indexOf('{key}') < 1 ) {
      logHttpError('Missing key construct')
    }
    if (messageUrl.indexOf('{value}') < 1 ) {
      logHttpError('Missing value construct')
    }

    messageUrl = messageUrl.replace(/"/g, '');

    if (messageWebType !== 'GET' && messageWebType !== 'POST') {
         logHttpError('Illegal messageWebType:' + messageWebType);
          return undefined;
    }

    return{
           webType: messageWebType,
           url: messageUrl,
           key: messageKey,
           value: messageValue,
           id : globalId
       };
}

// This return data will only be used for GET postbacks.
function generateMessageDataResponse(messageData) {
    messageResponse = messageData.url.replace('{key}', messageData.key);
    messageResponseFinal = messageResponse.replace('{value}',
                                                   messageData.value);

    return messageResponseFinal;
}

// The (heart) of the delivery is here. Async calls for each method of delivery
// Running tasks are modified here to keep allowable active tasks sessions.
function deliverMessageDataResponse(messageData,
                                    messageDataResponse,
                                    idForCallback) {
   var re = /(http:\/\/.*\/)(.*)/g;
   var urlHost = re.exec(messageDataResponse);

   var headers = {
        'Content-Type':     'application/x-www-form-urlencoded'
    }

    if (messageData.webType === 'GET') {
        request(messageDataResponse, function logHttpCallback(error,
                                                              response,
                                                              body)
        {
            if (!error && response.statusCode === 200) {
              logHttpSuccess(globalId);

            }
            else{
              logInformation('ERROR', 'HTTP_ERROR:' + error);
            }

            delete globalRunningTask[messageData.id];
            return undefined;
        });
    }
    else if (messageData.webType === 'POST') {
        var options = {
            url: urlHost[0],
            method: 'POST',
            headers: headers,
            form: {'key': messageData.key, 'value': messageData.value}
        }
        request(options, function logHttpCallback(error, response, body) {
              if (!error && response.statusCode == 200) {
                logHttpSuccess(globalId);

              }
              else{
                  logInformation('ERROR', 'HTTP_ERROR:' + error);
              }

              delete globalRunningTask[messageData.id];
              return undefined;
        });
    }
    else {
        logHttpError('ILLEGAL webType:' + messageData.webType);
          delete globalRunningTask[messageData.id];
            return undefined;
    }

}

var globalApplicationSignature = generateApplicationSignature();
var config = require('./attr-queue-config.json');
var RSMQWorker = require( 'rsmq-worker' );
var request = require('request');//.debug = true;
var globalMsg = 'Undefined';
var globalId = 'Undefined';
var globalRunningTask = new Object; // Array to hold current running.
var dateObject = new Date();

//TODO: Polling time for existing
var attrWorker = new RSMQWorker(config.queueAttribute, {
    autostart: true,             // start worker on init
    invisibletime: 0,           // hide received message for 5 sec
    maxReceiveCount: 2,         // only receive a message 2 times until delete
    timeout: 50000              // timeout of message to 5000ms
});

 var attrLogger = new RSMQWorker(config.queueLog, {
     autostart: true,             // start worker on init
 });

var attrLoggerError = new RSMQWorker(config.queueLogError, {
    autostart: true,             // start worker on init
});

// This is hooked in but not used *yet*. Visual stats easy to call.
var attrLoggerStat= new RSMQWorker(config.queueLogStat, {
    autostart: true,             // start worker on init
});

logInformation('INFO', 'Queue application starting');

// Listen to errors from the attr_queue
// TODO: Research timeout/exceed event for validity.
attrWorker.on('error', function( err, msg ){
  logInformation('QUEUE', 'ERROR:' + err + '-' + msg);
});

// Primary hook to digest incoming message.
attrWorker.on( 'message', function( message, next, id ){
    globalMsg = message;
    globalId = id;

// Log our entry point so we can trace completion.

    logInformation('START', 'Message received from queue');

     messageData = validateMessageData(message);

     if (! messageData) {
        attrWorker.del(id);
        next();
     }
     else {
         messageDataResponse = generateMessageDataResponse(messageData);

         while (Object.keys(globalRunningTask).length < config.maxactivetasks) {
             messageDataDeliver = deliverMessageDataResponse(messageData,
                                                           messageDataResponse,
                                                           id);
             globalRunningTask[globalId] = globalMsg;
             break;
        }
        attrWorker.del(id);
        next();
     }

});
