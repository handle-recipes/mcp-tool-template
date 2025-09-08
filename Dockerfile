# Use Node.js 20 Alpine image for smaller size and better security
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
  adduser -S recipes -u 1001 -G nodejs

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci && \
  npm cache clean --force

# Copy TypeScript configuration
COPY tsconfig.json ./

# Copy source code
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Remove development dependencies and source files to reduce image size
RUN npm prune --production && \
  rm -rf src/ tsconfig.json

# Change ownership of the app directory to the nodejs user
RUN chown -R recipes:nodejs /app

# Switch to non-root user
USER recipes

# Expose the port that the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
