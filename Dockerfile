# Stage 1: Build the React application
FROM node:18-alpine as builder

WORKDIR /app

# Install dependencies first (better cache utilization)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy custom Nginx configuration
COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf

# Remove default Nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy built artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 (This is the port you tell your backend colleague)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
