# Deploy no Coolify: lab.tudomudou.com.br

O site é estático: `web/` mais os GLB de `models/`, servidos por nginx num container. Não precisa de banco, variáveis de ambiente nem build de Node.

## 1. DNS

No painel do domínio `tudomudou.com.br`, crie o registro abaixo. Se já existir um curinga `*.tudomudou.com.br` apontando para o servidor, pule esta etapa.

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| A | `lab` | IP do servidor do Coolify | 300 |

Se usar Cloudflare, deixe o proxy **desligado** (nuvem cinza) até o Coolify emitir o certificado. Depois pode ligar com SSL "Full (strict)".

## 2. Recurso no Coolify

1. Abra **Projects**, entre no projeto (ou crie um, por exemplo `Lab3D`) e clique em **+ New** › **Application**.
2. Escolha a fonte do código:
   - **Private Repository (with GitHub App)**, se o app do Coolify já tem acesso a `jorguzz-fer/Lab3d`;
   - **Public Repository**, se o repositório for público.
3. Preencha:

| Campo | Valor |
|---|---|
| Repository | `jorguzz-fer/Lab3d` |
| Branch | `main` (ou `claude/relaxed-bell-xvwgd4` enquanto não houver merge) |
| Build Pack | **Dockerfile** |
| Base Directory | `/` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `80` |
| Domains | `https://lab.tudomudou.com.br` |

4. Clique em **Deploy**. O Coolify gera o certificado HTTPS (Let's Encrypt) sozinho quando o DNS já aponta para o servidor.

**Health check:** o container responde `ok` em `/healthz`, e o Dockerfile já declara um `HEALTHCHECK`. Se quiser, configure no Coolify o path `/healthz`, porta `80`.

**Deploy automático:** com o GitHub App, ative **Automatic Deployment** em *Advanced*. Cada push no branch configurado publica uma versão nova.

## 3. Conferir

```bash
curl -s https://lab.tudomudou.com.br/healthz
```

```bash
curl -sI https://lab.tudomudou.com.br/models/pele_fina_ia_a.glb
```

O primeiro comando deve responder `ok`. No segundo, espere `200`, `content-type: model/gltf-binary` e `cache-control: public, max-age=604800`.

## O que o container faz

- `Dockerfile`: imagem `nginx:1.27-alpine`, copia `web/` e `models/*.glb`.
- `deploy/nginx.conf`:
  - serve `.glb` como `model/gltf-binary`;
  - aplica gzip (o GLB procedural cai de 4,4 MB para 2,4 MB na transferência);
  - cache de 7 dias para modelos e imagens;
  - HTML sempre revalidado.
- A página carrega `models/*.glb` direto. A cópia em base64 (`.txt`) só é usada no artifact do Claude, que não serve `.glb`.

## Atualizar os modelos

```bash
npm install
```

```bash
npm run build:pele
```

Faça commit de `models/pele_fina_procedural.glb` e dê push. O Coolify publica de novo. Para trocar ou adicionar um modelo de IA, comprima as texturas antes:

```bash
python3 tools/compress_glb.py original.glb models/novo.glb --max 2048
```

## Testar o container localmente

```bash
docker build -t lab3d .
```

```bash
docker run --rm -p 8080:80 lab3d
```

Depois abra http://localhost:8080. Se o Docker Hub limitar o download da imagem base, use um espelho:

```bash
docker build --build-arg NGINX_IMAGE=mirror.gcr.io/library/nginx:1.27-alpine -t lab3d .
```
