"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoomState } from "../../../lib/useRoomState";

export default function HostNew() {
  const r = useRouter();
  const { send, ws } = useRoomState();

  useEffect(() => {
    if (!ws) return;

    ws.onopen = () => send({ type: "host.create" });

    // Override handler here so we can redirect on room.created
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "room.created") r.replace(`/host/${msg.code}`);
    };
  }, [ws, send, r]);

  return <main style={{ padding: 24 }}>Creating room…</main>;
}
