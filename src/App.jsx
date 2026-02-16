<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Boss Phase Test</title>

<style>
body {
    font-family: Arial, sans-serif;
    text-align: center;
    background: #111;
    color: white;
    margin: 0;
    overflow-x: hidden;
}

/* Screen shake animation */
@keyframes shake {
    0% { transform: translate(0, 0); }
    25% { transform: translate(-6px, 4px); }
    50% { transform: translate(6px, -4px); }
    75% { transform: translate(-4px, -6px); }
    100% { transform: translate(0, 0); }
}

.shake {
    animation: shake 0.3s;
}

#game {
    padding: 20px;
}

#boss {
    position: relative;
    width: 300px;
    margin: 20px auto;
}

.boss-part {
    position: absolute;
    left: 0;
    top: 0;
    width: 300px;
}

.damage {
    position: absolute;
    left: 0;
    top: 0;
    width: 300px;
    opacity: 0;
    pointer-events: none;
}

/* Flash effect */
.flash {
    animation: flashDamage 1s forwards;
}

@keyframes flashDamage {
    0% { opacity: 1; }
    100% { opacity: 0; }
}

#controls {
    position: fixed;
    bottom: 0;
    width: 100%;
    background: #222;
    padding: 15px;
    display: flex;
    justify-content: center;
    gap: 20px;
}

button {
    padding: 10px 20px;
    font-size: 16px;
}
</style>
</head>

<body>

<div id="game">

    <div id="setup">
        <h2>Select Players</h2>
        <select id="playerCount">
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
        </select>
        <br><br>
        <button onclick="startGame()">Start Game</button>
    </div>

    <div id="bossPhase" style="display:none;">
        <h2>Act 3 – Boss Fight</h2>

        <div id="boss">

            <!-- Shield -->
            <img id="shield" class="boss-part"
                 src="ScoundrelsOfObryndel/assets/boss-shield.png">
            <img id="shieldDamage" class="damage"
                 src="ScoundrelsOfObryndel/assets/boss-shield-damage.png">

            <!-- Body -->
            <img id="body" class="boss-part"
                 src="ScoundrelsOfObryndel/assets/boss-body.png">
            <img id="bodyDamage" class="damage"
                 src="ScoundrelsOfObryndel/assets/boss-body-damage.png">

            <!-- Head -->
            <img id="head" class="boss-part"
                 src="ScoundrelsOfObryndel/assets/boss-head.png">
            <img id="headDamage" class="damage"
                 src="ScoundrelsOfObryndel/assets/boss-head-damage.png">

        </div>

        <div id="hpDisplay">
            <p>Shield HP: <span id="shieldHP">5</span></p>
            <p>Body HP: <span id="bodyHP">5</span></p>
            <p>Head HP: <span id="headHP">5</span></p>
        </div>
    </div>

</div>

<div id="controls" style="display:none;">
    <button onclick="damagePart('shield')">Damage Shield</button>
    <button onclick="damagePart('body')">Damage Body</button>
    <button onclick="damagePart('head')">Damage Head</button>
</div>

<script>
let players = 1;

let hp = {
    shield: 5,
    body: 5,
    head: 5
};

function startGame() {
    players = document.getElementById("playerCount").value;
    document.getElementById("setup").style.display = "none";

    // Simulate scanning Tile-30
    startBossPhase();
}

function startBossPhase() {
    document.getElementById("bossPhase").style.display = "block";
    document.getElementById("controls").style.display = "flex";
}

function damagePart(part) {
    if (hp[part] <= 0) return;

    hp[part]--;

    document.getElementById(part + "HP").textContent = hp[part];

    // Flash damage overlay
    const dmg = document.getElementById(part + "Damage");
    dmg.classList.remove("flash");
    void dmg.offsetWidth;
    dmg.classList.add("flash");

    // Screen shake
    const game = document.getElementById("game");
    game.classList.remove("shake");
    void game.offsetWidth;
    game.classList.add("shake");

    // Remove part when dead
    if (hp[part] === 0) {
        document.getElementById(part).style.display = "none";
    }
}
</script>

</body>
</html>
