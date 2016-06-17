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
    var debug = require('debug')('routes');
	var uuid = require('node-uuid');
	var log4js = require('log4js');
	var watson = require('watson-developer-cloud');

/*	var http = require('http')
	var flightCache = require('ttl-lru-cache')({maxLength:settings.flightDataCacheMaxSize});
	var flightSegmentCache = require('ttl-lru-cache')({maxLength:settings.flightDataCacheMaxSize});
	var flightDataCacheTTL = settings.flightDataCacheTTL == -1 ? null : settings.flightDataCacheTTL; 
*/	
	
	//initialize for Watson services
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
	
	var dialog = watson.dialog({
		url: vcapUrl || settings.watsontUrl,
		username : vcapUsername || settings.watsonUsername,
		password : vcapPassword || settings.watsonPassword,
		version : settings.watsonVersion
	});
	
	//logging configurations
	log4js.configure('log4js.json', {});
	var logger = log4js.getLogger('routes');
	logger.setLevel(settings.loggerLevel);

	var daModuleName = "../../dataaccess/"+dbtype+"/index.js";
	logger.info("Use dataaccess:"+daModuleName);
	debug("Use dataaccess:", daModuleName);
	var dataaccess = new require(daModuleName)(settings, "acmeair");
	
	module.dbNames = dataaccess.dbNames
	
	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback)
	}

    module.initialize = function (callback) {
    	dataaccess.initialize(callback);
	};
	
	module.insertOne = function (collectionname, doc, callback /* (error, insertedDocument) */) {
		dataaccess.insertOne(collectionname, doc, callback)
	};


	module.login = function(req, res) {
		logger.debug('logging in user');
		var login = req.body.login;
		var password = req.body.password;
	
		res.cookie('sessionid', '');
		
		// replace eventually with call to business logic to validate customer
		validateCustomer(login, password, function(err, customerValid) {
			if (err) {
				res.send(500,err); // TODO: do I really need this or is there a cleaner way??
				return;
			}
			
			if (!customerValid) {
				res.sendStatus(403);
			}
			else {
				createSession(login, function(error, sessionid) {
					if (error) {
						logger.info(error);
						res.send(500, error);
						return;
					}
					res.cookie('sessionid', sessionid);
					res.send('logged in');
				});
			}
		});
	};

	function validateCustomer(username, password, callback /* (error, boolean validCustomer) */) {
		dataaccess.findOne(module.dbNames.customerName, username, function(error, customer){
				if (error) callback (error, null);
				else{
	                if (customer)
	                {
	                	callback(null, customer.password == password);
	                }
	                else
	                	callback(null, false)
				}
		});
	};
	
	function createSession(customerId, callback /* (error, sessionId) */) {
		var now = new Date();
		var later = new Date(now.getTime() + 1000*60*60*24);
			
		var document = { "_id" : uuid.v4(), "customerid" : customerId, "lastAccessedTime" : now, "timeoutTime" : later };

		dataaccess.insertOne(module.dbNames.customerSessionName, document, function (error, doc){
			if (error) callback (error, null)
			else callback(error, document._id);
		});
	}

	module.logout = function(req, res) {
		logger.debug('logging out user');
		
		var sessionid = req.cookies.sessionid;
		var login = req.body.login;
		invalidateSession(sessionid, function(err) {
			res.cookie('sessionid', '');
			res.send('logged out');
		});
	};

	function invalidateSession(sessionid, callback /* error */) {
	    dataaccess.remove(module.dbNames.customerSessionName,{'_id':sessionid},callback) 
	}

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
	
	module.getSupportWSPort = function(req,res) {
		var port = settings.websocketPort.toString();
		res.send(port);
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
	
	module.getSupportInitInfo = function(req,res) {
		
		var dialog_id = null;
		res.clearCookie('dialogID');
		res.clearCookie('conversationID');
		res.clearCookie('clientID');
		
		
		dialog.getDialogs({}, function (err, dialogs) {
		
			if (err)
				debug ('error:', err);
			else {
				debug ('Dialogs : ', dialogs );
				
				var doesDialogExist = false;
				dialogs.dialogs.filter(function(item) {
					if(item.name == settings.watsonDialogName){
						debug ('Item : ', item );
						debug ('dialog_id : ', item.dialog_id );
						dialog_id = item.dialog_id;
						res.cookie('dialogID', dialog_id);
						doesDialogExist = true;
						//To update the dialog, set watsonUpdateDialog true, and update watsonDialogFile.
						if (settings.watsonUpdateDialog){
							var fs = require('fs');
							var params = {
									dialog_id: dialog_id,
									file: fs.createReadStream('./websocket/' + settings.watsonDialogFile)
							};
							dialog.updateDialog(params, function(err, update){
								debug ('Update Message : ',update);
								debug ('Error : ',err);
							});
						}else {
							debug ("NO DIALOG UPDATE");
						}
					}
				});
				/*If the Dialog does not exist, create the dialog.
				 * Set the Dialog name & file name in settings.json
				 */
				if (!doesDialogExist){
					var fs = require('fs');
					var params = {
						  name: settings.watsonDialogName,
						  file: fs.createReadStream('./websocket/' + settings.watsonDialogFile)
					};
					dialog.createDialog(params, function(err, newDialog){
						debug ('dialog name : ',settings.watsonDialogName);
						debug ('Error : ',err);
						debug ('dialog_id : ', newDialog.dialog_id );
						dialog_id = newDialog.dialog_id;
						res.cookie('dialogID', dialog_id);
					});
				}
			}
			res.send(JSON.stringify({"agent" : "Server Message", "message":"Please wait for a moment. Agent will be with you shortly."}));
		});
		
	};
	
	module.getSupportService = function(req,res) {
		
		var dialog_id = req.cookies.dialogID;
		var conversation_id = req.cookies.conversationID;
		var client_id = req.cookies.clientID;
				
		
		//if the dialog have been initialized
		if(dialog_id){
			
			//if the conversation haven't been started
			if(!conversation_id){
				var params = { dialog_id: dialog_id};

				dialog.conversation(params, function(err, results) {
					res.cookie('conversationID', results.conversation_id);
					res.cookie('clientID', results.client_id);
					if (err)
						return JSON.stringify(err, null, 2);
					else if (!results){
						return "Result is null";
					} else {
						debug ('Results : ' , results);
						debug ('conversation_id : ' , results.conversation_id);
						debug ('client_id : ' , results.client_id);
						res.send(JSON.stringify({"agent" : "Watson", "message":results.response[0]}));
					}
				});
			} else {
				var message = req.body.message;
				params = { dialog_id: dialog_id, conversation_id: conversation_id, input: message};
				
				dialog.conversation(params, function message(err, results) {
						var returnMessage = "";
						
						if (err)
							return JSON.stringify(err, null, 2);
						
						debug ('Results : ' , results);
						debug ('conversation_id : ' , conversation_id);
						debug ('client_id : ' , client_id);

						if (results && results.response[0] && results.response[0].indexOf('Itinerary') > -1 ){
							debug ('End of conversation');
							params = { dialog_id: dialog_id, client_id: results.client_id};
							dialog.getProfile(params, function(err, profile) {
								if (err)
									return JSON.stringify(err, null, 2);
								else
									searchFlights(profile.name_values[0].value, profile.name_values[1].value, profile.name_values[2].value=='true', new Date(), new Date(), function(values){
										values.tripFlights.forEach(function(entries, index) {
										  entry = entries.flightsOptions[0];
										  debug({"agent" : "Watson", "message": 
											  results.response[0] +
											  (index == 0 ? "\nOUTBOUND - " : "\nINBOUND - " ) +
											  " Airplane : " + entry['airplaneTypeId'] + 
											  " Flight : " + entry['flightSegmentId'] + 
											  "\nDeparture : " + (index == 0 ? profile.name_values[0].value : profile.name_values[1].value ) + " " + entry['scheduledDepartureTime'] +
											  "\nArrival : " + (index == 0 ? profile.name_values[1].value : profile.name_values[0].value ) + " " + entry['scheduledArrivalTime'] +
											  "\n\nPlease login and reserve flights for reservation in the flights tab.\nIs there anything else that I can help you with?"});
										  res.send(JSON.stringify({"agent" : "Watson", "message": 
											  results.response[0] +
											  (index == 0 ? "\nOUTBOUND - " : "\nINBOUND - " ) +
											  " Airplane : " + entry['airplaneTypeId'] + 
											  " Flight : " + entry['flightSegmentId'] + 
											  "\nDeparture : " + (index == 0 ? profile.name_values[0].value : profile.name_values[1].value ) + " " + entry['scheduledDepartureTime'] +
											  "\nArrival : " + (index == 0 ? profile.name_values[1].value : profile.name_values[0].value ) + " " + entry['scheduledArrivalTime'] +
											  "\n\nPlease login and reserve flights for reservation in the flights tab.\nIs there anything else that I can help you with?"}));
										});
									});
							});
						} else {
							res.send(JSON.stringify({"agent" : "Watson", "message":results.response[0]}));
						}
				});
			}
		}	
		
	};

	return module;
}

