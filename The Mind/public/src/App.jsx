import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io();

export default function App() {
  const [username, setUsername] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [room, setRoom] = useState(null);
  const [inRoom, setInRoom] = useState(false);
  const [isVotingShuriken, setIsVotingShuriken] = useState(false);
  const [shurikenProposer, setShurikenProposer] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    socket.on('roomJoined', () => { setInRoom(true); setError(''); });
    socket.on('roomUpdate', (updatedRoom) => setRoom(updatedRoom));
    socket.on('errorMsg', (msg) => setError(msg));
    socket.on('shurikenVoteTrigger', ({ proposedBy }) => {
      setShurikenProposer(proposedBy);
      setIsVotingShuriken(true);
    });
    socket.on('shurikenVoteCancelled', () => setIsVotingShuriken(false));
    socket.on('shurikenExecuted', (updatedRoom) => {
      setIsVotingShuriken(false);
      setRoom(updatedRoom);
    });
    return () => {
      ['roomJoined','roomUpdate','errorMsg','shurikenVoteTrigger','shurikenVoteCancelled','shurikenExecuted']
        .forEach(e => socket.off(e));
    };
  }, []);

  const handleCreateRoom = () => {
    if (!username.trim()) return setError('Enter a username to continue.');
    socket.emit('createRoom', { username });
  };

  const handleJoinRoom = () => {
    if (!username.trim() || !roomCodeInput.trim()) return setError('Fill in both fields.');
    socket.emit('joinRoom', { roomCode: roomCodeInput, username });
  };

  const myData = room?.players.find(p => p.id === socket.id);
  const lastPlayed = room?.discardPile[room.discardPile.length - 1];

  /* ─── ENTRY SCREEN ─── */
  if (!inRoom) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0c0c0c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: '1rem',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '400px',
          background: '#111',
          border: '1px solid #222',
          borderRadius: '12px',
          padding: '2.5rem',
        }}>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              letterSpacing: '0.15em',
              color: '#f0f0f0',
              margin: 0,
              textTransform: 'uppercase',
            }}>The Mind</h1>
            <p style={{ color: '#555', fontSize: '0.8rem', marginTop: '0.4rem', letterSpacing: '0.08em' }}>
              Become one. Play in silence.
            </p>
          </div>

          {error && (
            <div style={{
              background: '#1a0f0f',
              border: '1px solid #3a1a1a',
              color: '#cc6666',
              padding: '0.7rem 1rem',
              borderRadius: '6px',
              fontSize: '0.82rem',
              marginBottom: '1.25rem',
            }}>{error}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Your name"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={inputStyle}
            />

            <div style={{ height: '1px', background: '#1e1e1e', margin: '0.25rem 0' }} />

            <button onClick={handleCreateRoom} style={primaryBtnStyle}>
              Create Room
            </button>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Room code"
                value={roomCodeInput}
                onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={handleJoinRoom} style={secondaryBtnStyle}>
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── IN-GAME SCREEN ─── */
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0c0c0c',
      color: '#e8e8e8',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Header HUD */}
      <header style={{
        borderBottom: '1px solid #1c1c1c',
        padding: '0.9rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#0f0f0f',
      }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Room</div>
          <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: '600', letterSpacing: '0.2em', color: '#ccc' }}>
            {room?.code}
          </div>
        </div>

        {room?.gameState !== 'LOBBY' && (
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <StatBlock label="Level" value={`${room?.currentLevel} / ${room?.maxLevels}`} />
            <StatBlock label="Lives" value={room?.lives} dim={room?.lives <= 1} />
            <StatBlock label="Shurikens" value={room?.shurikens} />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        position: 'relative',
      }}>

        {/* Shuriken vote overlay */}
        {isVotingShuriken && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(12,12,12,0.96)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50,
            backdropFilter: 'blur(4px)',
          }}>
            <div style={{
              background: '#111',
              border: '1px solid #2a2a2a',
              borderRadius: '10px',
              padding: '2rem',
              maxWidth: '340px',
              width: '100%',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', color: '#555', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Shuriken Proposed
              </div>
              <p style={{ color: '#bbb', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                <strong style={{ color: '#e8e8e8' }}>{shurikenProposer}</strong> wants to use a shuriken — everyone discards their lowest card.
              </p>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={() => socket.emit('castShurikenVote', false)} style={secondaryBtnStyle}>
                  Refuse
                </button>
                <button onClick={() => socket.emit('castShurikenVote', true)} style={primaryBtnStyle}>
                  Agree
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOBBY */}
        {room?.gameState === 'LOBBY' && (
          <div style={{ textAlign: 'center', width: '100%', maxWidth: '380px' }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', color: '#444', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
              Waiting for players
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
              {room.players.map((p, idx) => (
                <div key={idx} style={{
                  background: '#111',
                  border: '1px solid #1e1e1e',
                  borderRadius: '6px',
                  padding: '0.7rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ color: '#ccc', fontWeight: 500 }}>{p.username}</span>
                  <span style={{ fontSize: '0.7rem', color: '#444', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {idx === 0 ? 'Host' : 'Ready'}
                  </span>
                </div>
              ))}
            </div>
            {room.players.length >= 2 ? (
              <button onClick={() => socket.emit('startGame')} style={primaryBtnStyle}>
                Start Game
              </button>
            ) : (
              <p style={{ fontSize: '0.78rem', color: '#3a3a3a', letterSpacing: '0.05em' }}>
                Waiting for at least one more player...
              </p>
            )}
          </div>
        )}

        {/* SYNC WAITING */}
        {room?.gameState === 'SYNC_WAITING' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', color: '#444', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Level {room?.currentLevel}
              </div>
              <h2 style={{ color: '#888', fontWeight: 400, fontSize: '1rem', margin: 0 }}>Place your hand on the table</h2>
            </div>
            <button
              onClick={() => socket.emit('syncMind')}
              disabled={myData?.synced}
              style={{
                width: '110px', height: '110px',
                borderRadius: '50%',
                border: myData?.synced ? '2px solid #3a5a3a' : '2px solid #2a2a2a',
                background: myData?.synced ? '#0f1f0f' : '#111',
                color: myData?.synced ? '#4a8a4a' : '#888',
                fontWeight: 600,
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: myData?.synced ? 'default' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {myData?.synced ? 'Synced' : 'Tap to sync'}
            </button>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {room.players.map((p, idx) => (
                <span key={idx} style={{
                  padding: '0.3rem 0.7rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  border: p.synced ? '1px solid #2a4a2a' : '1px solid #1e1e1e',
                  background: p.synced ? '#0d1a0d' : 'transparent',
                  color: p.synced ? '#4a8a4a' : '#444',
                }}>
                  {p.username} {p.synced ? '·' : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* BLUNDER */}
        {room?.gameState === 'BLUNDER' && (
          <div style={{
            textAlign: 'center',
            maxWidth: '340px',
            width: '100%',
            background: '#111',
            border: '1px solid #2a1a1a',
            borderRadius: '10px',
            padding: '2.5rem 2rem',
          }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: '#663333', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Blunder
            </div>
            <h2 style={{ color: '#cc5555', fontWeight: 600, fontSize: '1.3rem', margin: '0 0 1rem' }}>Out of order</h2>
            <p style={{ color: '#666', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Lower cards were held back. <span style={{ color: '#999' }}>{lastPlayed?.playedBy}</span> played <span style={{ color: '#cc6666', fontWeight: 600 }}>{lastPlayed?.card}</span>.
            </p>
            <button onClick={() => socket.emit('acknowledgeBlunder')} style={primaryBtnStyle}>
              Continue
            </button>
          </div>
        )}

        {/* ACTIVE */}
        {room?.gameState === 'ACTIVE' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
            {/* Discard pile / last card */}
            <div style={{
              width: '130px', height: '180px',
              background: '#111',
              border: '1px solid #222',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {lastPlayed ? (
                <>
                  <span style={{ fontSize: '3.5rem', fontWeight: '700', color: '#f0f0f0', lineHeight: 1 }}>
                    {lastPlayed.card}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#444', letterSpacing: '0.08em', marginTop: '0.4rem', textTransform: 'uppercase' }}>
                    {lastPlayed.playedBy}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.7rem', color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Empty
                </span>
              )}
            </div>

            {room.shurikens > 0 && (
              <button onClick={() => socket.emit('proposeShuriken')} style={{
                ...secondaryBtnStyle,
                fontSize: '0.78rem',
                padding: '0.5rem 1.2rem',
              }}>
                Propose Shuriken ({room.shurikens} left)
              </button>
            )}
          </div>
        )}

        {/* GAME OVER */}
        {room?.gameState === 'GAMEOVER' && (
          <div style={{ textAlign: 'center', maxWidth: '300px' }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: '#444', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Game over
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#555', margin: '0 0 0.75rem' }}>Disconnected</h2>
            <p style={{ color: '#3a3a3a', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              The connection broke. Your minds drifted apart.
            </p>
            <button onClick={() => window.location.reload()} style={primaryBtnStyle}>
              Return to Menu
            </button>
          </div>
        )}

        {/* VICTORY */}
        {room?.gameState === 'VICTORY' && (
          <div style={{ textAlign: 'center', maxWidth: '300px' }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: '#3a5a3a', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Victory
            </div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#6aaa6a', margin: '0 0 0.75rem', letterSpacing: '0.05em' }}>One Mind</h2>
            <p style={{ color: '#555', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Perfect harmony. Every card, perfectly timed.
            </p>
            <button onClick={() => window.location.reload()} style={primaryBtnStyle}>
              Play Again
            </button>
          </div>
        )}
      </main>

      {/* Footer — player hand + opponents */}
      {room && room.gameState !== 'LOBBY' && (
        <footer style={{
          borderTop: '1px solid #1c1c1c',
          padding: '1.25rem 1.5rem',
          background: '#0f0f0f',
        }}>
          <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            {/* Opponents */}
            <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '2px' }}>
              {room.players.map((p, idx) => (
                <div key={idx} style={{
                  background: p.id === socket.id ? '#131a13' : '#111',
                  border: p.id === socket.id ? '1px solid #2a3a2a' : '1px solid #1e1e1e',
                  borderRadius: '6px',
                  padding: '0.5rem 0.85rem',
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#aaa' }}>
                    {p.username}{p.id === socket.id ? ' (you)' : ''}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#3a3a3a', marginTop: '1px' }}>
                    {p.hand.length} card{p.hand.length !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* My hand */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '2px', alignItems: 'flex-end' }}>
              {myData?.hand.map((card, idx) => (
                <button
                  key={idx}
                  disabled={room.gameState !== 'ACTIVE'}
                  onClick={() => socket.emit('playCard', card)}
                  style={{
                    width: '52px',
                    height: '72px',
                    flexShrink: 0,
                    borderRadius: '7px',
                    fontWeight: '700',
                    fontSize: '1.2rem',
                    border: room.gameState === 'ACTIVE' ? '1px solid #e8e8e8' : '1px solid #2a2a2a',
                    background: room.gameState === 'ACTIVE' ? '#f0f0f0' : '#161616',
                    color: room.gameState === 'ACTIVE' ? '#111' : '#333',
                    cursor: room.gameState === 'ACTIVE' ? 'pointer' : 'default',
                    transition: 'transform 0.15s',
                    transform: 'translateY(0)',
                  }}
                  onMouseEnter={e => { if (room.gameState === 'ACTIVE') e.target.style.transform = 'translateY(-8px)'; }}
                  onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; }}
                >
                  {card}
                </button>
              ))}
              {myData?.hand.length === 0 && room.gameState === 'ACTIVE' && (
                <span style={{ fontSize: '0.75rem', color: '#333', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Hand cleared
                </span>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

/* ─── Shared style tokens ─── */
const inputStyle = {
  width: '100%',
  background: '#0c0c0c',
  border: '1px solid #222',
  borderRadius: '6px',
  padding: '0.7rem 0.9rem',
  color: '#e8e8e8',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const primaryBtnStyle = {
  width: '100%',
  background: '#e8e8e8',
  color: '#111',
  border: 'none',
  borderRadius: '6px',
  padding: '0.75rem 1rem',
  fontWeight: '600',
  fontSize: '0.88rem',
  cursor: 'pointer',
  letterSpacing: '0.03em',
  transition: 'background 0.15s',
  fontFamily: 'inherit',
};

const secondaryBtnStyle = {
  width: '100%',
  background: 'transparent',
  color: '#888',
  border: '1px solid #2a2a2a',
  borderRadius: '6px',
  padding: '0.75rem 1rem',
  fontWeight: '500',
  fontSize: '0.88rem',
  cursor: 'pointer',
  letterSpacing: '0.03em',
  transition: 'border-color 0.15s, color 0.15s',
  fontFamily: 'inherit',
};

function StatBlock({ label, value, dim }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: '#3a3a3a', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: '600', color: dim ? '#883333' : '#bbb' }}>{value}</div>
    </div>
  );
}
