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
	var log4js = require('log4js');
	var jwt = require('jsonwebtoken');
	var debug = require('debug')('auth');

	var secretKey = "secret";
	log4js.configure('log4js.json', {});
	var logger = log4js.getLogger('authservice');
	logger.setLevel(settings.loggerLevel);

	module.dbNames = dataaccess.dbNames

	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback);
	}

	module.login = function(req, res) {

		var login = req.body.login;
		var password = req.body.password;

		res.cookie('sessionid', '');
		// invalidate current session here??

		validateCustomer(login, password, function(err, customerValid) {
			if (err) {
				res.status(500).send(err); // TODO: do I really need this or is there a cleaner way??
				return;
			}

			if (customerValid == "false") {
				res.sendStatus(403);
			}
			else {
				res.cookie('sessionid', jwt.sign({ customerToken : login }, secretKey, { expiresIn: '10m', algorithm: 'HS512' }));
				res.send('logged in');
			}
		});
	};

	module.logout = function (req, res){
		logger.debug("logging out " + req.cookies.sessionid);
		debug('just remove jwt cookie');
		res.cookie('sessionid', '');
		res.send('logged out');
	}

	validateCustomer = function(login, password, callback) {

		dataaccess.findOne(module.dbNames.customerName, login, function(error, customer){
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

	}

	module.checkForValidToken = function(req, res, next) {
		debug('checkForValidCookie');
		debug('requests', req);
		var token = req.cookies.sessionid;
		if (token) {
			token = token.trim();
		}
		if (!token || token == '') {
			debug('checkForValidCookie - no jwttoken so returning 403');
			res.sendStatus(403);
			return;
		}

		jwt.verify(token, secretKey, function(err, decoded) {
			if (err) {
				debug('token error',err);
				res.status(401);
				res.send(err);
			}else if (decoded.customerToken == req.cookies.loggedinuser){
				debug('token correct');
				req.acmeair_login_user = req.cookies.loggedinuser;
				next();
				return;
			}else if (decoded.customerToken == req.body.userid){
				debug('token correct');
				req.acmeair_login_user = req.body.userid;
				next();
				return;
			}else if (decoded.customerToken == req.params.user){
				debug('token correct');
				req.acmeair_login_user = req.body.userid;
				next();
				return;
			}else{
				debug('token unknown', decoded.customerToken);
				res.sendStatus(403);
				return;
			}
		});
	}

	return module;
}