FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY index.js ./

# Set default environment variables
ENV NODE_OPTIONS="--max-old-space-size=4096" \
    GH_BASE_URL="https://github.yourdomain.com/api/v3" \
    TARGET_BRANCH="develop" \
    PACKAGE_NAME="babydol" \
    OUTPUT_FILE="babydol-versions.json"

# Create a volume for output results
VOLUME ["/app/output"]

# Set default command
CMD ["node", "index.js"]