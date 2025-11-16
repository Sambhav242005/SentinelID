# Use Node.js 18+ image
FROM node:latest

# Accept the build-time API base URL
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Log the env baked into the build (debug)
RUN echo "NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}"

# Build the application with correct env baked in
RUN npm run build

# Expose port for Next.js
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
