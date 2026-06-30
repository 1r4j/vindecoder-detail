# Use Node.js 18 LTS official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create data directory for database
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "src/server.js"]
