FROM node:0.10.38

RUN mkdir /src

WORKDIR /src
ADD package.json /src/package.json
RUN npm install

EXPOSE 9080 9081 9082 9083 9084

ENV CUSTOMER_SERVICE=192.168.99.100/acmeair
ENV AUTH_SERVICE=192.168.99.100/acmeair

CMD ./startall.sh
