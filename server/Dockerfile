# Use the official Puppeteer Docker image which includes Chrome and all dependencies
FROM ghcr.io/puppeteer/puppeteer:24.3.1

# Switch to root to install project dependencies (optional but often needed for other apt-get packages)
USER root

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json .puppeteerrc.cjs ./

# Install dependencies
# Note: We use --no-cache to keep the image small
# We do NOT set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true so Puppeteer installs its own Chrome for Testing
# This ensures version compatibility
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome-stable" \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Install project dependencies
RUN npm ci

# Ensure the executable path is correct and accessible (debugging step)
RUN ls -la /usr/bin/google-chrome-stable || echo "Chrome not found at /usr/bin/google-chrome-stable"

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Change ownership of the app directory (including the .cache created by npm install)
RUN mkdir -p /app/.cache/puppeteer && \
    chown -R pptruser:pptruser /app

# Switch to the non-root user provided by the base image
USER pptruser

# Expose the port
EXPOSE 10000

# Start the application
CMD ["npm", "start"]