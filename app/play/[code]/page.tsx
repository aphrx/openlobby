"use client";
import { Space_Grotesk } from "next/font/google";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { useRoomState } from "../../../lib/useRoomState";

const space = Space_Grotesk({ subsets: ["latin"] });

export default function PlayRoom() {
  const { code } = useParams<{ code: string }>();
  const { state, send, channel } = useRoomState(code);
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const prompt = state?.phase === "prompt" ? state.prompt : "";

  useEffect(() => {
    if (state?.phase !== "prompt") {
      setHasSubmitted(false);
      setText("");
    }
  }, [state?.phase]);

  useEffect(() => {
    if (state?.phase === "prompt") {
      setHasSubmitted(false);
      setText("");
    }
  }, [state?.phase, prompt]);

  return (
    <main className={`page ${space.className}`}>
      <header className="hero">
        <p className="eyebrow">Player</p>
        <h1 className="title">
          Room <span className="code">{code}</span>
        </h1>
        <p className="subtle">Write one word and watch it appear on the host screen.</p>
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
          <h2>{state?.phase === "prompt" ? "Your word" : "Waiting room"}</h2>
          {state?.phase === "prompt" ? (
            <>
              <p className="prompt">{state.prompt}</p>
              <div className="field">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="One word"
                  disabled={hasSubmitted}
                />
                <button
                  onClick={() => {
                    send("player.submit", { playerId, text });
                    setHasSubmitted(true);
                  }}
                  disabled={!text.trim() || hasSubmitted}
                >
                  {hasSubmitted ? "Submitted" : "Send"}
                </button>
              </div>
            </>
          ) : (
            <p className="subtle">Hang tight while the host starts the round.</p>
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
