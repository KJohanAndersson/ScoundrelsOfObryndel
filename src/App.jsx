// ------------ BOSS PHASE ----------------
if (screen === 'boss') {
  const bossDead =
    boss.head === 0 && boss.body === 0 && boss.shield === 0;

  // Handle damage flashing
  const flashDamage = (part) => {
    const el = document.getElementById(part + 'Damage');
    if (!el) return;
    el.style.opacity = 1; // show overlay
    setTimeout(() => {
      el.style.opacity = 0; // hide overlay after 1s
    }, 1000);
  };

  const handleDamage = (part) => {
    damageBoss(part);
    flashDamage(part);
  };

  return (
    <div style={textBoxStyle}>
      <ExitButton onClick={resetGame} />
      <h2 style={{ color: '#FFD700', marginBottom: 10 }}>ACT 3: FINAL BOSS</h2>

      {bossDead ? (
        <>
          <h2>Victory!</h2>
          <button style={buttonStyle} onClick={resetGame}>
            Main Menu
          </button>
        </>
      ) : (
        <>
          <div
            style={{
              position: 'relative',
              width: 250,
              height: 250,
              marginTop: -30, // move boss sprite up slightly
            }}
          >
            {boss.body > 0 && (
              <>
                <img src={bossBody} style={layerStyle} alt="body" />
                <img
                  id="bodyDamage"
                  src="./assets/boss-body-damage.png"
                  style={{ ...layerStyle, opacity: 0 }}
                  alt="body damage"
                />
              </>
            )}

            {boss.shield > 0 && (
              <>
                <img src={bossShield} style={layerStyle} alt="shield" />
                <img
                  id="shieldDamage"
                  src="./assets/boss-shield-damage.png"
                  style={{ ...layerStyle, opacity: 0 }}
                  alt="shield damage"
                />
              </>
            )}

            {boss.head > 0 && (
              <>
                <img src={bossHead} style={layerStyle} alt="head" />
                <img
                  id="headDamage"
                  src="./assets/boss-head-damage.png"
                  style={{ ...layerStyle, opacity: 0 }}
                  alt="head damage"
                />
              </>
            )}
          </div>

          <div style={{ marginTop: 40 }}>
            <p>Head HP: {boss.head}</p>
            <p>Body HP: {boss.body}</p>
            <p>Shield HP: {boss.shield}</p>
          </div>

          <div style={bossButtonBar}>
            <button style={buttonStyle} onClick={() => handleDamage('head')}>
              Hit Head
            </button>
            <button style={buttonStyle} onClick={() => handleDamage('body')}>
              Hit Body
            </button>
            <button style={buttonStyle} onClick={() => handleDamage('shield')}>
              Hit Shield
            </button>
          </div>
        </>
      )}
    </div>
  );
}
