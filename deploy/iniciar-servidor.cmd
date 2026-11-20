@echo off
rem Mantiene la plataforma encendida: si node se cierra o falla, la vuelve a arrancar a los 5 s.
rem Lo ejecuta la tarea programada "WebFranco" al encender la PC (ver DESPLIEGUE.md, paso 6).
rem shortcut: el log crece sin limite; si pasa de unos MB, borrarlo con la app detenida.
cd /d "%~dp0.."
if not exist logs mkdir logs
:inicio
echo [%date% %time%] Iniciando servidor>> logs\servidor.log
node --env-file=.env server/app.js >> logs\servidor.log 2>&1
echo [%date% %time%] El servidor se detuvo (codigo %errorlevel%). Reinicio en 5 s>> logs\servidor.log
rem ping en lugar de timeout: timeout falla cuando la tarea corre sin ventana
ping -n 6 127.0.0.1 > nul
goto inicio
