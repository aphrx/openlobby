"use client";
import { Space_Grotesk } from "next/font/google";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Types } from "ably";
import { type GamePlayer, type Mark, useRoomState } from "../../../lib/useRoomState";

const space = Space_Grotesk({ subsets: ["latin"] });

const EMPTY_BOARD = Array.from({ length: 9 }, () => null as Mark | null);

function checkWinner(board: (Mark | null)[]) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every((cell) => cell)) return "draw";
  return null;
}

export default function HostRoom() {
  const { code } = useParams<{ code: string }>();
  const { state, setState, channel, publishState } = useRoomState(code);
  const players = state?.players ?? [];
  const gamePlayers = state?.phase === "lobby" ? [] : state?.players ?? [];
  const [shareUrl, setShareUrl] = useState("");
  const board = state?.phase === "lobby" ? EMPTY_BOARD : state?.board ?? EMPTY_BOARD;
  const turn = state?.phase === "lobby" ? null : state?.turn ?? null;
  const winner = state?.phase === "lobby" ? null : state?.winner ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShareUrl(`${window.location.origin}/play/${code}`);
  }, [code]);

  useEffect(() => {
    if (!channel || !code || state) return;
    publishState({ phase: "lobby", code, players: [] });
  }, [channel, code, publishState, state]);

  const updateState = useCallback(
    (updater: (current: typeof state) => typeof state) => {
      setState((current) => {
        const next = updater(current);
        if (next && channel) channel.publish("state.update", next);
        return next;
      });
    },
    [channel, setState],
  );

  useEffect(() => {
    if (!channel || !code) return;
    const onJoin = (msg: Types.Message) => {
      const data = msg.data as { playerId?: string; name?: string } | null;
      const playerId = data?.playerId;
      const name = data?.name?.trim();
      if (!playerId || !name) return;
      updateState((current) => {
        if (!current || current.phase === "lobby") {
          const base = current ?? { phase: "lobby", code, players: [] };
          if (base.players.some((p) => p.id === playerId)) return base;
          if (base.players.length >= 2) return base;
          return { ...base, players: [...base.players, { id: playerId, name }] };
        }
        return current;
      });
    };
    const onMove = (msg: Types.Message) => {
      const data = msg.data as { playerId?: string; index?: number } | null;
      const playerId = data?.playerId;
      const index = data?.index;
      if (!playerId || index === undefined) return;
      updateState((current) => {
        if (!current || current.phase !== "playing") return current;
        const player = current.players.find((p) => p.id === playerId);
        if (!player) return current;
        if (player.mark !== current.turn) return current;
        if (current.board[index]) return current;
        const nextBoard = [...current.board];
        nextBoard[index] = player.mark;
        const result = checkWinner(nextBoard);
        if (result) {
          return {
            ...current,
            board: nextBoard,
            winner: result,
            phase: "over",
          };
        }
        return {
          ...current,
          board: nextBoard,
          turn: current.turn === "X" ? "O" : "X",
        };
      });
    };
    channel.subscribe("player.join", onJoin);
    channel.subscribe("player.move", onMove);
    return () => {
      channel.unsubscribe("player.join", onJoin);
      channel.unsubscribe("player.move", onMove);
    };
  }, [channel, code, updateState]);

  const canStart = players.length === 2;
  const startGame = useCallback(() => {
    if (!code) return;
    if (players.length < 2) return;
    const assigned: GamePlayer[] = [
      { ...players[0], mark: "X" },
      { ...players[1], mark: "O" },
    ];
    publishState({
      phase: "playing",
      code,
      players: assigned,
      board: [...EMPTY_BOARD],
      turn: "X",
      winner: null,
    });
  }, [code, players, publishState]);

  const playAgain = useCallback(() => {
    if (!code) return;
    if (state?.phase === "lobby") return;
    const assigned = state?.players ?? [];
    if (assigned.length < 2) {
      publishState({ phase: "lobby", code, players: assigned.map(({ id, name }) => ({ id, name })) });
      return;
    }
    publishState({
      phase: "playing",
      code,
      players: assigned,
      board: [...EMPTY_BOARD],
      turn: "X",
      winner: null,
    });
  }, [code, publishState, state]);

  const status = useMemo(() => {
    if (!state) return "Waiting for players…";
    if (state.phase === "lobby") return "Waiting for 2 players.";
    if (state.phase === "playing") return `Turn: ${state.turn}`;
    if (state.winner === "draw") return "Draw!";
    return `Winner: ${state.winner}`;
  }, [state]);

  return (
    <main className={`page ${space.className}`}>
      <header className="hero">
        <div>
          <p className="eyebrow">Host Room</p>
          <h1 className="title">
            Code <span className="code">{code}</span>
          </h1>
          <p className="subtle">Players join at</p>
          <div className="share">{shareUrl}</div>
        </div>
        <div className="stats">
          <div>
            <p className="stat-label">Players</p>
            <p className="stat-value">{players.length}</p>
          </div>
          <div>
            <p className="stat-label">Status</p>
            <p className="stat-value">{state?.phase === "lobby" ? "Lobby" : "Game"}</p>
          </div>
        </div>
      </header>

      {state?.phase === "lobby" && (
        <section className="card">
          <div className="card-header">
            <h2>Lobby</h2>
            <button onClick={startGame} disabled={!canStart || !channel}>
              Start Game
            </button>
          </div>
          {players.length === 0 ? (
            <p className="empty">Waiting for players…</p>
          ) : (
            <div className="player-grid">
              {players.map((p: any) => (
                <div key={p.id} className="player">
                  <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                  <span className="name">{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {state?.phase !== "lobby" && (
        <section className="card">
          <div className="card-header">
            <h2>Tic Tac Toe</h2>
            <button onClick={playAgain} disabled={!channel}>
              New Game
            </button>
          </div>
          <p className="prompt">{status}</p>
          <div className="board">
            {board.map((cell, idx) => (
              <div key={idx} className={`cell ${cell ? "filled" : ""}`}>
                {cell ?? ""}
              </div>
            ))}
          </div>
          <div className="legend">
            {gamePlayers.map((p) => (
              <div key={p.id} className="legend-row">
                <span className="legend-mark">{p.mark}</span>
                <span>{p.name}</span>
              </div>
            ))}
          </div>
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
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          flex-wrap: wrap;
        }
        .eyebrow {
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-size: 12px;
          margin: 0 0 8px;
        }
        .title {
          font-size: clamp(28px, 5vw, 44px);
          margin: 0 0 8px;
        }
        .code {
          background: #161319;
          color: #fef7ed;
          padding: 6px 12px;
          border-radius: 999px;
          font-weight: 700;
        }
        .subtle {
          margin: 0 0 6px;
          color: #5a5661;
        }
        .share {
          background: #ffffff;
          border-radius: 12px;
          padding: 10px 14px;
          border: 1px solid #e8e2f2;
          font-size: 14px;
          word-break: break-all;
        }
        .stats {
          display: flex;
          gap: 16px;
          background: #ffffff;
          border: 1px solid #eee6f4;
          border-radius: 16px;
          padding: 16px 18px;
          min-width: 220px;
        }
        .stat-label {
          margin: 0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #6c6772;
        }
        .stat-value {
          margin: 6px 0 0;
          font-size: 24px;
          font-weight: 700;
        }
        .card {
          background: #ffffff;
          border: 1px solid #f0e7f6;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 18px 40px rgba(23, 15, 44, 0.06);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        h2 {
          margin: 0;
          font-size: 24px;
        }
        button {
          border: none;
          background: #161319;
          color: #fef7ed;
          padding: 10px 18px;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .player-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          margin-top: 16px;
        }
        .player {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f7f1ff;
          padding: 10px 12px;
          border-radius: 14px;
        }
        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #161319;
          color: #fef7ed;
          display: grid;
          place-items: center;
          font-weight: 700;
        }
        .name {
          font-weight: 600;
        }
        .prompt {
          font-size: 20px;
          margin: 14px 0 18px;
        }
        .board {
          display: grid;
          grid-template-columns: repeat(3, minmax(80px, 120px));
          gap: 10px;
          justify-content: start;
        }
        .cell {
          background: #fef7ed;
          border-radius: 16px;
          border: 1px solid #f4e2cc;
          font-size: 32px;
          font-weight: 700;
          display: grid;
          place-items: center;
          height: 100px;
        }
        .cell.filled {
          background: #f7f1ff;
          border-color: #e3d6fb;
        }
        .legend {
          display: flex;
          gap: 18px;
          margin-top: 18px;
          flex-wrap: wrap;
        }
        .legend-row {
          display: flex;
          gap: 8px;
          align-items: center;
          background: #ffffff;
          border: 1px solid #eee6f4;
          border-radius: 999px;
          padding: 6px 12px;
        }
        .legend-mark {
          background: #161319;
          color: #fef7ed;
          font-weight: 700;
          border-radius: 999px;
          padding: 4px 8px;
        }
        .empty {
          margin-top: 16px;
          color: #7b7482;
        }
        @media (max-width: 600px) {
          .stats {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </main>
  );
}
