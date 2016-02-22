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

module.exports = function() {
	var module = {};
	var uuid = require('node-uuid');
	
	module.chat = function(ws) {
		var supportAgent = "Support";
		supportAgent = getRandomSupportAgent();
		ws.send(greeting(supportAgent));
		ws.on('open', function open() {
			console.log("Open Called");
			ws.send(greeting(supportAgent));
		});
		ws.on('message', function (message){
			ws.send(supportResponse(supportAgent));
		});
	}
	
	/**
	 * min - inclusive
	 * max - exclusive
	 */
	function getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min)) + min;
	}
	
	function getRandomSupportAgent() {
		var supportStaffNames = ["Bob", "Bill", "Beth", "Don", "Jim", "Kate", 
		                         "Matt", "Mike","Nick","Rick","Steve","Tina","Tom"];
		return supportStaffNames[getRandomInt(0,supportStaffNames.length)];
	}
	
	function greeting(agentName) {
		return JSON.stringify({"agent" : agentName,
			"message" : "Welcome to AcmeAir Support. My name is " + 
			  agentName + ". How can I help you?"});
	}
	
	function supportResponse(agentName) {
		return JSON.stringify({"agent" : agentName,
			"message" : "One moment please..."});
	}
	
	return module;
}