#!/usr/bin/env bash
# [SIG-FLD-VAL-001] Declared in posture, amplified in field.
# End-of-coding-session ritual for obsidian-importer
# - Run all tests
# - Verify (lint + build)
# - Push topic branch
# - Create PR to main with prefilled body using gh CLI
set -euo pipefail

# Ensure gh is installed
if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install from https://cli.github.com/" >&2
  exit 1
fi

# Ensure clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has uncommitted changes. Commit or stash before ending session." >&2
  exit 1
fi

echo "Running tests..."
npm test -- --run

# Verify project builds and lints
echo "Verifying project (lint + build)..."
npm run -s verify

# Optionally run governance checks locally if available
if [ -d "gorvernance/obsidian-importer" ] || [ -d "governance/obsidian-importer" ] || [ -n "${GOV_PATH:-}" ]; then
  echo "Running local governance checks..."
  GOV_PATH="${GOV_PATH:-gorvernance/obsidian-importer}" \
  REQUIRE_GOV=0 \
  npm run -s ci:pr || true
  GOV_PATH="${GOV_PATH:-gorvernance/obsidian-importer}" \
  REQUIRE_GOV=0 \
  npm run -s validate:links || true
  GOV_PATH="${GOV_PATH:-gorvernance/obsidian-importer}" \
  REQUIRE_GOV=0 \
  npm run -s perf:budgets || true
  GOV_PATH="${GOV_PATH:-gorvernance/obsidian-importer}" \
  REQUIRE_GOV=0 \
  npm run -s fixtures:redact || true
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" = "HEAD" ]; then
  echo "Detached HEAD state is not supported." >&2
  exit 1
fi
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "End-session must run on a topic branch, not on $BRANCH." >&2
  exit 1
fi

# Push branch (set upstream if needed)
if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  git push
else
  git push -u origin "$BRANCH"
fi

# Compute PR title
TITLE="$(git log -1 --pretty=%s)"
if [ -z "$TITLE" ]; then
  TITLE="Update: $BRANCH"
fi

# --- PR creation (robust) ---
REPO="${GH_REPO:-ava-sig/obsidian-importer}"
BASE_BRANCH="$(git remote show origin | sed -n 's/  HEAD branch: //p')"
if [ -z "$BASE_BRANCH" ]; then BASE_BRANCH="main"; fi

# Ensure we have the latest refs (pruning is handled in session-cleanup)
git fetch origin

# Ensure upstream is set and push latest commits
if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  git push
else
  git push -u origin "$BRANCH"
fi

# Ensure there is at least one commit ahead of base
AHEAD_COUNT="$(git rev-list --count "origin/${BASE_BRANCH}..HEAD" 2>/dev/null || echo 0)"
if [ "$AHEAD_COUNT" -eq 0 ]; then
  echo "❌ No commits between origin/${BASE_BRANCH} and ${BRANCH}. Aborting PR creation." >&2
  echo "Tip: make sure you committed changes and pushed this branch." >&2
  rm -f "$tmpfile"
  exit 1
fi

# Build dynamic PR body
COMMITS=$(git log --no-decorate --pretty=format:'- %h %s' "origin/${BASE_BRANCH}..HEAD" | sed -e 's/\"/"/g')
FILES_CHANGED=$(git diff --name-status "origin/${BASE_BRANCH}..HEAD" | sed 's/^/- /')
DIFF_TEXT=$(git diff "origin/${BASE_BRANCH}..HEAD")

HAS_DS=$(printf "%s" "$DIFF_TEXT" | grep -E "/v1/data_sources/" >/dev/null && echo 1 || echo 0)
HAS_LEGACY=$(printf "%s" "$DIFF_TEXT" | grep -E "/v1/databases/" >/dev/null && echo 1 || echo 0)
HAS_RETRY=$(printf "%s" "$DIFF_TEXT" | grep -Ei "retry-after|429|5xx|backoff" >/dev/null && echo 1 || echo 0)
HAS_SECRET_TOUCH=$(printf "%s" "$DIFF_TEXT" | grep -Ei "authorization|token|redact" >/dev/null && echo 1 || echo 0)
HAS_ALLOW_LEGACY=$(printf "%s" "$DIFF_TEXT" | grep -E "allowLegacy|downgradeNote" >/dev/null && echo 1 || echo 0)

