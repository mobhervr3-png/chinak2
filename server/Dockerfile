FROM ghcr.io/puppeteer/puppeteer:latest

# Use root to install dependencies
USER root

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies to keep it light
# We set SKIP_CHROMIUM_DOWNLOAD because the base image ALREADY has Chrome installed at a known location
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Ensure pptruser owns everything
RUN chown -R pptruser:pptruser /app

# Switch back to pptruser (provided by base image)
USER pptruser

# Expose port
EXPOSE 10000

# Start
CMD ["npm", "start"]