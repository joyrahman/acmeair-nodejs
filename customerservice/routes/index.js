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
	
	var logger = log4js.getLogger('customerservice/routes');
	logger.setLevel(settings.loggerLevel);

	var daModuleName = "../../dataaccess/"+dbtype+"/index.js";
	logger.info("Use dataaccess:"+daModuleName);
	var dataaccess = new require(daModuleName)(settings);
	
	module.dbNames = dataaccess.dbNames
	
	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback);
	}
	
	// auth service setup code ****
	var http = require('http')
    
    // Place holder for service registry/discovery code
	var location = process.env.AUTH_SERVICE || "localhost/acmeair";
	var host;
	var post;
	var contextRoot;
    
	if (location.indexOf(":") > -1) {
		var split1 = location.split(":");
		host=split1[0];
		
		var split2 = split1.split("/");
		port = split2[0];
		authContextRoot = '/' + split2[1];
	} else {
		var split1 = location.split("/");
		host=split1[0];
		authContextRoot = '/' + split1[1];
		port=80;
	}
	// *****
	
	module.checkForValidSessionCookie = function(req, res, next) {
		logger.debug('checkForValidCookie');
		var sessionid = req.cookies.sessionid;
		if (sessionid) {
			sessiondid = sessionid.trim();
		}
		if (!sessionid || sessionid == '') {
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
				logger.debug('checkForValidCookie - bad session so returning 403');
				res.sendStatus(403);
				return;
			}
		});
	}
	
	function validateSession(sessionId, callback /* (error, userid) */) {
		var path = authContextRoot + "/rest/api/login/authcheck/" + sessionId;
     	var options = {
		hostname: host,
	 	port: port,
	    	path: path,
	    	method: "GET",
	    	headers: {
	    	      'Content-Type': 'application/json'
	    	}
     	}

    	logger.debug('validateSession request:'+JSON.stringify(options));

     	var request = http.request(options, function(response){
      		var data='';
      		response.setEncoding('utf8');
      		response.on('data', function (chunk) {
	   			data +=chunk;
      		});
       		response.on('end', function(){
       			if (response.statusCode>=400)
       				callback("StatusCode:"+ response.statusCode+",Body:"+data,null);
       			else
       				callback(null, JSON.parse(data).customerid);
        	})
     	});
     	request.on('error', function(e) {
   			callback('problem with request: ' + e.message, null);
     	});
     	request.end();
		
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
	
	module.validateId = function(req, res) {
		logger.info('verifying password for ' + req.body.login);
		getCustomer(req.body.login, function(err, customer) {
			if (err) {
				res.sendStatus(500);
			}
			logger.info(customer);
			if (req.body.password == customer.password) {
				res.send('{"validCustomer":"true"}');
			} else {
					res.send('{"validCustomer":"false"}');
			}
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