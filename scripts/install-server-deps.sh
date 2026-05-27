#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  sudo_cmd=""
else
  sudo_cmd="sudo"
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This bootstrap script expects Ubuntu/Debian with apt-get." >&2
  exit 1
fi

${sudo_cmd} apt-get update
${sudo_cmd} apt-get install -y ca-certificates curl git gnupg make

${sudo_cmd} install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | ${sudo_cmd} gpg --dearmor -o /etc/apt/keyrings/docker.gpg
${sudo_cmd} chmod a+r /etc/apt/keyrings/docker.gpg

. /etc/os-release
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  | ${sudo_cmd} tee /etc/apt/sources.list.d/docker.list >/dev/null

${sudo_cmd} apt-get update
${sudo_cmd} apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

if [ -n "${SUDO_USER:-}" ]; then
  ${sudo_cmd} usermod -aG docker "$SUDO_USER"
  echo "Added $SUDO_USER to the docker group. Log out and back in before running Docker without sudo."
fi

docker --version
docker compose version
