FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start the development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
