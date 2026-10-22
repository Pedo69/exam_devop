FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8000 DATA_DIR=/data
# no dependencies — Node built-ins only
COPY package.json server.js ./
# /data owned by the runtime user so a fresh named volume is writable
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8000
CMD ["node", "server.js"]
