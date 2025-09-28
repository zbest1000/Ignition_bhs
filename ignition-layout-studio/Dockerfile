# Multi-stage Dockerfile for Ignition Layout Studio

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies with cache mount for faster builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Copy frontend source
COPY frontend/ ./

# Build frontend with optimizations
RUN npm run build

# Stage 2: Backend dependencies
FROM node:18-alpine AS backend-deps

WORKDIR /app/backend

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production && \
    npm cache clean --force

# Stage 3: Production image
FROM node:18-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Install only runtime dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg \
    dumb-init

# Copy backend dependencies from previous stage
COPY --from=backend-deps /app/backend/node_modules /app/backend/node_modules

# Copy backend source
COPY --chown=appuser:appgroup backend/ /app/backend/

# Copy built frontend from previous stage
COPY --from=frontend-builder --chown=appuser:appgroup /app/frontend/build /app/frontend/build

# Create necessary directories with proper permissions
RUN mkdir -p /app/backend/uploads \
    && mkdir -p /app/backend/exports \
    && mkdir -p /app/backend/projects \
    && mkdir -p /app/backend/logs \
    && chown -R appuser:appgroup /app

# Set working directory
WORKDIR /app/backend

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV FRONTEND_BUILD_PATH=/app/frontend/build
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Health check with improved reliability
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "src/server.js"]