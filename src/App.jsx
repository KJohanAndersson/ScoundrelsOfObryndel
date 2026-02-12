import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';

export default function ObryndelGame() {
  const [screen, setScreen] = useState('main');
  const [playerCount, setPlayerCount] = useState(2);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [scannedCards, setScannedCards] = useState([]);
  const [act, setAct] = useState(1);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [qrData, setQrData] = useState('');
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const availableCharacters = ['Goblin', 'Troll', 'Cyclops', 'Witch'];
  
  // QR scanning setup
  useEffect(() => {
    let animationId;
    
    const startCamera = async () => {
      if (screen === 'game' && videoRef.current) {
        try {
          setCameraError('');
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          scanQRCode();
        } catch (err) {
          console.error('Camera error:', err);
          if (err.name === 'NotAllowedError') {
            setCameraError('Camera permission denied. Please allow camera access and refresh.');
          } else if (err.name === 'NotFoundError') {
            setCameraError('No camera found on this device.');
          } else if (err.name === 'NotSupportedError') {
            setCameraError('Camera requires HTTPS. Deploy to Vercel to use camera.');
          } else {
            setCameraError('Camera error: ' + err.message);
          }
        }
      }
    };

    const scanQRCode = () => {
      if (!videoRef.current || !canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');
      
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code && code.data.startsWith('Tile-')) {
          if (!scannedCards.includes(code.data)) {
            setQrData(code.data);
            setScannedCards(prev => [...prev, code.data]);
          }
        }
      }
      
      animationId = requestAnimationFrame(scanQRCode);
    };

    if (screen === 'game') {
      startCamera();
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [screen, scannedCards]);

  // Check for act transitions
  useEffect(() => {
    if (scannedCards.length === 5 && act === 1) {
      setAct(2);
    } else if (scannedCards.length === 10 && act === 2) {
      setAct(3);
    }
  }, [scannedCards, act]);

  const tileEvents = {
    'Tile-001': 'The world shifts beneath your feet.',
    'Tile-002': "You're all cursed and must cleanse yourselves in water.",
    'Tile-003': 'A mystical barrier blocks your path. Find the key to proceed.',
    'Tile-004': 'Ancient runes glow with power. One player gains an extra action point.',
    'Tile-005': 'The ground trembles. Everyone loses one action point this turn.',
    'Tile-006': 'A healing spring appears. All players restore vitality.',
    'Tile-007': 'Shadow creatures emerge from the darkness.',
    'Tile-008': 'A merchant appears offering mysterious items.',
    'Tile-009': 'The path splits. Choose your direction wisely.',
    'Tile-010': 'Thunder crashes. The barrier weakens nearby.',
    'Tile-011': 'A friendly spirit offers guidance.',
    'Tile-012': 'Poisonous gas fills the air. Move quickly!',
    'Tile-013': 'You discover an ancient artifact.',
    'Tile-014': 'The temperature drops. Ice forms around you.',
    'Tile-015': 'A puzzle door blocks the way forward.',
    'Tile-016': 'Wild magic surges through the area.',
    'Tile-017': 'You find a hidden cache of supplies.',
    'Tile-018': 'The spirits of Obryndel cry out in anguish.',
    'Tile-019': 'A powerful guardian stands in your way.',
    'Tile-020': 'The barrier fragment pulses with energy.',
    'Tile-021': 'Illusions cloud your vision.',
    'Tile-022': 'A safe haven appears. Rest and recover.',
    'Tile-023': 'The path behind you crumbles away.',
    'Tile-024': 'You hear Baron Thobrick\'s laughter echoing.',
    'Tile-025': 'A rift in time opens before you.',
    'Tile-026': 'The Ogre Shrine beckons in the distance.',
    'Tile-027': 'Twisted creatures guard the fragment.',
    'Tile-028': 'Reality warps around the barrier piece.',
    'Tile-029': 'You feel the pull of the shrine growing stronger.',
    'Tile-030': 'The final fragment reveals itself!',
  };

  const handleExitClick = () => {
    setShowExitWarning(true);
  };

  const confirmExit = () => {
    setScreen('main');
    setShowExitWarning(false);
    setPlayerCount(2);
    setCurrentPlayer(0);
    setCharacters([]);
    setScannedCards([]);
    setAct(1);
    setQrData('');
  };

  const selectCharacter = (character) => {
    const newCharacters = [...characters];
    newCharacters[currentPlayer] = character;
    setCharacters(newCharacters);
    
    if (currentPlayer < playerCount - 1) {
      setCurrentPlayer(currentPlayer + 1);
    }
  };

  const nextPlayer = () => {
    setCurrentPlayer((currentPlayer + 1) % playerCount);
  };

  const ExitButton = () => (
    <button 
      onClick={handleExitClick}
      style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        width: '40px',
        height: '40px',
        background: 'rgba(139, 69, 19, 0.8)',
        border: '2px solid #8B4513',
        borderRadius: '50%',
        color: '#F4E4C1',
        fontSize: '24px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        zIndex: 1000,
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.target.style.background = 'rgba(139, 69, 19, 1)';
        e.target.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.target.style.background = 'rgba(139, 69, 19, 0.8)';
        e.target.style.transform = 'scale(1)';
      }}
    >
      ×
    </button>
  );

  // Exit Warning Modal Component
  const ExitWarningModal = () => (
    showExitWarning && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        fontFamily: "'Cinzel', serif",
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          padding: '40px',
          borderRadius: '15px',
          border: '3px solid #8B4513',
          textAlign: 'center',
          maxWidth: '500px',
        }}>
          <h3 style={{
            color: '#F4E4C1',
            fontSize: '1.8rem',
            marginBottom: '30px',
          }}>
            Do you wish to go back to the main menu?
          </h3>
          
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <button
              onClick={confirmExit}
              style={{
                padding: '15px 40px',
                fontSize: '1.2rem',
                background: 'linear-gradient(135deg, #8B4513, #A0522D)',
                border: '2px solid #CD853F',
                borderRadius: '10px',
                color: '#F4E4C1',
                cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
                fontWeight: 'bold',
              }}
            >
              Confirm
            </button>
            
            <button
              onClick={() => setShowExitWarning(false)}
              style={{
                padding: '15px 40px',
                fontSize: '1.2rem',
                background: 'rgba(139, 69, 19, 0.3)',
                border: '2px solid #8B4513',
                borderRadius: '10px',
                color: '#F4E4C1',
                cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
                fontWeight: 'bold',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  );

  // Main Menu
  if (screen === 'main') {
    return (
      <>
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: "'Cinzel', serif",
        }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 8vw, 4rem)',
            color: '#F4E4C1',
            textAlign: 'center',
            marginBottom: '60px',
            textShadow: '3px 3px 6px rgba(0,0,0,0.7)',
            letterSpacing: '3px',
          }}>
            OBRYNDEL
          </h1>
          
          <button
            onClick={() => setScreen('intro')}
            style={{
              padding: '20px 60px',
              fontSize: '1.5rem',
              background: 'linear-gradient(135deg, #8B4513, #A0522D)',
              border: '3px solid #CD853F',
              borderRadius: '10px',
              color: '#F4E4C1',
              cursor: 'pointer',
              marginBottom: '20px',
              fontFamily: "'Cinzel', serif",
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-3px)';
              e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.6)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Start Game
          </button>
          
          <button
            style={{
              padding: '15px 50px',
              fontSize: '1.2rem',
              background: 'rgba(139, 69, 19, 0.5)',
              border: '2px solid #8B4513',
              borderRadius: '10px',
              color: '#F4E4C1',
              cursor: 'pointer',
              fontFamily: "'Cinzel', serif",
              letterSpacing: '2px',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(139, 69, 19, 0.7)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(139, 69, 19, 0.5)';
            }}
          >
            Settings
          </button>
        </div>
      </>
    );
  }

  // Intro Screen
  if (screen === 'intro') {
    return (
      <>
        <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: '40px 20px',
        fontFamily: "'Cinzel', serif",
        position: 'relative',
      }}>
        <ExitButton />
        
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: 'clamp(1rem, 3vw, 1.3rem)',
            color: '#F4E4C1',
            lineHeight: '1.8',
            marginBottom: '50px',
            padding: '30px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '15px',
            border: '2px solid #8B4513',
            textAlign: 'left',
          }}>
            The hero, Baron Thobrick's glorious campaign has left the land of Obryndel in shatters. 
            As he shattered the source of Obryndel's magical barrier, time and space has twisted. 
            You must gather the pieces and merge them together at the Shrine of the Ogre.
          </p>
          
          <div style={{
            marginBottom: '40px',
          }}>
            <label style={{
              display: 'block',
              fontSize: '1.5rem',
              color: '#F4E4C1',
              marginBottom: '20px',
            }}>
              Number of Players: {playerCount}
            </label>
            <input
              type="range"
              min="1"
              max="4"
              value={playerCount}
              onChange={(e) => setPlayerCount(parseInt(e.target.value))}
              style={{
                width: '80%',
                maxWidth: '400px',
                height: '10px',
                background: '#8B4513',
                borderRadius: '5px',
                outline: 'none',
              }}
            />
          </div>
          
          <button
            onClick={() => setScreen('instructions')}
            style={{
              padding: '20px 60px',
              fontSize: '1.5rem',
              background: 'linear-gradient(135deg, #8B4513, #A0522D)',
              border: '3px solid #CD853F',
              borderRadius: '10px',
              color: '#F4E4C1',
              cursor: 'pointer',
              fontFamily: "'Cinzel', serif",
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-3px)';
              e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.6)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Begin Journey
          </button>
        </div>
        <ExitWarningModal />
      </>
    );
  }

  // Instructions Screen
  if (screen === 'instructions') {
    return (
      <>
        <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: '40px 20px',
        fontFamily: "'Cinzel', serif",
        position: 'relative',
      }}>
        <ExitButton />
        
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: 'clamp(1rem, 3vw, 1.2rem)',
            color: '#F4E4C1',
            lineHeight: '1.8',
            marginBottom: '50px',
            padding: '30px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '15px',
            border: '2px solid #8B4513',
            textAlign: 'left',
          }}>
            Shuffle the QR-cards and place them in the card holder, place the phone in its slot in front of the cards. 
            Each player has two action points each turn. The actions available are: move one step, use item, use ability. 
            After each round a card is drawn from the front of the deck.
          </p>
          
          <button
            onClick={() => setScreen('game')}
            style={{
              padding: '20px 60px',
              fontSize: '1.5rem',
              background: 'linear-gradient(135deg, #8B4513, #A0522D)',
              border: '3px solid #CD853F',
              borderRadius: '10px',
              color: '#F4E4C1',
              cursor: 'pointer',
              fontFamily: "'Cinzel', serif",
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-3px)';
              e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.6)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Begin Act 1
          </button>
        </div>
        <ExitWarningModal />
      </>
    );
  }

  // Game Screen
  if (screen === 'game') {
    // Character selection phase
    if (characters.length < playerCount) {
      const availableChars = availableCharacters.filter(c => !characters.includes(c));
      
      return (
        <>
          <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          padding: '40px 20px',
          fontFamily: "'Cinzel', serif",
          position: 'relative',
        }}>
          <ExitButton />
          
          <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            textAlign: 'center',
          }}>
            <h2 style={{
              fontSize: '2rem',
              color: '#F4E4C1',
              marginBottom: '30px',
            }}>
              Player {currentPlayer + 1}: Choose Your Character
            </h2>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '20px',
              marginTop: '40px',
            }}>
              {availableChars.map(character => (
                <button
                  key={character}
                  onClick={() => selectCharacter(character)}
                  style={{
                    padding: '30px 20px',
                    fontSize: '1.3rem',
                    background: 'linear-gradient(135deg, #8B4513, #A0522D)',
                    border: '3px solid #CD853F',
                    borderRadius: '10px',
                    color: '#F4E4C1',
                    cursor: 'pointer',
                    fontFamily: "'Cinzel', serif",
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-3px) scale(1.05)';
                    e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0) scale(1)';
                    e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
                  }}
                >
                  {character}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ExitWarningModal />
      </>
      );
    }

    // Main gameplay
    return (
      <>
        <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: '40px 20px',
        fontFamily: "'Cinzel', serif",
        position: 'relative',
      }}>
        <ExitButton />
        
        {/* Hidden video and canvas for QR scanning */}
        <video ref={videoRef} style={{ display: 'none' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            padding: '20px',
            borderRadius: '10px',
            marginBottom: '20px',
            border: '2px solid #8B4513',
            textAlign: 'center',
          }}>
            <h2 style={{
              fontSize: '2.5rem',
              color: '#FFD700',
              margin: '0 0 10px 0',
            }}>
              Act {act}
            </h2>
            <p style={{
              fontSize: '1.3rem',
              color: '#F4E4C1',
              margin: 0,
            }}>
              Player {currentPlayer + 1}: {characters[currentPlayer]}
            </p>
          </div>
          
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            padding: '20px',
            borderRadius: '10px',
            marginBottom: '20px',
            border: '2px solid #8B4513',
          }}>
            <p style={{
              color: '#F4E4C1',
              fontSize: '1.1rem',
              margin: 0,
            }}>
              Cards Scanned: {scannedCards.length}/30
            </p>
          </div>
          
          {cameraError && (
            <div style={{
              background: 'rgba(139, 0, 0, 0.6)',
              padding: '20px',
              borderRadius: '10px',
              marginBottom: '20px',
              border: '2px solid #FF4444',
            }}>
              <p style={{
                color: '#FFD700',
                fontSize: '1.1rem',
                margin: 0,
                fontWeight: 'bold',
              }}>
                ⚠️ {cameraError}
              </p>
              <p style={{
                color: '#F4E4C1',
                fontSize: '0.9rem',
                margin: '10px 0 0 0',
              }}>
                You can still play - manually enter tile events or deploy to Vercel for camera access.
              </p>
            </div>
          )}
          
          {qrData && (
            <div style={{
              background: 'rgba(139, 69, 19, 0.6)',
              padding: '25px',
              borderRadius: '15px',
              marginBottom: '30px',
              border: '3px solid #CD853F',
              animation: 'fadeIn 0.5s ease-in',
            }}>
              <h3 style={{
                color: '#FFD700',
                fontSize: '1.5rem',
                marginBottom: '15px',
              }}>
                {qrData}
              </h3>
              <p style={{
                color: '#F4E4C1',
                fontSize: '1.2rem',
                lineHeight: '1.6',
                margin: 0,
              }}>
                {tileEvents[qrData] || 'Unknown event...'}
              </p>
            </div>
          )}
          
          <div style={{
            textAlign: 'center',
            marginTop: '40px',
          }}>
            <button
              onClick={nextPlayer}
              style={{
                padding: '20px 60px',
                fontSize: '1.5rem',
                background: 'linear-gradient(135deg, #8B4513, #A0522D)',
                border: '3px solid #CD853F',
                borderRadius: '10px',
                color: '#F4E4C1',
                cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-3px)';
                e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.6)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
              }}
            >
              End Turn
            </button>
          </div>
        </div>
        
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}
        </style>
      </div>
      <ExitWarningModal />
    </>
    );
  }
}
