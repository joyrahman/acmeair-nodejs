FROM registry.ng.bluemix.net/ibmnode

RUN mkdir /src

WORKDIR /src
COPY ./ /src
RUN npm install

EXPOSE 80
ENV VCAP_APP_PORT=80
ENV MONGO_HOST=db

CMD ["node", "app.js"]