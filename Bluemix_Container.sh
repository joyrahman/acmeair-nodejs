cd ..
REGISTRY=registry.ng.bluemix.net
NAME_SPACE=
MONGO_BRIDGE=

if ! [[ $1 == group ]]
then
echo 'To use Container Group, run the command with argument "group". e.g. "./Bluemix_Container.sh group"'
fi

docker build -f ./acmeair-nodejs/Dockerfile -t ${REGISTRY}/${NAME_SPACE}/acmeair_node .

docker push ${REGISTRY}/${NAME_SPACE}/acmeair_node

if ! [[ $1 == group ]]
then
cf ic run -p 80 -m 64 -e CCS_BIND_APP=${MONGO_BRIDGE} --name acmeair_node ${REGISTRY}/${NAME_SPACE}/acmeair_node
else
cf ic group create -p 80 -m 64 --min 1 --desired 1 --auto -e CCS_BIND_APP=${MONGO_BRIDGE} --name acmeair_node_group -n acmeairnode -d mybluemix.net ${REGISTRY}/${NAME_SPACE}/acmeair_node
fi
