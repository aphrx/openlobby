"use client";
import { Space_Grotesk } from "next/font/google";
import { useParams } from "next/navigation";
import { useState } from "react";
import { nanoid } from "nanoid";
import { useRoomState } from "../../../lib/useRoomState";

const space = Space_Grotesk({ subsets: ["latin"] });

export default function PlayRoom() {
  const { code } = useParams<{ code: string }>();
  const { state, send, channel } = useRoomState(code);
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const board = state?.phase === "playing" || state?.phase === "over" ? state.board : Array.from({ length: 9 }, () => null);
  const winner = state?.phase === "over" ? state.winner : null;
  const myMark =
    state?.phase === "playing" || state?.phase === "over"
      ? state.players.find((p) => p.id === playerId)?.mark
      : null;
  const canMove = Boolean(
    state?.phase === "playing" && myMark && state.turn === myMark && !winner,
  );

  return (
    <main className={`page ${space.className}`}>
      <header className="hero">
        <p className="eyebrow">Player</p>
        <h1 className="title">
          Room <span className="code">{code}</span>
        </h1>
        <p className="subtle">Play a quick game of Tic Tac Toe.</p>
      </header>

      {!playerId ? (
        <section className="card">
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
        <section className="card">
          <h2>{state?.phase === "playing" || state?.phase === "over" ? "Your move" : "Waiting room"}</h2>
          {state?.phase === "playing" || state?.phase === "over" ? (
            <>
              <p className="prompt">
                {winner ? (winner === "draw" ? "Draw!" : `Winner: ${winner}`) : `Turn: ${state.turn}`}
              </p>
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
        h2 {
          margin: 0 0 12px;
          font-size: 22px;
        }
        .prompt {
          font-size: 20px;
          margin: 0 0 16px;
        }
        .board {
          display: grid;
          grid-template-columns: repeat(3, minmax(80px, 110px));
          gap: 10px;
          justify-content: start;
          margin-bottom: 12px;
        }
        .cell {
          background: #fef7ed;
          border-radius: 16px;
          border: 1px solid #f4e2cc;
          font-size: 32px;
          font-weight: 700;
          display: grid;
          place-items: center;
          height: 90px;
          cursor: pointer;
        }
        .cell:disabled {
          cursor: not-allowed;
          opacity: 0.8;
        }
        .cell.filled {
          background: #f7f1ff;
          border-color: #e3d6fb;
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
