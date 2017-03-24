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
	var debug = require('debug')('routes');
	var uuid = require('uuid');
	var log4js = require('log4js');

	/**
	 * initialize for Watson services
	var vcapUrl = null;
	var vcapUsername = null;
	var vcapPassword = null;

	if (process.env.VCAP_SERVICES) {
		var services = JSON.parse(process.env.VCAP_SERVICES);
		for (var service_name in services) {
			if (service_name.indexOf('dialog') === 0) {
				var service = services[service_name][0];
				vcapUrl = service.credentials.url;
				vcapUsername = service.credentials.username;
				vcapPassword = service.credentials.password;
			}
		}
	}
	*/

	//logging configurations
	log4js.configure('log4js.json', {});
	var logger = log4js.getLogger('main_app');
	logger.setLevel(settings.loggerLevel);

	module.dbNames = dataaccess.dbNames

	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback)
	}

	module.initialize = function (callback) {
		dataaccess.initialize(callback);
	};
	
	module.closeDBConnection = function(callback){
		dataaccess.closeConnection(callback);
	}

	module.insertOne = function (collectionname, doc, callback /* (error, insertedDocument) */) {
		dataaccess.insertOne(collectionname, doc, callback)
	};


	/*
	 * STAY
	 */
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

	module.countFlights = function(req,res) {
		countItems(module.dbNames.flightName, function (error,count){
			if (error){
				res.send("-1");
			} else {
				res.send(count.toString());
			}
		});
	};

	function countItems(dbName, callback /*(error, count)*/) {
		debug("Calling count on " + dbName);
		dataaccess.count(dbName, {}, function(error, count) {
			debug("Output for "+dbName+" is "+count);
			if (error) callback(error, null);
			else {
				callback(null,count);
			}
		});
	};

	return module;
}

