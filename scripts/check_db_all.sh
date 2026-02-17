#!/usr/bin/env bash
set -u

# Usage:
#   ./scripts/check_db_all.sh
#   ./scripts/check_db_all.sh --start-missing
#
# Default behavior:
# - Detect installed PostgreSQL versions under /Library/PostgreSQL
# - Report status for each version
# - Try listing DBs if reachable
# - Never fail hard if one version has issues
#
# Optional:
# --start-missing: if a version is stopped, try to start it (and leave it running)

START_MISSING=false
if [[ "${1:-}" == "--start-missing" ]]; then
  START_MISSING=true
fi

ROOT="/Library/PostgreSQL"

run_pg_cmd() {
  # Run as postgres from a safe working directory to avoid getcwd permission errors.
  local cmd="$1"
  if sudo -n -u postgres bash -lc "cd /tmp && ${cmd}" 2>/dev/null; then
    return 0
  fi
  if sudo -u postgres bash -lc "cd /tmp && ${cmd}" 2>/dev/null; then
    return 0
  fi
  return 1
}

discover_versions() {
  if [[ ! -d "$ROOT" ]]; then
    return 0
  fi

  find "$ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null \
    | sed "s#${ROOT}/##" \
    | sort -V
}

list_databases() {
  local pg_bin="$1"
  if [[ ! -x "${pg_bin}/psql" ]]; then
    echo "  - psql not found in ${pg_bin}"
    return 0
  fi

  # Try peer auth first (best effort), fallback to env password if provided.
  if run_pg_cmd "\"${pg_bin}/psql\" -Atqc \"SELECT datname FROM pg_database ORDER BY datname;\""; then
    return 0
  fi

  if [[ -n "${PGPASSWORD:-}" ]]; then
    run_pg_cmd "PGPASSWORD='${PGPASSWORD}' \"${pg_bin}/psql\" -h localhost -U postgres -Atqc \"SELECT datname FROM pg_database ORDER BY datname;\"" || true
    return 0
  fi

  echo "  - Unable to list databases (auth required). Set PGPASSWORD to enable fallback."
}

check_version() {
  local ver="$1"
  local pg_home="${ROOT}/${ver}"
  local pg_bin="${pg_home}/bin"
  local pg_data="${pg_home}/data"
  local pg_ctl="${pg_bin}/pg_ctl"
  local pg_isready="${pg_bin}/pg_isready"

  echo
  echo "== PostgreSQL ${ver} =="

  if [[ ! -x "$pg_ctl" ]]; then
    echo "  - pg_ctl not found (${pg_ctl})"
    return 0
  fi
  if [[ ! -d "$pg_data" ]]; then
    echo "  - data directory not found (${pg_data})"
    return 0
  fi

  local status_out
  if status_out="$(run_pg_cmd "\"${pg_ctl}\" -D \"${pg_data}\" status" 2>&1)"; then
    echo "  - status: RUNNING"
    echo "  - ${status_out}" | sed 's/^  - //'
  else
    echo "  - status: STOPPED (or unknown)"
  fi

  if [[ "$START_MISSING" == "true" ]] && ! run_pg_cmd "\"${pg_ctl}\" -D \"${pg_data}\" status" >/dev/null 2>&1; then
    echo "  - trying start..."
    if run_pg_cmd "\"${pg_ctl}\" -D \"${pg_data}\" start"; then
      echo "  - start: OK"
    else
      echo "  - start: FAILED (continuing)"
    fi
  fi

  if [[ -x "$pg_isready" ]]; then
    if run_pg_cmd "\"${pg_isready}\" -q"; then
      echo "  - connection check: accepting connections"
    else
      echo "  - connection check: not ready"
    fi
  fi

  echo "  - databases:"
  list_databases "$pg_bin" | sed 's/^/    /'
}

main() {
  versions=()
  while IFS= read -r v; do
    [[ -n "$v" ]] && versions+=("$v")
  done < <(discover_versions)
  if [[ "${#versions[@]}" -eq 0 ]]; then
    echo "No PostgreSQL versions found under ${ROOT}"
    exit 0
  fi

  echo "Detected PostgreSQL versions:"
  for v in "${versions[@]}"; do
    echo "  - ${v}"
  done

  for v in "${versions[@]}"; do
    check_version "$v"
  done
}

main
