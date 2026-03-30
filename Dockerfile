# Usamos una imagen oficial y ligera de Node.js
FROM node:20-alpine

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias primero (para optimizar la caché de Docker)
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos todo el código fuente de tu API
COPY . .

# Exponemos el puerto en el que correrá tu servidor (3000)
EXPOSE 3000

# Comando principal para arrancar el backend
CMD ["npm", "start"]