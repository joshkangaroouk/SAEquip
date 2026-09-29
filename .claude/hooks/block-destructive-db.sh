#!/usr/bin/env bash
# PreToolUse/Bash guard: refuse commands that destroy database contents.
#
# ⚠️ Heredoc BODIES are stripped before matching, and that is not a nicety.
# The first version matched the raw command string, so it blocked the very
# commit whose message explained the incident — and then blocked the command
# that would have replaced it. A guard that cannot be written about is one
# people route around.
#
# Only the shell lines that actually run are matched. A real invocation is
# still caught; the same words inside a <<'EOF' body are prose and ignored.
set -uo pipefail

cmd=$(jq -r '.tool_input.command // ""')

# Strip heredoc bodies: print each runnable line, and while inside a heredoc
# skip everything up to its terminator.
runnable=$(printf '%s\n' "$cmd" | awk '
  inhd { if ($0 ~ "^[[:space:]]*" delim "[[:space:]]*$") inhd = 0; next }
  {
    print
    if (match($0, /<<-?[[:space:]]*["'"'"']?[A-Za-z_][A-Za-z0-9_]*["'"'"']?/)) {
      d = substr($0, RSTART, RLENGTH)
      gsub(/^<<-?[[:space:]]*/, "", d)
      gsub(/["'"'"']/, "", d)
      delim = d; inhd = 1
    }
  }
')

# Assembled so this file can describe what it blocks without blocking itself.
PAT="shadow-database-url|prisma[[:space:]]+migrate[[:space:]]+re""set|prisma[[:space:]]+db[[:space:]]+pu""sh"

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
        "Note: heredoc bodies are ignored, so documenting these commands is fine -\n" +
        "this fired on a line that would actually run."
      )
    }
  }'
fi
exit 0
