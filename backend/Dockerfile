# Dockerfile for Attendance Management System Backend
FROM node:20-alpine

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose HTTP port
EXPOSE 5000

# Environment defaults
ENV PORT=5000 \
    NODE_ENV=production

# Start backend server
CMD ["node", "src/server.js"]
