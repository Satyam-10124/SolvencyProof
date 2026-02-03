FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy backend package
COPY backend/package.json ./backend/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy backend source code
COPY backend ./backend

# Create data directories
RUN mkdir -p data/yellow_sessions data/output

# Copy data files if they exist
COPY data ./data

# Set working directory to backend
WORKDIR /app/backend

# Expose port (Railway will override with its own PORT)
EXPOSE 3001

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check using 0.0.0.0 and PORT variable with longer start period
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://0.0.0.0:${PORT}/health || exit 1

# Start the backend
CMD ["pnpm", "start"]
