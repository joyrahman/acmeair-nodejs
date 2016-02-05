## Acmeair NodeJS on Docker 


Assume you have [installed Docker and stared Docker daemon](https://docs.docker.com/installation/)
	
		
#### Run Acmeair in Micro-Service Mode with Docker

	1. Update ip to docker machine ip in these files.
		
		a. Dockerfile_* (5 files)
			Change 192.168.99.100 to your docker machine ip (in 3 places)
		
		b. nginx/sites_enabled/nodejs_project	
			Change 192.168.99.100 to your docker machine ip (in 5 places)
	
	2. Build/Start Containers
		a. docker-compose build
		b. docker-compose up
	
	3. Go to http://docker_machine_ip/acmeair
	




	