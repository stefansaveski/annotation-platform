# Use official Node.js image as the base
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the Next.js app (standalone output for optimal deployment)
RUN npx next build

# Production image, copy only necessary files
FROM node:20-alpine AS runner
WORKDIR /app

# Copy built app from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Install only production dependencies
RUN npm install --omit=dev --frozen-lockfile

# Keep TypeScript available at runtime so Next can load next.config.ts without attempting a write/install.
RUN npm install --no-save --save-exact typescript

# Use non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["npx", "next", "start"]
