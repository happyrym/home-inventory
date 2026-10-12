#!/bin/sh
is21() { [ -n "$1" ] && [ -x "$1/bin/java" ] && "$1/bin/java" -version 2>&1 | grep -q 'version "21'; }
for c in /opt/homebrew/opt/openjdk@21 /usr/local/opt/openjdk@21 "$(/usr/libexec/java_home -v 21 2>/dev/null)"; do
  if is21 "$c"; then export JAVA_HOME="$c"; export PATH="$c/bin:$PATH"; break; fi
done
exec "$@"
