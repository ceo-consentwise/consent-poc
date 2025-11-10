# frontend/consent-frontend/Dockerfile

# Build stage
FROM node:20 AS build
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build   # outputs to /app/dist

# Run stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: remove default nginx port message
RUN rm /etc/nginx/conf.d/default.conf

# Add simple config to serve SPA routing
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
