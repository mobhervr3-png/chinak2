FROM node:20

# Build trigger: 2026-02-26-v4-FULL-REBUILD
WORKDIR /app

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

# Hugging Face Spaces environment
ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860

# Start the server (fast startup)
CMD ["node", "index.js"]
