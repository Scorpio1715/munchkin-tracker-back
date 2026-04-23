import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
const DEFAULT_ICON = 'shield-halved';
const MAX_PLAYERS = 6;
const MAX_HISTORY = 100;

interface Player {
  id: string;
  name: string;
  color: string;
  icon: string;
  level: number;
  bonus: number;
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  playerName: string;
  playerColor: string;
  playerIcon: string;
  message: string;
}

interface Game {
  id: string;
  code: string;
  players: Player[];
  history: HistoryEntry[];
  createdAt: number;
}

const games = new Map<string, Game>();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getUniqueCode(): string {
  let code = generateCode();
  while (games.has(code)) code = generateCode();
  return code;
}

function pushHistory(game: Game, player: Player | null, message: string): HistoryEntry {
  const entry: HistoryEntry = {
    id: uuidv4(),
    timestamp: Date.now(),
    playerName: player?.name ?? '',
    playerColor: player?.color ?? '',
    playerIcon: player?.icon ?? '',
    message,
  };
  game.history.unshift(entry);
  if (game.history.length > MAX_HISTORY) game.history.pop();
  return entry;
}

setInterval(() => {
  const cutoff = Date.now() - 12 * 60 * 60 * 1000;
  for (const [code, game] of games.entries()) {
    if (game.createdAt < cutoff) games.delete(code);
  }
}, 60 * 60 * 1000);

app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });

app.post('/api/games', (_req, res) => {
  const code = getUniqueCode();
  const game: Game = { id: uuidv4(), code, players: [], history: [], createdAt: Date.now() };
  games.set(code, game);
  res.json({ code });
});

app.get('/api/games/:code', (req, res) => {
  const game = games.get(req.params.code.toUpperCase());
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
  res.json(game);
});

io.on('connection', (socket: Socket) => {
  let currentCode: string | null = null;

  socket.on('join-game', (code: string, callback: (data: { success: boolean; game?: Game; error?: string }) => void) => {
    const upper = code.toUpperCase();
    const game = games.get(upper);
    if (!game) { callback({ success: false, error: 'Partida no encontrada' }); return; }
    if (currentCode) socket.leave(currentCode);
    currentCode = upper;
    socket.join(upper);
    callback({ success: true, game });
  });

  socket.on('add-player', (data: { name: string; icon?: string }) => {
    if (!currentCode) return;
    const game = games.get(currentCode);
    if (!game || game.players.length >= MAX_PLAYERS) return;

    const idx = game.players.length;
    const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
    const icon = (data.icon ?? DEFAULT_ICON).replace(/[^a-z0-9-]/g, '').slice(0, 40);
    const player: Player = { id: uuidv4(), name: data.name.trim().slice(0, 20), color, icon, level: 1, bonus: 0 };

    game.players.push(player);
    const entry = pushHistory(game, player, 'se unió a la partida');
    io.to(currentCode).emit('player-added', player);
    io.to(currentCode).emit('history-entry', entry);
  });

  socket.on('update-player', (data: { playerId: string; level?: number; bonus?: number }) => {
    if (!currentCode) return;
    const game = games.get(currentCode);
    if (!game) return;
    const player = game.players.find((p) => p.id === data.playerId);
    if (!player) return;

    let message = '';

    if (data.level !== undefined) {
      const prev = player.level;
      player.level = Math.max(1, Math.min(10, data.level));
      if (player.level !== prev) {
        const arrow = player.level > prev ? '⬆' : '⬇';
        message = `${arrow} nivel ${prev} → ${player.level}`;
        if (player.level === 10) message += ' 👑 ¡Gana si mata un monstruo!';
      }
    }

    if (data.bonus !== undefined) {
      const prev = player.bonus;
      player.bonus = Math.max(0, data.bonus);
      if (player.bonus !== prev) {
        const diff = player.bonus - prev;
        message = diff > 0
          ? `+${diff} bonus de combate (total: ${player.bonus})`
          : `${diff} bonus de combate (total: ${player.bonus})`;
      }
    }

    io.to(currentCode).emit('player-updated', player);

    if (message) {
      const entry = pushHistory(game, player, message);
      io.to(currentCode).emit('history-entry', entry);
    }
  });

  socket.on('remove-player', (playerId: string) => {
    if (!currentCode) return;
    const game = games.get(currentCode);
    if (!game) return;
    const player = game.players.find((p) => p.id === playerId);
    if (player) {
      const entry = pushHistory(game, player, 'fue eliminado de la partida');
      io.to(currentCode).emit('history-entry', entry);
    }
    game.players = game.players.filter((p) => p.id !== playerId);
    io.to(currentCode).emit('player-removed', playerId);
  });

  socket.on('reset-game', () => {
    if (!currentCode) return;
    const game = games.get(currentCode);
    if (!game) return;
    game.players.forEach((p) => { p.level = 1; p.bonus = 0; });
    const entry = pushHistory(game, null, '🔄 La partida fue reiniciada');
    io.to(currentCode).emit('game-reset', game.players);
    io.to(currentCode).emit('history-entry', entry);
  });
});

const PORT = process.env.PORT ?? 3000;
httpServer.listen(PORT, () => {
  console.log(`Munchkin Tracker backend running on port ${PORT}`);
});
