#!/usr/bin/env bash
# WXATA Setup Script (Bash)
# Run this after cloning the repository

set -e

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║        WXATA Setup Script            ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "[!] Bun is not installed."
    echo "    Install it from: https://bun.sh"
    echo "    Or run: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "[1/4] Creating .env from template..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "      Created .env — edit it with your settings"
else
    echo "      .env already exists, skipping"
fi

echo "[2/4] Creating botinfo.json from template..."
if [ ! -f botinfo.json ]; then
    cp botinfo.example.json botinfo.json
    echo "      Created botinfo.json"
else
    echo "      botinfo.json already exists, skipping"
fi

echo "[3/4] Creating primary/secondary config directories..."
mkdir -p primary secondary

if [ ! -f primary/botinfo.json ]; then
    cp botinfo.example.json primary/botinfo.json
    echo "      Created primary/botinfo.json"
fi

if [ ! -f secondary/botinfo.json ]; then
    cp botinfo.example.json secondary/botinfo.json
    echo "      Created secondary/botinfo.json"
fi

echo "[4/4] Installing dependencies..."
bun run install:all

echo ""
echo "  ✓ Setup complete!"
echo ""
echo "  Next steps:"
echo "    1. Edit .env with your configuration"
echo "    2. Edit botinfo.json to customize commands"
echo "    3. Run: bun run all"
echo ""
echo "  Dashboard: http://localhost:5173"
echo "  Backend:   ws://localhost:5000"
echo ""
