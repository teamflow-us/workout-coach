FROM node:20-alpine

RUN apk add --no-cache wget

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build client
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run schema push then start server
CMD npx drizzle-kit push --force && npm start
