import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import ObryndelMiniGame from './ObryndelMiniGame';

// Boss sprites
import bossHead from './assets/boss-head.png';
import bossBody from './assets/boss-body.png';
import bossShield from './assets/boss-shield.png';
import bossHeadDamage from './assets/boss-head-damage.png';
import bossBodyDamage from './assets/boss-body-damage.png';
import bossShieldDamage from './assets/boss-shield-damage.png';

// ─── Narration lines ───────────────────────────────────────────────────────────
const NARRATION = {
  intro:
    "Baron Thobrick's quest to shatter the Mythical Crystal of the Ogre has been successful. " +
    "Now that the Crystal has been shattered the magical barrier shielding the foul creatures of Obryndel is crumbling. " +
    "Humankind may now live long in a world of peace, devoid of horrible creatures… " +
    "Unless… " +
    "You, Scoundrels of Obryndel! " +
    "It's up to you to gather the four shards, forge them together once more and slay Thobrick!",

  charSelectOpen:
    "Ah… I see… You dare challenge me? Scoundrels! One by one, show yourself to me!",

  charSelectNudge1:
    "Sigh… Are you daft? Pick a character card and present it to me.",

  charSelectNudge2:
    "Do I really have to spell it out for you? Pick a character and scan the QR-code…",

  afterChar: [
    null,
    "Scoundrel number 2, present thy self before me!",
    "Go on… scoundrel number 3.",
    "Ah…. Finally… What might this last scoundrel be?",
  ],

  charScanned: {
    'Character-001': "BAH! A Goblin?! I shall flatten ye with my boot.",
    'Character-002': "Eugh…. A troll… So that's where that wretched stench was coming from…",
    'Character-003': "Hah! A cyclops?! You look like a one eyed thumb…",
    'Character-004': "Witch! I shall wack ye with your own broom!",
  },

  allCharsSelected:
    "You really think you can stop me? Well then… Have at it!",

  firstRound:
    "Gah… Do I really have to explain everything for thee? " +
    "You certainly are a sad excuse of a creature… " +
    "Very well then… " +
    "You! Scoundrel number one, this is your turn to take action. " +
    "You may choose to move or use an item, of which you have none right at this very moment. " +
    "You must take two actions during your round. " +
    "After these are made you shall discard the frontmost card in the deck, which will determine what event will take place. " +
    "After this, Scoundrel number two will go through the same procedure and so on… " +
    "Good luck finding those wicked crystal shards, they appear at random throughout the realm! HA HA HA. " +
    "Your silly little quest is most certainly going to fail. " +
    "There is simply no chance for you mouth breathing rotten creatures to gather the four shards and forge them together at your cursed altar in your cursed village before the magic barrier is broken… " +
    "Ta ta!",

  itemFound:
    "Oh? So you found yourself an item? Surely you will need all the help you can possibly find to even last a second against me! " +
    "You may take an item from the bag.",

  trapTriggered:
    "You absolute fool! You have truly done it now! " +
    "You have stepped right into my trap, draining one health point from you!",

  bossEntrance:
    "Scoundrels! You dimwitted sods! Foiling my work are we? " +
    "Very well… I shall take care of you on a whim… " +
    "I present to you… Me! Lord Baron Thobrick the first! Huzza! " +
    "And now… You die.",

  bossHeadZero:   "My head! My glorious head! Who needs a head anyways?",
  bossBodyZero:   "What!? You've destroyed my body? My entire body? Shame on you…",
  bossShieldZero: "My shield! That was expensive! You shall pay for this!",

  bossDefeated:
    "Curse you, foul beasts! You've won this time… " +
    "But know this, for every drop of blood spilled here, a thousand more will rise! " +
    "With all my might I shall find a way to raise from my grave and vanquish your kind! " +
    "Ugh… …I am dead now.",
};

// ─── TTS controller ────────────────────────────────────────────────────────────
let _currentAudio = null;

const stopCurrentAudio = (fadeDuration = 400) => {
  if (!_currentAudio) return;
  const audio = _currentAudio;
  _currentAudio = null;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (fadeDuration <= 0) { audio.pause(); return; }
  const startVol = audio.volume;
  const steps = 20;
  const stepTime = fadeDuration / steps;
  let step = 0;
  const fade = setInterval(() => {
    step++;
    audio.volume = Math.max(0, startVol * (1 - step / steps));
    if (step >= steps) { clearInterval(fade); audio.pause(); }
  }, stepTime);
};

const speakText = (text) => {
  stopCurrentAudio(0);
  return new Promise((resolve) => {
    const speakBrowser = () => {
      if (!('speechSynthesis' in window)) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      const voices = window.speechSynthesis.getVoices();
      const male = voices.find(v =>
        /male/i.test(v.name) || /david|mark|daniel|alex|fred|ralph|junior|albert/i.test(v.name)
      );
      if (male) utterance.voice = male;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    };
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then(async res => { if (!res.ok) throw new Error(); return res.arrayBuffer(); })
      .then(buf => {
        const blob = new Blob([buf], { type: 'audio/mpeg' });
        const audio = new Audio(URL.createObjectURL(blob));
        _currentAudio = audio;
        audio.onended = () => { if (_currentAudio === audio) _currentAudio = null; resolve(); };
        audio.onerror = () => { if (_currentAudio === audio) _currentAudio = null; resolve(); };
        audio.play().catch(() => speakBrowser());
      })
      .catch(() => speakBrowser());
  });
};

// ─── Character metadata ────────────────────────────────────────────────────────
const CHARACTER_QR_MAP = {
  'Character-001': 'Goblin',
  'Character-002': 'Troll',
  'Character-003': 'Cyclops',
  'Character-004': 'Witch',
};

const CHARACTER_EMOJIS = { Goblin: '👺', Troll: '🧌', Cyclops: '👁️', Witch: '🧙‍♀️' };
const AVAILABLE_CHARACTERS = ['Goblin', 'Troll', 'Cyclops', 'Witch'];
const CHARACTER_TO_QR = Object.fromEntries(
  Object.entries(CHARACTER_QR_MAP).map(([k, v]) => [v, k])
);

