"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { makeWS } from "./ws";

export function useRoomState() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [state, setState] = useState<any>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const pending = useRef<string[]>([]);

  useEffect(() => {
    const socket = makeWS();
    const flush = () => {
      while (pending.current.length > 0) {
        const next = pending.current.shift();
        if (next) socket.send(next);
      }
    };
    socket.addEventListener("open", flush);
    socket.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "state.update") setState(msg.state);
      if (msg.type === "joined") setPlayerId(msg.playerId);
    };
    setWs(socket);
    return () => {
      socket.removeEventListener("open", flush);
      socket.close();
    };
  }, []);

  const send = useMemo(() => {
    return (data: any) => {
      const payload = JSON.stringify(data);
      if (!ws) {
        pending.current.push(payload);
        return;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        return;
      }
      pending.current.push(payload);
    };
  }, [ws]);

  return { ws, state, playerId, send };
}
