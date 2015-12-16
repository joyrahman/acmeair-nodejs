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

module.exports = function (settings) {
    var module = {};
    var http = require('http');
    var querystring = require('querystring');

    var contextRoot = settings.flightbookingContextRoot || "/acmeair-flightbooking-service/rest/api"
	var location = process.env.FLIGHTBOOKING_SERVICE;
	   
    var hostAndPort = location.split(":");

	var log4js = require('log4js');
	var logger = log4js.getLogger('flightbookinghttp');
	logger.setLevel(settings.loggerLevel);
	   
	
	module.queryflights = function(req, res) {
		
    	var sessionid = req.cookies.sessionid;    	
		
		doPost('/flights/queryflights/',sessionid, req.body, function(err,result) {
			if (result==null) {
				res.send(err);
			} else {
				res.send(result);
			}
		});
	}
	
	module.bookflights = function(req, res) {
		
		var sessionid = req.cookies.sessionid; 
		
		doPost('/bookings/bookflights/',sessionid, req.body, function(err,result) {
			if (result==null) {
				res.send(err);
			} else {
				res.send(result);
			}
		});
	}
	
	module.cancelBooking = function(req, res) {
		
		var sessionid = req.cookies.sessionid; 
		
		doPost('/bookings/cancelbooking/',sessionid, req.body, function(err,result) {
			if (result==null) {
				res.send(err);
			} else {
				res.send(result);
			}
		});
	}
	
	module.bookingsByUser = function(req, res) {
		
		var userid = req.params.user;
		var sessionid = req.cookies.sessionid; 
		
		
		doGet('/bookings/byuser/' + userid, sessionid, function(err,result) {
			if (result==null) {
				res.send(err);
			} else {
				res.send(result);
			}
		});
	}
	
    doPost = function (restLocation, sessionid, body, callback) {
    	    	
    	bodyString = querystring.stringify(body);
        
    	logger.debug("queryString:" + bodyString);
    	
		var path = contextRoot + restLocation;
	    var options = {
			hostname: hostAndPort[0],
		 	port: hostAndPort[1],
		    	path: path,
		    	method: "POST",
		    	headers: {
		    		  'Content-Type': 'application/x-www-form-urlencoded',
		              'Content-Length': Buffer.byteLength(bodyString),
		    	      'Cookie':'sessionid='+ sessionid
		    	}
	    }
	
	    logger.debug('doPost request:'+JSON.stringify(options));
	
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
	 					callback(null, data);
	 	            }
	        	})
	    });
	    request.on('error', function(e) {
	   			callback('problem with request: ' + e.message, null);
	    });
	    request.write(bodyString);
	   	request.end();
	}
    
    doGet = function (restLocation, sessionid, callback) {   	
    	
		var path = contextRoot + restLocation;
	    var options = {
			hostname: hostAndPort[0],
		 	port: hostAndPort[1],
		    	path: path,
		    	method: "GET",
		    	headers: {
		    	      'Content-Type': 'application/json',
		    		  //'Content-Type': 'application/x-www-form-urlencoded',
		    	      'Cookie':'sessionid='+ sessionid
		    	}
	    }
	
	    logger.debug('doGet request:'+JSON.stringify(options));
	
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
	 					callback(null, data);
	 	            }
	        	})
	    });
	    request.on('error', function(e) {
	   			callback('problem with request: ' + e.message, null);
	    });
	
	   	request.end();
	}
    
	return module;
}
