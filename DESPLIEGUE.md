# Manual de despliegue · Plataforma de exámenes (PC con Windows + Tailscale Funnel)

Guía para publicar la plataforma en internet desde una PC con Windows, sin abrir puertos ni pagar servidor. Tiempo estimado: 1 a 2 horas.

**Resultado:** `https://<equipo>.<red>.ts.net` → Tailscale Funnel (HTTPS) → Node en `localhost:3000` → PostgreSQL, todo en la misma PC, con arranque automático, reinicio si falla y respaldo diario.

En los comandos, cambia lo que está entre `< >`. Los de PowerShell que dicen **(administrador)** necesitan una ventana abierta con *clic derecho → Ejecutar como administrador*.

> **Por qué así:** Oracle Cloud pedía tarjeta de crédito. El túnel rápido de Cloudflare (`trycloudflare.com`) funciona, pero acepta como máximo 200 peticiones a la vez y falló la prueba de carga con 200 alumnos. Tailscale Funnel la aprobó (ver `PLAN_DESARROLLO.md`, Fase 9). La guía anterior para Oracle quedó en [`docs/DESPLIEGUE_ORACLE.md`](docs/DESPLIEGUE_ORACLE.md).

---

## 1. Requisitos de la PC

- Windows 10 u 11, encendida y conectada a internet durante los exámenes. Si es laptop, conectada a la corriente.
- Conexión por cable de preferencia. Con Wi-Fi también funciona, pero un corte afecta a todos los alumnos.

## 2. Instalar Node.js y PostgreSQL

1. **Node.js 24 LTS** desde <https://nodejs.org> (instalador `.msi`, opciones por defecto). El proyecto pide 24.2 o mayor.
2. **PostgreSQL 18** desde <https://www.postgresql.org/download/windows/> (instalador de EDB). Anota la contraseña del usuario `postgres` que te pide. Deja el puerto `5432`.
3. Comprueba en PowerShell:
   ```powershell
   node -v
   Get-Service postgresql*        # Status: Running, StartType: Automatic
   ```
   Si `StartType` no es `Automatic`: **(administrador)** `Set-Service postgresql-x64-18 -StartupType Automatic`.

## 3. Base de datos

Abre **SQL Shell (psql)** desde el menú Inicio, entra con el usuario `postgres` (Enter en todo lo demás) y ejecuta, con una contraseña larga inventada por ti:

```sql
CREATE ROLE webfranco LOGIN PASSWORD '<CLAVE_BD>';
CREATE DATABASE webfranco OWNER webfranco;
\q
```

## 4. Copiar la aplicación y configurarla

