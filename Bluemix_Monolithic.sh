cd ..
REGISTRY=registry.ng.bluemix.net
NAME_SPACE=strong
MONGO_BRIDGE=MongoBridge

docker build -f ./acmeair-nodejs/Dockerfile_BlueMix_monolithic -t ${REGISTRY}/${NAME_SPACE}/acmeair_node_monolithic .

docker push ${REGISTRY}/${NAME_SPACE}/acmeair_node_monolithic

cf ic run -e SUPPORT_SERVICE=true -e CCS_BIND_APP=${MONGO_BRIDGE} --name monolithic_1 ${REGISTRY}/${NAME_SPACE}/acmeair_node_monolithic
