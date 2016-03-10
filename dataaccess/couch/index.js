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

// Dataaccess must implement 
//	 	dbNames:  { customerName:, flightName:, flightSegmentName:, bookingName:, customerServiceName:, airportCodeMappingName:}
// 		initializeDatabaseConnections(function(error))
// 		insertOne(collname, doc, function(error, doc))
// 		findOne(collname, _id value, function(error, doc))
//		update(collname, doc, function(error, doc))
//		remove(collname, condition as json of field and value, function(error))
// 		findBy(collname, condition as json of field and value,function(err, docs))
//		TODO: count(collname, condition as json of field and value, function(error, count))

module.exports = function (settings) {
    var module = {};
    
    var log4js = require('log4js');
    
    log4js.configure('log4js.json', {});
    var logger = log4js.getLogger('dataaccess/couch');
    logger.setLevel(settings.loggerLevel);

    module.dbNames = {
    		customerName: "n_customer",
    		flightName:"n_flight",
    		flightSegmentName:"n_flightsegment",
    		bookingName:"n_booking",
    		customerSessionName:"n_customersession",
    		airportCodeMappingName:"n_airportcodemapping"
    }

    var dbConfig = calculateDBConfig();
    var nano = require('nano')(dbConfig.hosturl); // may need to set the connection pool here.

    // TODO does cache the db by dbName improve performance?
    var nanoDBs = {};
    nanoDBs[module.dbNames.airportCodeMappingName]=nano.db.use(module.dbNames.airportCodeMappingName);
    nanoDBs[module.dbNames.bookingName]=nano.db.use(module.dbNames.bookingName);
    nanoDBs[module.dbNames.customerName]=nano.db.use(module.dbNames.customerName);
    nanoDBs[module.dbNames.customerSessionName]=nano.db.use(module.dbNames.customerSessionName);
    nanoDBs[module.dbNames.flightName]=nano.db.use(module.dbNames.flightName);
    nanoDBs[module.dbNames.flightSegmentName]=nano.db.use(module.dbNames.flightSegmentName);  
    
    module.initializeDatabaseConnections = function(callback/*(error)*/) {
    	// do nothing
    	callback(null);
    }

	function calculateDBConfig(){
		
		var dbConfig ;
		if(process.env.VCAP_SERVICES){
			var env = JSON.parse(process.env.VCAP_SERVICES);
	        longger.log("env: %j",env);
			var serviceKey = Object.keys(env)[0];
			dbConfig = env[serviceKey][0]['credentials'];
		}
		if ( ! dbConfig ) {
			if(process.env.COUCH_URL){
				dbConfig = {"hosturl":process.env.COUCH_URL};
			}
		}
		if ( ! dbConfig ) {
			dbConfig = {
		    "host":settings.couch_host,
		    "port": settings.couch_port || 443,
		    "username":settings.couch_username,
		    "password":settings.couch_password
		    }
		}
		if ( ! dbConfig.hosturl){
			if (settings.couch_connection == "http") {
				dbConfig.hosturl = settings.couch_connection + "://"+dbConfig.host+":"+ dbConfig.port;
			} else {
				dbConfig.hosturl = settings.couch_connection + "://"+dbConfig.username+":"+dbConfig.password+"@"+dbConfig.host+":"+ dbConfig.port;
			}
			console.log(dbConfig.hosturl );
		}
		return dbConfig;
	}

    module.insertOne = function (collectionname, doc, callback /* (error, doc) */) {
    	
    	nanoDBs[collectionname].insert(doc, doc._id, function(err, doc){
			if (err) {
				logger.error(err);
				callback(err, null);
			}else
				callback(null, doc);
		});
	};

    module.findOne = function (collectionname, key, callback /* (error, doc) */) {
    	nanoDBs[collectionname].get(key, function(err, doc){
			if (err) {
				logger.error(err);
				callback(err, null);
			}else
			{
				callback(null, doc);
			}
		});
	};

    module.update = function (collectionname, doc, callback /* (error, insertedDocument) */) {
    	getRevision(nanoDBs[collectionname],doc._id, function(error, revision){ // Has to get revision as the customer passed from ui lost revision
    		if (error) callback (error, null);
    		else{
    			doc._rev = revision;
    			nanoDBs[collectionname].insert(doc, doc._id, function(err, body) {
    				callback(err, doc);
    			});
    		}
    	});
	};
	
	function getRevision(db, id, callback/*(error, revision)*/)
	{
		db.head(id, function(err, _, headers) {
			if (!err)
			{
				var revision = headers.etag;
				
				revision = revision.substring(1, revision.length-1);
			    callback(null, revision);
			}
			else {
				callback(err, null);
			}
		});
	}

    module.remove = function (collectionname, condition, callback /* (error) */) {
    	getRevision(nanoDBs[collectionname], condition._id, function(err, revision){
    		if (!err)
    		{
    			nanoDBs[collectionname].destroy(condition._id, revision, function(error, body) {
    				if (error) {
    					callback (error)
    				} else {
    					callback(null);
    				}
    			});
    		}
    		else { 
    			callback(err);
    		}
    	}); 
	};
	
		
	module.removeAll = function (collectionname, callback /* (error) */) {
		
		nano.db.destroy(collectionname, function(err, body) {
			nano.db.create(collectionname, function(err, body) {
				if (err)
					callback(err); 
				else {
					if (collectionname == module.dbNames.flightSegmentName){
						nanoDBs[collectionname].insert(
								{ "views": 
								{ "by_origin_and_dest": 
								{ "map": function(doc) {
									  emit([doc.originPort, doc.destPort],doc);
								} } 
								}
								}, '_design/view', function (error, response) { console.log(response);});
					}
					if (collectionname == module.dbNames.flightName){
						nanoDBs[collectionname].insert(
								{ "views": 
								{ "by_segmentId_and_departureTime": 
								{ "map": function(doc) {
									  emit([doc.flightSegmentId, doc.scheduledDepartureTime],doc);
								} } 
								}
								}, '_design/view', function (error, response) { console.log(response);});
					}
					if (collectionname == module.dbNames.bookingName){
						nanoDBs[collectionname].insert(
								{ "views": 
								{ "by_customerId": 
								{ "map": function(doc) {
									  emit([doc.customerId],doc);
								} } 
								}
								}, '_design/view', function (error, response) { console.log(response);});
					}
					callback(null);
				}
			});
		});	 		 
	};
	
	module.findBy = function(collectionname, condition, callback /*(error, docs*/){
		
		if (collectionname == module.dbNames.flightSegmentName) {
			var opts = [condition["originPort"],condition["destPort"]];
		
			nanoDBs[collectionname].view('view','by_origin_and_dest', {key: opts}, function (error, view) {
				if (error) {
					console.log("Hit error:"+error);
					callback (error, null);
				} else {
					callback(null, getDocumentFromQuery(view.rows));
				}
				
			});
		}
		if (collectionname == module.dbNames.flightName){
			var opts = [condition["flightSegmentId"],condition["scheduledDepartureTime"]];
		
			nanoDBs[collectionname].view('view','by_segmentId_and_departureTime', {key: opts}, function (error, view) {
				if (error) {
					console.log("Hit error:"+error);
					callback (error, null);
				} else {
					callback(null, getDocumentFromQuery(view.rows));
				}
				
			});	
		} 
		if (collectionname == module.dbNames.bookingName) {
			var opts = [condition["customerId"]];
			
			nanoDBs[collectionname].view('view','by_customerId', {key: opts}, function (error, view) {
				if (error) {
					console.log("Hit error:"+error);
					callback (error, null);
				} else {
					callback(null, getDocumentFromQuery(view.rows));
				}
				
			});	
		}
	}

	function getDocumentFromQuery(document)
	{
		logger.debug("translate document from query:"+JSON.stringify(document));
		var docs = [];
		for (i=0; i<document.length; i++)
			docs[i] = document[i].value;
		logger.debug("translated document from query:"+JSON.stringify(docs));
		return docs;
	}

	module.count = function(collectionname, condition, callback/* (error, docs) */) {
		nano.db.get(collectionname,function(err, body){
			if (err){
				logger.error("count hit error:"+err);
				callback(err, -1);
			}
			else{
				// Do not count view
				if (collectionname ==  module.dbNames.flightSegmentName || collectionname ==  module.dbNames.flightName || 
						collectionname ==  module.dbNames.bookingName) {
					callback(null, body.doc_count-1);
				} else {
					callback(null, body.doc_count);
				}
			}
		});
	};
	
	return module;
	
}