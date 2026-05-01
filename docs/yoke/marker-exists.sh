#!/usr/bin/env bash
# marker-exists.sh
#
# Usage: marker-exists.sh <path>
#
# Exits 0 if the marker file exists. Exits 1 otherwise. Used by gate phases
# to check whether the human has approved the gate by dropping the marker.
#
# In feature.yml, gate-a's `post:` runs this against `docs/plan.approved`.
# The phase is a no-op Claude session that ends; the post check fails until
# the human creates the marker file (e.g. `touch docs/plan.approved` from
# the dashboard's resume action). Yoke's retry_ladder then walks to
# awaiting_user and pauses until the human resumes.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <marker-path>" >&2
  exit 2
fi

if [[ -f "$1" ]]; then
  exit 0
else
  echo "marker not present: $1" >&2
  exit 1
fi
