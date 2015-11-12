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
    var http = require('http')

    var contextRoot = settings.flightbookingContextRoot || "/acmeair-flightbooking-service/rest/api"
	var location = process.env.FLIGHTBOOKING_SERVICE;
	   
    var hostAndPort = location.split(":");

	var log4js = require('log4js');
	var logger = log4js.getLogger('flightbookinghttp');
	logger.setLevel(settings.loggerLevel);
	   
	
	module.queryFlights = function(body, callback) {
		doPost('/flights/queryflights/',body,function(err,result) {
			callback(err,result);
		});
	}
	
	module.bookFlights = function(body, callback) {
		doPost('/bookings/bookflights/',body,function(err,result) {
			callback(err,result);
		});
	}
	
	module.cancelBooking = function(body, callback) {
		doPost('/bookings/cancelbooking/',body,function(err,result) {
			callback(err);
		});
	}
	
	module.getBookingsByUser = function(userid, callback) {
		doGet('/bookings/byUser/' + userid, function(err,result) {
			callback(err,result);
		});
	}
	
    doPost = function (restLocation, body, callback) {
    	    	
    	bodyString = JSON.stringify(body);
    	
		var path = contextRoot + restLocation;
	    var options = {
			hostname: hostAndPort[0],
		 	port: hostAndPort[1],
		    	path: path,
		    	method: "POST",
		    	headers: {
		    	      'Content-Type': 'application/json',
		    	      'Content-Length': bodyString.length
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
    
    doGet = function (restLocation, callback) {   	
    	
		var path = contextRoot + restLocation;
	    var options = {
			hostname: hostAndPort[0],
		 	port: hostAndPort[1],
		    	path: path,
		    	method: "GET",
		    	headers: {
		    	      'Content-Type': 'application/json'
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
