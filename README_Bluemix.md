## Acmeair NodeJS on Bluemix 

Assume you have access to [Bluemix](https://console.ng.bluemix.net). 

	cf api api.ng.bluemix.net
	
	cf login

### Preparation
Edit [Bluemix_CF.sh](Bluemix_CF.sh) to change application name.  "acmeair-node" is the application name and will be used for the hostname of the application. Add an identifiers to it to make it unique. (e.g. You could use the initials of your name.)
		

#### Create Mongo DB service
	   
Option 1 : Go to Bluemix Catalog, then create a "Compose for MongoDB" service provided by IBM

Option 2 : [Setup Compose Mongo DB & create acmeair database](https://www.compose.io/mongodb/)

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

#### Create application
	Run previously modified shell script
	./Bluemix_CF.sh

#### Bind service to application
	
	cf bind-service acmeair-node mongoCompose
	
#### Start application and Access application URL
	
	cf start acmeair-node
	
	http://acmeair-node.mybluemix.net