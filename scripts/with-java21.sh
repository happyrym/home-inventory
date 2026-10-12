#!/bin/sh
# firebase-tools 15+ 에뮬레이터는 JDK 21이 필요하지만 전역 Java(Android 빌드용 17)는 바꾸지 않는다.
# /usr/libexec/java_home -v 21 은 21이 없어도 기본 JVM을 exit 0으로 돌려주므로 버전 문자열을 직접 확인한다.
is21() { [ -n "$1" ] && [ -x "$1/bin/java" ] && "$1/bin/java" -version 2>&1 | grep -q 'version "21'; }
for c in /opt/homebrew/opt/openjdk@21 /usr/local/opt/openjdk@21 "$(/usr/libexec/java_home -v 21 2>/dev/null)"; do
  if is21 "$c"; then export JAVA_HOME="$c"; export PATH="$c/bin:$PATH"; break; fi
done
exec "$@"
