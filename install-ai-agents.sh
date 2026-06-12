#!/usr/bin/env bash

# Secure Boltdocs AI Skill Installer
# Supported editors/environments: Cursor, Claude, Copilot, Agents (Gemini)

set -euo pipefail

# ANSI color codes
RC='\033[0m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
DIM='\033[2m'

# Default values
TARGET=""
OUTPUT_DIR=""
YES_MODE=false
GITHUB_RAW="https://raw.githubusercontent.com/jesus-alcala/boltdocs/develop/skills/boltdocs"
LOCAL_SRC="skills/boltdocs"

# Print banner
show_banner() {
  echo -e "${CYAN}"
  echo "   ██████╗  ██████╗ ██╗  ████████╗██████╗  ██████╗  ██████╗███████╗"
  echo "   ██╔══██╗██╔═══██╗██║  ╚══██╔══╝██╔══██╗██╔═══██╗██╔════╝██╔════╝"
  echo "   ██████╔╝██║   ██║██║     ██║   ██║  ██║██║   ██║██║     ███████╗"
  echo "   ██╔══██╗██║   ██║██║     ██║   ██║  ██║██║   ██║██║     ╚════██║"
  echo "   ██████╔╝╚██████╔╝███████╗██║   ██████╔╝╚██████╔╝╚██████╗███████║"
  echo "   ╚══════╝  ╚═════╝ ╚══════╝╚═╝   ╚═════╝  ╚═════╝  ╚═════╝╚══════╝"
  echo -e "${RC}"
  echo -e "  ${DIM}⚡ Boltdocs AI Agent & Skills Installer${RC}\n"
}

# Print help message
show_help() {
  echo "Usage: $0 [options]"
  echo
  echo "Options:"
  echo "  -t, --target <name>      Target platform: cursor, claude, copilot, agents, all"
  echo "  -o, --output-dir <path>  Override default destination directory"
  echo "  -y, --yes                Automatic yes to prompts (non-interactive mode)"
  echo "  -h, --help               Display this help message"
  echo
  echo "Platforms:"
  echo "  cursor     Install to .cursor/skills/boltdocs/"
  echo "  claude     Install to .claude/skills/boltdocs/"
  echo "  copilot    Install to .copilot/skills/boltdocs/"
  echo "  agents     Install to .agents/skills/boltdocs/"
  echo "  all        Install to all of the above"
}

# Parse options
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--target)
      TARGET="${2:-}"
      shift 2
      ;;
    -o|--output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    -y|--yes)
      YES_MODE=true
      shift
      ;;
    -h|--help)
      show_banner
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${RC}"
      show_help
      exit 1
      ;;
  esac
done

# Clear target inputs
if [ -n "$TARGET" ]; then
  TARGET=$(echo "$TARGET" | tr '[:upper:]' '[:lower:]')
  if [[ "$TARGET" != "cursor" && "$TARGET" != "claude" && "$TARGET" != "copilot" && "$TARGET" != "agents" && "$TARGET" != "all" ]]; then
    echo -e "${RED}Invalid target: $TARGET${RC}"
    show_help
    exit 1
  fi
fi

# Ensure commands exist
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}Error: required tool '$1' is not installed.${RC}" >&2
    exit 1
  fi
}

check_command mkdir
check_command cp

# Interactive setup
if [ -z "$TARGET" ]; then
  show_banner
  echo -e "${YELLOW}Which AI environment do you want to configure?${RC}"
  echo "  1) Cursor (.cursor/skills/boltdocs/)"
  echo "  2) Claude (.claude/skills/boltdocs/)"
  echo "  3) Copilot (.copilot/skills/boltdocs/)"
  echo "  4) AI Agents/Gemini (.agents/skills/boltdocs/)"
  echo "  5) All of the above"
  echo
  read -rp "Select option [1-5]: " OPTION
  case "$OPTION" in
    1) TARGET="cursor" ;;
    2) TARGET="claude" ;;
    3) TARGET="copilot" ;;
    4) TARGET="agents" ;;
    5) TARGET="all" ;;
    *) echo -e "${RED}Invalid option selected.${RC}"; exit 1 ;;
  esac
fi

# Resolve source files
TEMP_DIR=""
cleanup() {
  if [ -n "${TEMP_DIR:-}" ] && [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi
}
trap cleanup EXIT

resolve_sources() {
  # If local workspace folder exists, use it
  if [ -d "$LOCAL_SRC" ] && [ -f "$LOCAL_SRC/SKILL.md" ]; then
    echo -e "${GREEN}Using local skill sources...${RC}"
    SRC_DIR="$LOCAL_SRC"
  else
    # Standalone fetch mode (fetch files via curl)
    check_command curl
    echo -e "${YELLOW}Local skill sources not found. Fetching from Github...${RC}"
    TEMP_DIR=$(mktemp -d)
    
    mkdir -p "$TEMP_DIR/references"
    
    local files=(
      "SKILL.md"
      "references/configuration.md"
      "references/routing.md"
      "references/components.md"
      "references/styling.md"
    )
    
    for file in "${files[@]}"; do
      echo -e "${DIM}Downloading $file...${RC}"
      curl -fsSL "$GITHUB_RAW/$file" -o "$TEMP_DIR/$file" || {
        echo -e "${RED}Failed to download $file${RC}"
        exit 1
      }
    done
    SRC_DIR="$TEMP_DIR"
  fi
}

install_to_dir() {
  local target_path="$1"
  echo -e "${YELLOW}Installing to: $target_path...${RC}"
  mkdir -p "$target_path/references"
  cp -r "$SRC_DIR/SKILL.md" "$target_path/SKILL.md"
  cp -r "$SRC_DIR/references/"* "$target_path/references/"
  echo -e "${GREEN}✔ Installed successfully at $target_path!${RC}"
}

# Run resolutions
resolve_sources

# Install targets
if [[ "$TARGET" == "cursor" || "$TARGET" == "all" ]]; then
  DIR=${OUTPUT_DIR:-.cursor/skills/boltdocs}
  install_to_dir "$DIR"
fi

if [[ "$TARGET" == "claude" || "$TARGET" == "all" ]]; then
  DIR=${OUTPUT_DIR:-.claude/skills/boltdocs}
  install_to_dir "$DIR"
fi

if [[ "$TARGET" == "copilot" || "$TARGET" == "all" ]]; then
  DIR=${OUTPUT_DIR:-.copilot/skills/boltdocs}
  install_to_dir "$DIR"
fi

if [[ "$TARGET" == "agents" || "$TARGET" == "all" ]]; then
  DIR=${OUTPUT_DIR:-.agents/skills/boltdocs}
  install_to_dir "$DIR"
fi

echo -e "\n${GREEN}✨ Boltdocs AI Agent Skills configuration complete! ✨${RC}"
