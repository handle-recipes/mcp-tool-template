# Use Node.js 20 LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port (if needed)
EXPOSE 3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S recipes -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R recipes:nodejs /app
USER recipes

# Start the application
CMD ["npm", "start"]