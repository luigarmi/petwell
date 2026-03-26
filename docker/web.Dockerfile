FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

CMD ["npm", "run", "dev:web", "--", "--host", "0.0.0.0", "--port", "3000"]
