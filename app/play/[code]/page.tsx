"use client";
import { Space_Grotesk } from "next/font/google";
import { useParams } from "next/navigation";
import { useState } from "react";
import { nanoid } from "nanoid";
import { games } from "../../../lib/games";
import type { GameId } from "../../../lib/games/types";
import { useRoomState } from "../../../lib/useRoomState";

const space = Space_Grotesk({ subsets: ["latin"] });

export default function PlayRoom() {
  const { code } = useParams<{ code: string }>();
  const { state, send, channel } = useRoomState(code);
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const players = state?.players ?? [];
  const board = state?.phase === "ttt" ? state.board : Array.from({ length: 9 }, () => null);
  const winner = state?.phase === "ttt" ? state.winner : null;
  const myMark = state?.phase === "ttt" ? state.players.find((p) => p.id === playerId)?.mark : null;
  const myVote = state?.phase === "lobby" ? state.votes[playerId ?? ""] : null;
  const votes = state?.phase === "lobby" ? state.votes : {};
  const unoPlayer = state?.phase === "uno" ? state.players.find((p) => p.id === playerId) ?? null : null;
  const unoTop = state?.phase === "uno" ? state.discardPile[state.discardPile.length - 1] : null;
  const unoIsMyTurn =
    state?.phase === "uno" && playerId ? state.players[state.turnIndex]?.id === playerId : false;
  const [chosenColor, setChosenColor] = useState<"red" | "yellow" | "green" | "blue" | null>(null);
  const codePlayers = state?.phase === "codenames-setup" || state?.phase === "codenames-play" ? state.players : [];
  const me = codePlayers.find((p) => p.id === playerId) ?? null;
  const canGuess =
    state?.phase === "codenames-play" && me && me.team === state.turn && me.role === "guesser" && !state.winner;
  const canMove = Boolean(state?.phase === "ttt" && myMark && state.turn === myMark && !winner);

  const inGame =
    state?.phase === "ttt" ||
    state?.phase === "word" ||
    state?.phase === "codenames-setup" ||
    state?.phase === "codenames-play" ||
    state?.phase === "uno";

  return (
    <main className={`page ${inGame ? "playing" : ""} ${space.className}`}>
      {!inGame && (
        <header className="hero">
          <p className="eyebrow">Player</p>
          <h1 className="title">
            Room <span className="code">{code}</span>
          </h1>
          <p className="subtle">Play a quick game of Tic Tac Toe.</p>
        </header>
      )}

      {!playerId ? (
        <section className={`card ${inGame ? "game-surface" : ""}`}>
          <h2>Join the room</h2>
          <div className="field">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <button
              onClick={() => {
                const id = nanoid(10);
                setPlayerId(id);
                send("player.join", { playerId: id, name });
              }}
              disabled={!name.trim() || !channel}
            >
              Join
            </button>
          </div>
        </section>
      ) : (
        <section className={`card ${inGame ? "game-surface" : ""}`}>
          {!inGame && (
            <h2>
              {state?.phase === "lobby" ? "Vote for a game" : "Waiting room"}
            </h2>
          )}
          {state?.phase === "lobby" ? (
            <>
              <p className="subtle">Pick what you want to play.</p>
              <div className="vote-grid">
                {games.map((game) => (
                  <button
                    key={game.id}
                    className={`vote-card ${myVote === game.id ? "selected" : ""}`}
                    onClick={() => {
                      if (!playerId) return;
                      send("player.vote", { playerId, gameId: game.id });
                    }}
                  >
                    <h3>{game.name}</h3>
                    <p>{game.playersNeeded}</p>
                    <div className="vote-names">
                      {players.filter((p) => votes[p.id] === game.id).length === 0
                        ? "No votes yet"
                        : players
                            .filter((p) => votes[p.id] === game.id)
                            .map((p) => (p.id === playerId ? "You" : p.name))
                            .join(", ")}
                    </div>
                    {myVote === game.id && <span className="vote-pill">Your vote</span>}
                  </button>
                ))}
              </div>
            </>
          ) : state?.phase === "ttt" ? (
            <>
              <div className="name-row">
                {state.players.map((p) => (
                  <div key={p.id} className={`name-pill ${state.turn === p.mark ? "active" : ""}`}>
                    <span className="pill-mark">{p.mark}</span>
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
              {winner && <p className="prompt">{winner === "draw" ? "Draw!" : `Winner: ${winner}`}</p>}
              <div className="board">
                {board.map((cell, idx) => (
                  <button
                    key={idx}
                    className={`cell ${cell ? "filled" : ""}`}
                    onClick={() => {
                      if (!canMove || cell || !playerId) return;
                      send("player.move", { playerId, index: idx });
                    }}
                    disabled={!canMove || Boolean(cell)}
                  >
                    {cell ?? ""}
                  </button>
                ))}
              </div>
              {myMark && <p className="subtle">You are {myMark}</p>}
            </>
          ) : state?.phase === "word" ? (
            <>
              <p className="prompt">{state.prompt}</p>
              <div className="field">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="One word"
                />
                <button
                  onClick={() => {
                    if (!playerId) return;
                    send("player.submit", { playerId, text });
                  }}
                  disabled={!text.trim()}
                >
                  Send
                </button>
              </div>
            </>
          ) : state?.phase === "codenames-setup" ? (
            <>
              <p className="prompt">Host is setting up teams and spymasters…</p>
              {me && (
                <div className="subtle">
                  You are on {me.team ?? "no team yet"} as {me.role}.
                </div>
              )}
            </>
          ) : state?.phase === "codenames-play" ? (
            <>
              <div className="name-row">
                {codePlayers.map((p) => (
                  <div key={p.id} className={`name-pill ${state.turn === p.team ? "active" : ""}`}>
                    <span className="pill-mark">{p.team ? p.team[0].toUpperCase() : "?"}</span>
                    <span>{p.name}</span>
                    <span className="role">{p.role}</span>
                  </div>
                ))}
              </div>
              <p className="prompt">{state.winner ? `Winner: ${state.winner}` : `Turn: ${state.turn}`}</p>
              {canGuess && <p className="subtle">Tap a word card to make a guess.</p>}
              {state.cards.length === 0 ? (
                <p className="subtle">Board loading…</p>
              ) : (
                <div className="codenames-grid">
                  {state.cards.map((card, idx) => {
                    const showColor = me?.role === "spymaster" || card.revealed;
                    return (
                      <button
                        key={`${card.word}-${idx}`}
                        className={`code-card ${showColor ? card.color : "hidden"} ${
                          card.revealed ? "revealed" : ""
                        }`}
                        onClick={() => {
                          if (!playerId || !canGuess) return;
                          if (card.revealed) return;
                          send("player.reveal", { playerId, index: idx });
                        }}
                        disabled={!canGuess || card.revealed}
                      >
                        {card.word}
                      </button>
                    );
                  })}
                </div>
              )}
              {canGuess && (
                <button className="end-turn" onClick={() => playerId && send("player.endTurn", { playerId })}>
                  End Turn
                </button>
              )}
            </>
          ) : state?.phase === "uno" ? (
            <>
              <div className="uno-status">
                <span>Top: {unoTop?.value}</span>
                <span>Color: {state.currentColor}</span>
                <span>Turn: {state.players[state.turnIndex]?.name}</span>
              </div>
              <div className="uno-piles">
                <div className="uno-pile">
                  <div className="uno-stack neat">
                    <div className="uno-card back" />
                    <div className="uno-card back layer" />
                    <div className="uno-card back layer" />
                  </div>
                  <span className="uno-count">{state.drawPile.length}</span>
                </div>
                <div className="uno-pile">
                  <div className="uno-stack messy">
                    <div className="uno-card layer tilt-left" />
                    <div className="uno-card layer tilt-right" />
                    <div className={`uno-card top ${unoTop?.color ?? ""}`}>
                      <span className="uno-value">{unoTop?.value}</span>
                    </div>
                  </div>
                  <span className="uno-count">{state.discardPile.length}</span>
                </div>
              </div>
              <div className="uno-actions">
                <button
                  onClick={() => playerId && send("player.uno.draw", { playerId })}
                  disabled={!unoIsMyTurn}
                >
                  Draw
                </button>
                {unoIsMyTurn && unoPlayer && unoPlayer.hand.some((c) => c.color === "wild") && (
                  <div className="uno-color">
                    {(["red", "yellow", "green", "blue"] as const).map((color) => (
                      <button
                        key={color}
                        className={`chip ${chosenColor === color ? "active" : ""}`}
                        onClick={() => setChosenColor(color)}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="uno-hand">
                {unoPlayer?.hand.map((card, index, list) => {
                  const spread = Math.min(90, Math.max(45, list.length * 6.5));
                  const angle = list.length <= 1 ? 0 : -spread / 2 + (index * spread) / (list.length - 1);
                  return (
                  <button
                    key={card.id}
                    className={`uno-card ${card.color}`}
                    style={
                      {
                        "--angle": `${angle}deg`,
                        "--offset": `${(index - (list.length - 1) / 2) * 3}px`,
                        zIndex: index,
                      } as React.CSSProperties
                    }
                    onClick={() => {
                      if (!playerId || !unoIsMyTurn) return;
                      if (card.color === "wild" && !chosenColor) return;
                      send("player.uno.play", { playerId, cardId: card.id, chosenColor: chosenColor ?? undefined });
                      if (card.color === "wild") setChosenColor(null);
                    }}
                    disabled={!unoIsMyTurn}
                  >
                    <span className="uno-value">
                      {card.value === "reverse"
                        ? "⟲"
                        : card.value === "skip"
                        ? "⦸"
                        : card.value === "draw2"
                        ? "+2"
                        : card.value === "wild"
                        ? "★"
                        : card.value === "wild4"
                        ? "+4"
                        : card.value}
                    </span>
                  </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="subtle">Hang tight while the host starts the game.</p>
          )}
        </section>
      )}

      <style jsx>{`
        :global(body) {
          margin: 0;
          background: radial-gradient(circle at top, #f8f4ff, #fef7ed 55%, #f6fbff);
          color: #161319;
        }
        .page {
          min-height: 100vh;
          padding: 32px 28px 48px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .page.playing {
          padding: 0;
          gap: 0;
        }
        .hero {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .eyebrow {
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-size: 12px;
          margin: 0;
        }
        .title {
          font-size: clamp(26px, 5vw, 40px);
          margin: 0;
        }
        .code {
          background: #161319;
          color: #fef7ed;
          padding: 6px 12px;
          border-radius: 999px;
          font-weight: 700;
        }
        .subtle {
          margin: 0;
          color: #5a5661;
        }
        .card {
          background: #ffffff;
          border: 1px solid #f0e7f6;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 18px 40px rgba(23, 15, 44, 0.06);
        }
        .card.game-surface {
          background: transparent;
          border: none;
          box-shadow: none;
        }
        .game-surface {
          min-height: 100vh;
          width: 100vw;
          border-radius: 0;
          border: none;
          box-shadow: none;
          background: transparent;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        h2 {
          margin: 0 0 12px;
          font-size: 22px;
        }
        .prompt {
          font-size: 20px;
          margin: 0 0 16px;
        }
        .name-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin: 0 0 16px;
          justify-content: center;
        }
        .name-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 999px;
          background: #ffffff;
          border: 1px solid #eee6f4;
          font-weight: 600;
        }
        .name-pill .role {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6c6772;
        }
        .name-pill.active {
          border-color: #161319;
          box-shadow: 0 10px 18px rgba(22, 19, 25, 0.18);
        }
        .pill-mark {
          background: #161319;
          color: #fef7ed;
          font-weight: 700;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 12px;
        }
        .vote-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .vote-card {
          background: #fef7ed;
          border-radius: 16px;
          border: 1px solid #f4e2cc;
          padding: 14px 16px;
          text-align: left;
          cursor: pointer;
          color: #161319;
        }
        .vote-card.selected {
          border-color: #161319;
          box-shadow: 0 8px 18px rgba(22, 19, 25, 0.12);
        }
        .vote-card h3 {
          margin: 0 0 4px;
        }
        .vote-card p {
          margin: 0;
          color: #5a5661;
        }
        .vote-names {
          margin-top: 8px;
          font-size: 13px;
          color: #5a5661;
        }
        .vote-pill {
          display: inline-block;
          margin-top: 8px;
          background: #161319;
          color: #fef7ed;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
        }
        .board {
          display: grid;
          grid-template-columns: repeat(3, minmax(84px, 110px));
          gap: 12px;
          justify-content: center;
          margin-bottom: 12px;
          padding: 12px;
          background: linear-gradient(135deg, #f6ede0, #f9f2e7);
          border-radius: 18px;
          border: 1px solid #f4e2cc;
          box-shadow: inset 0 2px 8px rgba(40, 30, 20, 0.08);
        }
        .cell {
          background: linear-gradient(180deg, #fff6e7, #f3e1c8);
          border-radius: 18px;
          border: 1px solid #e9d1b4;
          font-size: 34px;
          font-weight: 800;
          display: grid;
          place-items: center;
          height: 92px;
          cursor: pointer;
          color: #1d1820;
          box-shadow: 0 10px 16px rgba(32, 20, 10, 0.12), inset 0 2px 2px rgba(255, 255, 255, 0.6);
          transform: translateY(-1px);
        }
        .cell:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 22px rgba(32, 20, 10, 0.16), inset 0 2px 2px rgba(255, 255, 255, 0.7);
        }
        .cell:disabled {
          cursor: not-allowed;
          opacity: 0.85;
        }
        .cell.filled {
          background: linear-gradient(180deg, #f7f1ff, #e8dcff);
          border-color: #d9c8ff;
          box-shadow: 0 10px 18px rgba(45, 24, 88, 0.14), inset 0 2px 2px rgba(255, 255, 255, 0.7);
        }
        .codenames-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(64px, 1fr));
          gap: 8px;
          width: min(720px, 90vw);
          margin: 12px 0;
        }
        .code-card {
          border-radius: 10px;
          border: 1px solid #f4e2cc;
          background: #fff7e9;
          padding: 10px;
          font-weight: 600;
          min-height: 52px;
          text-align: center;
          cursor: pointer;
        }
        .code-card:disabled {
          cursor: not-allowed;
          opacity: 0.9;
        }
        .code-card.hidden {
          background: #fffaf1;
          border-color: #f4e2cc;
        }
        .code-card.red {
          background: #ffe2e2;
          border-color: #eaa3a3;
        }
        .code-card.blue {
          background: #e2edff;
          border-color: #9db8f1;
        }
        .code-card.neutral {
          background: #f0e6d6;
          border-color: #d5c4a6;
        }
        .code-card.assassin {
          background: #2a2025;
          color: #fef7ed;
          border-color: #2a2025;
        }
        .code-card.red.revealed {
          background: #ffd3d3;
          border-color: #d84a4a;
        }
        .code-card.blue.revealed {
          background: #d7e5ff;
          border-color: #3a6ed8;
        }
        .code-card.neutral.revealed {
          background: #ece4d6;
          border-color: #c9b79d;
        }
        .code-card.assassin.revealed {
          background: #2a2025;
          color: #fef7ed;
          border-color: #2a2025;
        }
        .end-turn {
          margin-top: 8px;
        }
        .uno-status {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .uno-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .uno-piles {
          display: flex;
          gap: 16px;
          align-items: flex-end;
          margin: 10px 0 14px;
        }
        .uno-pile {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .uno-color {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .uno-hand {
          display: flex;
          justify-content: center;
          align-items: flex-end;
          gap: 2px;
          flex-wrap: nowrap;
          margin-top: 8px;
          padding-bottom: 8px;
        }
        .uno-card {
          width: 70px;
          height: 100px;
          border-radius: 12px;
          border: 1px solid #f4e2cc;
          background: #fff7e9;
          display: grid;
          place-items: center;
          font-weight: 700;
          color: #111111;
          margin-left: -34px;
          transform-origin: 50% 290%;
          transform: translateX(var(--offset)) rotate(var(--angle)) translateY(-14px);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 12px 18px rgba(32, 20, 10, 0.18);
        }
        .uno-card:first-child {
          margin-left: 0;
        }
        .uno-card:hover {
          transform: translateX(var(--offset)) rotate(var(--angle)) translateY(-24px);
          box-shadow: 0 14px 22px rgba(32, 20, 10, 0.16);
        }
        .uno-value {
          font-size: 24px;
        }
        .uno-card.red {
          background: #ffb7b7;
          border-color: #d84a4a;
        }
        .uno-card.blue {
          background: #bcd4ff;
          border-color: #3a6ed8;
        }
        .uno-card.green {
          background: #b7f0c2;
          border-color: #3b9b55;
        }
        .uno-card.yellow {
          background: #ffe7a6;
          border-color: #d9a43b;
        }
        .uno-card.back {
          background: repeating-linear-gradient(45deg, #161319, #161319 8px, #2c2532 8px, #2c2532 16px);
        }
        .uno-stack {
          position: relative;
          width: 70px;
          height: 100px;
        }
        .uno-stack.neat .uno-card {
          position: absolute;
          inset: 0;
          box-shadow: 0 8px 14px rgba(32, 20, 10, 0.16);
        }
        .uno-stack.neat .uno-card.layer:nth-child(2) {
          transform: translate(2px, 2px);
          opacity: 0.95;
        }
        .uno-stack.neat .uno-card.layer:nth-child(3) {
          transform: translate(4px, 4px);
          opacity: 0.9;
        }
        .uno-stack.messy .uno-card {
          position: absolute;
          inset: 0;
          box-shadow: 0 10px 16px rgba(32, 20, 10, 0.18);
        }
        .uno-stack.messy .tilt-left {
          transform: rotate(-5deg) translate(-2px, 1px);
        }
        .uno-stack.messy .tilt-right {
          transform: rotate(5deg) translate(2px, 2px);
        }
        .uno-stack.messy .top {
          transform: rotate(0deg);
          z-index: 2;
        }
        .field {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        input {
          flex: 1;
          min-width: 200px;
          border-radius: 999px;
          border: 1px solid #e8e2f2;
          padding: 12px 16px;
          font-size: 16px;
          background: #fffdf9;
        }
        button {
          border: none;
          background: #161319;
          color: #fef7ed;
          padding: 12px 20px;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </main>
  );
}
