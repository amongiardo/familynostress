#!/usr/bin/env bash
set -euo pipefail

PASSWORD="Antonio83"

CURRENT_PASSWORD=""
if [[ -t 0 ]]; then
  read -s -p "Current postgres password (leave empty to try defaults): " CURRENT_PASSWORD
  echo
fi

try_psql() {
  local pg_bin="$1"
  local cmd="$2"
  local pass="$3"

  if [[ -n "$pass" ]]; then
    sudo -u postgres env PGPASSWORD="$pass" "${pg_bin}/psql" -p 5432 -U postgres -c "$cmd"
  else
    sudo -u postgres "${pg_bin}/psql" -p 5432 -U postgres -c "$cmd"
  fi
}

reset_password() {
  local pg_bin="$1"
  local cmd="$2"

  local candidates=()
  if [[ -n "$CURRENT_PASSWORD" ]]; then
    candidates+=("$CURRENT_PASSWORD")
  else
    candidates+=("Antonio83" "antonio" "")
  fi

  for pass in "${candidates[@]}"; do
    if try_psql "$pg_bin" "$cmd" "$pass"; then
      return 0
    fi
  done

  echo "All password attempts failed. Provide the correct password and rerun." >&2
  return 1
}

reset_pg() {
  local ver="$1"
  local pg_bin="/Library/PostgreSQL/${ver}/bin"
  local pg_data="/Library/PostgreSQL/${ver}/data"
  local other_ver="$2"

  if [[ ! -x "${pg_bin}/pg_ctl" ]]; then
    echo "PostgreSQL ${ver} not found at ${pg_bin}"
    return 0
  fi

  if [[ -n "$other_ver" ]] && [[ -x "/Library/PostgreSQL/${other_ver}/bin/pg_ctl" ]]; then
    echo "== Stop PostgreSQL ${other_ver} (avoid port conflict) =="
    sudo -u postgres "/Library/PostgreSQL/${other_ver}/bin/pg_ctl" -D "/Library/PostgreSQL/${other_ver}/data" stop || true
  fi

  echo "== Stop PostgreSQL ${ver} (if running) =="
  sudo -u postgres "${pg_bin}/pg_ctl" -D "${pg_data}" stop || true

  echo "== Start PostgreSQL ${ver} =="
  cd /tmp
  sudo -u postgres "${pg_bin}/pg_ctl" -D "${pg_data}" start

  echo "== Reset password for postgres (${ver}) =="
  reset_password "${pg_bin}" "ALTER USER postgres WITH PASSWORD '${PASSWORD}';"

  echo "== Databases (${ver}) =="
  PGPASSWORD="${PASSWORD}" "${pg_bin}/psql" -p 5432 -U postgres -lqt

  echo "== Stop PostgreSQL ${ver} =="
  sudo -u postgres "${pg_bin}/pg_ctl" -D "${pg_data}" stop
}

reset_pg 18 16
reset_pg 16 18
