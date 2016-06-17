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
var debug = require('debug')('acmeair');

log4js.configure('log4js.json', {});
var logger = log4js.getLogger('monolithic');
logger.setLevel(settings.loggerLevel);

// disable process.env.PORT for now as it cause problem on mesos slave
var port = (process.env.VMC_APP_PORT || process.env.VCAP_APP_PORT || settings.monolithic_port);
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

var authRoutes = new require('./authservice/routes/index.js')(true,null,dbtype,settings); 
var flightRoutes = new require('./flightservice/routes/index.js')(true,dbtype,settings); 
var bookingRoutes = new require('./bookingservice/routes/index.js')(true,null,dbtype,settings); 
var customerRoutes = new require('./customerservice/routes/index.js')(true,null,dbtype,settings); 
var routes = new require('./monolithic/routes/index.js')(dbtype, settings);
var loader = new require('./loader/loader.js')(routes, settings);

// Setup express with 4.0.0

var app = express();
var morgan         = require('morgan');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser');
var ws = require('ws').Server;

app.use(express.static(__dirname + '/public/monolithic'));     	// set the static files location /public/img will be /img for users
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

// main app
router.post('/login', login);
router.get('/login/logout', logout);

// flight service
router.post('/flights/queryflights', authRoutes.checkForValidSessionCookie, flightRoutes.queryflights);
router.post('/bookings/bookflights', authRoutes.checkForValidSessionCookie, bookingRoutes.bookflights);
router.post('/bookings/cancelbooking', authRoutes.checkForValidSessionCookie, bookingRoutes.cancelBooking);
router.get('/bookings/byuser/:user', authRoutes.checkForValidSessionCookie, bookingRoutes.bookingsByUser);

router.get('/customer/byid/:user', authRoutes.checkForValidSessionCookie, customerRoutes.getCustomerById);
router.post('/customer/byid/:user', authRoutes.checkForValidSessionCookie, customerRoutes.putCustomerById);

// probably main app?
router.get('/config/runtime', routes.getRuntimeInfo);
router.get('/config/dataServices', routes.getDataServiceInfo);
router.get('/config/activeDataService', routes.getActiveDataServiceInfo);
router.get('/config/countBookings', routes.countBookings);
router.get('/config/countCustomers', routes.countCustomer);
router.get('/config/countSessions', routes.countCustomerSessions);
router.get('/config/countFlights', routes.countFlights);
router.get('/config/countFlightSegments', routes.countFlightSegments);
router.get('/config/countAirports' , routes.countAirports);
//router.get('/loaddb', startLoadDatabase);
router.get('/loader/load', startLoadDatabase);
router.get('/loader/query', loader.getNumConfiguredCustomers);

// ?
router.get('/checkstatus', checkStatus);

//for websocket watson dialog service
router.get('/support', routes.getSupportWSPort);

//for REST API watson dialog service
router.get('/WatsonSupportInit', routes.getSupportInitInfo);
router.post('/WatsonSupportService', routes.getSupportService);



//REGISTER OUR ROUTES so that all of routes will have prefix 
app.use(settings.monolithicContextRoot, router);


if (settings.websocketPort != ""){
	var websocket = new require('./websocket/index.js')(routes, settings);
	debug("websocketPort", settings.websocketPort );
	//NOTE: Websocket must have its own port number. It has to be a microservice
	//Current code conflicts the port number with HTTP & chat will not function.
	var wss = new ws({port:(process.env.VCAP_APP_PORT || settings.websocketPort)});
	wss.on('connection', websocket.chat);
}

var initialized = false;
var serverStarted = false;

initDB();


function checkStatus(req, res){
	res.sendStatus(200);
}

function login(req, res){
	if (!initialized)
     {
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(403);
	}else
		routes.login(req, res);
}


function logout(req, res){
	if (!initialized)
     {
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(400);
	}else
		routes.logout(req, res);
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

	authRoutes.initializeDatabaseConnections(function(error) {
		if (error) {
			logger.info('Error connecting to database - exiting process: '+ error);
			// Do not stop the process for debug in container service
			//process.exit(1); 
		}else{
			logger.info("Initialized auth database connections");
		}
		});
	flightRoutes.initializeDatabaseConnections(function(error) {
		if (error) {
			logger.info('Error connecting to database - exiting process: '+ error);
			// Do not stop the process for debug in container service
			//process.exit(1); 
		}else{
			logger.info("Initialized flight database connections");
		}
		});
	bookingRoutes.initializeDatabaseConnections(function(error) {
		if (error) {
			logger.info('Error connecting to database - exiting process: '+ error);
			// Do not stop the process for debug in container service
			//process.exit(1); 
		}else{
			logger.info("Initialized booking database connections");
		}
		});
	customerRoutes.initializeDatabaseConnections(function(error) {
		if (error) {
			logger.info('Error connecting to database - exiting process: '+ error);
			// Do not stop the process for debug in container service
			//process.exit(1); 
		}else{
			logger.info("Initialized customer database connections");
		}
		});
}


function startServer() {
	if (serverStarted ) return;
	serverStarted = true;
	app.listen(port);   
	logger.info("Express server listening on port " + port);
}
