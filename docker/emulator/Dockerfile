FROM node:20-alpine

RUN apk add --no-cache openjdk21-jre-headless bash curl
RUN npm install -g firebase-tools

WORKDIR /app

COPY firebase.json firestore.rules firestore.indexes.json ./

EXPOSE 8085 9099 4000

CMD ["firebase", "emulators:start", "--project", "dailycheckin-local"]
