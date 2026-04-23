# ⚔️ Munchkin Tracker — Backend

> API en tiempo real para sincronizar el estado de las partidas de **Munchkin** entre dispositivos.

Built with **Node.js + Express + Socket.io** · Deployed on **Render**

---

## ✨ Funcionalidades

- 🎮 Gestión de partidas con código de 6 caracteres
- 👥 Hasta 6 jugadores por partida
- ⚡ Sincronización en tiempo real vía **WebSockets**
- 🧹 Limpieza automática de partidas con más de 12 horas de antigüedad

---

## 🛠️ Stack

| | |
|---|---|
| Runtime | Node.js |
| Framework | Express |
| Tiempo real | Socket.io |
| Lenguaje | TypeScript |
| Estado | In-memory (por partida) |
| Deploy | Render |

---

## 🚀 Arrancar en local

```bash
# Instalar dependencias
npm install

# Arrancar en modo desarrollo con hot-reload (http://localhost:3000)
npm run dev
```

---

## 📦 Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Desarrollo con hot-reload (ts-node-dev) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm run start` | Arranca el build de producción |

---

## 🔌 API

### REST

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/games` | Crea una nueva partida, devuelve `{ code }` |
| `GET` | `/api/games/:code` | Obtiene el estado de una partida |
| `GET` | `/health` | Health check |

### Socket.io events

**Cliente → Servidor**

| Evento | Payload | Descripción |
|---|---|---|
| `join-game` | `code` | Unirse a una partida |
| `add-player` | `{ name, icon }` | Añadir jugador |
| `update-player` | `{ playerId, level?, bonus? }` | Actualizar nivel o bonus |
| `remove-player` | `playerId` | Eliminar jugador |
| `reset-game` | — | Reiniciar todos a nivel 1 |

**Servidor → Cliente**

| Evento | Payload | Descripción |
|---|---|---|
| `player-added` | `Player` | Nuevo jugador añadido |
| `player-updated` | `Player` | Jugador actualizado |
| `player-removed` | `playerId` | Jugador eliminado |
| `game-reset` | `Player[]` | Estado tras reinicio |

---

## 🗂️ Estructura

```
src/
└── index.ts    # Servidor Express + lógica Socket.io
```

---

## 🌍 Despliegue en Render

1. New → Web Service → conecta el repo
2. Configura:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
3. Deploy
