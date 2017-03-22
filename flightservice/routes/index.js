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

module.exports = function (dataaccess, dbtype, settings) {
	var module = {};
	var log4js = require('log4js');
	var debug = require('debug')('flight');
	var flightCache = require('ttl-lru-cache')({maxLength:settings.flightDataCacheMaxSize});
	var flightSegmentCache = require('ttl-lru-cache')({maxLength:settings.flightDataCacheMaxSize});
	var flightDataCacheTTL = settings.flightDataCacheTTL == -1 ? null : settings.flightDataCacheTTL; 

	log4js.configure('log4js.json', {});
	var logger = log4js.getLogger('flightservice');
	logger.setLevel(settings.loggerLevel);

	var daModuleName = "../../dataaccess/"+dbtype+"/index.js";
	logger.info("Use dataaccess:"+daModuleName);

	module.dbNames = dataaccess.dbNames

	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback);
	}

	module.insertOne = function (collectionname, doc, callback /* (error, insertedDocument) */) {
		dataaccess.insertOne(collectionname, doc, callback)
	};

	module.removeAll = function (collectionname, callback /* (error, insertedDocument) */) {
		dataaccess.removeAll(collectionname, callback)
	};

	module.initialize = function (callback /* (error, insertedDocument) */) {
		dataaccess.initialize(callback)
	};
	module.queryflights = function(req, res) {
		var fromAirport = req.body.fromAirport;
		var toAirport = req.body.toAirport;
		var oneWay = (req.body.oneWay == 'true');
		var fromDateWeb = new Date(req.body.fromDate);
		var returnDateWeb = new Date(req.body.returnDate);
		searchFlights(fromAirport, toAirport, oneWay, fromDateWeb, returnDateWeb, function(values){
			res.send(values)

		});
	}

	module.searchFlights = function (fromAirport, toAirport, oneWay, fromDateWeb, returnDateWeb, callback) {
		searchFlights(fromAirport, toAirport, oneWay, fromDateWeb, returnDateWeb, callback);
	}

	function searchFlights(fromAirport, toAirport, oneWay, fromDateWeb, returnDateWeb, callback) {
		logger.debug('querying flights');
		debug('querying flights');
		
		//If your acmeair is in another time zone (e.g. Your browser is in EST & Acmeair server is in CST), fromDate will be 1 day behind than fromDateWeb & won't query 
		var fromDate = new Date(fromDateWeb.getFullYear(), fromDateWeb.getMonth(), fromDateWeb.getDate()); // convert date to local timezone
		var returnDate;
		//if (oneWay=='false') { // this needs to be changed like this. currently, oneWay is string instead of boolean
		if (!oneWay) {
			returnDate = new Date(returnDateWeb.getFullYear(), returnDateWeb.getMonth(), returnDateWeb.getDate()); // convert date to local timezone
		}
		dataaccess.findOneWithCondition(module.dbNames.flightName, {"originPort" : fromAirport, "destPort" : toAirport, "scheduledDepartureTime" : fromDate}, function(err, outboundData){
			debug('Outbound : ' + JSON.stringify(outboundData))
			
			//Match behavior with old code, add flights into array
			flightsOutbound = [];
			if(outboundData !== null){
				flightsOutbound.push(outboundData);
			}
			
			//if (oneWay=='false') { // this needs to be changed like this. currently, oneWay is string instead of boolean
			if (!oneWay) {
				dataaccess.findOneWithCondition(module.dbNames.flightName, {"originPort" : toAirport, "destPort" : fromAirport, "scheduledDepartureTime" : returnDate}, function(err, inboundData){
					debug('Inbound : ' + JSON.stringify(inboundData))
					
					//Match behavior with old code, add flights into array
					flightsReturn = [];
					if (inboundData !== null){
						flightsReturn.push(inboundData);
					}
					
					var options = {"tripFlights":
						[
						 {"numPages":1,"flightsOptions": flightsOutbound,"currentPage":0,"hasMoreOptions":false,"pageSize":10},
						 {"numPages":1,"flightsOptions": flightsReturn,"currentPage":0,"hasMoreOptions":false,"pageSize":10}
						], "tripLegs":2};
					
					debug('options', options);
					callback(options);
				});
			}
			else {
				var options = {"tripFlights":
					[
					 {"numPages":1,"flightsOptions": flightsOutbound,"currentPage":0,"hasMoreOptions":false,"pageSize":10}
					], "tripLegs":1};
				callback(options);
			}
		});
	};	
	
	module.countFlights = function(req,res) {
		countItems(module.dbNames.flightName, function (error,count){
			if (error){
				res.send("-1");
			} else {
				res.send(count.toString());
			}
		});
	};

	countItems = function(dbName, callback /*(error, count)*/) {
		console.log("Calling count on " + dbName);
		dataaccess.count(dbName, {}, function(error, count) {
			console.log("Output for "+dbName+" is "+count);
			if (error) callback(error, null);
			else {
				callback(null,count);
			}
		});
	};

	return module;
}