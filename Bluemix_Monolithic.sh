cd ..
REGISTRY=registry.ng.bluemix.net
NAME_SPACE=
MONGO_BRIDGE=

if ! [[ $1 == cloudant ]]
then
echo 'To use Cloudant DB, run the command with argument "cloudant". e.g. "./Bluemix_Monolithic.sh cloudant"'
fi

docker build -f ./acmeair-nodejs/Dockerfile_BlueMix_monolithic -t ${REGISTRY}/${NAME_SPACE}/acmeair_node_monolithic .

docker push ${REGISTRY}/${NAME_SPACE}/acmeair_node_monolithic

if [[ $1 == cloudant ]]
then
cf ic run -p 80 -e dbtype=cloudant -e CCS_BIND_APP=${MONGO_BRIDGE} --name monolithic_1 ${REGISTRY}/${NAME_SPACE}/acmeair_node_monolithic
else
cf ic run -p 80 -e CCS_BIND_APP=${MONGO_BRIDGE} --name monolithic_1 ${REGISTRY}/${NAME_SPACE}/acmeair_node_monolithic
fi