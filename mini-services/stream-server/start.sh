#!/bin/sh
# ARENA - arranca el servidor de streaming MediaMTX (RTMP :1935 / HLS :8888 / API :9997 localhost)
# Uso: ./start.sh   (el sandbox tambien lo auto-arranca al boot via .zscripts/dev.sh)
cd "$(dirname "$0")"
if pgrep -f "mediamtx mediamtx.yml" > /dev/null 2>&1; then
    echo "mediamtx ya esta corriendo"
    exit 0
fi
nohup ./mediamtx mediamtx.yml > stream.log 2>&1 &
disown
echo "mediamtx arrancado (PID $!). Log: stream.log"
