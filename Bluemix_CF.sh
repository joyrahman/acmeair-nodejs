appName=acme-node
mongoService=mongoCompose
cf push ${appName} --no-start -m 256M
cf bind-service ${appName} ${mongoService}
cf start ${appName}