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
//Dataaccess must implement 
//dbNames:  { customerName:, flightName:, flightSegmentName:, bookingName:, customerServiceName:, airportCodeMappingName:}
//initializeDatabaseConnections(function(error))
//insertOne(collname, doc, function(error, doc))
//findOne(collname, _id value, function(error, doc))
//update(collname, doc, function(error, doc))
//remove(collname, condition as json of field and value, function(error))
//findBy(collname, condition as json of field and value,function(err, docs))
//count(collname, condition as json of field and value, function(error, count))

module.exports = function (settings) {
	var module = {};
	var debug = require('debug')('mongodb');

	var mongoClient = require('mongodb').MongoClient;
	var log4js = require('log4js');

	//log4js.configure('log4js.json', {});
	var logger = log4js.getLogger('mongo');
	logger.setLevel(settings.loggerLevel);

	var dbName = settings.mongoDatabaseName;

	module.dbNames = {
			customerName: "customer",
			flightName:"flight",
			flightSegmentName:"flightSegment",
			bookingName:"booking",
			customerSessionName:"customerSession",
			airportCodeMappingName:"airportCodeMapping"
	}

	var dbclient = null;

	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		var mongo = null;
		var mongoExists = false;

		//This section extracts Connection String to Compose Mongo DB
		if(process.env.VCAP_SERVICES){
			var env = JSON.parse(process.env.VCAP_SERVICES);
			var serviceKeys = Object.keys(env);
			serviceKeys.forEach(function(value){
				  debug('service key',value);
					if (value == 'compose-for-mongodb'){
						  if(mongoExists){
							  console.log('There are more than 1 Mongo DB Service connected to this instance.  Please check the Services.  For now, it will connect to the last Mongo DB Service that is detected ');
						  }
						temp = env[value][0]['credentials']['uri'];                 
						if (temp.startsWith('mongodb://')){
							mongo = temp;
							debug("mongo: %j",mongo);
							mongoExists = true;
						}
					}else if(value == 'user-provided'){
						if(env[value][0]['credentials'].hasOwnProperty('url')){
							temp = env[value][0]['credentials']['url'];
							if (temp.startsWith('mongodb://')){
								  if(mongoExists){
									  console.log('There are more than 1 Mongo DB Service connected to this instance.  Please check the Services.  For now, it will connect to the last Mongo DB Service that is detected ');
								  }
								mongo = temp;
								debug("mongo: %j",mongo);
								mongoExists = true;
							}
						}
					}
				});
		}

		// The section is for docker integration using link
		if (mongo ==null && process.env.MONGO_PORT!=null) {
			logger.info(process.env.MONGO_PORT);
			logger.info(process.env.MONGO_PORT_27017_TCP_ADDR);
			logger.info(process.env.MONGO_PORT_27017_TCP_PORT);
			mongo = {
					"hostname":  process.env.MONGO_PORT_27017_TCP_ADDR,
					"port": process.env.MONGO_PORT_27017_TCP_PORT,
					"username":"",
					"password":"",
					"name":"",
					"db":dbName
			}
		}
		// Default to read from settings file
		if (mongo==null) {
			mongo = {
					"hostname": process.env.MONGO_HOST || settings.mongoHost,
					"port": settings.mongoPort,
					"username":settings.mongoUsername,
					"password":settings.mongoPassword,
					"name":"",
					"db":dbName
			}
		}

		var generate_mongo_url = function(obj){
			if (process.env.MONGO_URL)
			{
				logger.info("mongo: %j",process.env.MONGO_URL);
				return process.env.MONGO_URL;
			}
			if (obj.startsWith('mongodb://')){
				return obj;
			}
			obj.hostname = (obj.hostname || 'localhost');
			obj.port = (obj.port || 27017);
			obj.db = (obj.db || dbName);

			if(obj.username && obj.password){
				return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
			}
			else{
				return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
			}
		}

		var mongourl = generate_mongo_url(mongo);


		var c_opt = {autoReconnect:true,poolSize: settings.mongoConnectionPoolSize};
		mongoClient.connect(mongourl, c_opt, function(err, conn){
			if (err){
				callback(err);
			}else {
				dbclient=conn;
					dbclient.collection(module.dbNames.bookingName).createIndex({customerId:1}
					, {background:true}, function(err, indexName) {
						logger.info("createIndex:"+err+":"+indexName);
					});
					dbclient.collection(module.dbNames.flightName).createIndex({flightSegmentId:1,scheduledDepartureTime:2}
					, {background:true}, function(err, indexName) {
						logger.info("createIndex:"+err+":"+indexName);
					});
					dbclient.collection(module.dbNames.flightSegmentName).createIndex({originPort:1,destPort:2}
					, {background:true}, function(err, indexName) {
						logger.info("createIndex:"+err+":"+indexName);
					});
				callback(null);
			}
		});
	}
	
	module.closeConnection = function(callback){
		dbclient.close(false, function(error, result) {
		  if (error){
			  logger.error("DB close error:"+error);
				callback(error);
		  }else{
			  callback();
		  }
		});
	}

	module.initialize = function (callback) {
		var itemsProcessed = 0;
		for(var dbName in module.dbNames){
			(function(tempDbName){
				dbclient.dropCollection(tempDbName, function() {
					itemsProcessed++;
					if(itemsProcessed === Object.keys(module.dbNames).length) {
						logger.info("Processing callback");
						callback();
					}   
				});
			})(module.dbNames[dbName]);
		}
	};

	module.insertOne = function (collectionname, doc, callback /* (error, insertedDocument) */) {
		dbclient.collection(collectionname,function(error, collection){
			if (error){
				logger.error("insertOne hit error:"+error);
				callback(error, null);
			}
			else{
				collection.insertOne(doc, {safe: true}, callback);
			}
		});
	};


	module.findOne = function(collectionname, key, callback /* (error, doc) */) {
		dbclient.collection(collectionname, function(error, collection){
			if (error){
				logger.error("findOne hit error:"+error);
				callback(error, null);
			}
			else{
				collection.find({_id: key}).toArray(function(err, docs) {
					if (err) callback (err, null);
					var doc = docs[0];
					if (doc)
						callback(null, doc);
					else
					{
						logger.debug("Not found:"+key);
						callback(null, null)
					}
				});
			}
		});
	};

	module.update = function(collectionname, doc, callback /* (error, doc) */) {
		dbclient.collection(collectionname, function(error, collection){
			if (error){
				logger.error("update hit error:"+error);
				callback(error, null);
			}
			else{
				collection.updateOne({_id: doc._id}, doc, {safe: true}, function(err, numUpdates) {
					logger.debug(numUpdates);
					callback(err, doc);
				});
			}
		});
	};

	module.remove = function(collectionname,condition, callback/* (error) */) {

		dbclient.collection(collectionname,function(error, collection){

			if (error){
				logger.info("remove hit error:"+error);
				callback(error, null);
			}
			else{

				collection.deleteOne({_id: condition._id}, {safe: true}, function(err, numDocs) {
					if (err) 
						callback (err);
					else {
						callback(null);
					}
				});

			}
		});
	};

	module.removeAll = function(collectionname, callback) {
		dbclient.collection(collectionname,function(error, collection){

			if (error){
				logger.info("remove hit error:"+error);
				callback(error);
			} else {
				collection.deleteMany({}, function(err, numDocs) {
					if (err) 
						callback (err);
					else {
						callback(null);
					}
				});
			}
		});

	}

	module.findBy = function(collectionname,condition, callback/* (error, docs) */) {
		dbclient.collection(collectionname,function(error, collection){
			if (error){
				logger.error("findBy hit error:"+error);
				callback(error, null);
			}
			else{
				collection.find(condition).toArray(function(err, docs) {
					if (err) callback (err, null);
					else callback(null, docs);
				});
			}
		});
	};

	module.count = function(collectionname, condition, callback/* (error, docs) */) {
		dbclient.collection(collectionname,function(error, collection){
			if (error){
				logger.info("count hit error:"+error);
				callback(error, null);
			}
			else{
				collection.count(condition, function (err, count) {
					if (err) callback (err, null);
					else callback(null, count);
				});
			}
		});
	};

	return module;

}

