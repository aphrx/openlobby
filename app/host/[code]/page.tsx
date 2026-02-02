"use client";
import { Space_Grotesk } from "next/font/google";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Types } from "ably";
import { useRoomState } from "../../../lib/useRoomState";

const space = Space_Grotesk({ subsets: ["latin"] });

const PROMPTS = [
  "Write one word that describes your day.",
  "Write one word a villain would put on a welcome mat.",
  "Write one word you'd never want to hear a doctor say.",
  "Write one word that belongs in a space adventure.",
  "Write one word that sounds like a dance move.",
  "Write one word your pet is secretly thinking.",
];

function pickPrompt() {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}

export default function HostRoom() {
  const { code } = useParams<{ code: string }>();
  const { state, setState, channel, publishState } = useRoomState(code);
  const players = state?.players ?? [];
  const submissions = state?.phase === "prompt" ? state.submissions : {};
  const submittedCount = Object.keys(submissions).length;
  const [shareUrl, setShareUrl] = useState("");

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
        const base =
          current ??
          ({
            phase: "lobby",
            code,
            players: [],
          } as const);
        if (base.players.some((p) => p.id === playerId)) return base;
        const nextPlayers = [...base.players, { id: playerId, name }];
        if (base.phase === "lobby") {
          return { ...base, players: nextPlayers };
        }
        return { ...base, players: nextPlayers };
      });
    };
    const onSubmit = (msg: Types.Message) => {
      const data = msg.data as { playerId?: string; text?: string } | null;
      const playerId = data?.playerId;
      const text = data?.text?.trim();
      if (!playerId || !text) return;
      updateState((current) => {
        if (!current || current.phase !== "prompt") return current;
        if (!current.players.some((p) => p.id === playerId)) return current;
        return { ...current, submissions: { ...current.submissions, [playerId]: text } };
      });
    };
    channel.subscribe("player.join", onJoin);
    channel.subscribe("player.submit", onSubmit);
    return () => {
      channel.unsubscribe("player.join", onJoin);
      channel.unsubscribe("player.submit", onSubmit);
    };
  }, [channel, code, updateState]);

  const startRound = useCallback(() => {
    if (!code) return;
    const base = state ?? { phase: "lobby", code, players: [] };
    publishState({
      phase: "prompt",
      code,
      prompt: pickPrompt(),
      submissions: {},
      players: base.players,
    });
  }, [code, publishState, state]);

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
            <p className="stat-label">Submitted</p>
            <p className="stat-value">
              {submittedCount}/{players.length || 1}
            </p>
          </div>
        </div>
      </header>

      {state?.phase === "lobby" && (
        <section className="card">
          <div className="card-header">
            <h2>Lobby</h2>
            <button onClick={startRound} disabled={players.length < 1 || !channel}>
              Start Round
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

      {state?.phase === "prompt" && (
        <section className="card">
          <div className="card-header">
            <h2>Word Wall</h2>
            <button onClick={startRound}>New Prompt</button>
          </div>
          <p className="prompt">{state.prompt}</p>
          {submittedCount === 0 ? (
            <p className="empty">No words yet. The wall is waiting.</p>
          ) : (
            <div className="wall">
              {Object.entries(submissions as Record<string, string>).map(([playerId, text]) => {
                const player = players.find((p: any) => p.id === playerId);
                return (
                  <div key={playerId} className="word">
                    <span className="word-text">{text}</span>
                    <span className="word-by">{player?.name ?? "Unknown"}</span>
                  </div>
                );
              })}
            </div>
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
        .wall {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
        }
        .word {
          background: #fef7ed;
          border-radius: 16px;
          padding: 14px 16px;
          border: 1px solid #f4e2cc;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .word-text {
          font-size: 20px;
          font-weight: 700;
        }
        .word-by {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #6c6772;
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
