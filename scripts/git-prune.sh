#!/usr/bin/env bash
# [SIG-FLD-VAL-001] Declared in posture, amplified in field.
# Robust prune script (macOS/BSD compatible):
# - Prune remote-tracking refs
# - Delete local branches with missing upstream ([gone])
# - Delete local branches fully merged into main/master
set -euo pipefail

# Prune remote-tracking refs
git fetch --prune origin
# Also prune any stale remotes (safe if none)
if command -v git >/dev/null 2>&1; then
  git remote prune origin || true
fi

# Determine primary branch
PRIMARY=main
if git show-ref --verify --quiet refs/heads/main; then
  PRIMARY=main
elif git show-ref --verify --quiet refs/heads/master; then
  PRIMARY=master
fi

# Delete local branches with [gone] upstream (skip primary)
echo "Pruning local branches with missing upstream..."
while IFS= read -r line; do
  name="${line%% *}"
  status="${line#* }"
  if [ "$status" = "[gone]" ] && [ "$name" != "$PRIMARY" ] && [ "$name" != "master" ]; then
    echo " - deleting (gone upstream): $name"
    git branch -D "$name" || true
  fi
done < <(git for-each-ref --format='%(refname:short) %(upstream:trackshort)' refs/heads)

# Delete branches fully merged into primary
echo "Pruning local branches merged into $PRIMARY..."
while IFS= read -r merged; do
  [ -z "$merged" ] && continue
  [ "$merged" = "$PRIMARY" ] && continue
  [ "$merged" = "master" ] && continue
  echo " - deleting (merged): $merged"
  git branch -d "$merged" || true
done < <(git branch --merged "$PRIMARY" | sed 's/^..//')

echo "Prune complete. Current branches:"
git branch -v