1. Descarga el proyecto con git (instálalo desde <https://git-scm.com> si no lo tienes):
   ```powershell
   git clone https://github.com/JaredMDD/WebFranco.git C:\ProyectoExamen\WebFranco
   cd C:\ProyectoExamen\WebFranco
   ```
   El repositorio no trae `.env`, `node_modules` ni `server\uploads`: se crean aquí.

   **Si ya tenías la app en una carpeta copiada a mano** (con exámenes reales): detén la app, clona en una carpeta nueva, copia a ella tu `.env` y tu carpeta `server\uploads` (las imágenes de las preguntas), y sigue desde el punto 2 sin crear el `.env` de nuevo. La base de datos no se toca. Si ya registraste la tarea `WebFranco` del paso 6 con la carpeta anterior, vuelve a registrarla con la nueva (`Unregister-ScheduledTask 'WebFranco' -Confirm:$false` y repite el paso 6).
2. En PowerShell, dentro de esa carpeta:
   ```powershell
   npm ci --omit=dev
   Copy-Item .env.example .env
   notepad .env
   ```
3. Deja el `.env` así:
   ```
   PORT=3000
   DATABASE_URL=postgres://webfranco:<CLAVE_BD>@localhost:5432/webfranco
   NODE_ENV=production
   TRUST_PROXY=1
   URL_PUBLICA=https://<equipo>.<red>.ts.net
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=<cuenta>@gmail.com
   SMTP_PASS=<contraseña de aplicación de 16 letras>
   SMTP_FROM=Plataforma de exámenes <<cuenta>@gmail.com>
   ```
   - `URL_PUBLICA`: la dirección del paso 5. Va en los enlaces de "¿Olvidaste tu contraseña?"; sin ella no se envían.
   - `SMTP_*`: la cuenta que envía las contraseñas iniciales y los enlaces de recuperación. Con Gmail: activa la verificación en dos pasos en esa cuenta y crea una **contraseña de aplicación** en <https://myaccount.google.com/apppasswords>; esa va en `SMTP_PASS`, no la contraseña normal. Conviene una cuenta solo para la plataforma. Sin `SMTP_HOST` la app funciona igual, pero el administrador ve la contraseña en pantalla y la entrega a mano, y "¿Olvidaste tu contraseña?" no envía nada.
   - `NODE_ENV=production`: la cookie de sesión solo viaja por HTTPS. Por eso, **en esa PC el inicio de sesión ya no funciona en `http://localhost:3000`**; entra siempre por la dirección `https://...ts.net`.
   - `TRUST_PROXY=1`: toma la IP del alumno que informa Tailscale. Se comprueba en el paso 9.
4. Crea las tablas y el administrador:
   ```powershell
   npm run db:migrar
   ```
   **Guarda la contraseña del administrador que se imprime**: no se vuelve a mostrar. Si se pierde: `npm run db:migrar -- --nueva-contrasena-admin`.
5. Entra como administrador, abre **Mi cuenta**, cámbiale la contraseña y registra tu correo: sin correo no podrás usar "¿Olvidaste tu contraseña?".

## 5. Publicar con Tailscale Funnel

1. Instala Tailscale desde <https://tailscale.com/download/windows> e inicia sesión (Google, Microsoft o GitHub; el plan personal es gratis y no pide tarjeta).
2. En la consola web <https://login.tailscale.com/admin/dns> activa **MagicDNS** y **HTTPS Certificates**.
3. En el ícono de Tailscale de la barra de tareas: **Preferences → Run unattended**. Así Tailscale funciona aunque nadie haya iniciado sesión en Windows.
4. Publica el puerto 3000 (con la app encendida, paso 6, o `npm start` para probar):
   ```powershell
   tailscale funnel --bg 3000
   tailscale funnel status          # muestra la dirección pública https://<equipo>.<red>.ts.net
   ```
   La primera vez, si Funnel no está habilitado en tu cuenta, el comando da un enlace para activarlo; ábrelo y repite el comando. El certificado puede tardar unos minutos en emitirse.

`--bg` deja la publicación guardada: sigue activa tras cerrar la terminal y tras reiniciar la PC. Para quitarla: `tailscale funnel --bg 3000 off`.

## 6. Arranque automático de la aplicación

`deploy\iniciar-servidor.cmd` arranca la app y la vuelve a levantar a los 5 s si se cae. Lo ejecuta una tarea programada al encender la PC, sin necesidad de iniciar sesión. Su registro queda en `logs\servidor.log`.

Primero cierra cualquier `npm start` que tengas abierto (si no, el puerto 3000 queda ocupado). Luego **(administrador)**, cambiando la carpeta si es otra:

```powershell
$dir = 'C:\ProyectoExamen\WebFranco'
$config = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$alEncender = New-ScheduledTaskTrigger -AtStartup; $alEncender.Delay = 'PT30S'   # espera a que arranque PostgreSQL
Register-ScheduledTask -TaskName 'WebFranco' -User 'NT AUTHORITY\SYSTEM' -RunLevel Highest -Settings $config -Trigger $alEncender `
  -Action (New-ScheduledTaskAction -Execute "$dir\deploy\iniciar-servidor.cmd")
Start-ScheduledTask 'WebFranco'
```

`-ExecutionTimeLimit 0` es necesario: sin él, Windows detiene la tarea a los 3 días.

Comprueba: `Invoke-RestMethod http://localhost:3000/api/salud` debe mostrar `db : True`.

## 7. Que la PC no se duerma ni se reinicie sola

**(administrador)**, para cuando está conectada a la corriente:

```powershell
powercfg /change standby-timeout-ac 0      # no suspender
powercfg /change hibernate-timeout-ac 0    # no hibernar
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0; powercfg /setactive SCHEME_CURRENT   # laptop: cerrar la tapa no hace nada
```

**Actualizaciones de Windows:** en *Configuración → Windows Update*, usa **Pausar actualizaciones** durante las semanas de exámenes y define las **horas activas** para que nunca reinicie en horario de examen. Apagar la pantalla sí está permitido.

## 8. Respaldos

`deploy\respaldo.ps1` guarda la base de datos (`bd-<fecha>.dump`) y las imágenes (`imagenes-<fecha>.zip`) y borra los de más de 14 días. Usa como destino una carpeta de **OneDrive o Google Drive**, así la copia queda también fuera de la PC.

Respaldo diario a las 2:30 (si la PC estaba apagada, se hace al encenderla) **(administrador)**:

```powershell
$dir = 'C:\ProyectoExamen\WebFranco'
$destino = 'C:\Users\<usuario>\OneDrive\Respaldos\WebFranco'
Register-ScheduledTask -TaskName 'WebFranco respaldo' -User 'NT AUTHORITY\SYSTEM' -Trigger (New-ScheduledTaskTrigger -Daily -At 2:30am) `
  -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable) `
  -Action (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$dir\deploy\respaldo.ps1`" -Destino `"$destino`"")
Start-ScheduledTask 'WebFranco respaldo'     # primer respaldo ahora; revisa que aparezca en la carpeta
```

