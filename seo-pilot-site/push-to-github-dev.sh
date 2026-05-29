#!/usr/bin/env bash
# ============================================================================
# push-to-github-dev.sh
# Mirrors the FULL local working state to the `dev` branch of
# Admin0TSP/the-seo-pilot-site, excluding .env files and build noise.
#
# Unlike push-to-github.sh (which selectively copies named files to `main`),
# this script syncs everything in your local seo-pilot-site/ folder to dev,
# so dev always reflects what's actually on your machine.
#
# Run this from your Mac terminal:
#   bash /Users/shipsy/Downloads/seo-pilot-site/seo-pilot-site/push-to-github-dev.sh
#
# Optional — customize the commit message:
#   COMMIT_MSG="Add 3 new GEO blogs + refresh playbook" \
#     bash push-to-github-dev.sh
#
# What it does:
#   1. Clones the remote repo into ~/Downloads/the-seo-pilot-site-clone
#      (or refreshes the existing clone if already there)
#   2. Checks out the `dev` branch (creates it from `main` if it doesn't
#      exist on the remote yet)
#   3. Rsyncs the entire local seo-pilot-site/ folder to the clone's
#      seo-pilot-site/ folder, with --delete so anything removed locally
#      is also removed on dev. EXCLUDES:
#        - .env         (your live secrets — never pushed)
#        - .env.local, .env.production, etc — anything matching .env.*
#          EXCEPT .env.example, which IS pushed as a template
#        - node_modules/, .git/, *.log
#        - .DS_Store (Mac filesystem noise)
#        - content/.indexing-queue.jsonl (runtime state, not source)
#   4. Commits + pushes to origin/dev.
#
# Prereqs: git installed, authenticated to GitHub for this repo
#   (gh auth login OR an SSH key OR an HTTPS PAT cached via osxkeychain),
#   rsync (ships with macOS by default).
# ============================================================================

set -euo pipefail

LOCAL_SITE="/Users/shipsy/Downloads/seo-pilot-site/seo-pilot-site"
CLONE_DIR="$HOME/Downloads/the-seo-pilot-site-clone"
REPO_URL="https://github.com/Admin0TSP/the-seo-pilot-site.git"
BRANCH="dev"
DEFAULT_BASE_BRANCH="main"
COMMIT_MSG="${COMMIT_MSG:-Sync local working state to dev}"

# ---------------------------------------------------------------------------
# 1. Clone (or refresh) the remote repo locally
# ---------------------------------------------------------------------------

if [ -d "$CLONE_DIR/.git" ]; then
  echo "==> Clone exists at $CLONE_DIR — fetching latest from origin"
  git -C "$CLONE_DIR" fetch origin --prune
else
  echo "==> Cloning $REPO_URL into $CLONE_DIR"
  git clone "$REPO_URL" "$CLONE_DIR"
fi

cd "$CLONE_DIR"

# Stash any uncommitted local changes in the clone to avoid surprises
if [ -n "$(git status --porcelain)" ]; then
  echo "==> Stashing uncommitted changes in clone (auto-stash before sync)"
  git stash push -u -m "auto-stash before dev sync $(date +%s)" || true
fi

# ---------------------------------------------------------------------------
# 2. Check out (or create) the dev branch
# ---------------------------------------------------------------------------

if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "==> '$BRANCH' branch exists on remote — checking out"
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git checkout "$BRANCH"
  else
    git checkout -b "$BRANCH" "origin/$BRANCH"
  fi
  git pull --ff-only origin "$BRANCH" || true
else
  echo "==> '$BRANCH' branch does NOT exist on remote — creating from '$DEFAULT_BASE_BRANCH'"
  git checkout "$DEFAULT_BASE_BRANCH"
  git pull --ff-only origin "$DEFAULT_BASE_BRANCH"
  git checkout -b "$BRANCH"
fi

DEST="$CLONE_DIR/seo-pilot-site"
mkdir -p "$DEST"

# ---------------------------------------------------------------------------
# 3. Rsync local -> clone, mirror mode, with sensible excludes
#
# Order of rules matters in rsync: the FIRST matching --include / --exclude
# wins. Placing --include='.env.example' before --exclude='.env*' ensures
# the example template survives the exclude.
# ---------------------------------------------------------------------------

echo ""
echo "==> Syncing $LOCAL_SITE/ -> $DEST/"
echo "    Excluding: .env (and .env.* except .env.example), node_modules/,"
echo "               .git/, .DS_Store, *.log, content/.indexing-queue.jsonl*"
echo ""

rsync -av --delete \
  --include='.env.example' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='node_modules' \
  --exclude='node_modules/' \
  --exclude='.git' \
  --exclude='.git/' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  --exclude='content/.indexing-queue.jsonl' \
  --exclude='content/.indexing-queue.jsonl.tmp' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='.vscode' \
  --exclude='.idea' \
  "$LOCAL_SITE/" "$DEST/"

# ---------------------------------------------------------------------------
# 4. Show what's about to land
# ---------------------------------------------------------------------------

echo ""
echo "==> Status (first 60 lines):"
git -C "$CLONE_DIR" status seo-pilot-site/ | head -60
echo ""
echo "==> Diff stat (last 30 lines):"
git -C "$CLONE_DIR" --no-pager diff --stat -- seo-pilot-site/ | tail -30 || true

# ---------------------------------------------------------------------------
# 5. Stage, commit, push
# ---------------------------------------------------------------------------

echo ""
echo "==> Staging seo-pilot-site/"
git -C "$CLONE_DIR" add -A seo-pilot-site/

# Bail gracefully if nothing changed
if git -C "$CLONE_DIR" diff --cached --quiet; then
  echo "    Nothing to commit — '$BRANCH' is already in sync with local."
  exit 0
fi

echo "==> Committing: $COMMIT_MSG"
git -C "$CLONE_DIR" commit -m "$COMMIT_MSG"

echo ""
echo "==> Pushing to origin/$BRANCH"
git -C "$CLONE_DIR" push -u origin "$BRANCH"

echo ""
echo "==> Done. View on GitHub:"
echo "    https://github.com/Admin0TSP/the-seo-pilot-site/tree/$BRANCH/seo-pilot-site"
echo ""
echo "Tip: when ready to merge dev -> main, open a PR at"
echo "    https://github.com/Admin0TSP/the-seo-pilot-site/compare/main...$BRANCH"
