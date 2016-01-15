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

module.exports = function (dbtype, settings) {
    var module = {};
	var uuid = require('node-uuid');
	var log4js = require('log4js');
	var http = require('http')
	var flightCache = require('ttl-lru-cache')({maxLength:settings.flightDataCacheMaxSize});
	var flightSegmentCache = require('ttl-lru-cache')({maxLength:settings.flightDataCacheMaxSize});
	var flightDataCacheTTL = settings.flightDataCacheTTL == -1 ? null : settings.flightDataCacheTTL; 
	
	var logger = log4js.getLogger('routes');
	logger.setLevel(settings.loggerLevel);

	var daModuleName = "../../dataaccess/"+dbtype+"/index.js";
	logger.info("Use dataaccess:"+daModuleName);
	var dataaccess = new require(daModuleName)(settings);
	
	module.dbNames = dataaccess.dbNames
	
	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback)
	}

	module.insertOne = function (collectionname, doc, callback /* (error, insertedDocument) */) {
		dataaccess.insertOne(collectionname, doc, callback)
	};

	module.toGMTString  = function(req, res) {
		logger.info('******* running eyecatcher function');
		var now = new Date().toGMTString();
		res.send(now);
	};
	
	module.getRuntimeInfo = function(req,res) {
		var runtimeInfo = [];
		runtimeInfo.push({"name":"Runtime","description":"NodeJS"});
		var versions = process.versions;
		for (var key in versions) {
			runtimeInfo.push({"name":key,"description":versions[key]});
		}
		res.contentType('application/json');
		res.send(JSON.stringify(runtimeInfo));
	};
	
	module.getDataServiceInfo = function(req,res) {
		var dataServices = [{"name":"cassandra","description":"Apache Cassandra NoSQL DB"},
		                    {"name":"cloudant","description":"IBM Distributed DBaaS"},
		                    {"name":"mongo","description":"MongoDB NoSQL DB"}];
		res.send(JSON.stringify(dataServices));
	};
	
	module.getActiveDataServiceInfo = function (req,res) {
		res.send(dbtype);
	};
	
	module.countBookings = function(req,res) {
		countItems(module.dbNames.bookingName, function (error,count){
			if (error){
				res.send("-1");
			} else {
				res.send(count.toString());
			}
		});
	};
	
	module.countCustomer = function(req,res) {
		countItems(module.dbNames.customerName, function (error,count){
			if (error){
				res.send("-1");
			} else {
				res.send(count.toString());
			}
		});
	};
	
	module.countCustomerSessions = function(req,res) {
		countItems(module.dbNames.customerSessionName, function (error,count){
			if (error){
				res.send("-1");
			} else {
				res.send(count.toString());
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
	
	module.countFlightSegments = function(req,res) {
		countItems(module.dbNames.flightSegmentName, function (error,count){
			if (error){
				res.send("-1");
			} else {
				res.send(count.toString());
			}
		});
	};
	
	module.countAirports = function(req,res) {
		countItems(module.dbNames.airportCodeMappingName, function (error,count){
			if (error){
				res.send("-1");
			} else {
				res.send(count.toString());
			}
		});
	};
	
	function countItems(dbName, callback /*(error, count)*/) {
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

