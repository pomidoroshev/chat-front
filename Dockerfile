FROM node

RUN mkdir /app

ADD package.json /app

WORKDIR /app

RUN npm install

ADD . /app

RUN npm run build

RUN mkdir /usr/share/nginx

RUN mv /app/build /usr/share/nginx/html

VOLUME /usr/share/nginx/html

