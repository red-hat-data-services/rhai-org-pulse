#!/usr/bin/env bash
#
# Restore team-tracker data from an S3 backup.
#
# Prerequisites:
#   - oc CLI logged into the cluster
#   - aws CLI configured (or use rh-aws-saml-login wrapper)
#
# Usage:
#   ./scripts/restore-backup.sh                  # list available backups
#   ./scripts/restore-backup.sh <s3-key>         # restore a specific backup
#
# The script downloads the backup locally, copies it into the backend pod,
# and extracts it over the data directory.

set -euo pipefail

NAMESPACE="${NAMESPACE:-ambient-code--team-tracker}"
BUCKET="${BUCKET:-org-pulse-data-backups}"
PREFIX="team-tracker/"
AWS_CMD="${AWS_CMD:-aws}"

if [ $# -eq 0 ]; then
  echo "Available backups (newest first):"
  echo ""
  $AWS_CMD s3 ls "s3://${BUCKET}/${PREFIX}" --region us-east-1 | sort -r | head -20
  echo ""
  echo "Usage: $0 <filename>"
  echo "Example: $0 team-tracker/backup-2026-05-11T06-00-00.tar.gz"
  exit 0
fi

KEY="$1"
TMPFILE=$(mktemp /tmp/restore-XXXXXX.tar.gz)
trap 'rm -f "$TMPFILE"' EXIT

echo "==> Downloading s3://${BUCKET}/${KEY} ..."
$AWS_CMD s3 cp "s3://${BUCKET}/${KEY}" "$TMPFILE" --region us-east-1

echo "==> Finding backend pod ..."
POD=$(oc get pods -n "$NAMESPACE" -l app=team-tracker,component=backend -o jsonpath='{.items[0].metadata.name}')
echo "    Pod: $POD"

echo "==> Copying archive to pod ..."
oc cp "$TMPFILE" "${NAMESPACE}/${POD}:/tmp/restore.tar.gz"

echo "==> Extracting over /app/data ..."
oc exec -n "$NAMESPACE" "$POD" -- tar xzf /tmp/restore.tar.gz -C /app

echo "==> Cleaning up temp file in pod ..."
oc exec -n "$NAMESPACE" "$POD" -- rm -f /tmp/restore.tar.gz

echo "==> Restore complete. You may want to restart the backend pod:"
echo "    oc rollout restart deployment/backend -n $NAMESPACE"
