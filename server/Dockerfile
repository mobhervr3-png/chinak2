# Use the official Puppeteer Docker image which includes Chrome and all dependencies
FROM ghcr.io/puppeteer/puppeteer:24.3.1

# Switch to root to install project dependencies (optional but often needed for other apt-get packages)
USER root

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Note: We use --no-cache to keep the image small, and skip puppeteer's chrome download since the base image has it
# The official image installs Google Chrome Stable at /usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install project dependencies
RUN npm ci

# Ensure the executable path is correct and accessible (debugging step)
RUN ls -la /usr/bin/google-chrome-stable || echo "Chrome not found at /usr/bin/google-chrome-stable"

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 10000

# Start the application
CMD ["npm", "start"]