**Antes de cada ventana de examen**, haz uno a mano:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\respaldo.ps1 -Destino 'C:\Users\<usuario>\OneDrive\Respaldos\WebFranco'
```

**Restaurar** (con la app detenida, paso 10): la base, desde la carpeta de PostgreSQL (`...\PostgreSQL\18\bin`):

```powershell
.\pg_restore.exe --clean --if-exists --no-owner --dbname="postgres://webfranco:<CLAVE_BD>@localhost:5432/webfranco" "<ruta>\bd-<fecha>.dump"
```

Las imágenes: descomprime `imagenes-<fecha>.zip` dentro de `server\uploads`.

## 9. Comprobación final

- [ ] `https://<equipo>.<red>.ts.net/api/salud` responde `"db":true` desde **otro** dispositivo (celular con datos móviles, no el Wi-Fi de la casa).
- [ ] El administrador entra y crea un docente con un correo real: **la contraseña inicial llega a ese correo** (revisa también spam). El docente crea una materia, un grupo y un examen corto.
- [ ] En el acceso, "¿Olvidaste tu contraseña?" con el usuario del docente manda un enlace que abre la dirección `https://...ts.net` y permite elegir una contraseña nueva.
- [ ] Un alumno se registra, se inscribe y presenta el examen **desde un celular con datos móviles**, sin que aparezca el aviso "Se perdió la conexión".
- [ ] En "En revisión", la IP de un incidente de prueba es la del celular, no `127.0.0.1` ni una `100.x.x.x` de Tailscale. Si sale una de esas, avisar: hay que ajustar cómo se lee la IP.
- [ ] Reinicia la PC **sin iniciar sesión en Windows**: a los 1–2 minutos, la dirección pública vuelve a responder.
- [ ] Hay al menos un respaldo en la carpeta de OneDrive o Google Drive.

## 10. Operación diaria y actualizaciones

| Acción | Comando (PowerShell) |
|---|---|
| ¿Está encendida? | `Invoke-RestMethod http://localhost:3000/api/salud` |
| Ver el registro | `Get-Content logs\servidor.log -Tail 30` |
| Reiniciar la app | `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess -Force` (se levanta sola a los 5 s) |
| Detenerla del todo **(administrador)** | `Stop-ScheduledTask 'WebFranco'` y después el comando de "Reiniciar" |
| Volver a encenderla **(administrador)** | `Start-ScheduledTask 'WebFranco'` |

**Actualizar la aplicación.** **Nunca durante una ventana de examen:** el reinicio corta las conexiones y, si tarda más de 20 s, los alumnos quedan como abandonados.

1. Haz un respaldo a mano (paso 8).
2. Descarga los cambios: `git pull` (no toca `.env` ni `server\uploads`, que git ignora).
3. `npm ci --omit=dev` y `npm run db:migrar` (se puede repetir; no borra datos).
4. Reinicia la app (tabla de arriba).

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| La dirección `.ts.net` no abre | ¿Tailscale conectado? `tailscale status`. ¿Funnel activo? `tailscale funnel status`. ¿La app responde en `localhost:3000`? |
| El login no hace nada o vuelve al acceso | Entraste por `http://localhost` con `NODE_ENV=production`; usa la dirección `https://...ts.net`. |
| `logs\servidor.log` repite "El servidor se detuvo" cada 5 s | Otro programa usa el puerto 3000 (¿un `npm start` abierto?) o falla la base: lee las líneas anteriores del log. |
| `/api/salud` dice `"db":false` | PostgreSQL detenido: `Get-Service postgresql*`; **(administrador)** `Start-Service postgresql-x64-18`. |
| Tras reiniciar Windows no vuelve | Falta **Run unattended** en Tailscale (paso 5) o la tarea `WebFranco` (paso 6): `Get-ScheduledTask WebFranco`. |
| El alumno ve "Se perdió la conexión" seguido | Internet inestable en la PC servidor o en el celular. Revisa la conexión de la PC; si es Wi-Fi, usa cable. |
| No llegan los correos | Lee `logs\servidor.log` ("Correo no enviado: …"). Con Gmail, `SMTP_PASS` debe ser una contraseña de aplicación. Revisa spam. Mientras tanto, el panel del administrador muestra la contraseña en pantalla. |
| El respaldo no aparece | Ejecuta el comando manual del paso 8 y lee el error; revisa que `DATABASE_URL` en `.env` sea correcto. |

> **Límites de este despliegue:** todo depende de una sola PC y de su internet doméstico. Si se apaga o pierde conexión a mitad de examen, los alumnos quedan como abandonados a los 20 s y el docente puede reabrirles el examen. Tailscale limita el ancho de banda de Funnel sin publicar una cifra; la prueba de carga de 200 alumnos pasó, pero exámenes con muchas imágenes conviene probarlos antes. Como contingencia para la presentación, el sistema corre en local con `npm start`.
