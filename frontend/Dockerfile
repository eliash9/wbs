# Gunakan image Node.js untuk membangun aplikasi
FROM node:18-alpine AS builder

# Atur working directory
WORKDIR /app

# Salin file konfigurasi
COPY package*.json ./

# Install dependensi
RUN npm install

# Salin seluruh kode ke container
COPY . .

# Build aplikasi frontend
RUN npm run build

# Gunakan image nginx untuk serving file statis
FROM nginx:alpine

# Salin hasil build dari tahap builder ke folder default nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Ekspose port yang digunakan nginx
EXPOSE 80

# Jalankan nginx
CMD ["nginx", "-g", "daemon off;"]
