#!/bin/sh
# Weaver Server Startup Script
# Downloads the server JAR if missing and starts it with java
#
# Usage:
#   Interactive:  ./weaver_server.sh
#   With args:    ./weaver_server.sh [PORT] [VERSION]
#                 ./weaver_server.sh 9090 3.22.0
#                 ./weaver_server.sh 9090
#                 ./weaver_server.sh latest (uses default port 8080)
#   One-liner:    curl -sSL https://raw.githubusercontent.com/Weaver-oss/Weaver/main/weaver_server.sh | sh
#   With args:    curl ... | sh -s -- 9090 3.22.0

# Check for Java and version 21+
if ! command -v java >/dev/null 2>&1; then
  echo "Error: Java is not installed or not in PATH"
  exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | sed -E 's/.*"([0-9]+).*/\1/')
if [ -z "$JAVA_VERSION" ] || [ "$JAVA_VERSION" -lt 21 ] 2>/dev/null; then
  echo "Error: JDK 21 or higher is required. Current version: $(java -version 2>&1 | head -n 1)"
  exit 1
fi

# Defaults
SERVER_PORT=8080
WEAVER_VERSION="latest"
REPO_URL="https://weaver-server.s3.us-east-2.amazonaws.com"

# Argument parsing: check if args are port numbers or versions
for arg in "$@"; do
  if echo "$arg" | grep -q "^[0-9][0-9]*$"; then
    SERVER_PORT="$arg"
  else
    WEAVER_VERSION="$arg"
  fi
done

# If running interactively and no args provided, prompt user
if [ $# -eq 0 ] && [ -z "$WEAVER_PORT" ] && [ -t 0 ]; then
  printf "Enter the port for Server [8080]: "
  read input_port </dev/tty
  if [ -n "$input_port" ]; then
    SERVER_PORT="$input_port"
  fi

  printf "Enter the version [latest]: "
  read input_version </dev/tty
  if [ -n "$input_version" ]; then
    WEAVER_VERSION="$input_version"
  fi
elif [ -n "$WEAVER_PORT" ] && [ $# -eq 0 ]; then
    SERVER_PORT="$WEAVER_PORT"
fi

JAR_NAME="weaver-server-${WEAVER_VERSION}.jar"
JAR_URL="${REPO_URL}/${JAR_NAME}"

# Use Weaver_HOME if set, otherwise use ~/.Weaver-cli (avoids polluting the project directory)
if [ -z "$Weaver_HOME" ]; then
  Weaver_HOME="${HOME}/.Weaver-cli"
fi

JAR_PATH="$Weaver_HOME/$JAR_NAME"

# Download JAR if not present
if [ ! -f "$JAR_PATH" ]; then
  echo "First run: downloading Weaver Server JAR to $Weaver_HOME (large file, may take a few minutes)"
  mkdir -p "$Weaver_HOME"
  curl -L --progress-bar -o "$JAR_PATH" "$JAR_URL"
  if [ $? -ne 0 ]; then
    echo "Failed to download Weaver Server JAR from $JAR_URL"
    exit 1
  fi
  echo "Downloaded to $JAR_PATH"
fi

echo "Starting Weaver Server ${WEAVER_VERSION} on port $SERVER_PORT..."
java -jar "$JAR_PATH" --server.port=$SERVER_PORT