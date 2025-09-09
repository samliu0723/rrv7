#!/usr/bin/env bash
set -euo pipefail

# Starts the dev server on the Raspberry Pi and (optionally) forwards port 5173.
# Usage:
#   ./scripts/dev-pi.sh                 # run dev on remote, access via http://raspberrypi5.local:5173
#   TUNNEL=1 ./scripts/dev-pi.sh        # forward local port 5173 to remote 5173 and keep SSH session

HOST=${HOST:-admin@raspberrypi5.local}
REMOTE_DIR=${REMOTE_DIR:-~/rrv7}
SSH_OPTS=${SSH_OPTS:-"-o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o TCPKeepAlive=yes"}

if [[ "${TUNNEL:-0}" == "1" ]]; then
  echo "Opening SSH tunnel and starting dev server on $HOST ..."
  ssh $SSH_OPTS -t -L 5173:localhost:5173 "$HOST" bash -lc "cd $REMOTE_DIR && npm run dev"
else
  echo "Starting dev server on $HOST ..."
  ssh $SSH_OPTS -t "$HOST" bash -lc "cd $REMOTE_DIR && npm run dev"
  echo "Access dev server at http://raspberrypi5.local:5173"
fi
