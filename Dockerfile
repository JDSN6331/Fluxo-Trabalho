FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NITRO_PRESET=node-server
RUN npm run build

FROM node:22-alpine AS email-worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY scripts ./scripts
CMD ["npm", "run", "email:worker"]

# Keep the web application as the final stage so platforms that do not expose
# Docker's --target option deploy the HTTP service by default.
FROM node:22-alpine AS app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
