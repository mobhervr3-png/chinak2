FROM node:20-slim

# BUILD TRIGGER: 2026-02-27-RENDER-DEPLOY
WORKDIR /app

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy backend package files and prisma schema
COPY server/package*.json ./
COPY server/prisma ./prisma

# Install production dependencies
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

# Install production dependencies during build phase
RUN npm install --omit=dev --no-audit --no-fund --ignore-scripts --legacy-peer-deps

# Copy backend source files
COPY server/ .

# Generate Prisma client during build phase
RUN npx prisma generate

# Standard production environment
ENV NODE_ENV=production
# Render will automatically provide PORT, but we default to 10000
ENV PORT=10000
EXPOSE 10000

# Start the server
CMD ["node", "index.js"]
