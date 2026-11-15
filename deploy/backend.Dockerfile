FROM node:22-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/ ./
RUN mkdir -p uploads/products && chown -R node:node uploads

ENV NODE_ENV=production
ENV PORT=3002
EXPOSE 3002

USER node
CMD ["node", "index.js"]
