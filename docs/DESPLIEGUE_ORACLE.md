# Manual de despliegue · Plataforma de exámenes (Oracle Cloud)

Guía corta, de la cuenta nueva a la web publicada con HTTPS. Sigue `Req.md` §4.1. Tiempo estimado: 2 a 3 horas, más la espera de activación de la cuenta.

**Resultado:** `https://<tu-nombre>.duckdns.org` → Nginx (HTTPS) → Node en `127.0.0.1:3000` → PostgreSQL, con reinicio automático y respaldo diario.

En los comandos, cambia lo que está entre `< >`.

---

## 1. Crear la cuenta de Oracle Cloud

1. Entra a <https://signup.cloud.oracle.com> y regístrate con tu correo. País: **México**.
2. Elige la **región de origen** con cuidado, **no se puede cambiar después**. Recomendada: **Mexico Central (Querétaro)**, o **Mexico Northeast (Monterrey)**.
3. Verifica tu teléfono y registra una **tarjeta de débito o crédito**. Solo sirve para comprobar identidad: puede aparecer un cargo temporal que se reembolsa. La cuenta queda en **Free Tier**: mientras no la cambies a "Pay As You Go", no se cobra nada.
4. Espera el correo de "cuenta lista". Puede tardar de minutos a horas. Después entra a <https://cloud.oracle.com>.

> La asignación gratuita (*Always Free*) cambió en 2026. Antes de crear la máquina, revisa en la documentación oficial cuántos OCPU y cuánta memoria incluye hoy.

## 2. Crear la máquina virtual

1. Menú ☰ → **Compute → Instances → Create instance**.
2. **Image:** *Canonical Ubuntu 24.04*.
3. **Shape:** *Ampere → VM.Standard.A1.Flex* (ARM64). Asigna los OCPU y la memoria **dentro de la asignación gratuita vigente**.
4. **Networking:** *Create new virtual cloud network* con *public subnet* y **Assign a public IPv4 address**.
5. **SSH keys:** *Generate a key pair for me*. **Descarga la llave privada** (`.key`) y guárdala en un lugar seguro, porque sin ella no podrás entrar.
6. **Create**. Si aparece *Out of capacity*, prueba otro *Availability domain* o vuelve a intentar más tarde.
7. Anota la **Public IP address** de la instancia.

## 3. Abrir los puertos 80 y 443

Hay que abrirlos en dos lugares.

**a) En Oracle (lista de seguridad).** Ve a la instancia → *Subnet* → *Security Lists* → *Default Security List* → **Add Ingress Rules**. Agrega dos reglas:

| Source CIDR | IP Protocol | Destination port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

**b) En Ubuntu.** Entra por SSH desde PowerShell en tu PC:

```powershell
# Si dice "permissions too open", primero:  icacls <llave>.key /inheritance:r /grant:r "$($env:USERNAME):R"
ssh -i <ruta\llave>.key ubuntu@<IP_PUBLICA>
```

Ya dentro del servidor, abre los puertos:

```bash
# Las imágenes de Oracle traen reglas iptables propias; no actives ufw (puede dejarte fuera del SSH).
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

El puerto 3000 **no** se abre: Node solo se usa a través de Nginx.

## 4. Instalar Node.js, PostgreSQL y Nginx

```bash
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone America/Mexico_City
sudo apt install -y nginx postgresql build-essential
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -   # Node 24 LTS (el proyecto pide >= 24.2)
sudo apt install -y nodejs
node -v && psql --version
```

## 5. Base de datos

```bash
CLAVE_BD=$(openssl rand -hex 24); echo "$CLAVE_BD"    # anótala: va en el .env
sudo -u postgres psql -c "CREATE ROLE webfranco LOGIN PASSWORD '$CLAVE_BD';"
sudo -u postgres psql -c "CREATE DATABASE webfranco OWNER webfranco;"
```

## 6. Subir la aplicación

**En tu PC** (PowerShell, dentro de `D:\IdeaProjects\WebFranco`), empaqueta y sube el código:

```powershell
tar -czf ..\webfranco.tgz --exclude=node_modules --exclude=.env --exclude=server/uploads --exclude=.idea --exclude=.git .
scp -i <ruta\llave>.key ..\webfranco.tgz ubuntu@<IP_PUBLICA>:~
```

**En el servidor**, la aplicación corre con un usuario propio sin permisos de administrador:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin webfranco
sudo usermod -aG webfranco ubuntu                 # para poder leer los respaldos (paso 10)
sudo mkdir -p /opt/webfranco && sudo tar -xzf ~/webfranco.tgz -C /opt/webfranco
sudo chown -R webfranco: /opt/webfranco
cd /opt/webfranco && sudo -u webfranco npm ci --omit=dev
```

Crea el archivo de configuración `/opt/webfranco/.env`:

```bash
sudo -u webfranco tee /opt/webfranco/.env > /dev/null <<'EOF'
PORT=3000
DATABASE_URL=postgres://webfranco:<CLAVE_BD>@localhost:5432/webfranco
NODE_ENV=production
TRUST_PROXY=1
EOF
sudo chmod 640 /opt/webfranco/.env
```

- `NODE_ENV=production` hace que la cookie de sesión solo viaje por HTTPS. Por eso **el inicio de sesión no funciona hasta el paso 9**.
- `TRUST_PROXY=1` toma la IP real del alumno, la que envía Nginx. Úsalo solo detrás de Nginx.

Crea las tablas y el administrador:

```bash
cd /opt/webfranco && sudo -u webfranco npm run db:migrar
```

**Guarda la contraseña del administrador que se imprime**: no se vuelve a mostrar. Si se pierde: `sudo -u webfranco npm run db:migrar -- --nueva-contrasena-admin`.

## 7. Servicio con reinicio automático (systemd)

