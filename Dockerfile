FROM node:18-alpine
LABEL org.opencontainers.image.source="https://github.com/JonhSHEPARD/ics-proxy"

WORKDIR /app

COPY package.json package-lock.json .
RUN npm install

COPY . .

ENV PORT 80
EXPOSE 80

CMD ["npm", "start"]
