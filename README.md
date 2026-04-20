# WXATA 🟢🚧

WXATA is a high-performance WhatsApp bot platform built with **Baileys** and powered by **Bun**. Designed for speed, reliability, and extensibility, it allows you to run interactive games, code-based utilities, and advanced chat automations on a VPS.

## 🚀 Features

- **High Performance**: Powered by the Bun runtime for minimal latency.
- **Robust Auth**: Reliable session management and multi-device support via Baileys.
- **Dynamic Configuration**: otinfo.json acts as a hot-reloadable schema for commands, permissions, and routing.
- **Access Control**: Built-in permission modules allowing per-chat, global, or per-number script invocation.
- **React Dashboard**: Configure arguments, commands, and target overrides via a rich web interface.
- **VPS Ready**: Optimized for 24/7 background operation.

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **WhatsApp Library**: [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
- **Frontend**: Vite, React, Tailwind CSS, Framer Motion
- **Language**: TypeScript

## 📁 Project Structure

`	ext
WXATA/
├── frontend/        # React + Vite visual dashboard interface
├── backend/         # WhatsApp bot core (Baileys + Bun)
├── BOTPLAN.md       # Technical roadmap and features
├── botinfo.json     # Dynamic operational state and script registry
├── deployment.md    # Guide for deploying for free
└── README.md        # Project documentation
`

## 🚦 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed on your system.

### Installation

1. Clone the repository.
2. Install dependencies for both frontend and backend:
   `ash
   # Install frontend deps
   cd frontend
   bun install

   # Install backend deps
   cd ../backend
   bun install
   `

### Running the Project

- **Frontend**: cd frontend && bun run dev
- **Backend**: cd backend && bun run start

## 📈 Roadmap

- [x] Initial Plan & Design
- [x] React Dashboard
- [x] Backend Configuration Flow
- [x] Command Handler System
- [x] Authorization & Permission System
- [x] Production Deployment Guide
- [ ] User Account System / Firebase Integration
- [ ] Interactive Game Modules

---
*Built with 💚 by TADS Tech*
