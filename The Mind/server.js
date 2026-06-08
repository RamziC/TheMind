import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// Serve compiled static assets from React production build
app.use(express.static(path.join(__dirname, 'public', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dist', 'index.html'));
});

// In-Memory Game Rooms Store
const rooms = {}; 

function getMaxLevels(playerCount) {
  if (playerCount <= 2) return 12;
  if (playerCount === 3) return 10;
  return 8;
}

function generateDeck() {
  return Array.from({ length: 100 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
}

function startLevel(room) {
  room.gameState = 'SYNC_WAITING';
  room.discardPile = [];
  room.syncStatus = {};
  room.shurikenVotes = {};
  
  const deck = generateDeck();
  room.players.forEach(p => {
    p.hand = deck.splice(0, room.currentLevel).sort((a, b) => a - b);
    p.synced = false;
  });
}

function checkLevelCompletion(room) {
  const totalCardsLeft = room.players.reduce((sum, p) => sum + p.hand.length, 0);
  if (totalCardsLeft === 0) {
    // Process Rewards
    if ([2, 5, 8].includes(room.currentLevel)) room.shurikens = Math.min(3, room.shurikens + 1);
    if ([3, 6, 9].includes(room.currentLevel)) room.lives = Math.min(5, room.lives + 1);

    if (room.currentLevel >= room.maxLevels) {
      room.gameState = 'VICTORY';
    } else {
      room.currentLevel += 1;
      startLevel(room);
    }
  }
}

io.on('connection', (socket) => {
  let currentRoomCode = null;
  let playerUsername = null;

  socket.on('createRoom', ({ username }) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    currentRoomCode = roomCode;
    playerUsername = username;

    rooms[roomCode] = {
      code: roomCode,
      gameState: 'LOBBY', // LOBBY, SYNC_WAITING, ACTIVE, BLUNDER, GAMEOVER, VICTORY
      currentLevel: 1,
      maxLevels: 12,
      lives: 2,
      shurikens: 1,
      discardPile: [],
      players: [{ id: socket.id, username, hand: [], synced: false }],
      shurikenVotes: {}
    };

    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: true });
    io.to(roomCode).emit('roomUpdate', rooms[roomCode]);
  });

  socket.on('joinRoom', ({ roomCode, username }) => {
    const room = rooms[roomCode.toUpperCase()];
    if (!room) return socket.emit('errorMsg', 'Room not found.');
    if (room.gameState !== 'LOBBY') return socket.emit('errorMsg', 'Game already in progress.');

    currentRoomCode = roomCode.toUpperCase();
    playerUsername = username;

    room.players.push({ id: socket.id, username, hand: [], synced: false });
    socket.join(currentRoomCode);
    socket.emit('roomJoined', { roomCode: currentRoomCode, isHost: false });
    io.to(currentRoomCode).emit('roomUpdate', room);
  });

  socket.on('startGame', () => {
    const room = rooms[currentRoomCode];
    if (!room || room.players.length < 2) return;

    room.lives = room.players.length;
    room.maxLevels = getMaxLevels(room.players.length);
    room.currentLevel = 1;
    room.shurikens = 1;
    
    startLevel(room);
    io.to(currentRoomCode).emit('roomUpdate', room);
  });

  socket.on('syncMind', () => {
    const room = rooms[currentRoomCode];
    if (!room || room.gameState !== 'SYNC_WAITING') return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) player.synced = true;

    const allSynced = room.players.every(p => p.synced);
    if (allSynced) {
      room.gameState = 'ACTIVE';
    }
    io.to(currentRoomCode).emit('roomUpdate', room);
  });

  socket.on('playCard', (cardValue) => {
    const room = rooms[currentRoomCode];
    if (!room || room.gameState !== 'ACTIVE') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.hand.includes(cardValue)) return;

    // Core Global Minimum Validation Logic
    const allRemainingCards = room.players.flatMap(p => p.hand);
    const globalMin = Math.min(...allRemainingCards);

    if (cardValue === globalMin) {
      // Valid Play
      player.hand = player.hand.filter(c => c !== cardValue);
      room.discardPile.push({ card: cardValue, playedBy: player.username });
      checkLevelCompletion(room);
    } else {
      // Blunder Detected
      room.gameState = 'BLUNDER';
      room.lives -= 1;
      room.discardPile.push({ card: cardValue, playedBy: player.username, blunder: true });

      // Penalty Sweeping: Force discard lower cards
      room.players.forEach(p => {
        const lowerCards = p.hand.filter(c => c < cardValue);
        lowerCards.forEach(lc => {
          room.discardPile.push({ card: lc, playedBy: p.username, penalty: true });
        });
        p.hand = p.hand.filter(c => c >= cardValue);
      });
      
      // Remove the played card from its owner's hand
      player.hand = player.hand.filter(c => c !== cardValue);

      if (room.lives <= 0) {
        room.gameState = 'GAMEOVER';
      }
    }
    io.to(currentRoomCode).emit('roomUpdate', room);
  });

  socket.on('acknowledgeBlunder', () => {
    const room = rooms[currentRoomCode];
    if (!room || room.gameState !== 'BLUNDER') return;

    room.gameState = 'SYNC_WAITING';
    room.players.forEach(p => p.synced = false);
    checkLevelCompletion(room);
    io.to(currentRoomCode).emit('roomUpdate', room);
  });

  socket.on('proposeShuriken', () => {
    const room = rooms[currentRoomCode];
    if (!room || room.shurikens <= 0 || room.gameState !== 'ACTIVE') return;

    room.shurikenVotes = { [socket.id]: true };
    io.to(currentRoomCode).emit('shurikenVoteTrigger', { proposedBy: playerUsername });
  });

  socket.on('castShurikenVote', (vote) => {
    const room = rooms[currentRoomCode];
    if (!room || !room.shurikenVotes) return;

    room.shurikenVotes[socket.id] = vote;
    const voteValues = Object.values(room.shurikenVotes);

    if (vote === false) {
      room.shurikenVotes = {};
      io.to(currentRoomCode).emit('shurikenVoteCancelled');
      return;
    }

    if (voteValues.length === room.players.length && voteValues.every(v => v === true)) {
      room.shurikens -= 1;
      room.shurikenVotes = {};
      
      // Every player sheds lowest card
      room.players.forEach(p => {
        if (p.hand.length > 0) {
          const lowest = p.hand.shift();
          room.discardPile.push({ card: lowest, playedBy: p.username, shurikenReveal: true });
        }
      });

      checkLevelCompletion(room);
      io.to(currentRoomCode).emit('shurikenExecuted', room);
    }
  });

  socket.on('disconnect', () => {
    const room = rooms[currentRoomCode];
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[currentRoomCode];
      } else {
        io.to(currentRoomCode).emit('roomUpdate', room);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`The Mind running safely on port ${PORT}`);
});
