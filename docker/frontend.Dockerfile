FROM nginx:alpine

# Copy frontend files
COPY frontend/public/ /usr/share/nginx/html/

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]