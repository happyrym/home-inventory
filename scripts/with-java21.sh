#!/bin/sh
if [ -x /usr/libexec/java_home ] && JH=$(/usr/libexec/java_home -v 21 2>/dev/null); then
  export JAVA_HOME="$JH"
elif [ -x /opt/homebrew/opt/openjdk@21/bin/java ]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21
fi
if [ -n "$JAVA_HOME" ]; then export PATH="$JAVA_HOME/bin:$PATH"; fi
exec "$@"
