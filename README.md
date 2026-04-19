# WXATA 🟢⛓️

WXATA is a high-performance WhatsApp bot platform built with **Baileys** and powered by **Bun**. Designed for speed, reliability, and extensibility, it allows you to run interactive games, code-based utilities, and advanced chat automations on a VPS.

## 🚀 Features

- **High Performance**: Powered by the Bun runtime for minimal latency.
- **Robust Auth**: Reliable session management and multi-device support via Baileys.
- **Modular Design**: Easy-to-expand command and game modules.
- **Cyberpunk UI**: A sleek black and green "Coming Soon" frontend built with React and Framer Motion.
- **VPS Ready**: Optimized for 24/7 background operation.

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **WhatsApp Library**: [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
- **Frontend**: Vite, React, Tailwind CSS, Framer Motion
- **Language**: TypeScript

## � Project Structure

```text
WXATA/
├── frontend/        # React + Vite "Coming Soon" page
├── backend/         # WhatsApp bot logic (Baileys + Bun)
├── BOTPLAN.md       # Technical roadmap and features
└── README.md        # Project documentation
```

## 🚦 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed on your system.

### Installation

1. Clone the repository.
2. Install dependencies for both frontend and backend:
   ```bash
   # Install frontend deps
   cd frontend
   bun install

   # Install backend deps
   cd ../backend
   bun install
   ```

### Running the Project

- **Frontend**: `cd frontend && bun dev`
- **Backend**: `cd backend && bun start`

## 📝 Roadmap

- [x] Initial Plan & Design
- [x] "Coming Soon" Frontend
- [ ] Backend Authentication Flow
- [ ] Command Handler System
- [ ] Interactive Game Modules
- [ ] Production Deployment Guide

---
*Built with 💚 by TADS Tech*
