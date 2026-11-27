#!/usr/bin/env sh
# Creates a self-signed TLS certificate for local HTTPS testing (Git Bash / macOS / Linux).
# Then set in .env:  TLS_KEY_PATH=certs/localhost-key.pem  TLS_CERT_PATH=certs/localhost.pem
export MSYS_NO_PATHCONV=1  # stop Git Bash rewriting "/CN=localhost" into a Windows path
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
  -keyout certs/localhost-key.pem -out certs/localhost.pem \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
echo "Created certs/localhost.pem and certs/localhost-key.pem"
