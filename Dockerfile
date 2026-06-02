FROM node:18-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the default port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV production
ENV PORT 3000

# Start the application
CMD ["npm", "run", "start"]
