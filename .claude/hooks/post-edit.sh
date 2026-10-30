#!/usr/bin/env bash
# gliplog: PostToolUse feedback after Edit and Write. Registered in .claude/settings.json.
# Never edits files; a failed check returns decision=block so the reason reaches Claude.
set -u
command -v jq >/dev/null 2>&1 || exit 0
payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$file" ] && [ -f "$file" ] || exit 0
root=${CLAUDE_PROJECT_DIR:-$(pwd)}
rel=${file#"$root"/}
EM=$(printf '\xe2\x80\x94')

block() {
  jq -n --arg r "$1" '{decision: "block", reason: $r}'
  exit 0
}

case "$rel" in
  *.md)
    lines=$(grep -nF "$EM" "$file" | grep -vF 'em-dash-ok' | cut -d: -f1 | head -5 | paste -sd, -)
    [ -z "$lines" ] || block "em-dash in $rel (lines $lines); replace it with a colon, comma, semicolon, or parentheses."
    ;;
  src/*.ts|src/*.vue|tests/*.ts|e2e/*.ts)
    if [ -x "$root/node_modules/.bin/eslint" ] && command -v node >/dev/null 2>&1; then
      out=$(cd "$root" && node_modules/.bin/eslint --max-warnings 0 "$file" 2>&1) || block "eslint $rel failed:
$(printf '%s' "$out" | head -20)"
    fi
    ;;
  src/data/*.json)
    if [ -x "$root/node_modules/.bin/vitest" ]; then
      out=$(cd "$root" && node_modules/.bin/vitest run tests/data 2>&1) || block "catalog tests failed after editing $rel:
$(printf '%s' "$out" | tail -25)"
    fi
    ;;
  src/styles/tokens.css)
    out=$(cd "$root" && node scripts/check-contrast.mjs 2>&1) || block "contrast check failed:
$out"
    ;;
esac
exit 0
