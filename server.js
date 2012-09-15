/**
 * [ faye-push-service ]
 * 
 * @author timo@klarshift.de
 * 
 * TODO: HTTPS endpoint
 * TODO: avoid default post to faye service, since it skips sec. token
 * TODO: config from external config file
 * TODO: propper logging
 * TODO: start script with forever
 */

/* dependencies */
var http = require('http'),
    faye = require('faye'),
    fs = require('fs');

/* config */
var port = 8000;

// adapter
var bayeux = new faye.NodeAdapter({mount: "/faye", timeout: 45});

var totalRequests = 0;
var totalPublishRequests = 0;
var totalUnauthorized = 0;

var startTime = new Date();


/**
 * get uptime
 */
function getUptime(){	
	var upMillis = ((new Date().getTime()) - startTime.getTime());
	var upTime = new Date();
	upTime.setTime(upMillis);
	return upTime;	
}

/**
 * retrieve ip address, even behind lb
 */
function getIP(request){	
	var ip = null;
	try { ip = request.headers['x-forwarded-for']; }
	catch ( error ) { ip = request.socket.remoteAddress; }
	if(ip == null) ip = '(undefined)';
	return ip;
}

/**
 * log method
 */
function log(message, request){
	var ip = getIP(request);
	var d = new Date();
	console.log(d.toUTCString() + ' // [p=' + totalPublishRequests + ' | a=' + totalUnauthorized + ' | t=' + totalRequests + '] // ' + ip + " :: " + message);	
}

// create http interface
var server = http.createServer(function(request, response) {	
	totalRequests++;
	log("Client requesting ...", request);
	
	// receive data via post
	if(request.method == 'POST'){		
		// read data    
		var data = "";
        request.on('data', function(chunk) { data += chunk; });
                      
        // get data end
        request.on('end', function() {			
			var json = JSON.parse(data);
			var channel = json.channel;
			var publishData = json.data;			
            bayeux.getClient().publish(channel, JSON.stringify(publishData));           
            response.writeHead(200, {'content-type': 'text/plain' });
            response.end('OK', 'utf-8')
        });
    }else{
		// stats
		if(request.url == '/stats'){
			var data = {currentDate: (new Date()).toUTCString(), upSince: startTime.toUTCString(), uptime: getUptime(), totalRequests: totalRequests};
			response.writeHead(200, {"Content-Type" : 'application/json'});
			response.end(JSON.stringify(data), 'utf-8');
		}else{
			// ping check
			response.writeHead(200);
			response.end("");
		}		
	}
});

bayeux.bind('handshake', function(clientId) {
  console.log("handshake with " + clientId);
})

bayeux.bind('subscribe', function(clientId, channel) {
  console.log("subscribe " + channel + " by " + clientId);
})

bayeux.bind('unsubscribe', function(clientId, channel) {
  console.log("unsubscribe " + channel + " by " + clientId);
})

bayeux.bind('publish', function(clientId, channel, data) {
  console.log("publish " + data + " by " + clientId + " :: " + channel);
})

bayeux.bind('disconnect', function(clientId) {
  console.log("disconnect with " + clientId);
})

// attach and listen
bayeux.attach(server);
server.listen(port);
