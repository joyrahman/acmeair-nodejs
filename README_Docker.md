## Acmeair NodeJS on Docker 

### Assumption

1. [Docker Daemon](https://docs.docker.com/installation/) (1.11.2 or newer) is running. You need enough privilege (e.g. root) to run docker commands.

2. [Docker Compose](https://docs.docker.com/compose/) (1.11.2 or newer) is available to simplify launching a microservice model of AcmeAir. [An online document] (https://github.com/linux-on-ibm-z/docs/wiki/Building-Docker-Compose) to install docker-compose on Linux-on-z is also available.

3. Java Development Kit is available. IBM SDK, Java Technology Edition, Version 8 is recommended for Linux-on-z.

4. An IP address (192.168.1.1 in the following example) is available on the Linux system to host the AcmeAir application. Replace it with an actual address in your environment.

### Build Docker Images of AcmeAir

#### Node.js Microservice Model

The microservice model of AcmeAir consists of ten Docker containers: five Node.js microservice, four mongodb, and one nginx. Modify Dockerfiles and docker-compose.yml to use an appropriate image for a non-x86 platform. Here is a sample procedure to build those containers on Linux-on-z.

          $ git clone https://github.com/blueperf/acmeair-nodejs.git
          $ cd acmeair-nodejs
          $ sed -i 's/registry.ng.bluemix.net\/ibmnode/s390x\/ibmnode/g' Dockerfile_*
          $ sed -i 's/FROM nginx/FROM sinenomine\/nginx-s390x/' nginx/Dockerfile
          $ sed -i 's/image: mongo/image: sinenomine\/mongodb-s390x/' docker-compose.yml
          # docker-compose build

#### Node.js Monolithic Model

The monolithic model of AcmeAir consists of two Docker containers: one Node.js service and one mongodb. Modify a Dockerfile and docker-compose.yml_monolithic to use an appropriate image for a non-x86 platform. Here is a sample procedure to build those containers on Linux-on-z.

          $ git clone https://github.com/blueperf/acmeair-nodejs.git
          $ cd acmeair-nodejs
          $ sed -i 's/registry.ng.bluemix.net\/ibmnode/s390x\/ibmnode/g' Dockerfile_monolithic
          $ sed -i 's/image: mongo/image: sinenomine\/mongodb-s390x/' docker-compose.yml_monolithic
          $ mv docker-compose.yml_monolithic docker-compose.yml
          # docker-compose build

### Run AcmeAir Node.js

Here is a sample procedure to launch AcmeAir in a microservice or monlithic service model as defined in docker-compose.yml by running docker images built in a previous setp.

          # docker network create --driver bridge acmeair
          # NETWORK=acmeair docker-compose up

Some error messages like "js-bson: Failed to load c++ bson extension, using pure JS version" can be ignored safely. Access the top page of AcmeAir at
http://192.168.1.1/main/acmeair/.
If you started the monolithic model of AcmeAir, you can access the top page at http://192.168.1.1:9085/.
Note to replace the IP address to the actual one, and not to remove the final slash '/' in the URL, which is necessary to access the page.

### Load Database

#### Node.js Microservice Model

Initialize the databases by using REST APIs of the application. Here is a sample procedure to initialize four mongodb instances for the microservice model. Note to replace the IP address.

          $ curl -sS http://192.168.1.1/customer/acmeair-cs/rest/api/customer/loader/load?numCustomers=10000
          $ curl -sS http://192.168.1.1/flight/acmeair-fs/rest/api/flights/loader/load
          $ curl -sS http://192.168.1.1/auth/acmeair-as/rest/api/login/loader/load
          $ curl -sS http://192.168.1.1/booking/acmeair-bs/rest/api/bookings/loader/load

#### Node.js Monolithic Model

Here is a sample procedure to initialize the mongodb instance for the monolithic model. Note to replace the IP address.

          $ curl -sS http://192.168.1.1:9085/rest/api/loader/load?numCustomers=10000

### Build JMeter Driver

Apache JMeter is the default workload driver of AcmeAir benchmark. Here is a sample procedure to build the driver by compling the Java source code. Set JAVA_HOME to point the installation directory of Java SDK to be used.

          $ export JAVA_HOME=/opt/ibm/java-s390x-80  # Please change the path
          $ git clone https://github.com/blueperf/acmeair-driver.git
          $ curl -sSLO https://services.gradle.org/distributions/gradle-3.2.1-bin.zip
          $ unzip gradle-3.2.1-bin.zip
          $ ./gradle-3.2.1/bin/gradle --no-daemon -p acmeair-driver build

          $ curl -sSLO https://storage.googleapis.com/google-code-archive-downloads/v2/code.google.com/json-simple/json-simple-1.1.1.jar
          $ curl -sSL https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-2.13.tgz | tar xz

          $ mv json-simple-1.1.1.jar apache-jmeter-2.13/lib/ext/
          $ mv acmeair-driver/acmeair-jmeter/build/libs/acmeair-jmeter-1.1.0-SNAPSHOT.jar apache-jmeter-2.13/lib/ext/

### Run JMeter Driver

#### Node.js Microservice Model

Here is a sample command to run the workload driver. The standard output shows the benchmark progress. Replace the JHOST parameter to an actual IP address. Modify the JDURATION parameter to change the benchmark duration.

          $ ./apache-jmeter-2.13/bin/jmeter -n -DusePureIDs=true -t acmeair-driver/acmeair-jmeter/scripts/AcmeAir-microservices-v1.jmx -JUSER=9999 -JDURATION=600 -JHOST=192.168.1.1 -JTHREAD=100 -JPORT=80

#### Node.js Monolithic Model

Here is a sample command to run the workload driver for the monolithic model of AcmeAir. The standard output shows the benchmark progress. Replace the JHOST parameter to an actual IP address. Modify the JDURATION parameter to change the benchmark duration.

          $ ./apache-jmeter-2.13/bin/jmeter -n -DusePureIDs=true -t acmeair-driver/acmeair-jmeter/scripts/AcmeAir-v5.jmx -JUSER=9999 -JDURATION=600 -JHOST=192.168.1.1 -JTHREAD=100 -JPORT=9085
