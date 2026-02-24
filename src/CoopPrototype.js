import React, { useState, useEffect } from "react";

const GRID_SIZE = 10;

const PLAYER_COLORS = ["red", "blue", "yellow", "green"];

const START_POS = { x: 4, y: 4 };

const CORNERS = [
  { x: 0, y: 0, color: "red" },
  { x: 9, y: 0, color: "blue" },
  { x: 0, y: 9, color: "yellow" },
  { x: 9, y: 9, color: "green" },
];

export default function CoopPrototype({ onExit }) {
  const [playerCount, setPlayerCount] = useState(2);
  const [phase, setPhase] = useState("setup");
  const [grid, setGrid] = useState([]);
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [actionMode, setActionMode] = useState(null);
  const [selectedTile, setSelectedTile] = useState(null);
  const [message, setMessage] = useState("");

  // ────────────────────────────
  // INITIALIZE GAME
  // ────────────────────────────
  const initializeGame = () => {
    const newGrid = [];

    for (let y = 0; y < GRID_SIZE; y++) {
      const row = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        row.push(PLAYER_COLORS[Math.floor(Math.random() * playerCount)]);
      }
      newGrid.push(row);
    }

    // Start tile white
    newGrid[START_POS.y][START_POS.x] = "white";

    // Corner tiles white
    CORNERS.forEach(c => {
      newGrid[c.y][c.x] = "white";
    });

    setGrid(newGrid);

    const newPlayers = PLAYER_COLORS.slice(0, playerCount).map(color => ({
      color,
      x: START_POS.x,
      y: START_POS.y,
      hasObject: false,
    }));

    setPlayers(newPlayers);
    setCurrentPlayer(0);
    setPhase("game");
    setMessage("");
  };

  // ────────────────────────────
  // MOVEMENT
  // ────────────────────────────
  const movePlayer = (dx, dy) => {
    const player = players[currentPlayer];
    const newX = player.x + dx;
    const newY = player.y + dy;

    if (
      newX < 0 ||
      newY < 0 ||
      newX >= GRID_SIZE ||
      newY >= GRID_SIZE
    )
      return;

    const tileColor = grid[newY][newX];

    if (
      tileColor !== player.color &&
      tileColor !== "white"
    )
      return;

    const updated = [...players];
    updated[currentPlayer] = { ...player, x: newX, y: newY };

    // Check object pickup
    const corner = CORNERS.find(
      c => c.x === newX && c.y === newY && c.color === player.color
    );
    if (corner && !player.hasObject) {
      updated[currentPlayer].hasObject = true;
      setMessage(`${player.color.toUpperCase()} collected their object!`);
    }

    setPlayers(updated);
    endTurn();
  };

  // ────────────────────────────
  // SWITCH COLORS
  // ────────────────────────────
  const handleTileClick = (x, y) => {
    if (actionMode !== "switch") return;

    // Can't switch start or corner
    if (
      (x === START_POS.x && y === START_POS.y) ||
      CORNERS.some(c => c.x === x && c.y === y)
    )
      return;

    // Can't switch occupied
    if (players.some(p => p.x === x && p.y === y)) return;

    if (!selectedTile) {
      setSelectedTile({ x, y });
    } else {
      const newGrid = [...grid];
      const temp = newGrid[y][x];
      newGrid[y][x] =
        newGrid[selectedTile.y][selectedTile.x];
      newGrid[selectedTile.y][selectedTile.x] = temp;

      setGrid(newGrid);
      setSelectedTile(null);
      endTurn();
    }
  };

  // ────────────────────────────
  // END TURN
  // ────────────────────────────
  const endTurn = () => {
    setActionMode(null);
    setSelectedTile(null);

    const next = (currentPlayer + 1) % playerCount;
    setCurrentPlayer(next);

    checkWin();
  };

  // ────────────────────────────
  // WIN CONDITION
  // ────────────────────────────
  const checkWin = () => {
    const allHaveObjects = players.every(p => p.hasObject);
    const allAtStart = players.every(
      p => p.x === START_POS.x && p.y === START_POS.y
    );

    if (allHaveObjects && allAtStart) {
      setMessage("All objects merged! You win!");
    }
  };

  // ────────────────────────────
  // KEY CONTROLS (WASD)
  // ────────────────────────────
  useEffect(() => {
    const handleKey = e => {
      if (actionMode !== "move") return;

      if (e.key === "w") movePlayer(0, -1);
      if (e.key === "s") movePlayer(0, 1);
      if (e.key === "a") movePlayer(-1, 0);
      if (e.key === "d") movePlayer(1, 0);
    };

    window.addEventListener("keydown", handleKey);
    return () =>
      window.removeEventListener("keydown", handleKey);
  });

  // ────────────────────────────
  // RENDER
  // ────────────────────────────
  if (phase === "setup") {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <h2>Co-op Prototype</h2>

        <p>Players: {playerCount}</p>
        <input
          type="range"
          min="2"
          max="4"
          value={playerCount}
          onChange={e =>
            setPlayerCount(parseInt(e.target.value))
          }
        />

        <br />
        <button onClick={initializeGame}>
          Start Game
        </button>
        <button onClick={onExit}>Back</button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h3>
        Player {currentPlayer + 1} (
        {players[currentPlayer].color})
      </h3>

      <div style={{ marginBottom: 15 }}>
        <button onClick={() => setActionMode("move")}>
          Move (WASD)
        </button>
        <button onClick={() => setActionMode("switch")}>
          Switch Tiles
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, 40px)`,
          justifyContent: "center",
        }}
      >
        {grid.map((row, y) =>
          row.map((cell, x) => {
            const playerHere = players.find(
              p => p.x === x && p.y === y
            );

            const corner = CORNERS.find(
              c => c.x === x && c.y === y
            );

            return (
              <div
                key={`${x}-${y}`}
                onClick={() =>
                  handleTileClick(x, y)
                }
                style={{
                  width: 40,
                  height: 40,
                  background: cell,
                  border: "1px solid black",
                  position: "relative",
                  cursor:
                    actionMode === "switch"
                      ? "pointer"
                      : "default",
                }}
              >
                {corner && (
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: corner.color,
                      position: "absolute",
                      top: 4,
                      left: 4,
                    }}
                  />
                )}

                {playerHere && (
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background:
                        playerHere.color,
                      position: "absolute",
                      bottom: 4,
                      right: 4,
                      border: "2px solid white",
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      <p style={{ marginTop: 20 }}>{message}</p>
    </div>
  );
}
