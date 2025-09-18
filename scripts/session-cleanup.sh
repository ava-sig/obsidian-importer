#!/usr/bin/env bash
# [SIG-FLD-VAL-001] Declared in posture, amplified in field.
# Post-merge cleanup ritual for obsidian-importer
# - Ensure PR is merged
# - Switch to main, pull latest, prune
# - Delete local topic branch
# - Prompt for conflict resolution if needed
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install from https://cli.github.com/" >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" = "HEAD" ]; then
  echo "Detached HEAD state is not supported." >&2
  exit 1
fi

# Identify PR associated with current branch (if on topic) or read from arg
BRANCH="${1:-$CURRENT_BRANCH}"

# If we're on main already, try to infer previous branch from reflog
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "On $BRANCH. If you want to delete a topic branch, pass it as an argument:"
  echo "  bash scripts/session-cleanup.sh <topic-branch>"
fi

# Check PR status
if ! gh pr view --head "$BRANCH" --json number >/dev/null 2>&1; then
  echo "No PR found for branch '$BRANCH'. If it was merged and branch auto-deleted by GitHub, continue." >&2
else
  MERGED="$(gh pr view --head "$BRANCH" --json merged -q .merged)"
  STATE="$(gh pr view --head "$BRANCH" --json state -q .state)"
  if [ "$MERGED" != "true" ] && [ "$STATE" != "MERGED" ] && [ "$STATE" != "closed" ]; then
    echo "PR for '$BRANCH' is not merged yet (state=$STATE). Merge it first, then re-run." >&2
    exit 1
  fi
fi

# Switch to main and pull latest
MAIN_BRANCH="main"
if git show-ref --verify --quiet refs/heads/main; then
  MAIN_BRANCH="main"
elif git show-ref --verify --quiet refs/heads/master; then
  MAIN_BRANCH="master"
fi

git checkout "$MAIN_BRANCH"
# Fetch and prune, then pull latest
git fetch --prune origin
git pull --ff-only origin "$MAIN_BRANCH" || {
  echo "Fast-forward pull failed. Attempting rebase..." >&2
  git pull --rebase origin "$MAIN_BRANCH"
}

# Run smoke tests on main (if defined)
echo "Running smoke tests on $MAIN_BRANCH (if available)..."
npm run smoke || true

# Delete local topic branch if it exists
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch -D "$BRANCH" || true
fi

# Optional: also ensure remote branch is gone (in case auto-delete is disabled)
if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "Remote still has branch '$BRANCH'. Deleting at origin..."
  git push origin --delete "$BRANCH" || true
fi

# Sweep: delete any local branches whose upstream is gone
echo "Sweeping local branches with missing upstream..."
for gone in $(git for-each-ref --format='%(refname:short) %(upstream:trackshort)' refs/heads | awk '$2=="[gone]"{print $1}'); do
  case "$gone" in
    main|master) ;; # skip protected
    *) echo " - deleting local branch (upstream gone): $gone"; git branch -D "$gone" || true ;;
  esac
done

# Sweep: delete local branches fully merged into the main branch
echo "Sweeping local branches fully merged into $MAIN_BRANCH..."
for merged in $(git branch --merged "$MAIN_BRANCH" | sed 's/^..//' | grep -v -E "^(main|master)$"); do
  echo " - deleting merged local branch: $merged"
  git branch -d "$merged" || true
done

# Report status
echo "Cleanup complete. You are on '$MAIN_BRANCH' with latest changes."

echo "If you encountered conflicts during rebase or merge, follow docs/CONFLICT-RESOLUTION.md."
