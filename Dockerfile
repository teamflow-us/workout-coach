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

# Start server (schema is managed externally via setup.sql)
CMD ["npm", "start"]
