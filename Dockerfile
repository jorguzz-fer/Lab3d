# Site estático da aula (web/) + modelos GLB, servido por nginx.
# Coolify: Build Pack = Dockerfile, porta exposta = 80.
ARG NGINX_IMAGE=nginx:1.27-alpine
FROM ${NGINX_IMAGE}

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/ /usr/share/nginx/html/
# Os GLB são servidos direto. A página só cai para o base64 (.txt) quando o servidor não serve .glb.
COPY models/*.glb /usr/share/nginx/html/models/
RUN rm -f /usr/share/nginx/html/models/*.txt

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
