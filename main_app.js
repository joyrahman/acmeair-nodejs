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

var express = require('express')
  , http = require('http')
  , fs = require('fs')
  , log4js = require('log4js');
var settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));

log4js.configure('log4js.json', {});
var logger = log4js.getLogger('main_app');
logger.setLevel(settings.loggerLevel);

// disable process.env.PORT for now as it cause problem on mesos slave
var port = (process.env.VMC_APP_PORT || process.env.VCAP_APP_PORT || settings.main_port);
var host = (process.env.VCAP_APP_HOST || 'localhost');

logger.info("host:port=="+host+":"+port);

var dbtype = process.env.dbtype || "mongo";

// Calculate the backend datastore type if run inside BLuemix or cloud foundry
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

var routes = new require('./main/routes/index.js')(dbtype, settings);
var loader = new require('./loader/loader.js')(routes, settings);

// Setup express with 4.0.0

var app = express();
var morgan         = require('morgan');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser')

app.use('/acmeair',express.static(__dirname + '/public'));     	// set the static files location /public/img will be /img for users

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

app.use(methodOverride());                  			// simulate DELETE and PUT
app.use(cookieParser());                  				// parse cookie

var router = express.Router(); 		

// config/load
router.get('/config/runtime', routes.getRuntimeInfo);
router.get('/config/dataServices', routes.getDataServiceInfo);
router.get('/config/activeDataService', routes.getActiveDataServiceInfo);
router.get('/config/countBookings', routes.countBookings);
router.get('/config/countCustomers', routes.countCustomer);
router.get('/config/countSessions', routes.countCustomerSessions);
router.get('/config/countFlights', routes.countFlights);
router.get('/config/countFlightSegments', routes.countFlightSegments);
router.get('/config/countAirports' , routes.countAirports);
router.get('/loader/load', startLoadDatabase);
router.get('/loader/query', loader.getNumConfiguredCustomers);

// ?
router.get('/checkstatus', checkStatus);

//REGISTER OUR ROUTES so that all of routes will have prefix 
app.use(settings.mainContextRoot, router);

// Only initialize DB after initialization of the authService is done
var initialized = false;
var serverStarted = false;

initDB(); // only used for config/load


function checkStatus(req, res){
	res.sendStatus(200);
}

function startLoadDatabase(req, res){
	if (!initialized)
     	{
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(400);
	}else
		loader.startLoadDatabase(req, res);
}

function initDB(){
    if (initialized ) return;
		routes.initializeDatabaseConnections(function(error) {
	if (error) {
		logger.info('Error connecting to database - exiting process: '+ error);
		// Do not stop the process for debug in container service
		//process.exit(1); 
	}else
	      initialized =true;

	logger.info("Initialized database connections");
	startServer();
	});
}


function startServer() {
	if (serverStarted ) return;
	serverStarted = true;
	app.listen(port);   
	logger.info("Express server listening on port " + port);
}
