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

    var contextRoot = settings.customerContextRoot || "/acmeair-customer-service/rest/api"
	var location = process.env.CUSTOMER_SERVICE;
	   
    var hostAndPort = location.split(":");

	var log4js = require('log4js');
	var logger = log4js.getLogger('customerhttp');
	logger.setLevel(settings.loggerLevel);
	
    module.getCustomer = function (userid, sessionid, callback /* (error, userid) */){

    	    	
		var path = contextRoot+"/customer/byid/" + userid;
	     	var options = {
			hostname: hostAndPort[0],
		 	port: hostAndPort[1],
		    	path: path,
		    	method: "GET",
		    	headers: {
		    	      'Content-Type': 'application/json',
		    	      'Cookie':'sessionid='+ sessionid
		    	}
	     		
	    }
	
	    logger.info('getCustomer request:'+JSON.stringify(options));
	
	    var request = http.request(options, function(response){
	      		var data='';
	      		response.setEncoding('utf8');
	      		response.on('data', function (chunk) {
	      		  logger.info('getCustomer chunk:'+chunk);
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
   
   
    module.updateCustomer = function (userid, sessionid, customer, callback /* (error, userid) */){
    	    	
    	customerData = JSON.stringify(customer);
    	
		var path = contextRoot+"/customer/byid/" + userid;
	    var options = {
			hostname: hostAndPort[0],
		 	port: hostAndPort[1],
		    	path: path,
		    	method: "POST",
		    	headers: {
		    	      'Content-Type': 'application/json',
		    	      'Content-Length': customerData.length,
		    	      'Cookie':'sessionid='+ sessionid
		    	}
	    }
	
	    logger.debug('updateCustomer request:'+JSON.stringify(options));
	
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
	    request.write(customerData);
	   	request.end();
	}
    
	return module;
}
