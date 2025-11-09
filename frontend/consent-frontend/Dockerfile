# Build stage
FROM node:20.19.0-alpine AS build
WORKDIR /usr/src/app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# Serve built assets with Vite preview (you can swap to nginx later)
FROM node:20.19.0-alpine AS run
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist ./dist
EXPOSE 5173
CMD ["npx","vite","preview","--host","0.0.0.0","--port","5173"]