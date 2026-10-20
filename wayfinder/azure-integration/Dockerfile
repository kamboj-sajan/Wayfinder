# Wayfinder backend API
# Build: docker build -t wayfinder-api .
# Run:   docker run -p 5050:5050 --env-file .env wayfinder-api

FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
ENV PORT=5050
EXPOSE 5050
USER node
CMD ["node", "dist/server.js"]
