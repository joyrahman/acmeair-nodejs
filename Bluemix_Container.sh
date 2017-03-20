cd ..
REGISTRY=registry.ng.bluemix.net
NAME_SPACE=
MONGO_BRIDGE=


docker build -f ./acmeair-nodejs/Dockerfile -t ${REGISTRY}/${NAME_SPACE}/acmeair_node .

docker push ${REGISTRY}/${NAME_SPACE}/acmeair_node

cf ic run -p 80 -e CCS_BIND_APP=${MONGO_BRIDGE} --name acmeair_node ${REGISTRY}/${NAME_SPACE}/acmeair_node