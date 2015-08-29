var RSMQWorker = require( 'rsmq-worker' );
//var logQ = process.argv[2];

var logQ = 'attr-log-queue';
console.log("Reading from " + logQ);

var attrLogger = new RSMQWorker(logQ, {
 autostart: true,             // start worker on init
});


attrLogger.on('message', function( message, next, id ){
  console.log('ID-MESSAGE:' + id + '-' + message);
  next();
});
