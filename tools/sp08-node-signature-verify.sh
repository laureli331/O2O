#!/usr/bin/env bash
set -euo pipefail

readonly version='v24.22.3'
readonly archive='node-v24.22.3-linux-x64.tar.xz'
readonly expected='4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb'
readonly release_keys_commit='481637f813e912c4aa3622d7964ab426c97b8e8d'
readonly base="https://nodejs.org/dist/${version}"
readonly keyring_url="https://raw.githubusercontent.com/nodejs/release-keys/${release_keys_commit}/gpg/pubring.kbx"

workdir="$(mktemp -d)"
# GitHub-hosted runner is disposable; leave its temporary evidence to runner teardown.

curl --fail --silent --show-error --location "${base}/SHASUMS256.txt.asc" -o "${workdir}/SHASUMS256.txt.asc"
curl --fail --silent --show-error --location "${keyring_url}" -o "${workdir}/pubring.kbx"

# Follow Node's official clear-signed manifest verification procedure.
gpgv --keyring "${workdir}/pubring.kbx" --output "${workdir}/SHASUMS256.txt" "${workdir}/SHASUMS256.txt.asc"

awk -v file="${archive}" -v expected="${expected}" '
  $2 == file { count++; if ($1 != expected) bad=1 }
  END { if (count != 1 || bad) exit 1 }
' "${workdir}/SHASUMS256.txt"

printf 'Signature valid; signed manifest matches the recorded archive SHA-256.\n'
