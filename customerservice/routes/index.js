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

module.exports = function (dbtype, authService, settings) {
    var module = {};
	var uuid = require('node-uuid');
	var log4js = require('log4js');
	
	var logger = log4js.getLogger('customerservice/routes');
	logger.setLevel(settings.loggerLevel);

	var daModuleName = "../../dataaccess/"+dbtype+"/index.js";
	logger.info("Use dataaccess:"+daModuleName);
	var dataaccess = new require(daModuleName)(settings);
	
	module.dbNames = dataaccess.dbNames
	
	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback);
	}
	
	module.checkForValidSessionCookie = function(req, res, next) {
		logger.debug('checkForValidCookie');
		var sessionid = req.cookies.sessionid;
		if (sessionid) {
			sessiondid = sessionid.trim();
		}
		if (!sessionid || sessionid == '') {
			logger.info('checkForValidCookie - no sessionid cookie so returning 403');
			logger.debug('checkForValidCookie - no sessionid cookie so returning 403');
			res.sendStatus(403);
			return;
		}
	
		validateSession(sessionid, function(err, customerid) {
			if (err) {
				logger.debug('checkForValidCookie - system error validating session so returning 500');
				res.sendStatus(500);
				return;
			}
			
			if (customerid) {
				logger.debug('checkForValidCookie - good session so allowing next route handler to be called');
				req.acmeair_login_user = customerid;
				next();
				return;
			}
			else {
				logger.info('checkForValidCookie - bad session so returning 403');
				logger.debug('checkForValidCookie - bad session so returning 403');
				res.sendStatus(403);
				return;
			}
		});
	}
	
	function validateSession(sessionId, callback /* (error, userid) */) {
		authService.validateSession(sessionId,callback);
		return;
	}

	module.getCustomerById = function(req, res) {
		logger.debug('getting customer by user ' + req.params.user);
	
		getCustomer(req.params.user, function(err, customer) {
			if (err) {
				res.sendStatus(500);
			}
			
			res.send(customer);
		});
	};
	
	module.putCustomerById = function(req, res) {
		logger.debug('putting customer by user ' + req.params.user);
		
		updateCustomer(req.params.user, req.body, function(err, customer) {
			if (err) {
				res.sendStatus(500);
			}
			res.send(customer);
		});
	};
	
	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback);
	}
	
	
	function getCustomer(username, callback /* (error, Customer) */) {
	    dataaccess.findOne(module.dbNames.customerName, username, callback);
	}
	
	function updateCustomer(login, customer, callback /* (error, Customer) */) {						
	    dataaccess.update(module.dbNames.customerName, customer,callback)
	}


	return module;
}