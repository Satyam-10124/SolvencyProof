FROM node:20-alpine

WORKDIR /app

# Copy package.json only
COPY package.json ./

# Install dependencies with npm (avoids pnpm workspace detection)
RUN npm install

# Copy source code
COPY src ./src
COPY index.ts ./

# Create data directories
RUN mkdir -p data/yellow_sessions data/output

# Expose API port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the API server
CMD ["node", "--import", "tsx", "src/api/server.ts"]
