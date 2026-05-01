#!/usr/bin/env bash

set -euo pipefail

require_env() {
  local var_name="$1"

  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
}

coolify_api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  require_env "COOLIFY_BASE_URL"
  require_env "COOLIFY_TOKEN"

  if [[ -n "${body}" ]]; then
    curl --fail --silent --show-error \
      -X "${method}" \
      -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${body}" \
      "${COOLIFY_BASE_URL}/api/v1${path}"
    return
  fi

  curl --fail --silent --show-error \
    -X "${method}" \
    -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
    "${COOLIFY_BASE_URL}/api/v1${path}"
}

validate_deploy_config() {
  local required_vars=(
    COOLIFY_BASE_URL
    COOLIFY_TOKEN
    COOLIFY_API_UUID
    COOLIFY_EDDN_LISTENER_UUID
    COOLIFY_EDDN_WORKER_UUID
    COOLIFY_DB_MIGRATOR_UUID
  )

  for var_name in "${required_vars[@]}"; do
    require_env "${var_name}"
  done
}

pin_app_to_commit() {
  local app_uuid="$1"
  local commit_sha="$2"
  local payload

  payload="$(jq -n --arg sha "${commit_sha}" '{ git_commit_sha: $sha }')"
  coolify_api "PATCH" "/applications/${app_uuid}" "${payload}" >/dev/null
}

set_app_env() {
  local app_uuid="$1"
  local key="$2"
  local value="$3"
  local payload

  payload="$(jq -n --arg key "${key}" --arg value "${value}" '{
    key: $key,
    value: $value,
    is_literal: true,
    is_buildtime: false,
    is_runtime: true
  }')"

  coolify_api "PATCH" "/applications/${app_uuid}/envs" "${payload}" >/dev/null
}

extract_deployment_uuid() {
  jq -r '.deployment_uuid // .deployments[0].deployment_uuid // empty'
}

start_app() {
  local app_uuid="$1"

  coolify_api "POST" "/applications/${app_uuid}/start" | extract_deployment_uuid
}

restart_app() {
  local app_uuid="$1"

  coolify_api "POST" "/applications/${app_uuid}/restart" | extract_deployment_uuid
}

stop_app() {
  local app_uuid="$1"

  coolify_api "POST" "/applications/${app_uuid}/stop" >/dev/null
}

wait_for_deployment() {
  local deployment_uuid="$1"
  local label="$2"

  if [[ -z "${deployment_uuid}" || "${deployment_uuid}" == "null" ]]; then
    echo "Coolify did not return a deployment UUID for ${label}." >&2
    exit 1
  fi

  while true; do
    local response
    local status

    response="$(coolify_api "GET" "/deployments/${deployment_uuid}")"
    status="$(jq -r '.status // empty' <<<"${response}")"

    echo "${label} deployment status: ${status:-unknown}"

    case "${status}" in
      finished)
        break
        ;;
      failed|cancelled|canceled)
        echo "${label} deployment failed." >&2
        jq -r '.logs // empty' <<<"${response}" >&2
        exit 1
        ;;
    esac

    sleep 10
  done
}