```bash
sudo tee /etc/systemd/system/webfranco.service > /dev/null <<'EOF'
[Unit]
Description=Plataforma de exámenes (WebFranco)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=webfranco
WorkingDirectory=/opt/webfranco
ExecStart=/usr/bin/node --env-file=.env server/app.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload && sudo systemctl enable --now webfranco
curl -s http://127.0.0.1:3000/api/salud                 # {"ok":true,...,"db":true}
```

## 8. Dominio gratuito (DuckDNS) y Nginx

1. Entra a <https://www.duckdns.org> con tu cuenta de Google o GitHub. Crea el subdominio `<tu-nombre>`, escribe la **IP pública** en *current ip* y pulsa **update ip**.
2. Configura Nginx como proxy inverso. Incluye el *upgrade* de WebSocket, que Socket.IO necesita para detectar desconexiones:

```bash
sudo tee /etc/nginx/sites-available/webfranco > /dev/null <<'EOF'
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    listen 80;
    server_name <tu-nombre>.duckdns.org;
    client_max_body_size 3m;               # imágenes de preguntas: máximo 2 MB

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/webfranco /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 9. HTTPS con Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <tu-nombre>.duckdns.org --redirect -m <tu-correo> --agree-tos
sudo certbot renew --dry-run       # comprueba la renovación automática
```

Abre `https://<tu-nombre>.duckdns.org` y entra con el administrador.

## 10. Respaldos diarios

Este script guarda la base de datos y las imágenes cada noche y conserva 14 días de respaldos:

```bash
sudo install -d -o webfranco -g webfranco -m 750 /var/backups/webfranco
sudo tee /opt/webfranco/respaldo.sh > /dev/null <<'EOF'
#!/bin/sh
set -e
set -a; . /opt/webfranco/.env; set +a
DIA=$(date +%F)
pg_dump "$DATABASE_URL" | gzip > /var/backups/webfranco/bd-$DIA.sql.gz
tar -czf /var/backups/webfranco/imagenes-$DIA.tgz -C /opt/webfranco/server uploads
find /var/backups/webfranco -type f -mtime +14 -delete
EOF
sudo chown webfranco: /opt/webfranco/respaldo.sh && sudo chmod 750 /opt/webfranco/respaldo.sh
sudo -u webfranco /opt/webfranco/respaldo.sh && ls -lh /var/backups/webfranco
echo '30 2 * * * /opt/webfranco/respaldo.sh' | sudo crontab -u webfranco -
```

**Copia fuera del servidor**, desde tu PC, al menos cada semana y **antes de cada ventana de examen**:

```powershell
scp -i <ruta\llave>.key "ubuntu@<IP_PUBLICA>:/var/backups/webfranco/*" D:\Respaldos\WebFranco\
```

Para restaurar, en una base vacía y con el `.env` cargado (`set -a; . /opt/webfranco/.env; set +a`): `gunzip -c bd-<fecha>.sql.gz | psql "$DATABASE_URL"`. Para las imágenes: `tar -xzf imagenes-<fecha>.tgz -C /opt/webfranco/server`.

## 11. Comprobación final

- [ ] `https://<tu-nombre>.duckdns.org` abre con candado y `http://` redirige a `https://`.
- [ ] `https://<tu-nombre>.duckdns.org/api/salud` responde `"db":true`.
- [ ] El administrador entra y crea un docente. El docente crea una materia y un grupo y programa un examen corto.
- [ ] Un alumno se registra, se inscribe y presenta el examen **desde un celular con datos móviles**, sin que aparezca el aviso "Se perdió la conexión".
- [ ] En "En revisión", la IP de un incidente de prueba es la del celular, no `127.0.0.1`. Si sale `127.0.0.1`, falta `TRUST_PROXY=1`.
- [ ] `sudo reboot` y, al volver, el sitio funciona solo (systemd).
- [ ] Hay un respaldo en `/var/backups/webfranco` y una copia en tu PC.

## 12. Actualizar la aplicación

**No lo hagas durante una ventana de examen.** El reinicio corta los sockets: los alumnos se reconectan solos, pero un reinicio largo los marca como abandonados.

```powershell
# En tu PC: empaqueta y sube como en el paso 6
```

```bash
# En el servidor
sudo -u webfranco /opt/webfranco/respaldo.sh
sudo tar -xzf ~/webfranco.tgz -C /opt/webfranco && sudo chown -R webfranco: /opt/webfranco
cd /opt/webfranco && sudo -u webfranco npm ci --omit=dev && sudo -u webfranco npm run db:migrar
sudo systemctl restart webfranco
```

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| No conecta por SSH | Revisa la IP y la ruta de la llave; el usuario es `ubuntu`. |
| La página no abre por `http://` | Faltan las reglas del paso 3 (en Oracle **y** en iptables). |
| `502 Bad Gateway` | La app no corre: `sudo systemctl status webfranco` y `sudo journalctl -u webfranco -n 50`. |
| El login no hace nada o vuelve al acceso | Entraste por `http://` con `NODE_ENV=production`; usa `https://`. |
| El alumno ve "Se perdió la conexión" todo el tiempo | Nginx sin las cabeceras `Upgrade`/`Connection` del paso 8. |
| Error al subir imágenes (413) | Falta `client_max_body_size 3m;` en Nginx. |
| Certbot falla | DuckDNS no apunta a la IP pública o el puerto 80 está cerrado. |
| La IP pública cambió | Actualízala en DuckDNS. Solo cambia si la instancia se termina y se crea otra. |

> **Riesgos de Oracle:** Oracle puede reclamar instancias gratuitas con uso muy bajo, y la asignación gratuita puede cambiar. Mantén los respaldos fuera del servidor. Como contingencia para la presentación, el sistema corre en local con `npm start`.
