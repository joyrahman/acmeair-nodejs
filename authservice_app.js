/*******************************************************************************
* Copyright (c) 2015 IBM Corp.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*******************************************************************************/

var fs = require('fs');
var settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
var log4js = require('log4js');

log4js.configure('log4js.json', {});
var logger = log4js.getLogger('authservice_app');
logger.setLevel(settings.loggerLevel);

var port = (process.env.VMC_APP_PORT || process.env.VCAP_APP_PORT || settings.authservice_port);
var host = (process.env.VCAP_APP_HOST || 'localhost');

registerService(process.env.SERVICE_NAME, port);

logger.info("host:port=="+host+":"+port);

var dbtype = process.env.dbtype || "mongo";

//Calculate the backend datastore type if run inside BLuemix or cloud foundry
if(process.env.VCAP_SERVICES){
	var env = JSON.parse(process.env.VCAP_SERVICES);
   	logger.info("env: %j",env);
	var serviceKey = Object.keys(env)[0];
	if (serviceKey && serviceKey.indexOf('cloudant')>-1)
		dbtype="cloudant";
	else if (serviceKey && serviceKey.indexOf('redis')>-1)
		dbtype="redis";
}
logger.info("db type=="+dbtype);

// call the packages we need
var express    = require('express'); 		
var app        = express(); 				
var morgan         = require('morgan');
var bodyParser     = require('body-parser');
var cookieParser = require('cookie-parser');

if (settings.useDevLogger)
	app.use(morgan('dev'));                     		// log every request to the console

//create application/json parser
var jsonParser = bodyParser.json();
// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false });

app.use(jsonParser);
app.use(urlencodedParser);

//parse an HTML body into a string
app.use(bodyParser.text({ type: 'text/html' }));
app.use(cookieParser()); 

var router = express.Router(); 	
var routes = new require('./authservice/routes/index.js')(dbtype,settings); 
var loader = new require('./loader/loader.js')(routes, settings);

router.post('/login', routes.login);
router.get('/login/logout', routes.logout);
router.get('/login/authcheck/:tokenid', routes.authcheck);
router.get('/login/config/countSessions', routes.countCustomerSessions);
router.get('/login/loader/load', clearSessionDatabase);

// REGISTER OUR ROUTES so that all of routes will have prefix 
app.use(settings.authContextRoot, router);

var initialized = false;
var serverStarted = false;

initDB();

function initDB(){
    if (initialized ) return;
	routes.initializeDatabaseConnections(function(error) {
			if (error) {
				logger.error('Error connecting to database - exiting process: '+ error);
				// Do not stop the process for debug in container service
				//process.exit(1); 
			}else
			{
				initialized =true;
				logger.info("Initialized database connections");
			}
			startServer();
	});
}

function clearSessionDatabase(req, res){
	if (!initialized)
     	{
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(400);
	}else {
		loader.clearSessionDatabase(req, res);
	}
}


function startServer() {
	if (serverStarted ) return;
	serverStarted = true;
	app.listen(port);
	console.log('Application started port ' + port);
}



function registerService(serviceName, port) {
	var request = require('request');
	var NAME = serviceName;
	var PORT = port;
	var BEARER_TOKEN = process.env.SD_TOKEN;
	var SD_URL = process.env.SD_URL;
	var space_id = process.env.space_id;
	var SERVICE_IP = ""; //see below

	var headers = {'content-type': 'application/json', 'authorization': 'Bearer ' + BEARER_TOKEN, 'X-Forwarded-Proto': 'https' };
	var TIME_TO_LIVE = 300;
	var SLEEP_TIME= Math.ceil(TIME_TO_LIVE*0.9*1000);
	var url = SD_URL + "/api/v1/instances";

	//Get the service IP
	var os = require('os');
	var interfaces = os.networkInterfaces();
	var addresses = [];
	for (var k in interfaces) {
	    for (var k2 in interfaces[k]) {
	        var address = interfaces[k][k2];
	        if (address.family === 'IPv4' && !address.internal) {
	            addresses.push(address.address);
	        }
	    }
	}

	SERVICE_IP=addresses[0];

	var options = {
		url: url,
		headers: headers,
		json: {
			tags :[],
			status : "UP",
			service_name: NAME, 
			endpoint: {type: "http", "value": SERVICE_IP +":"+ PORT }, 
			ttl:TIME_TO_LIVE
		}
	};

	console.log('OPTIONS : ' + JSON.stringify(options));
	
	/*space_id implicitly tell that it is running on IBM Container.
	 * If space_id exists, register the container to the Service Discovery.
	 */
	if (space_id){
		//Register Container
		request.post(options, function (err, res, body) {
			if ( typeof res !== 'undefined' && res ){
				res.setEncoding('utf8');
				var heartURL = body.links.heartbeat;
				console.log('REGISTRATION RESPONSE : ' + JSON.stringify(res));
				var heartOptions = {
					url: heartURL,
					headers: headers
				};
				console.log('HEARTBEAT OPTIONS : ' + heartURL);
				//Renewing registration periodically 
				setInterval(function() {
					request.put(heartOptions, function (err, res, body) {
						if (( typeof res !== 'undefined' && res ) && (res.statusCode === 200)){
							console.log('HEARTBEAT RESPONSE : ', JSON.stringify(res));
						}else{
							if ( typeof res !== 'undefined' && res ){
								console.log('REGISTRATION RENEWAL FAILED WITH STATUS CODE : ' + res.statusCode + '. TRY REGISTRATION AGAIN.');	
							} else {
								console.log('REGISTRATION RENEWAL FAILED. TRY REGISTRATION AGAIN.');
							}
							//Re-registering after failed heartbeat
							request.post(options, function (err, res, body) {
								if ( typeof res !== 'undefined' && res ){
									res.setEncoding('utf8');
									console.log('RE-REGISTRATION RESPONSE : ', JSON.stringify(res));
									heartURL = body.links.heartbeat;
									heartOptions = {
										url: heartURL,
										headers: headers
									};
									console.log('RE-REGISTRATION HEARTBEAT OPTIONS : ' + heartURL);
								}else{
									console.log('RE-REGISTRATION FAILED! POST RESPONSE DOES NOT EXIST!');
								}
							});
						}
					});
				}, SLEEP_TIME);
			}else{
				console.log('REGISTRATION FAILED! POST RESPONSE DOES NOT EXIST!');
			}
		});
	}
}
