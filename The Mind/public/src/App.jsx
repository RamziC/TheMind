import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io(); // Automatically binds to host address securely

export default function App() {
  const [username, setUsername] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [room, setRoom] = useState(null);
  const [inRoom, setInRoom] = useState(false);
  const [isVotingShuriken, setIsVotingShuriken] = useState(false);
  const [shurikenProposer, setShurikenProposer] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    socket.on('roomJoined', ({ roomCode }) => {
      setInRoom(true);
      setError('');
    });

    socket.on('roomUpdate', (updatedRoom) => {
      setRoom(updatedRoom);
    });

    socket.on('errorMsg', (msg) => {
      setError(msg);
    });

    socket.on('shurikenVoteTrigger', ({ proposedBy }) => {
      setShurikenProposer(proposedBy);
      setIsVotingShuriken(true);
    });

    socket.on('shurikenVoteCancelled', () => {
      setIsVotingShuriken(false);
    });

    socket.on('shurikenExecuted', (updatedRoom) => {
      setIsVotingShuriken(false);
      setRoom(updatedRoom);
    });

    return () => {
      socket.off('roomJoined');
      socket.off('roomUpdate');
      socket.off('errorMsg');
      socket.off('shurikenVoteTrigger');
      socket.off('shurikenVoteCancelled');
      socket.off('shurikenExecuted');
    };
  }, []);

  const handleCreateRoom = () => {
    if (!username.trim()) return setError('Please enter a username.');
    socket.emit('createRoom', { username });
  };

  const handleJoinRoom = () => {
    if (!username.trim() || !roomCodeInput.trim()) return setError('Fill out all fields.');
    socket.emit('joinRoom', { roomCode: roomCodeInput, username });
  };

  const myData = room?.players.find(p => p.id === socket.id);
  const lastPlayed = room?.discardPile[room.discardPile.length - 1];

  if (!inRoom) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-center mb-2 bg-gradient-to-r from-teal-400 to-indigo-500 bg-clip-text text-transparent">THE MIND</h1>
          <p className="text-zinc-400 text-center text-sm mb-6">Become one mind. Ascending order. Ultimate silence.</p>
          
          {error && <div className="bg-red-950 border border-red-800 text-red-400 p-3 rounded-lg text-sm mb-4">{error}</div>}

          <div className="space-y-4">
            <input 
              type="text" placeholder="Your Username" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-teal-500 transition"
            />
            <hr className="border-zinc-800 my-4" />
            <button onClick={handleCreateRoom} className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-zinc-950 font-bold py-3 rounded-xl transition shadow-lg">
              Create New Table
            </button>
            <div className="flex gap-2">
              <input 
                type="text" placeholder="Room Code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                className="w-2/3 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
              />
              <button onClick={handleJoinRoom} className="w-1/3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold py-3 rounded-xl transition border border-zinc-700">
                Join Table
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between font-sans selection:bg-teal-500 selection:text-black">
      {/* Top HUD Display */}
      <header className="bg-zinc-900/60 border-b border-zinc-900 p-4 backdrop-blur-md flex justify-between items-center px-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">Room Code</span>
          <span className="text-lg font-mono font-bold tracking-widest text-teal-400">{room?.code}</span>
        </div>
        {room?.gameState !== 'LOBBY' && (
          <div className="flex gap-8 items-center text-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">Level</span>
              <span className="text-xl font-bold text-zinc-100">{room?.currentLevel} <span className="text-xs text-zinc-500">/ {room?.maxLevels}</span></span>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">Lives</span>
              <span className="text-xl font-bold text-red-500">{'❤️'.repeat(room.lives)}</span>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">Shurikens</span>
              <span className="text-xl font-bold text-amber-400">{'⭐'.repeat(room.shurikens)}</span>
            </div>
          </div>
        )}
      </header>

      {/* Main Table Interface */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col items-center justify-center relative">
        
        {/* Shuriken Decision Overlay */}
        {isVotingShuriken && (
          <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl space-y-6">
              <h3 className="text-xl font-bold text-amber-400 flex flex-col items-center gap-2">
                <span className="text-3xl animate-spin">⭐</span> Shuriken Proposed!
              </h3>
              <p className="text-zinc-300 text-sm">{shurikenProposer} wants to sacrifice a Shuriken to throw down everyone's lowest card. Do you agree?</p>
              <div className="flex gap-3">
                <button onClick={() => socket.emit('castShurikenVote', false)} className="w-1/2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl font-medium transition">Refuse</button>
                <button onClick={() => socket.emit('castShurikenVote', true)} className="w-1/2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 py-3 rounded-xl font-bold transition shadow-lg">Agree</button>
              </div>
            </div>
          </div>
        )}

        {room?.gameState === 'LOBBY' && (
          <div className="text-center max-w-md w-full space-y-6 bg-zinc-900/40 p-8 border border-zinc-900 rounded-2xl">
            <h2 className="text-xl font-bold text-zinc-300">Gathering Minds</h2>
            <div className="space-y-2 text-left">
              {room.players.map((p, idx) => (
                <div key={idx} className="bg-zinc-950 border border-zinc-800/60 p-3 rounded-xl flex justify-between items-center">
                  <span className="font-medium text-zinc-300">{p.username}</span>
                  <span className="text-xs px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">{idx === 0 ? 'Host' : 'Ready'}</span>
                </div>
              ))}
            </div>
            {room.players.length >= 2 ? (
              <button onClick={() => socket.emit('startGame')} className="w-full bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 text-zinc-950 font-extrabold py-4 rounded-xl shadow-xl transform active:scale-95 transition">
                Initiate Connection
              </button>
            ) : (
              <p className="text-xs text-zinc-500 animate-pulse">Waiting for at least one more player to connect...</p>
            )}
          </div>
        )}

        {room?.gameState === 'SYNC_WAITING' && (
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-400">Place your hand on the table to sync...</h2>
            <button 
              onClick={() => socket.emit('syncMind')}
              disabled={myData?.synced}
              className={`w-32 h-32 rounded-full border-4 font-bold text-sm tracking-wide shadow-2xl transform transition active:scale-95 duration-300 ${
                myData?.synced 
                  ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 animate-pulse'
                  : 'bg-zinc-900 border-zinc-700 hover:border-teal-500 text-zinc-300'
              }`}
            >
              {myData?.synced ? 'SYNCED' : 'TAP TO SYNC'}
            </button>
            <div className="flex gap-3 justify-center">
              {room.players.map((p, idx) => (
                <span key={idx} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${p.synced ? 'bg-emerald-950 border-emerald-800 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                  {p.username} {p.synced ? '✓' : '...'}
                </span>
              ))}
            </div>
          </div>
        )}

        {room?.gameState === 'BLUNDER' && (
          <div className="text-center space-y-6 max-w-sm bg-zinc-900 border border-red-900/60 p-8 rounded-2xl shadow-2xl shadow-red-950/20">
            <h2 className="text-3xl font-black tracking-tight text-red-500 animate-bounce">BLUNDER!</h2>
            <p className="text-zinc-400 text-sm">Someone misjudged the stream of time. Lower cards were forced out of players' hands.</p>
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xl text-zinc-200">
              Disrupting Move: <span className="text-red-400 font-bold">{lastPlayed?.card}</span> by {lastPlayed?.playedBy}
            </div>
            <button onClick={() => socket.emit('acknowledgeBlunder')} className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold py-3 rounded-xl transition">
              Acknowledge & Re-align
            </button>
          </div>
        )}

        {room?.gameState === 'ACTIVE' && (
          <div className="w-full flex flex-col items-center space-y-12">
            {/* The Active Center Pile Card */}
            <div className="w-48 h-64 bg-zinc-900 border-2 border-teal-500/30 rounded-2xl flex flex-col items-center justify-center relative shadow-2xl shadow-teal-950/10">
              <div className="absolute inset-2 border border-zinc-800/40 rounded-xl pointer-events-none"></div>
              {lastPlayed ? (
                <>
                  <span className="text-6xl font-black tracking-tighter text-zinc-100 mb-1">{lastPlayed.card}</span>
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Played by {lastPlayed.playedBy}</span>
                </>
              ) : (
                <span className="text-sm tracking-widest uppercase font-bold text-zinc-600 animate-pulse">Empty Table</span>
              )}
            </div>

            {/* Actions Panel */}
            {room.shurikens > 0 && (
              <button onClick={() => socket.emit('proposeShuriken')} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-400 font-bold px-5 py-2.5 rounded-xl text-sm transition tracking-wide flex items-center gap-2 shadow-md">
                ⭐ Propose Shuriken Reveal
              </button>
            )}
          </div>
        )}

        {room?.gameState === 'GAMEOVER' && (
          <div className="text-center space-y-4 max-w-sm">
            <h2 className="text-5xl font-black text-zinc-600 tracking-tight">DISCONNECTED</h2>
            <p className="text-zinc-400 text-sm">Connection broken. You completely desynchronized from the timeline.</p>
            <button onClick={() => window.location.reload()} className="bg-zinc-100 text-zinc-950 font-bold px-6 py-3 rounded-xl transition hover:bg-zinc-200">Return to Menu</button>
          </div>
        )}

        {room?.gameState === 'VICTORY' && (
          <div className="text-center space-y-4 max-w-sm">
            <h2 className="text-5xl font-black text-teal-400 tracking-tight bg-gradient-to-r from-teal-400 to-indigo-400 bg-clip-text text-transparent animate-pulse">ONE MIND</h2>
            <p className="text-zinc-400 text-sm">Incredible. Your collective timing achieved absolute harmony.</p>
            <button onClick={() => window.location.reload()} className="bg-zinc-100 text-zinc-950 font-bold px-6 py-3 rounded-xl transition hover:bg-zinc-200">Play Again</button>
          </div>
        )}
      </main>

      {/* Player Dashboard Bottom Tray */}
      {room && room.gameState !== 'LOBBY' && (
        <footer className="bg-zinc-900/30 border-t border-zinc-900/80 p-6 backdrop-blur-md">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            
            {/* Tracking opponents card counts */}
            <div className="flex gap-4 overflow-x-auto max-w-full py-1">
              {room.players.map((p, idx) => (
                <div key={idx} className={`px-4 py-2 rounded-xl bg-zinc-900 border ${p.id === socket.id ? 'border-teal-500/20 bg-teal-950/5' : 'border-zinc-800'} flex items-center gap-3 shrink-0`}>
                  <div className="text-left">
                    <span className="text-sm font-semibold text-zinc-300 block">{p.username} {p.id === socket.id && '(You)'}</span>
                    <span className="text-xs text-zinc-500">{p.hand.length} cards remaining</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Current Player Hand Control Zone */}
            <div className="flex items-center gap-2 max-w-full overflow-x-auto py-2">
              {myData?.hand.map((card, idx) => (
                <button
                  key={idx}
                  disabled={room.gameState !== 'ACTIVE'}
                  onClick={() => socket.emit('playCard', card)}
                  className={`w-14 h-20 rounded-xl font-bold text-lg flex items-center justify-center border shadow-md transform transition-all relative group shrink-0 ${
                    room.gameState === 'ACTIVE'
                      ? 'bg-zinc-100 text-zinc-950 border-white hover:-translate-y-3 cursor-pointer hover:shadow-teal-500/20 hover:shadow-xl'
                      : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                  }`}
                >
                  {card}
                </button>
              ))}
              {myData?.hand.length === 0 && room.gameState === 'ACTIVE' && (
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 animate-pulse bg-zinc-900/60 px-4 py-2.5 rounded-xl border border-zinc-800">Hand Cleared</span>
              )}
            </div>

          </div>
        </footer>
      )}
    </div>
  );
}
