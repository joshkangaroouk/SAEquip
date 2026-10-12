#!/usr/bin/env bash
# PreToolUse/Bash guard: refuse commands that destroy database contents.
#
# ⚠️ Heredoc bodies are stripped before matching ONLY when nothing executes
# them. The first version matched the raw command string, so it blocked the
# very commit whose message explained the incident — and then blocked the
# command that would have replaced it. A guard that cannot be written about is
# one people route around. So a body read by cat/tee/git commit is prose and
# ignored.
#
# ⚠️ But a body fed to bash, sh, node, python, psql… RUNS, and skipping those
# let a destructive command through (fixed 2026-10-12, with three more gaps:
# a `<<<` here-string or a `$((1<<X))` shift was taken for a heredoc opener,
# so every line after it went unchecked; and `prisma@<version>` slipped past
# the pattern). Cases live in backend/scripts/script-guards-test.ts — edit
# this file and re-run them rather than loosening the pattern.
set -uo pipefail

cmd=$(jq -r '.tool_input.command // ""')

# Print every line that runs: each shell line, plus the body of any heredoc
# whose line also names an interpreter.
runnable=$(printf '%s\n' "$cmd" | awk '
  inhd {
    if ($0 ~ "^[[:space:]]*" delim "[[:space:]]*$") { inhd = 0; next }
    if (execbody) print
    next
  }
  {
    print
    probe = $0
    # Neither of these is a heredoc: an arithmetic shift, and a here-string.
    gsub(/\$\(\([^)]*\)\)/, "", probe)
    gsub(/<<</, "", probe)
    if (match(probe, /<<-?[[:space:]]*["'"'"']?[A-Za-z_][A-Za-z0-9_]*["'"'"']?/)) {
      d = substr(probe, RSTART, RLENGTH)
      gsub(/^<<-?[[:space:]]*/, "", d)
      gsub(/["'"'"']/, "", d)
      delim = d; inhd = 1
      execbody = (probe ~ /(^|[|;&(`[:space:]])(bash|sh|zsh|dash|ksh|node|deno|bun|python|python3|ruby|perl|psql|tsx|npx|eval|source|xargs)([[:space:]]|$)/)
    }
  }
')

# Assembled so this file can describe what it blocks without blocking itself.
PAT="shadow-database-url|prisma(@[^[:space:]]+)?[[:space:]]+migrate[[:space:]]+re""set|prisma(@[^[:space:]]+)?[[:space:]]+db[[:space:]]+pu""sh"

if printf '%s\n' "$runnable" | grep -qiE "$PAT"; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: (
        "BLOCKED by project policy: this command destroys database contents.\n\n" +
        "The shadow-database flag WIPES whatever database you hand it - Prisma drops\n" +
        "and recreates a shadow database by design. Pointing it at DIRECT_URL emptied\n" +
        "all 19 production tables on 2026-09-29 and lost 7 customer quote requests\n" +
        "permanently. The reset and push subcommands are destructive for the same reason.\n\n" +
        "Use the documented flow instead (see CLAUDE.md, Prisma migrations):\n" +
        "  migrate diff --from-schema-datasource prisma/schema.prisma --script\n" +
        "  migrate deploy\n" +
        "Neither needs a shadow database.\n\n" +
        "Note: heredoc bodies read by cat/tee/git are ignored, so documenting these\n" +
        "commands is fine - this fired on a line that would actually run, or on a\n" +
        "heredoc fed to an interpreter."
      )
    }
  }'
fi
exit 0
