## Acmeair NodeJS on Docker 

Prereq:

[Install Docker and stared Docker daemon](https://docs.docker.com/installation/)

[Install Cloud Foundry & ](http://docs.cloudfoundry.org/cf-cli/)

[Setup Compose Mongo DB & create acmeair database](https://www.compose.io/mongodb/)

* Retrieve & save these information from Compose Mongo DB

	hostname,"port", "db", "username", "password”

	Create a string:
	
	"url": "mongodb://username:password@hostname:port/db"
	e.g. mongodb://acmeuser:password@myServer.dblayer.com:27017/acmeair

* On cf cli, run following commands to create Compose Mongo DB service on Bluemix:

	Use CF command to create DB:
	
	cf cups mongoCompose -p "url"
	
	At the URL prompt, enter above URL that was created:
	
	url>mongodb://acmeuser:password@myServer.dblayer.com:27017/acmeair

* Mongo DB CF Bridge App:

	On Bluemix UI, go to dashboard
	
	Under “Cloud Foundry App”, click CREATE APP > WEB > SDK for Node.js > Continue > Enter “MongoBridge” as an app name > FINISH
	
	Click “Overview” from left navigator for “MongoBridge” app > Click “Bind a Service” > Select “mongoCompose” that you have created > ADD
	
Note: memory quota can be 64 MB

[Setup Service Discovery](https://console.ng.bluemix.net/docs/services/ServiceDiscovery/index.html)

[Setup Service Proxy](https://console.ng.bluemix.net/docs/services/ServiceProxy/index.html) 

* From Service Discovery Bluemix UI, get the following information:

	Go to Service Discovery > From the left navigation, go to Service Credentials > Get auth_token and url 

* For the ServiceProxyTenant, assign public IP address with the following:

	cf ic ip request

	cf ic ip bind <public IP address> ServiceProxyTenant

From the Bluemix UI, go to ServiceProxyTenant container, then record public IP address and port number

	e.g. Public IP : 134.168.16.136, port number :6379

### Create each services in IBM Container service

#### On local docker server:

	Go to the root directory of acmeair-nodejs

* Create the images with the following command:

	docker build -f <Dockerfile names> -t <image name> .

	e.g. docker build -f acmeair-nodejs/Dockerfile_as -t auth .

	Create image for all services:

	auth : acmeair-nodejs/Dockerfile_as
	
	customer : acmeair-nodejs/Dockerfile_cs

	flight : acmeair-nodejs/Dockerfile_fs 

	booking : acmeair-nodejs/Dockerfile_bs

* Tag the image with Bluemix Registry name with the following command:

	docker tag <image name>:latest registry.<bluemi region>.bluemix.net/strong/<image name>:latest

	e.g. docker tag auth:latest registry.ng.bluemix.net/strong/auth:latest

* Push the image to Bluemix with the following command:

	docker push registry.<bluemi region>.bluemix.net/strong/<image name>:latest

	e.g. docker push registry.ng.bluemix.net/strong/auth:latest

* Deploy the Container Image with following command (use Service Discovery - SD - auth_token and URL retrieved from prerequisite):

	cf ic run -e CCS_BIND_APP=<Mongo Bridge App Name> -e SERVICE_NAME=<service name> -e SD_URL=<SD URL> -e SD_TOKEN=<auth_token> --name <container name> <image name>

	e.g. cf ic run -e CCS_BIND_APP=MongoBridge -e SERVICE_NAME=auth -e SD_URL=https://servicediscovery.ng.bluemix.net -e SD_TOKEN=1m3rliolucbampleoq36am82bdfv0othuruoefe6enop27ab7cnp --name auth_1 registry.ng.bluemix.net/strong/auth

NOTE: These service name MUST be used (hardcoded in the app to recognize each unique services):

	Authentication Service : auth

	Customer Service : customer

	Flight Service : flight

	Booking Service : booking

* Useful command for debugging : The following command can be used to logon container shell:

	cf ic exec -it <container name> bash

	e.g. cf ic exec -it auth_2 bash

Wait for couple minutes AFTER all services are running (There is 1 minute sleep time in the app to wait for all initialization including networking)

	Access each REST API using Service Proxy URL (ServiceProxyTenant IP address and port number)

	e.g. Using FireFox Poster to POST

	URL : http://134.168.16.136:6379/auth/acmeair-as/rest/api/login

	Content Type : application/json

	Body : 

	{
	"login": "uid11@email.com",
	"password": "password"
	}

Sample URL:

Authentication Service GET : http://134.168.16.136:6379/auth/acmeair-as/rest/api/login/logout

Customer Service GET : http://134.168.16.136:6379/customer/acmeair-cs/rest/api/customer/config/countCustomers

Flight Service GET : http://134.168.16.136:6379/flight/acmeair-fs/rest/api/flights/config/countFlights

Booking Service GET : http://134.168.16.136:6379/booking/acmeair-bs/rest/api/bookings/config/countBookings

#### Check if Services are registered

* Go to Service Discovery to see all services are discovered

* Go to Service Proxy to see all services are registered

Debugging:

	Go to each container services log to see if there is heartbeat recorded and StatusCode is 200:

	e.g. {"log":"HEARTBEAT RESPONSE : {\"statusCode\":200,\.....}
