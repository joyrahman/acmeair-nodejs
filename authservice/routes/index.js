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
	
	log4js.configure('log4js.json', {});
	var logger = log4js.getLogger('authservice/routes');
	logger.setLevel(settings.loggerLevel);

	var daModuleName = "../../dataaccess/"+dbtype+"/index.js";
	logger.info("Use dataaccess:"+daModuleName);
	var dataaccess = new require(daModuleName)(settings);
			
	// customer service setup code ****
	var http = require('http')
    
    // Place holder for service registry/discovery code
	var location = process.env.CUSTOMER_SERVICE || "localhost/acmeair";
	var host;
	var post;
	var customerContextRoot;
    
	if (location.indexOf(":") > -1) {
		var split1 = location.split(":");
		host=split1[0];
		
		var split2 = split1.split("/");
		port = split2[0];
		customerContextRoot = '/' + split2[1];
	} else {
		var split1 = location.split("/");
		host=split1[0];
		customerContextRoot = '/' + split1[1];
		port=80;
	}
	// *****

	module.dbNames = dataaccess.dbNames
	
	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback);
	}
	
	module.login = function(req, res) {

		var login = req.body.login;
		var password = req.body.password;
	
		res.cookie('sessionid', '');
		// invalidate current session here??
				
		// replace eventually with call to business logic to validate customer
		validateCustomer(login, password, function(err, customerValid) {
			if (err) {
				res.status(500).send(err); // TODO: do I really need this or is there a cleaner way??
				return;
			}
			
			if (!customerValid) {
				res.sendStatus(403);
			}
			else {
				createSession(login, function(error, sessioninfo) {
					if (error) {
						logger.info(error);
						res.send(500, error);
						return;
					}
					res.cookie('sessionid', sessioninfo._id);
					res.send('logged in');
				});
			}
		});
	};
	
	module.authcheck = function(req, res) {
		logger.debug('validate token ' + req.params.tokenid);
		
		validateSession(req.params.tokenid, function(error, cs){
			if (error){
				res.status(404).send(error);
			}
			else{
				res.send(JSON.stringify(cs));
			}
		})
	}
	
	module.logout = function (req, res){
		logger.debug("logging out " + req.cookies.sessionid);
		
		var sessionid = req.cookies.sessionid;
		invalidateSession(sessionid, function(error){
			if (error){
			 	res.status(404).send(error);
			} else {
				res.cookie('sessionid', '');
				res.send('logged out');
			}
		})
	}
	
	validateCustomer = function(login, password, callback) {
		
		// make service call to customerService
		var querystring = require('querystring');
    	var dataString = querystring.stringify({
    	      login: login,
    	      password: password
    	    });

    	var path = '/rest/api/customer/validateid';
    	
    	logger.debug("Sending to: " + "http://" + host + ":" + port + customerContextRoot + path);
    	
    	var options = {
    	    host: host,
    	    port: port,
    	    path: customerContextRoot + path,
    	    method: 'POST',
    	    headers: {
    	        'Content-Type': 'application/x-www-form-urlencoded',
    	        'Content-Length': Buffer.byteLength(dataString)
    	    }
    	};
    		
	    var request = http.request(options, function(response){
	      		var data='';
	      		response.setEncoding('utf8');
	      		response.on('data', function (chunk) {
		   			data +=chunk;
	      		});
	      		 response.on('end', function(){
	      			if (response.statusCode>=400)
	 				   callback("StatusCode:"+ response.statusCode+",Body:"+data, null);
	 			   	else{
	 					var jsonData = JSON.parse(data);
	 					logger.debug("returning " + jsonData.validCustomer);
	 					callback(null, jsonData.validCustomer);
	 	            }
	        	})
	    });
	    request.on('error', function(e) {
	    	 callback("StatusCode:500,Body:"+data, null);
	    });
	    
	    request.write(dataString);
	   	request.end();
	}
	
	createSession = function(customerId, callback /* (error, session) */) {
		logger.debug("create session in DB:"+customerId);

		var now = new Date();
		var later = new Date(now.getTime() + 1000*60*60*24);
			
		var document = { "_id" : uuid.v4(), "customerid" : customerId, "lastAccessedTime" : now, "timeoutTime" : later };

		dataaccess.insertOne(module.dbNames.customerSessionName, document, function (error, doc){
			if (error) callback (error, null)
			else callback(error, document);
		});
	}

	validateSession = function(sessionId, callback /* (error, session) */){
		logger.debug("validate session in DB:"+sessionId);
		var now = new Date();
		
	    dataaccess.findOne(module.dbNames.customerSessionName, sessionId, function(err, session) {
			if (err) callback (err, null);
			else{
				if (now > session.timeoutTime) {
					daraaccess.remove(module.dbNames.customerSessionName,sessionId, function(error) {
						callback(null, null);
					});
				}
				else
					callback(null, session);
			}
		});
	}
	
	invalidateSession = function(sessionid, callback /* error */) {
		logger.debug("invalidate session in DB:"+sessionid);
	    dataaccess.remove(module.dbNames.customerSessionName,sessionid,callback) ;
	}

	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback);
	}
	
	return module;
}