FROM node:20-alpine AS base

# Install libvips dependencies for Sharp high-performance image processing
RUN apk add --no-cache vips-dev build-base python3

WORKDIR /app

COPY services/image-worker/package.json ./
RUN npm install

COPY services/image-worker ./
RUN npm run build

CMD ["npm", "start"]