const SHARD_ZONES = ['Village of Obryndel', 'Forest of Travesy', 'Charstone Alpines', 'Mudbrik Castle'];
const SHARD_ORDER_NAMES = ['First', 'Second', 'Third', 'Fourth'];

// ─── Event outcomes for no-QR mode ────────────────────────────────────────────
const MANUAL_EVENTS = [
  { id: 'scan',    label: '🃏 Scan Event',           desc: 'Draw and resolve the top event card.' },
  { id: 'boss',    label: '💀 Forge All Shards (Boss Phase)', desc: 'All shards forged — Thobrick awakens!' },
];

// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Mode flag: true = no QR scanning, use buttons instead ──────────────────
  const [noQrMode, setNoQrMode] = useState(false);

  const [screen, setScreen] = useState('main');
  const [playerCount, setPlayerCount] = useState(2);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [players, setPlayers] = useState([]);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [act, setAct] = useState(1);
  const [actAnimating, setActAnimating] = useState(false);
  const [scannedCards, setScannedCards] = useState([]);
  const [roundPhase, setRoundPhase] = useState('playerTurn');
  const [qrData, setQrData] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [shardSchedule, setShardSchedule] = useState([]);
  const [nextShardIndex, setNextShardIndex] = useState(0);
  const [boss, setBoss] = useState({ head: 5, body: 5, shield: 5 });
  const [bossDefeated, setBossDefeated] = useState(false);
  const [charScanFeedback, setCharScanFeedback] = useState('');
  const [charCameraError, setCharCameraError] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [narrationText, setNarrationText] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);

  const charVideoRef = useRef(null);
  const charCanvasRef = useRef(null);
  const charAnimRef = useRef(null);
  const charStreamRef = useRef(null);

  const nudge1Ref = useRef(null);
  const nudge2Ref = useRef(null);
  const narrationAbortRef = useRef(false);
  const charCameraActive = useRef(false);

  const pendingScanPlayerRef = useRef(null);
  const currentPlayerRef = useRef(0);
  const roundPhaseRef = useRef('playerTurn');
  const scannedCardsRef = useRef([]);
  const roundsCompletedRef = useRef(0);
  const shardScheduleRef = useRef([]);
  const nextShardIndexRef = useRef(0);
  const actRef = useRef(1);
  const playerCountRef = useRef(2);
  const playersRef = useRef([]);
  const charactersRef = useRef([]);
  const currentPlayerForScan = useRef(0);

  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { roundPhaseRef.current = roundPhase; }, [roundPhase]);
  useEffect(() => { scannedCardsRef.current = scannedCards; }, [scannedCards]);
  useEffect(() => { roundsCompletedRef.current = roundsCompleted; }, [roundsCompleted]);
  useEffect(() => { shardScheduleRef.current = shardSchedule; }, [shardSchedule]);
  useEffect(() => { nextShardIndexRef.current = nextShardIndex; }, [nextShardIndex]);
  useEffect(() => { actRef.current = act; }, [act]);
  useEffect(() => { playerCountRef.current = playerCount; }, [playerCount]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { charactersRef.current = characters; }, [characters]);
  useEffect(() => { currentPlayerForScan.current = currentPlayer; }, [currentPlayer]);

  const noQrModeRef = useRef(false);
  useEffect(() => { noQrModeRef.current = noQrMode; }, [noQrMode]);

  const speak = async (text) => {
    if (noQrModeRef.current) {
      setNarrationText(text);
      return;
    }
    setIsSpeaking(true);
    await speakText(text);
    setIsSpeaking(false);
  };
  const abortNarration = () => {
    narrationAbortRef.current = true;
    stopCurrentAudio(300);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const clearNudgeTimers = () => {
    if (nudge1Ref.current) { clearTimeout(nudge1Ref.current); nudge1Ref.current = null; }
    if (nudge2Ref.current) { clearTimeout(nudge2Ref.current); nudge2Ref.current = null; }
  };

  const startNudgeTimers = () => {
    clearNudgeTimers();
    nudge1Ref.current = setTimeout(async () => {
      await speak(NARRATION.charSelectNudge1);
      nudge2Ref.current = setTimeout(() => speak(NARRATION.charSelectNudge2), 10000);
    }, 10000);
  };

  const shuffleArray = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const createShardSchedule = () => {
    const rounds = shuffleArray([1, 2, 3, 4, 5]).slice(0, 4).sort((a, b) => a - b);
    const zones = shuffleArray(SHARD_ZONES);
    return rounds.map((round, index) => ({ round, zone: zones[index], orderName: SHARD_ORDER_NAMES[index] }));
  };

  const maybeGetShardMessage = (currentRound) => {
    const schedule = shardScheduleRef.current;
    const idx = nextShardIndexRef.current;
    if (idx >= schedule.length) return null;
    const nextShard = schedule[idx];
    if (!nextShard || nextShard.round !== currentRound) return null;
    setNextShardIndex(idx + 1);
    nextShardIndexRef.current = idx + 1;
    return `${nextShard.orderName} shard appeared in ${nextShard.zone}.`;
  };

  const triggerActAnimation = () => {
    setActAnimating(true);
    setTimeout(() => setActAnimating(false), 1200);
  };

  // ─── QR Camera ─────────────────────────────────────────────────────────────
  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      animationRef.current = requestAnimationFrame(scanQRCodeLoop);
    } catch (err) { setCameraError('Camera error: ' + err.message); }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null; }
  };

  const scanQRCodeLoop = () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (roundPhaseRef.current !== 'scanQR') return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data.startsWith('Tile-') && !scannedCardsRef.current.includes(code.data)) {
        setScannedCards(prev => { const n = [...prev, code.data]; scannedCardsRef.current = n; return n; });
        stopCamera();
        handleTileScan(parseInt(code.data.split('-')[1], 10));
        return;
      }
    }
    animationRef.current = requestAnimationFrame(scanQRCodeLoop);
  };

  const handleTileScan = (num) => {
    if (num === 30) {
      speak(NARRATION.bossEntrance);
      setQrData(NARRATION.bossEntrance);
      setScreen('boss');
      setAct(3);
      return;
    }
    if (num >= 1 && num <= 29) {
      const targetPlayer = pendingScanPlayerRef.current != null ? pendingScanPlayerRef.current : currentPlayerRef.current;
      const eventMsg = handleTileEvent(num, targetPlayer);
      const currentRound = roundsCompletedRef.current + 1;
      const shardMsg = maybeGetShardMessage(currentRound);
      const combinedMsg = [eventMsg, shardMsg].filter(Boolean).join(' ');
      if (combinedMsg) { setQrData(combinedMsg); speak(combinedMsg); }
      advanceTurn(targetPlayer);
    }
  };

  const advanceTurn = (targetPlayer) => {
    const pc = playerCountRef.current;
    if (targetPlayer < pc - 1) {
      setCurrentPlayer(targetPlayer + 1);
      currentPlayerRef.current = targetPlayer + 1;
    } else {
      setCurrentPlayer(0);
      currentPlayerRef.current = 0;
      setRoundsCompleted(prev => { const next = prev + 1; roundsCompletedRef.current = next; return next; });
    }
    pendingScanPlayerRef.current = null;
    setRoundPhase('playerTurn');
    roundPhaseRef.current = 'playerTurn';
  };

  useEffect(() => {
    if (roundPhase === 'scanQR' && screen === 'game' && !noQrMode) startCamera();
  }, [roundPhase, screen]);

  // ─── Character camera (QR mode only) ──────────────────────────────────────
  const startCharacterCamera = async () => {
    if (!charVideoRef.current) return;
    setCharCameraError(''); setCharScanFeedback('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      charStreamRef.current = stream;
      charVideoRef.current.srcObject = stream;
      await charVideoRef.current.play();
      charCameraActive.current = true;
      charAnimRef.current = requestAnimationFrame(scanCharacterQRLoop);
    } catch (err) { setCharCameraError('Camera error: ' + err.message); }
  };

  const stopCharacterCamera = () => {
    charCameraActive.current = false;
    if (charStreamRef.current) { charStreamRef.current.getTracks().forEach(t => t.stop()); charStreamRef.current = null; }
    if (charAnimRef.current) { cancelAnimationFrame(charAnimRef.current); charAnimRef.current = null; }
  };

  const scanCharacterQRLoop = () => {
    if (!charCameraActive.current || !charVideoRef.current || !charCanvasRef.current) return;
    const video = charVideoRef.current;
    const canvas = charCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && CHARACTER_QR_MAP[code.data]) {
        const charName = CHARACTER_QR_MAP[code.data];
        if (charactersRef.current.filter(c => c).includes(charName)) {
          setCharScanFeedback(`${charName} is already taken! Try a different card.`);
        } else {
          clearNudgeTimers(); stopCharacterCamera(); setCharScanFeedback('');
          handleCharacterScanned(code.data, charName);
          return;
        }
      }
    }
    charAnimRef.current = requestAnimationFrame(scanCharacterQRLoop);
  };

  const handleCharacterScanned = async (qrCode, charName) => {
    const playerIdx = currentPlayerForScan.current;
    const newChars = [...charactersRef.current];
    newChars[playerIdx] = charName;
    setCharacters(newChars); charactersRef.current = newChars;
    await speak(NARRATION.charScanned[qrCode]);
    const nextIdx = playerIdx + 1;
    const pc = playerCountRef.current;
    if (nextIdx < pc) {
      setCurrentPlayer(nextIdx); currentPlayerForScan.current = nextIdx;
      const promptLine = NARRATION.afterChar[nextIdx];
      if (promptLine) await speak(promptLine);
      startCharacterCamera();
    } else {
      await speak(NARRATION.allCharsSelected);
      setScreen('game'); setCurrentPlayer(0); currentPlayerForScan.current = 0;
    }
  };

  // ─── No-QR character pick ──────────────────────────────────────────────────
  const handleNoQrCharacterPick = async (charName) => {
    const playerIdx = currentPlayerForScan.current;
    const newChars = [...charactersRef.current];
    newChars[playerIdx] = charName;
    setCharacters(newChars); charactersRef.current = newChars;
    const qrCode = CHARACTER_TO_QR[charName];
    await speak(NARRATION.charScanned[qrCode]);
    const nextIdx = playerIdx + 1;
    const pc = playerCountRef.current;
    if (nextIdx < pc) {
      setCurrentPlayer(nextIdx); currentPlayerForScan.current = nextIdx;
      const promptLine = NARRATION.afterChar[nextIdx];
      if (promptLine) await speak(promptLine);
    } else {
      await speak(NARRATION.allCharsSelected);
      setScreen('game'); setCurrentPlayer(0); currentPlayerForScan.current = 0;
    }
  };

  // ─── No-QR event resolution ────────────────────────────────────────────────
  const handleNoQrEvent = (eventId) => {
    if (eventId === 'boss') {
      speak(NARRATION.bossEntrance);
      setQrData(NARRATION.bossEntrance);
      setScreen('boss');
      setAct(3);
      return;
    }
    const targetPlayer = pendingScanPlayerRef.current != null ? pendingScanPlayerRef.current : currentPlayerRef.current;
    let eventMsg = '';
    setPlayers(prev => {
      const copy = [...prev];
      if (!copy[targetPlayer]) return prev;
      const zone = Math.min(2, actRef.current);
      const weights = actRef.current === 1 ? { item: 0.22, trap: 0.18 } : { item: 0.18, trap: 0.22 };
      const roll = Math.random();
      const outcome = roll < weights.item ? 'item' : roll < weights.item + weights.trap ? 'trap' : 'neutral';
      if (outcome === 'trap') {
        copy[targetPlayer] = { ...copy[targetPlayer], hp: Math.max(copy[targetPlayer].hp - 1, 0) };
        eventMsg = NARRATION.trapTriggered;
      } else if (outcome === 'item') {
        copy[targetPlayer] = { ...copy[targetPlayer], items: [...copy[targetPlayer].items, `Treasure (Zone ${zone})`] };
        eventMsg = NARRATION.itemFound;
      } else {
        eventMsg = `Player ${targetPlayer + 1} scouts ahead, but the room is eerily calm. Nothing happens.`;
      }
      playersRef.current = copy;
      return copy;
    });
    const currentRound = roundsCompletedRef.current + 1;
    const shardMsg = maybeGetShardMessage(currentRound);
    const combinedMsg = [eventMsg || `Player ${targetPlayer + 1} scouts ahead. Nothing happens.`, shardMsg].filter(Boolean).join(' ');
    setQrData(combinedMsg);
    speak(combinedMsg);
    advanceTurn(targetPlayer);
  };

  useEffect(() => {
    if (screen === 'characterSelect') {
      const run = async () => {
        narrationAbortRef.current = false;
        await speak(NARRATION.charSelectOpen);
        if (narrationAbortRef.current) return;
        if (!noQrMode) { startNudgeTimers(); startCharacterCamera(); }
      };
      run();
    }
    return () => {
      if (screen === 'characterSelect') { stopCharacterCamera(); clearNudgeTimers(); }
    };
  }, [screen]);

  useEffect(() => {
    if (screen === 'game') {
      const init = Array.from({ length: playerCount }).map((_, i) => ({
        char: characters[i] || null, hp: 5, items: [],
      }));
      setPlayers(init); playersRef.current = init;
      setRoundsCompleted(0); roundsCompletedRef.current = 0;
      setAct(1); actRef.current = 1;
      pendingScanPlayerRef.current = null;
      setRoundPhase('playerTurn'); roundPhaseRef.current = 'playerTurn';
      setCurrentPlayer(0); currentPlayerRef.current = 0;
      setBossDefeated(false);
      const sched = createShardSchedule();
      setShardSchedule(sched); shardScheduleRef.current = sched;
      setNextShardIndex(0); nextShardIndexRef.current = 0;
      triggerActAnimation();
      speak(NARRATION.firstRound);
    }
    return () => { if (screen === 'game') stopCamera(); };
  }, [screen]);

  useEffect(() => {
    if (screen === 'boss') { setAct(3); actRef.current = 3; return; }
    const newAct = roundsCompleted >= 7 ? 2 : 1;
    if (newAct !== actRef.current) { setAct(newAct); actRef.current = newAct; triggerActAnimation(); }
  }, [roundsCompleted, screen]);

  useEffect(() => {
    if (roundPhase === 'playerTurn' && screen === 'game') {
      if (!qrData) {
        const t = setTimeout(() => {
          if (noQrModeRef.current) setNarrationText('');
          pendingScanPlayerRef.current = currentPlayer;
          setRoundPhase('scanQR');
          roundPhaseRef.current = 'scanQR';
        }, 1500);
        return () => clearTimeout(t);
      }
    }
  }, [roundPhase, screen, qrData]);

  const handleEventDismiss = () => {
    setQrData('');
    pendingScanPlayerRef.current = currentPlayerRef.current;
    setRoundPhase('scanQR');
    roundPhaseRef.current = 'scanQR';
  };

  const handleTileEvent = (tileNum, playerIndex) => {
    if (tileNum < 1 || tileNum > 29) return null;
    const zone = Math.min(2, actRef.current);
    const weights = actRef.current === 1 ? { item: 0.22, trap: 0.18 } : { item: 0.18, trap: 0.22 };
    const roll = Math.random();
    const outcome = roll < weights.item ? 'item' : roll < weights.item + weights.trap ? 'trap' : 'neutral';
    setPlayers(prev => {
      const copy = [...prev];
      if (!copy[playerIndex]) return prev;
      if (outcome === 'trap') copy[playerIndex] = { ...copy[playerIndex], hp: Math.max(copy[playerIndex].hp - 1, 0) };
      else if (outcome === 'item') copy[playerIndex] = { ...copy[playerIndex], items: [...copy[playerIndex].items, `Treasure (Zone ${zone})`] };
      playersRef.current = copy;
      return copy;
    });
    if (outcome === 'trap') return NARRATION.trapTriggered;
    if (outcome === 'item') return NARRATION.itemFound;
    return `Player ${playerIndex + 1} scouts ahead, but the room is eerily calm. Nothing happens.`;
  };

  const resetGame = () => {
    abortNarration(); stopCamera(); stopCharacterCamera(); clearNudgeTimers();
    narrationAbortRef.current = true;
    setScreen('main'); setPlayerCount(2); playerCountRef.current = 2;
    setCurrentPlayer(0); currentPlayerRef.current = 0;
    setCharacters([]); charactersRef.current = [];
    setScannedCards([]); scannedCardsRef.current = [];
    setRoundPhase('playerTurn'); roundPhaseRef.current = 'playerTurn';
    setQrData('');
    setBoss({ head: 5, body: 5, shield: 5 }); setBossDefeated(false);
    setShardSchedule([]); shardScheduleRef.current = [];
    setNextShardIndex(0); nextShardIndexRef.current = 0;
    setCharScanFeedback(''); setCharCameraError(''); setActAnimating(false);
    setNarrationText('');
  };

  const launchGame = (useQr) => {
    abortNarration();
    narrationAbortRef.current = false;
    setNoQrMode(!useQr);
    setScreen('intro');
  };

  const launchTestCharacterScan = () => {
    abortNarration(); narrationAbortRef.current = false;
    setPlayerCount(2); playerCountRef.current = 2;
    setCurrentPlayer(0); currentPlayerForScan.current = 0;
    setCharacters([]); charactersRef.current = [];
    setScreen('characterSelect');
  };

  const launchTestEventScan = () => {
    abortNarration(); narrationAbortRef.current = false;
    const dummyPlayers = [{ char: 'Goblin', hp: 5, items: [] }, { char: 'Troll', hp: 5, items: [] }];
    setPlayers(dummyPlayers); playersRef.current = dummyPlayers;
    setPlayerCount(2); playerCountRef.current = 2;
    setCharacters(['Goblin', 'Troll']); charactersRef.current = ['Goblin', 'Troll'];
    setCurrentPlayer(0); currentPlayerRef.current = 0;
    setRoundsCompleted(0); roundsCompletedRef.current = 0;
    setAct(1); actRef.current = 1;
    setBossDefeated(false); setQrData('');
    setScannedCards([]); scannedCardsRef.current = [];
    const sched = createShardSchedule();
    setShardSchedule(sched); shardScheduleRef.current = sched;
    setNextShardIndex(0); nextShardIndexRef.current = 0;
    pendingScanPlayerRef.current = 0;
    setRoundPhase('scanQR'); roundPhaseRef.current = 'scanQR';
    setScreen('game');
  };

  const launchTestBoss = () => {
    abortNarration(); narrationAbortRef.current = false;
    setBoss({ head: 5, body: 5, shield: 5 }); setBossDefeated(false);
    setAct(3); actRef.current = 3;
    speak(NARRATION.bossEntrance); setScreen('boss');
  };

  // ─── Boss damage ───────────────────────────────────────────────────────────
  const damageBoss = (part) => {
    setBoss(prev => {
      const newVal = Math.max(prev[part] - 1, 0);
      const updated = { ...prev, [part]: newVal };
      if (newVal === 0) {
        const allDead = Object.keys(updated).every(k => updated[k] === 0);
        if (allDead) { setBossDefeated(true); speak(NARRATION.bossDefeated); }
        else {
          if (part === 'head') speak(NARRATION.bossHeadZero);
          if (part === 'body') speak(NARRATION.bossBodyZero);
          if (part === 'shield') speak(NARRATION.bossShieldZero);
        }
      }
      return updated;
    });
  };

  const ExitButton = ({ onClick }) => <button onClick={onClick} style={exitStyle}>×</button>;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREENS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Main menu ─────────────────────────────────────────────────────────────
  if (screen === 'main') {
    return (
      <div style={menuStyle}>
        <h1 style={titleStyle}>OBRYNDEL</h1>

        {/* Primary launch buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button style={buttonStyle} onClick={() => launchGame(true)}>
            Start Game
          </button>
          <button
            style={{
              ...buttonStyle,
              background: 'linear-gradient(180deg,#1b3a2e,#0a1f17)',
              border: '1px solid rgba(80,200,120,0.22)',
              color: '#C5F0D0',
            }}
            onClick={() => launchGame(false)}
          >
            No QR Mode
          </button>
          <p style={{ color: 'rgba(200,180,130,0.35)', fontSize: '0.72rem', margin: '2px 0 0', letterSpacing: 1 }}>
            Use buttons instead of card scanning
          </p>

          {/* ─── Co-op Prototype button ─── */}
          <button
            style={{
              ...buttonStyle,
              background: 'linear-gradient(180deg,#1a2b3a,#0a1220)',
              border: '1px solid rgba(80,140,200,0.28)',
              color: '#C0D8F0',
              marginTop: 6,
            }}
            onClick={() => { abortNarration(); setScreen('miniGame'); }}
          >
            🗺️ Co-op Prototype
          </button>
          <p style={{ color: 'rgba(160,190,220,0.3)', fontSize: '0.72rem', margin: '-4px 0 0', letterSpacing: 1 }}>
            Cooperative shard-gathering mini game
          </p>
        </div>

        {/* Test shortcuts */}
        <div style={testSectionStyle}>
          <p style={testLabelStyle}>— test shortcuts —</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            <button style={testButtonStyle} onClick={launchTestCharacterScan}>🎴 Scan Characters</button>
            <button style={testButtonStyle} onClick={launchTestEventScan}>🗺️ Scan Event Cards</button>
            <button style={testButtonStyle} onClick={launchTestBoss}>💀 Boss Fight</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Co-op Prototype mini game ─────────────────────────────────────────────
  if (screen === 'miniGame') {
    return <ObryndelMiniGame onExit={() => setScreen('main')} />;
  }

  // ─── Intro ─────────────────────────────────────────────────────────────────
  if (screen === 'intro') {
    return <IntroScreen onDone={() => setScreen('playerCount')} onAbort={abortNarration} />;
  }

  // ─── Player count ──────────────────────────────────────────────────────────
  if (screen === 'playerCount') {
    return (
      <div style={textBoxStyle}>
        {noQrMode && <ModeBadge />}
        <h2 style={{ color: '#FFD700' }}>Welcome to Obryndel!</h2>
        <p>Choose number of scoundrels:</p>
        <div style={{ marginTop: 20, marginBottom: 30 }}>
          <label style={{ fontSize: '1.4rem', color: '#EFD88B' }}>Players: {playerCount}</label>
          <input
            type="range" min="1" max="4" value={playerCount}
            onChange={e => { setPlayerCount(parseInt(e.target.value)); playerCountRef.current = parseInt(e.target.value); }}
            style={{ width: 250, display: 'block', margin: '12px auto 0' }}
          />
        </div>
        <button style={buttonStyle} onClick={() => {
          abortNarration();
          setCurrentPlayer(0); currentPlayerForScan.current = 0;
          setCharacters([]); charactersRef.current = [];
          setScreen('characterSelect');
        }}>Continue</button>
      </div>
    );
  }

  // ─── Character selection ───────────────────────────────────────────────────
  if (screen === 'characterSelect') {
    const pickedChars = characters.filter(c => c);
    const remaining = AVAILABLE_CHARACTERS.filter(c => !pickedChars.includes(c));

    if (noQrMode) {
      return (
        <div style={textBoxStyle}>
          <ExitButton onClick={() => { abortNarration(); resetGame(); }} />
          <ModeBadge />
          <div style={{ ...cardStyle, width: '100%', maxWidth: 680, padding: 28, marginTop: 20 }}>
            <h2 style={{ color: '#D9B65A', marginTop: 0, fontFamily: "'Merriweather', Georgia, serif" }}>
              Player {currentPlayer + 1}: Choose Your Character
            </h2>
            <p style={{ color: '#cfc1a3', marginBottom: 24 }}>
              Pick a character from the cards below.
            </p>
            {narrationText && (
              <div style={narrationBoxStyle}>
                <span style={{ opacity: 0.45, fontSize: '0.7rem', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Thobrick speaks…</span>
                {narrationText}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 24 }}>
              {AVAILABLE_CHARACTERS.map(char => {
                const taken = pickedChars.includes(char);
                return (
                  <button
                    key={char}
                    disabled={taken}
                    onClick={() => handleNoQrCharacterPick(char)}
                    style={{
                      padding: '18px 12px', borderRadius: 12,
                      border: taken ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(213,169,62,0.30)',
                      background: taken ? 'rgba(0,0,0,0.2)' : 'linear-gradient(180deg,rgba(90,58,20,0.8),rgba(30,15,5,0.8))',
                      color: taken ? '#4a3a2a' : '#F0DFA0',
                      cursor: taken ? 'not-allowed' : 'pointer',
                      fontSize: '1.5rem',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      transition: 'transform 120ms ease, box-shadow 120ms ease',
                      boxShadow: taken ? 'none' : '0 6px 20px rgba(0,0,0,0.5)',
                    }}
                    onMouseEnter={e => { if (!taken) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                  >
                    <span style={{ fontSize: '2.2rem' }}>{CHARACTER_EMOJIS[char]}</span>
                    <span style={{ fontFamily: "'Cinzel', Georgia, serif", letterSpacing: 1 }}>{char}</span>
                    {taken && <span style={{ fontSize: '0.7rem', color: '#6a5a3a', marginTop: 2 }}>Taken</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {Array.from({ length: playerCount }).map((_, i) => (
                <div key={i} style={{
                  padding: '8px 14px', borderRadius: 8,
                  background: characters[i] ? 'rgba(60,40,10,0.7)' : 'rgba(0,0,0,0.3)',
                  color: characters[i] ? '#e6d8ad' : '#6a5a3a',
                  border: characters[i] ? '1px solid rgba(213,169,62,0.2)' : '1px solid rgba(255,255,255,0.04)',
                  minWidth: 120, fontSize: 13,
                }}>
                  {characters[i] ? `✓ ${CHARACTER_EMOJIS[characters[i]]} ${characters[i]}` : `Player ${i + 1} — ?`}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={textBoxStyle}>
        <ExitButton onClick={() => { abortNarration(); stopCharacterCamera(); clearNudgeTimers(); resetGame(); }} />
        <div style={{ ...cardStyle, width: '100%', maxWidth: 720, padding: 28 }}>
          <h2 style={{ color: '#D9B65A', marginTop: 0, fontFamily: "'Merriweather', Georgia, serif" }}>
            Player {currentPlayer + 1}: Scan Your Character Card
          </h2>
          <p style={{ color: '#cfc1a3', marginTop: 6, marginBottom: 18 }}>
            Hold your character QR card up to the <strong style={{ color: '#EFD88B' }}>front camera</strong>.
          </p>
          <div style={{ position: 'relative', width: 280, height: 280, margin: '0 auto 18px', borderRadius: 14, overflow: 'hidden', border: '2px solid rgba(213,169,62,0.35)', background: '#000' }}>
            <video ref={charVideoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} muted playsInline />
            {charCameraActive.current && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 160, height: 160, border: '2px solid rgba(213,169,62,0.75)', borderRadius: 10 }} />
              </div>
            )}
            {!charCameraActive.current && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6a5a3a', fontSize: 14 }}>Waiting…</div>
            )}
          </div>
          <canvas ref={charCanvasRef} style={{ display: 'none' }} />
          {charScanFeedback && <p style={{ color: '#ff9a60', marginBottom: 12, fontSize: 14 }}>{charScanFeedback}</p>}
          {charCameraError && <p style={{ color: '#ff7070', marginBottom: 12, fontSize: 14 }}>{charCameraError}</p>}
          <div style={{ marginBottom: 18, color: '#9a8a6a', fontSize: 12, lineHeight: 1.7 }}>
            <strong style={{ color: '#b09a6a' }}>Card codes:</strong><br />
            Character-001 → Goblin &nbsp;|&nbsp; Character-002 → Troll &nbsp;|&nbsp;
            Character-003 → Cyclops &nbsp;|&nbsp; Character-004 → Witch
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {Array.from({ length: playerCount }).map((_, i) => (
              <div key={i} style={{
                padding: '8px 14px', borderRadius: 8,
                background: characters[i] ? 'rgba(60,40,10,0.7)' : 'rgba(0,0,0,0.3)',
                color: characters[i] ? '#e6d8ad' : '#6a5a3a',
                border: characters[i] ? '1px solid rgba(213,169,62,0.2)' : '1px solid rgba(255,255,255,0.04)',
                minWidth: 120, fontSize: 13,
              }}>
                {characters[i] ? `✓ ${characters[i]}` : `Player ${i + 1} — ?`}
              </div>
            ))}
          </div>
          {remaining.length > 0 && <p style={{ color: '#7a6a4a', fontSize: 12, marginTop: 14 }}>Still available: {remaining.join(', ')}</p>}
        </div>
      </div>
    );
  }

  // ─── Boss ──────────────────────────────────────────────────────────────────
  if (screen === 'boss') {
    const flashDamage = (part) => {
      const el = document.getElementById(part + 'Damage');
      if (!el) return;
      el.style.opacity = 1;
      setTimeout(() => { el.style.opacity = 0; }, 1000);
    };
    const handleDamage = (part) => { damageBoss(part); flashDamage(part); };
    return (
      <div style={textBoxStyle}>
        <ExitButton onClick={resetGame} />
        <h2 style={{ color: '#FFD700', marginBottom: 10 }}>ACT 3: FINAL BOSS</h2>
        {bossDefeated ? (
          <>
            <p style={{ color: '#EDE6CF', maxWidth: 560, lineHeight: 1.8, fontStyle: 'italic', marginBottom: 24 }}>{NARRATION.bossDefeated}</p>
            <h2 style={{ color: '#FFD700' }}>Victory!</h2>
            <button style={buttonStyle} onClick={resetGame}>Main Menu</button>
          </>
        ) : (
          <>
            <div style={{ ...cardStyle, width: 320, height: 340, margin: '0 auto 18px', padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {boss.body > 0 && (<>
                  <img src={bossBody} alt="body" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '100%', zIndex: 1 }} />
                  <img id="bodyDamage" src={bossBodyDamage} alt="body damage" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '100%', zIndex: 2, opacity: 0 }} />
                </>)}
                {boss.shield > 0 && (<>
                  <img src={bossShield} alt="shield" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '100%', zIndex: 3 }} />
                  <img id="shieldDamage" src={bossShieldDamage} alt="shield damage" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '100%', zIndex: 4, opacity: 0 }} />
                </>)}
                {boss.head > 0 && (<>
                  <img src={bossHead} alt="head" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '100%', zIndex: 5 }} />
                  <img id="headDamage" src={bossHeadDamage} alt="head damage" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '100%', zIndex: 6, opacity: 0 }} />
                </>)}
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 30, marginBottom: 10 }}>
              <p>Head HP: {boss.head}</p><p>Body HP: {boss.body}</p><p>Shield HP: {boss.shield}</p>
            </div>
            <div style={bossButtonBar}>
              <button style={buttonStyle} onClick={() => handleDamage('head')}>Hit Head</button>
              <button style={buttonStyle} onClick={() => handleDamage('body')}>Hit Body</button>
              <button style={buttonStyle} onClick={() => handleDamage('shield')}>Hit Shield</button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ─── Game ──────────────────────────────────────────────────────────────────
  if (screen === 'game') {
    const activePlayer = players[currentPlayer];
    return (
      <div style={textBoxStyle}>
        <div style={{ position: 'fixed', top: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ color: '#D9B65A', fontWeight: 700, fontSize: actAnimating ? '3.5rem' : '1.4rem', transition: 'font-size 0.6s cubic-bezier(0.22,1,0.36,1)', textShadow: actAnimating ? '0 0 40px rgba(213,169,62,0.6)' : 'none', letterSpacing: 4 }}>
            ACT {act}
          </div>
        </div>
        {qrData && (
          <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, background: 'rgba(0,0,0,0.6)' }}>
            <div style={{ ...cardStyle, maxWidth: 720, padding: 24 }}>
              <h3 style={{ marginTop: 0, color: '#EFD88B' }}>Event</h3>
              <p style={{ color: '#EDE6CF' }}>{qrData}</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <button onClick={handleEventDismiss} style={buttonStyle}>Continue</button>
              </div>
            </div>
          </div>
        )}
        <ExitButton onClick={resetGame} />
        {noQrMode && <ModeBadge />}
        <div style={{ marginTop: 80, marginBottom: 20 }}>
          <h2 style={{ marginBottom: 4 }}>
            Player {currentPlayer + 1}
            {activePlayer?.char && (
              <span style={{ color: '#D9B65A', marginLeft: 10, fontSize: '1.2rem' }}>
                {CHARACTER_EMOJIS[activePlayer.char]} {activePlayer.char}
              </span>
            )}
          </h2>
          {activePlayer && (
            <p style={{ color: '#9a8a6a', fontSize: 14, margin: 0 }}>
              HP: {activePlayer.hp} &nbsp;|&nbsp; Items: {activePlayer.items.length > 0 ? activePlayer.items.join(', ') : 'None'}
            </p>
          )}
        </div>
        {noQrMode && narrationText && roundPhase !== 'scanQR' && !qrData && (
          <div style={{ ...narrationBoxStyle, maxWidth: 500, marginBottom: 16 }}>
            <span style={{ opacity: 0.45, fontSize: '0.7rem', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Thobrick speaks…</span>
            {narrationText}
          </div>
        )}
        {noQrMode && roundPhase === 'scanQR' && !qrData && (
          <div style={{ ...cardStyle, width: '100%', maxWidth: 500, padding: 24, marginTop: 8 }}>
            <h3 style={{ color: '#EFD88B', marginTop: 0 }}>🃏 Draw an Event Card</h3>
            <p style={{ color: '#9a8a6a', fontSize: 13, marginBottom: 20 }}>
              Discard the top card from the deck, then tap the matching outcome below.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {MANUAL_EVENTS.map(evt => (
                <button
                  key={evt.id}
                  onClick={() => handleNoQrEvent(evt.id)}
                  style={{
                    padding: '18px 20px', borderRadius: 12, cursor: 'pointer',
                    border: '1px solid rgba(213,169,62,0.22)',
                    background: evt.id === 'boss'
                      ? 'linear-gradient(180deg,rgba(80,20,20,0.9),rgba(30,5,5,0.9))'
                      : 'linear-gradient(180deg,rgba(50,35,15,0.8),rgba(15,10,5,0.8))',
                    color: evt.id === 'boss' ? '#ffaaaa' : '#EFD88B',
                    fontSize: '1rem', textAlign: 'center',
                    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14,
                    transition: 'transform 120ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                >
                  <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{evt.label.split(' ')[0]}</span>
                  <span style={{ textAlign: 'left' }}>
                    <span style={{ fontFamily: "'Cinzel', Georgia, serif", letterSpacing: 0.5, display: 'block' }}>
                      {evt.label.split(' ').slice(1).join(' ')}
                    </span>
                    <span style={{ color: 'rgba(200,180,130,0.45)', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{evt.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {!noQrMode && (
          <>
            <video ref={videoRef} style={{ display: 'none' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {roundPhase === 'scanQR' && <p style={{ color: '#9a8a6a', fontSize: 14, marginTop: 12 }}>Scanning tile card…</p>}
            {cameraError && <p style={{ color: 'red' }}>{cameraError}</p>}
          </>
        )}
        {players.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
            {players.map((p, i) => (
              <div key={i} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, minWidth: 100,
                background: i === currentPlayer ? 'rgba(90,60,10,0.7)' : 'rgba(20,15,10,0.5)',
                border: i === currentPlayer ? '1px solid rgba(213,169,62,0.4)' : '1px solid rgba(255,255,255,0.04)',
                color: i === currentPlayer ? '#EFD88B' : '#7a6a4a',
              }}>
                {CHARACTER_EMOJIS[p.char] || '?'} P{i + 1} — HP: {p.hp}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

// ─── No-QR mode badge ─────────────────────────────────────────────────────────
function ModeBadge() {
  return (
    <div style={{
      position: 'fixed', top: 18, right: 66,
      background: 'rgba(20,60,35,0.85)',
      border: '1px solid rgba(80,200,120,0.25)',
      borderRadius: 8, padding: '4px 10px',
      color: 'rgba(140,230,160,0.8)', fontSize: '0.7rem', letterSpacing: 1.5,
      textTransform: 'uppercase', zIndex: 90,
    }}>
      🎲 No QR
    </div>
  );
}

// ─── Intro screen ─────────────────────────────────────────────────────────────
function IntroScreen({ onDone, onAbort }) {
  const lines = [
    "Baron Thobrick's quest to shatter the Mythical Crystal of the Ogre has been successful.",
    "Now that the Crystal has been shattered the magical barrier shielding the foul creatures of Obryndel is crumbling.",
    "Humankind may now live long in a world of peace, devoid of horrible creatures…",
    "Unless…",
    "You, Scoundrels of Obryndel!",
    "It's up to you to gather the four shards, forge them together once more and slay Thobrick!",
  ];
  const [visibleLines, setVisibleLines] = useState([]);
  const abortedRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      stopCurrentAudio(0);
      const p = speakText(NARRATION.intro);
      const delays = [0, 2200, 4800, 7400, 8200, 9000];
      delays.forEach((d, i) => {
        setTimeout(() => { if (!abortedRef.current) setVisibleLines(prev => [...prev, i]); }, d);
      });
      await p;
      if (!abortedRef.current) setTimeout(() => { if (!abortedRef.current) onDone(); }, 1200);
    };
    run();
    return () => { abortedRef.current = true; stopCurrentAudio(300); };
  }, []);

  const handleSkip = () => { abortedRef.current = true; stopCurrentAudio(300); onAbort(); onDone(); };

  return (
    <div style={{ ...menuStyle, justifyContent: 'center', gap: 0 }}>
      <div style={{ maxWidth: 680, textAlign: 'center' }}>
        {lines.map((line, i) => (
          <p key={i} style={{
            color: i === 4 ? '#FF9A60' : '#EDE6CF',
            fontSize: i === 4 ? '1.3rem' : '1.05rem',
            fontStyle: i < 3 ? 'italic' : 'normal',
            fontWeight: i >= 4 ? 700 : 400,
            margin: '10px 0',
            opacity: visibleLines.includes(i) ? 1 : 0,
            transform: visibleLines.includes(i) ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
            lineHeight: 1.6,
          }}>{line}</p>
        ))}
      </div>
      <button style={{ ...buttonStyle, marginTop: 40, opacity: 0.6, fontSize: '0.85rem', padding: '10px 20px' }} onClick={handleSkip}>Skip</button>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const menuStyle = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  background: 'radial-gradient(800px 400px at 15% 10%, rgba(120,40,20,0.06), transparent), linear-gradient(180deg, #020203 0%, #09070a 60%, #0b0508 100%)',
  fontFamily: "'Cinzel', 'Merriweather', Georgia, serif", padding: 28,
};

const titleStyle = {
  fontSize: '4rem', color: '#F6E6A8', marginBottom: 12, letterSpacing: 6,
  lineHeight: 1, textTransform: 'uppercase',
  textShadow: '0 12px 40px rgba(0,0,0,0.75), 0 0 18px rgba(220,180,70,0.08)',
};

const buttonStyle = {
  padding: '14px 26px', fontSize: '1.05rem',
  background: 'linear-gradient(180deg,#5a3b1b,#2b1708)',
  border: '1px solid rgba(230,185,70,0.18)', borderRadius: 14,
  color: '#FFF8E6', cursor: 'pointer', margin: 10,
  boxShadow: '0 14px 40px rgba(5,3,2,0.75), inset 0 1px 0 rgba(255,255,255,0.02)',
  transition: 'transform 140ms cubic-bezier(.2,.8,.2,1), box-shadow 140ms ease',
};

const testSectionStyle = {
  marginTop: 48, padding: '20px 28px',
  borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center',
};

const testLabelStyle = {
  color: 'rgba(180,160,100,0.35)', fontSize: '0.7rem',
  letterSpacing: 3, textTransform: 'uppercase', margin: '0 0 14px',
};

const testButtonStyle = {
  padding: '10px 18px', fontSize: '0.88rem',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(213,169,62,0.12)', borderRadius: 10,
  color: 'rgba(239,216,139,0.6)', cursor: 'pointer',
  transition: 'background 140ms ease, color 140ms ease',
};

const textBoxStyle = {
  width: '100%', maxWidth: 980, minHeight: '100vh', padding: 36,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
  background: 'linear-gradient(180deg, rgba(10,8,6,0.6), rgba(4,3,2,0.6))',
  color: '#EDE6CF', textAlign: 'center', borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.02)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.02)',
};

const exitStyle = {
  position: 'fixed', top: 18, left: 18, width: 44, height: 44,
  borderRadius: 10, background: 'linear-gradient(180deg, rgba(255,235,180,0.04), rgba(0,0,0,0.2))',
  color: '#EFD88B', fontSize: 20, cursor: 'pointer',
  border: '1px solid rgba(213,169,62,0.12)', boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
};

const bossButtonBar = {
  position: 'fixed',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
  left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 18, zIndex: 60,
};

const cardStyle = {
  background: 'linear-gradient(180deg, rgba(36,24,18,0.9), rgba(6,4,3,0.9))',
  border: '1px solid rgba(213,169,62,0.12)', padding: 22, borderRadius: 14,
  boxShadow: '0 28px 100px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,255,255,0.02)',
};

const narrationBoxStyle = {
  background: 'rgba(20,12,5,0.75)',
  border: '1px solid rgba(213,169,62,0.15)',
  borderLeft: '3px solid rgba(213,169,62,0.5)',
  borderRadius: 10,
  padding: '14px 18px',
  color: '#D4C49A',
  fontStyle: 'italic',
  fontSize: '0.95rem',
  lineHeight: 1.7,
  textAlign: 'left',
  marginTop: 8,
  width: '100%',
};
