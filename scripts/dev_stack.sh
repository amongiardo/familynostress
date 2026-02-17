#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
PID_DIR="$ROOT_DIR/.dev_pids"
FRONTEND_DIR="$ROOT_DIR/frontend"
NUNITO_DIR="$FRONTEND_DIR/src/app/fonts/nunito"

PG_BIN="/Library/PostgreSQL/16/bin"
PG_CTL="${PG_BIN}/pg_ctl"
PG_ISREADY="${PG_BIN}/pg_isready"
PG_DATA="/Library/PostgreSQL/16/data"

mkdir -p "$LOG_DIR" "$PID_DIR"

ensure_nunito_fonts() {
  local required=(
    "nunito-latin-400-normal.woff2"
    "nunito-latin-600-normal.woff2"
    "nunito-latin-700-normal.woff2"
    "nunito-latin-800-normal.woff2"
  )

  local missing=0
  for font in "${required[@]}"; do
    if [[ ! -f "$NUNITO_DIR/$font" ]]; then
      missing=1
      break
    fi
  done

  if [[ "$missing" -eq 0 ]]; then
    echo "Nunito local fonts already installed."
    return 0
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "npm not found. Cannot auto-install Nunito fonts."
    return 1
  fi

  echo "Nunito local fonts missing. Installing..."
  local tmp_dir
  tmp_dir="$(mktemp -d)"

  (
    set -euo pipefail
    cd "$tmp_dir"
    npm pack @fontsource/nunito >/dev/null
    local tarball
    tarball="$(ls -1 fontsource-nunito-*.tgz | head -n1)"
    [[ -n "${tarball:-}" ]]
    tar -xzf "$tarball"
    mkdir -p "$NUNITO_DIR"
    for weight in 400 600 700 800; do
      cp "package/files/nunito-latin-${weight}-normal.woff2" \
        "$NUNITO_DIR/nunito-latin-${weight}-normal.woff2"
    done
  )

  rm -rf "$tmp_dir"
  echo "Nunito local fonts installed."
}

is_pid_running() {
  local name="$1"
  local pid_file="$PID_DIR/${name}.pid"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

stack_running() {
  is_pid_running "frontend" || is_pid_running "backend"
}

stop_pid() {
  local name="$1"
  local pid_file="$PID_DIR/${name}.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $name (pid $pid)..."
      if command -v pgrep >/dev/null 2>&1; then
        pgrep -P "$pid" | xargs -r kill 2>/dev/null || true
      fi
      kill "$pid" 2>/dev/null || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$pid_file"
  fi
}

kill_node_ports() {
  for port in 3000 3001 3002 3003; do
    if command -v lsof >/dev/null 2>&1; then
      pids="$(lsof -tiTCP:${port} -sTCP:LISTEN -c node 2>/dev/null || true)"
      if [[ -n "$pids" ]]; then
        echo "Killing node listeners on port $port: $pids"
        kill $pids 2>/dev/null || true
      fi
    fi
  done
}

ensure_postgres() {
  if [[ ! -x "$PG_ISREADY" ]]; then
    echo "pg_isready not found at $PG_ISREADY. Skipping PostgreSQL check."
    return 0
  fi

  if "$PG_ISREADY" -q; then
    echo "PostgreSQL is already running."
    return 0
  fi

  echo "PostgreSQL is not running."
  echo "To avoid frequent sudo prompts, this script does NOT stop PostgreSQL."
  read -r -p "Do you want to start PostgreSQL now? [y/N]: " ans
  if [[ ! "$ans" =~ ^[Yy]$ ]]; then
    echo "PostgreSQL start skipped."
    return 1
  fi

  if [[ -x "$PG_CTL" ]]; then
    if sudo -n -u postgres "$PG_CTL" -D "$PG_DATA" start >/dev/null 2>&1; then
      echo "PostgreSQL started (non-interactive sudo)."
      return 0
    fi

    echo "Sudo authorization required once to start PostgreSQL..."
    sudo -v
    sudo -u postgres "$PG_CTL" -D "$PG_DATA" start
    return 0
  fi

  echo "pg_ctl not found at $PG_CTL."
  return 1
}

run_update() {
  echo "[1/3] PostgreSQL check..."
  ensure_postgres

  echo "[2/3] Prisma migrate deploy + generate..."
  cd "$ROOT_DIR/backend"
  npx prisma migrate deploy
  npx prisma generate

  echo "[3/3] Backend build..."
  npm run build
}

run_start() {
  ensure_nunito_fonts || true
  ensure_postgres || true
  kill_node_ports

  echo "Starting backend..."
  cd "$ROOT_DIR/backend"
  nohup npm run dev > "$LOG_DIR/backend.log" 2>&1 &
  echo $! > "$PID_DIR/backend.pid"

  echo "Starting frontend..."
  cd "$ROOT_DIR/frontend"
  nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
  echo $! > "$PID_DIR/frontend.pid"

  echo "Stack started."
}

run_stop() {
  local stop_db="false"

  if [[ -t 0 ]]; then
    echo "Stop mode:"
    echo "1) Stop app only (default)"
    echo "2) Stop app + PostgreSQL"
    echo "3) Exit"
    read -r -p "Choose an option [1-3]: " stop_choice
    case "${stop_choice:-1}" in
      1) stop_db="false" ;;
      2) stop_db="true" ;;
      3) echo "Exit."; return 0 ;;
      *) echo "Invalid option. Defaulting to app only."; stop_db="false" ;;
    esac
  fi

  stop_pid "frontend"
  stop_pid "backend"

  NEXT_CACHE_DIR="$ROOT_DIR/frontend/.next"
  if [[ -d "$NEXT_CACHE_DIR" ]]; then
    echo "Clearing frontend cache: $NEXT_CACHE_DIR"
    rm -rf "$NEXT_CACHE_DIR"
  fi

  kill_node_ports

  if [[ "$stop_db" == "true" ]]; then
    if [[ -x "$PG_CTL" ]]; then
      echo "Stopping PostgreSQL..."
      if ! sudo -n -u postgres "$PG_CTL" -D "$PG_DATA" stop >/dev/null 2>&1; then
        sudo -v
        sudo -u postgres "$PG_CTL" -D "$PG_DATA" stop
      fi
      echo "Stack and PostgreSQL stopped."
    else
      echo "pg_ctl not found at $PG_CTL. App stopped, PostgreSQL unchanged."
    fi
  else
    echo "App stack stopped. PostgreSQL left running."
  fi
}

run_update_and_start() {
  run_update
  run_start
}

interactive_mode() {
  if stack_running; then
    echo "Dev stack is currently RUNNING."
    echo "1) Stop"
    echo "2) Exit"
    read -r -p "Choose an option [1-2]: " choice
    case "$choice" in
      1) run_stop ;;
      2) echo "Exit." ;;
      *) echo "Invalid option. Exit." ;;
    esac
    return
  fi

  echo "Dev stack is currently STOPPED."
  echo "1) Update + Start"
  echo "2) Exit"
  read -r -p "Choose an option [1-2]: " choice
  case "$choice" in
    1) run_update_and_start ;;
    2) echo "Exit." ;;
    *) echo "Invalid option. Exit." ;;
  esac
}

case "${1:-}" in
  --start) run_start ;;
  --stop) run_stop ;;
  --update) run_update ;;
  --update-start) run_update_and_start ;;
  ""|--interactive) interactive_mode ;;
  *)
    echo "Usage: $0 [--interactive|--start|--stop|--update|--update-start]"
    exit 1
    ;;
esac
