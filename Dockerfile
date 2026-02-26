FROM node:20

WORKDIR /app

# Copy backend package files and prisma schema
COPY server/package*.json ./
COPY server/prisma ./prisma

# Install production dependencies
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
ENV npm_config_optional=false
ENV npm_config_legacy_peer_deps=true
ENV npm_config_registry=https://registry.npmjs.org/
ENV npm_config_maxsockets=5
ENV npm_config_network_concurrency=5
ENV npm_config_progress=false
ENV npm_config_fetch_retries=5
ENV npm_config_fetch_retry_factor=2
ENV npm_config_fetch_retry_mintimeout=20000
ENV npm_config_fetch_retry_maxtimeout=120000
ENV npm_config_timeout=600000
ENV npm_config_loglevel=verbose
ENV npm_config_cache=/data/.npm

# Install production dependencies during build phase
RUN npm install --omit=dev --omit=optional --no-audit --no-fund --ignore-scripts --legacy-peer-deps --verbose

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
