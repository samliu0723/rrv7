#!/usr/bin/env bash
set -euo pipefail

# Continuously sync local changes to the Raspberry Pi using rsync + a file watcher.
# Requires one of: fswatch (recommended), watchexec, or entr to be installed on your Mac.
#
# Usage:
#   ./scripts/watch-sync-pi.sh                      # sync to default host/dir
#   HOST=admin@pi5.local REMOTE_DIR=~/rrv7 ./scripts/watch-sync-pi.sh
#
# The remote dev server can be started separately (e.g., in another terminal):
#   ./scripts/dev-pi.sh

HOST=${HOST:-admin@raspberrypi5.local}
REMOTE_DIR=${REMOTE_DIR:-~/rrv7}
SSH_OPTS=${SSH_OPTS:-"-o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o TCPKeepAlive=yes"}

RSYNC_EXCLUDES=(
  --exclude .git
  --exclude node_modules
  --exclude build
  --exclude .env.local
)

rsync_push() {
  rsync -avz --delete "${RSYNC_EXCLUDES[@]}" -e "ssh $SSH_OPTS" ./ "$HOST:$REMOTE_DIR"
}

echo "Initial sync → $HOST:$REMOTE_DIR"
ssh $SSH_OPTS "$HOST" "mkdir -p $REMOTE_DIR"
rsync_push

watch_with_fswatch() {
  echo "Watching with fswatch…"
  fswatch -0 -r \
    -e ".*\\.git(/|$)" \
    -e ".*node_modules(/|$)" \
    -e ".*build(/|$)" \
    . | while IFS= read -r -d '' _; do
      rsync_push
    done
}

watch_with_watchexec() {
  echo "Watching with watchexec…"
  watchexec -r -w . --ignore .git --ignore node_modules --ignore build -- \
    bash -lc '"$0" rsync_push' "$BASH_SOURCE"
}

watch_with_entr() {
  echo "Watching with entr…"
  if ! command -v rg >/dev/null 2>&1; then
    echo "ripgrep (rg) is required for entr mode" >&2
    exit 1
  fi
  rg --files -uu -g '!node_modules' -g '!.git' -g '!build' | \
    entr -r bash -lc 'rsync_push'
}

if command -v fswatch >/dev/null 2>&1; then
  watch_with_fswatch
elif command -v watchexec >/dev/null 2>&1; then
  watch_with_watchexec
elif command -v entr >/dev/null 2>&1; then
  watch_with_entr
else
  cat <<'MSG' >&2
No supported watcher found. Install one of these on your Mac:
  - fswatch      (brew install fswatch)   ← recommended
  - watchexec    (brew install watchexec)
  - entr         (brew install entr ripgrep)

Then rerun: ./scripts/watch-sync-pi.sh
MSG
  exit 1
fi