CONTRACTS=
if [ "$HAS_SECRET_TOUCH" = 1 ]; then CONTRACTS="$CONTRACTS\n  - SIG-SYS-NOT-027 — Secrets & Privacy"; fi
if [ "$HAS_RETRY" = 1 ]; then CONTRACTS="$CONTRACTS\n  - SIG-SYS-NOT-018 — Rate Limit & Retry"; fi
if [ "$HAS_DS" = 1 ] || [ "$HAS_LEGACY" = 1 ]; then CONTRACTS="$CONTRACTS\n  - SIG-SYS-NOT-023 — DS Docs Compliance"; fi
if [ "$HAS_ALLOW_LEGACY" = 1 ]; then CONTRACTS="$CONTRACTS\n  - SIG-SYS-NOT-032 — Back-Compat (downgrade)"; fi
if [ -z "$CONTRACTS" ]; then CONTRACTS="\n  - (none detected)"; fi

GLYPH_HEADER_STATUS="[ ]"
if USE_CACHED=1 npm run -s check:glyph-header >/dev/null 2>&1; then GLYPH_HEADER_STATUS="[x]"; fi

tmpfile="$(mktemp)"
cat > "$tmpfile" <<PR_BODY
# PR Summary

- What change is introduced?
  $(
    # Summarize by first commit subject + key touched areas
    FIRST_SUBJ=$(git log --no-decorate --pretty=format:'%s' -n 1 HEAD | sed -e 's/\"/"/g')
    echo "$FIRST_SUBJ"
    if printf "%s" "$DIFF_TEXT" | grep -q "src/network/notionClient.ts"; then echo "  - Harden Notion client (retries/redirects/guards)"; fi
    if printf "%s" "$DIFF_TEXT" | grep -q "src/formats/notion-"; then echo "  - Scaffold Notion importer modules (convert/schema/bases/utils/types/ui)"; fi
    if printf "%s" "$DIFF_TEXT" | grep -q "__tests__/"; then echo "  - Add/align tests including guideline checks"; fi
  )

- Why is this necessary now?
  $(
    REASONS=""
    [ "$HAS_DS" = 1 ] && REASONS="$REASONS\n  - Align with Data Sources and governance (SIG-SYS-NOT-023)"
    [ "$HAS_RETRY" = 1 ] && REASONS="$REASONS\n  - Improve resilience to 429/5xx with governed retries (SIG-SYS-NOT-018)"
    [ -n "$REASONS" ] || REASONS="\n  - Prepare importer structure for feature work and tests"
    printf "%b" "$REASONS"
  )

- How was this tested?
  $(
    echo "\n  - Unit tests (vitest):"
    echo "    * $(npm run -s test 2>/dev/null | grep -E 'Tests  ' | sed 's/^/    /' || echo 'Local tests passed')"
    echo "  - Governance CI (lint/build enforced pre-checks)"
  )

## Commits
${COMMITS}

## Files Changed
${FILES_CHANGED}

## Governance

- Glyph(s) referenced:
  - SIG-FLD-VAL-001 — Declaration Echoes Return Amplified
- Contracts impacted:
${CONTRACTS}

## Downgrade Notes (if any)

$(
  if [ "$HAS_LEGACY" = 1 ]; then
    cat <<'NOTE'
If using a legacy or less-preferred path (e.g., Notion legacy DB API instead of Data Sources), explain:
- Reason for downgrade:
- Scope and duration:
- Mitigations and plan to restore alignment:
NOTE
  else
    echo "(none)"
  fi
)

## Checklist

- ${GLYPH_HEADER_STATUS} New/changed source files include the glyph header on the first lines
- [x] Tests run locally (see session-end output)
- [ ] Governance checks will pass in CI

PR_BODY

# Create PR using gh (pre-filled body modeled after template)
# If PR already exists, this will error; ignore with || true then print status
if ! gh pr create --repo "$REPO" --base "$BASE_BRANCH" --head "$BRANCH" --title "$TITLE" --body-file "$tmpfile"; then
  echo "PR may already exist or repo not set. Status:" >&2
  gh pr status --repo "$REPO" || true
fi

rm -f "$tmpfile"

# Show created PR URL
if gh pr view --repo "$REPO" --json url >/dev/null 2>&1; then
  gh pr view --repo "$REPO" --json url -q .url
fi

echo "End-of-session ritual complete. Review PR checks in GitHub."
echo "When CI is green, merge with: gh pr merge --squash --delete-branch"
