#!/bin/bash
set -euo pipefail

export NODE_ENV="${NODE_ENV:-production}"

exec node --enable-source-maps artifacts/api-server/dist/index.mjs
