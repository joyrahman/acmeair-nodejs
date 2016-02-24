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
var logger = log4js.getLogger('monolithic_app');
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

// Setup express with 4.0.0

var app = express();
var expressWs = require('express-ws')(app); 
var morgan         = require('morgan');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser');
var restCtxRoot = settings.monolithicContextRoot;
var ctxRoot = restCtxRoot.substring(0,restCtxRoot.indexOf("/",restCtxRoot.indexOf("/")+1));

app.use(ctxRoot,express.static(__dirname + '/public'));     	// set the static files location /public/img will be /img for users
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
var routes = new require('./monolithic/routes/index.js')(dbtype, settings);
var loader = new require('./loader/loader.js')(routes, settings);
var websocket = new require('./websocket/index.js')();

// connect to websocket (may be a better way?)
app.ws(ctxRoot+ '/support', function(ws, req) {
	websocket.chat(ws);
});

// main app
router.post('/login', login);
router.get('/login/logout', logout);

// flight service

router.post('/flights/queryflights', routes.checkForValidSessionCookie, routes.queryflights);
router.post('/bookings/bookflights', routes.checkForValidSessionCookie, routes.bookflights);
router.post('/bookings/cancelbooking', routes.checkForValidSessionCookie, routes.cancelBooking);
router.get('/bookings/byuser/:user', routes.checkForValidSessionCookie, routes.bookingsByUser);

router.get('/customer/byid/:user', routes.checkForValidSessionCookie, routes.getCustomerById);
router.post('/customer/byid/:user', routes.checkForValidSessionCookie, routes.putCustomerById);

router.get('/config/runtime', routes.getRuntimeInfo);
router.get('/config/dataServices', routes.getDataServiceInfo);
router.get('/config/activeDataService', routes.getActiveDataServiceInfo);

router.get('/bookings/config/countBookings', routes.countBookings);
router.get('/customer/config/countCustomers', routes.countCustomer);
router.get('/login/config/countSessions', routes.countCustomerSessions);
router.get('/flights/config/countFlights', routes.countFlights);
router.get('/flights/config/countFlightSegments', routes.countFlightSegments);
router.get('/flights/config/countAirports' , routes.countAirports);

router.get('/customer/loader/query', loader.getNumConfiguredCustomers);
router.get('/customer/loader/load', startLoadCustomerDatabase);
router.get('/flights/loader/load', startLoadFlightDatabase);
router.get('/login/loader/load', clearSessionDatabase);
router.get('/bookings/loader/load', clearBookingDatabase);

// ?
router.get('/checkstatus', checkStatus);

//REGISTER OUR ROUTES so that all of routes will have prefix 
app.use(settings.monolithicContextRoot, router);

// Only initialize DB after initialization of the authService is done
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


function startLoadCustomerDatabase(req, res){
	if (!initialized)
     	{
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(400);
	}else
		loader.startLoadCustomerDatabase(req, res);
}

function startLoadFlightDatabase(req, res){
	if (!initialized)
     	{
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(400);
	}else
		loader.startLoadFlightDatabase(req, res);
}

function clearSessionDatabase(req, res){
	if (!initialized)
     	{
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(400);
	}else
		loader.clearSessionDatabase(req, res);
}

function clearBookingDatabase(req, res){
	if (!initialized)
     	{
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(400);
	}else
		loader.clearBookingDatabase(req, res);
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
