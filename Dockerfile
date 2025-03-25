FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy application code and environment files
COPY index.js .env ./
# .env.local will be mounted at runtime or provided via environment variables

# Set default environment variables (can be overridden at runtime)
ENV NODE_OPTIONS="--max-old-space-size=4096" \
    GH_BASE_URL="https://github.yourdomain.com/api/v3" \
    TARGET_BRANCH="develop" \
    PACKAGE_NAME="babydol" \
    OUTPUT_FILE="/app/output/babydol-versions.json" \
    SCAN_PACKAGE_FILES="package.json,frontend/package.json,client/package.json,ui/package.json"

# Create a volume for output results
VOLUME ["/app/output"]

# Create the output directory
RUN mkdir -p /app/output && chmod 777 /app/output

# Set default command
CMD ["node", "index.js"]