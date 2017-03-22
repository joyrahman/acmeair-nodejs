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

module.exports = function (loadUtil,settings, dbtype) {
	var module = {};

	var csv = require('csv');
	var log4js = require('log4js');
	var uuid = require('uuid');
	var async = require('async');
	var fs = require('fs');

	log4js.configure('log4js.json', {});
	var logger = log4js.getLogger('loader');
	logger.setLevel(settings.loggerLevel);

	var DATABASE_PARALLELISM = 5;

	var d = new Date(); // Today!
	d.setDate(d.getDate() - 2); // Yesterday!
	var nowAtMidnight = getDateAtTwelveAM(d);

	var d = new Date(); // Today!
	d.setDate(d.getDate() - 2); // 2 days ago - It is needed if the hosting server is in different time zone
	var nowAtMidnight = getDateAtTwelveAM(d);
	var maxDays = process.env.maxdays || settings.MAX_DAYS_TO_SCHEDULE_FLIGHTS;

	var flights;

	var customerTemplate = {
			_id : undefined,
			password : "password",
			status : "GOLD",
			total_miles : 1000000,
			miles_ytd : 1000,
			address : {
				streetAddress1 : "123 Main St.",
				city : "Anytown",
				stateProvince : "NC",
				country : "USA",
				postalCode : "27617"
			},
			phoneNumber : "919-123-4567",
			phoneNumberType : "BUSINESS"
	};

	if (dbtype === 'cassandra' ){
		var flightTemplate = {
				id : undefined,
				originPort : undefined,
				destPort : undefined,
				scheduledDepartureTime : undefined,
				scheduledArrivalTime : undefined,
				miles : undefined,
				flight : undefined,
				firstClassBaseCost : '500',
				economyClassBaseCost : '200',
				numFirstClassSeats : '10',
				numEconomyClassSeats : '200',
				airplaneTypeId : 'B747'
		}
	}else {
		var flightTemplate = {
				_id : undefined,
				originPort : undefined,
				destPort : undefined,
				scheduledDepartureTime : undefined,
				scheduledArrivalTime : undefined,
				miles : undefined,
				flight : undefined,
				firstClassBaseCost : 500,
				economyClassBaseCost : 200,
				numFirstClassSeats : 10,
				numEconomyClassSeats : 200,
				airplaneTypeId : "B747"
		}	
	}

	function cloneObjectThroughSerialization(theObject) {
		return JSON.parse(JSON.stringify(theObject));
	}

	function getDepartureTimeDaysFromDate(baseTime, days) {
		milliseconds = days * 24 /* hours */ * 60 /* minutes */ * 60 /* seconds */ * 1000 /* milliseconds */;
		return new Date(baseTime.getTime() + milliseconds);
	}

	function getArrivalTime(departureTime, mileage) {
		averageSpeed = 600.0; // 600 miles/hours
		hours = mileage / averageSpeed; // miles / miles/hour = hours
		milliseconds = hours * 60 /* minutes */ * 60 /* seconds */ * 1000 /* milliseconds */;
		return new Date(departureTime.getTime() + milliseconds);
	}

	function getDateAtTwelveAM(theDate) {
		return new Date(theDate.getFullYear(), theDate.getMonth(), theDate.getDate(), 0, 0, 0, 0);
	}

	function getDateAtRandomTopOfTheHour(theDate) {
		randomHour = Math.floor((Math.random()*23));
		return new Date(theDate.getFullYear(), theDate.getMonth(), theDate.getDate(), randomHour, 0, 0, 0);
	}

	function insertCustomer(customer, callback) {
		logger.debug('customer to insert = ' + JSON.stringify(customer));
		loadUtil.insertOne(loadUtil.dbNames.customerName, customer, function(error, customerInserted) {
			logger.debug('customer inserted = ' + JSON.stringify(customerInserted));
			callback();
		});
	}

	function insertFlight(flight, callback) {
		loadUtil.insertOne(loadUtil.dbNames.flightName, flight, function(error, flightInserted) {
			logger.debug('flight inserted = ' + JSON.stringify(flightInserted));
			callback();
		});
	}

	module.startLoadDatabase = function startLoadDatabase(req, res) {

		var numCustomers = req.query.numCustomers;
		if(numCustomers === undefined) {
			numCustomers = settings.MAX_CUSTOMERS;
		}
		loadUtil.initialize(function() {
			logger.info('DB initialized');
			logger.info('starting loading database');
			createCustomers(numCustomers, function(){});
			createFlightRelatedData(function() {
				logger.info('number of customers = ' + customers.length);
				logger.info('number of flights = ' + flights.length);
				flightQueue.drain = function() {
					logger.info('all flights loaded');
					logger.info('ending loading database');
					res.send('Database Finished Loading');
					loadUtil.closeDBConnection(function(err){
						if (!err){
							loadUtil.initializeDatabaseConnections(function(err){
								if(err){
									logger.info('Error initalizing database : ' + err);
								}
							});
						}else{
							logger.info('Error iclosing database : ' + err);
						}
					});
				};
				customerQueue.push(customers);
			});
		});
		//res.send('Trigger DB loading');
	}

	module.startLoadCustomerDatabase = function startLoadCustomerDatabase(req, res) {

		logger.info("numCustomers: " + req.query.numCustomers);

		var numCustomers = req.query.numCustomers;
		if(numCustomers == undefined) {
			numCustomers = settings.MAX_CUSTOMERS;
		}

		logger.info('starting loading database');

		loadUtil.removeAll(loadUtil.dbNames.customerName, function(err) {
			logger.info('#number of customers = ' + customers.length);
			if (err) {
				logger.error(err);
			} else {		
				createCustomers(numCustomers, function() {
					logger.info('number of customers = ' + customers.length);
					customerQueue.push(customers);
					res.send('Database Finished Loading');
				});
			}
		});
	}


	module.startLoadFlightDatabase = function startLoadFlightDatabase(req, res) {
		loadUtil.initialize(function(err) {
			if (err) {
				debug(err);
			} else {	
				var flightQueue = async.queue(insertFlight, DATABASE_PARALLELISM);
				createFlightRelatedData(function(dataArray){
					dataArray.forEach(function(value){
						debug("Data : ",JSON.stringify(value));		
					});
					flightQueue.push(flights);
					flightQueue.drain = function() {
						debug('all flights loaded');
						res.send('Database Finished Loading');
					};	
				});
			}
		});
	}

	module.clearSessionDatabase = function clearSessionDatabase(req, res) {

		logger.info('starting clearing sesison database');	
		loadUtil.removeAll(loadUtil.dbNames.customerSessionName, function(err) {
			if (err) {
				logger.debug(err);
			} 
			res.send('Database Finished Loading');
		});
	}

	module.clearBookingDatabase = function clearSessionDatabase(req, res) {

		logger.info('starting clearing sesison database');	
		loadUtil.removeAll(loadUtil.dbNames.bookingName, function(err) {
			if (err) {
				logger.debug(err);
			} 
			res.send('Database Finished Loading');
		});
	}

	module.getNumConfiguredCustomers = function (req, res) {
		res.contentType("text/plain");
		res.send(settings.MAX_CUSTOMERS.toString());
	}


	var customerQueue = async.queue(insertCustomer, DATABASE_PARALLELISM);
	customerQueue.drain = function() {
		logger.info('all customers loaded');
		airportCodeMappingQueue.push(airportCodeMappings);
	}

	var flightQueue = async.queue(insertFlight, DATABASE_PARALLELISM);

	var customers = new Array();
	var airportCodeMappings = new Array();
	var flightSegments = new Array();
	var flights = new Array();

	function createCustomers(numCustomers, callback) {
		customers = new Array();
		for (var ii = 0; ii < numCustomers; ii++) {
			var customer = cloneObjectThroughSerialization(customerTemplate);
			customer._id = "uid" + ii + "@email.com";
			customers.push(customer);
		};
		callback();
	}

	function createFlightRelatedData(callback/*()*/) {
		flights = new Array();
		var rows = new Array();
		csv()
		.from.path('./loader/mileage.csv',{ delimiter: ',' }) 
		.on('record', function(data, index) {
			rows[index] = data;
			debug('#'+index+' '+JSON.stringify(data));
		})
		.on('end', function(count) {
			debug('Number of lines: ' + count);
			debug('rows.length = ' + rows.length);
			debug('rows = ' + rows);
			var flightId = 0;
			for (var originPorts = 2; originPorts < rows[0].length; originPorts++) {
				for (var destPorts = 2; destPorts < rows.length; destPorts++){
					for (var kk = 0; kk < maxDays; kk++) {
						if (rows[destPorts][originPorts].toString() !== "NA"){
							var flight = cloneObjectThroughSerialization(flightTemplate);
							flight.miles = rows[destPorts][originPorts];
							if (dbtype === 'cassandra' ){
								flight.id = uuid.v4();
								tempFlight = getDepartureTimeDaysFromDate(nowAtMidnight, kk);
								flight.scheduledDepartureTime = tempFlight.toISOString();
								flight.scheduledArrivalTime = getArrivalTime(tempFlight, flight.miles).toISOString();
							}else{
								flight._id = uuid.v4();
								flight.scheduledDepartureTime = getDepartureTimeDaysFromDate(nowAtMidnight, kk);
								flight.scheduledArrivalTime = getArrivalTime(flight.scheduledDepartureTime, flight.miles);
							}
							flight.originPort = rows[1][originPorts];
							flight.destPort = rows[destPorts][1];
							flight.flight = "AA" + flightId;
							flights.push(flight);
						}
					}
					flightId++;
				}
			}
			callback(flights);
		});
	}

	return module;

}
