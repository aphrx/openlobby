"use client";
import { Space_Grotesk } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { makeWS } from "../lib/ws";

const space = Space_Grotesk({ subsets: ["latin"] });

export default function Home() {
  const [code, setCode] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = useRouter();

  useEffect(() => {
    const socket = makeWS();
    socket.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "room.created") {
        setCreating(false);
        r.push(`/host/${msg.code}`);
      }
      if (msg.type === "error") {
        setCreating(false);
        setError(msg.message ?? "Something went wrong.");
      }
    };
    socket.onerror = () => {
      setCreating(false);
      setError("WebSocket connection failed. Is the server running?");
    };
    setWs(socket);
    return () => socket.close();
  }, [r]);

  const createRoom = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("WebSocket not connected yet. Try again in a second.");
      return;
    }
    setError(null);
    setCreating(true);
    ws.send(JSON.stringify({ type: "host.create" }));
  };

  return (
    <main className={`page ${space.className}`}>
      <header className="hero">
        <p className="eyebrow">Party Platform</p>
        <h1 className="title">Start a Word Wall</h1>
        <p className="subtle">Create a room, share the code, and watch words appear live.</p>
      </header>

      <section className="card">
        <h2>Join a room</h2>
        <div className="field">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
          />
          <button onClick={() => r.push(`/play/${code}`)} disabled={!code.trim()}>
            Join
          </button>
        </div>
      </section>

      <section className="card highlight">
        <h2>Host a room</h2>
        <p className="subtle">We’ll make a fresh code and drop you into the host screen.</p>
        <button onClick={createRoom} disabled={creating}>
          {creating ? "Creating..." : "Create Room"}
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      <style jsx>{`
        :global(body) {
          margin: 0;
          background: radial-gradient(circle at top, #f8f4ff, #fef7ed 55%, #f6fbff);
          color: #161319;
        }
        .page {
          min-height: 100vh;
          padding: 40px 28px 56px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 900px;
          margin: 0 auto;
        }
        .hero {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .eyebrow {
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-size: 12px;
          margin: 0;
        }
        .title {
          font-size: clamp(32px, 6vw, 52px);
          margin: 0;
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
        .highlight {
          background: #fff7e9;
          border-color: #f4e2cc;
        }
        h2 {
          margin: 0 0 12px;
          font-size: 22px;
        }
        .field {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        input {
          flex: 1;
          min-width: 220px;
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
        .error {
          margin: 12px 0 0;
          color: #8a2d2d;
          font-size: 14px;
        }
      `}</style>
    </main>
  );
}
