cd ..
REGISTRY=registry.ng.bluemix.net
NAME_SPACE=wasperf
MONGO_BRIDGE=MongoBridge1
SD_URL=https://servicediscovery.ng.bluemix.net
SD_TOKEN=1n5ivgpbo0nkhiorm3jprrjjvb912du1u125ggolqjm2h90is8rg

docker build -f acmeair-nodejs/Dockerfile_BlueMix_main -t acmeair_mainservice .
docker build -f acmeair-nodejs/Dockerfile_BlueMix_as -t acmeair_authservice .
docker build -f acmeair-nodejs/Dockerfile_BlueMix_bs -t acmeair_bookingservice .
docker build -f acmeair-nodejs/Dockerfile_BlueMix_cs -t acmeair_customerservice .
docker build -f acmeair-nodejs/Dockerfile_BlueMix_fs -t acmeair_flightservice .

docker tag -f acmeair_mainservice:latest ${REGISTRY}/${NAME_SPACE}/acmeair_mainservice:latest
docker tag -f acmeair_authservice:latest ${REGISTRY}/${NAME_SPACE}/acmeair_authservice:latest
docker tag -f acmeair_bookingservice:latest ${REGISTRY}/${NAME_SPACE}/acmeair_bookingservice:latest
docker tag -f acmeair_customerservice:latest ${REGISTRY}/${NAME_SPACE}/acmeair_customerservice:latest
docker tag -f acmeair_flightservice:latest ${REGISTRY}/${NAME_SPACE}/acmeair_flightservice:latest

docker push ${REGISTRY}/${NAME_SPACE}/acmeair_mainservice
docker push ${REGISTRY}/${NAME_SPACE}/acmeair_authservice
docker push ${REGISTRY}/${NAME_SPACE}/acmeair_bookingservice
docker push ${REGISTRY}/${NAME_SPACE}/acmeair_customerservice
docker push ${REGISTRY}/${NAME_SPACE}/acmeair_flightservice

cf ic run -e SERVICE_NAME=main -e SD_URL=${SD_URL} -e SD_TOKEN=${SD_TOKEN} --name main_1 ${REGISTRY}/${NAME_SPACE}/acmeair_mainservice
cf ic run -e CCS_BIND_APP=${MONGO_BRIDGE} -e SERVICE_NAME=auth     -e SD_URL=${SD_URL} -e SD_TOKEN=${SD_TOKEN} --name auth_1     ${REGISTRY}/${NAME_SPACE}/acmeair_authservice
cf ic run -e CCS_BIND_APP=${MONGO_BRIDGE} -e SERVICE_NAME=booking  -e SD_URL=${SD_URL} -e SD_TOKEN=${SD_TOKEN} --name booking_1  ${REGISTRY}/${NAME_SPACE}/acmeair_bookingservice
cf ic run -e CCS_BIND_APP=${MONGO_BRIDGE} -e SERVICE_NAME=customer -e SD_URL=${SD_URL} -e SD_TOKEN=${SD_TOKEN} --name customer_1 ${REGISTRY}/${NAME_SPACE}/acmeair_customerservice
cf ic run -e CCS_BIND_APP=${MONGO_BRIDGE} -e SERVICE_NAME=flight   -e SD_URL=${SD_URL} -e SD_TOKEN=${SD_TOKEN} --name flight_1   ${REGISTRY}/${NAME_SPACE}/acmeair_flightservice


