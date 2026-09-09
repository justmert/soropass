#!/bin/bash
# runlog.sh: run a command, append timestamp + command + complete output to agent-log.md, echo output.
# Usage: ./runlog.sh '<command string>'
WD="<workdir>"
LOG="$WD/agent-log.md"
CMD="$1"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
OUT="$(mktemp "$WD/.out.XXXXXX")"
cd "$WD" || exit 1
bash -c "$CMD" >"$OUT" 2>&1
RC=$?
LINES=$(wc -l <"$OUT" | tr -d ' ')
{
  echo ""
  echo "## $TS"
  echo ""
  echo '```'
  echo "\$ $CMD"
  echo '```'
  echo ""
  echo "exit code: $RC"
  echo ""
  if [ "$LINES" -gt 300 ]; then
    echo "Output was $LINES lines; showing the first 150 and last 150 lines."
    echo ""
    echo '```'
    head -n 150 "$OUT"
    echo "[... $((LINES-300)) lines omitted ...]"
    tail -n 150 "$OUT"
    echo '```'
  else
    echo '```'
    cat "$OUT"
    echo '```'
  fi
} >>"$LOG"
cat "$OUT"
rm -f "$OUT"
exit $RC
