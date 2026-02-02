"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Types } from "ably";
import { getRealtime } from "./ably-client";

export type Player = { id: string; name: string };
export type Mark = "X" | "O";
export type GamePlayer = Player & { mark: Mark };
export type RoomState =
  | { phase: "lobby"; code: string; players: Player[] }
  | {
      phase: "playing";
      code: string;
      players: GamePlayer[];
      board: (Mark | null)[];
      turn: Mark;
      winner: Mark | "draw" | null;
    }
  | {
      phase: "over";
      code: string;
      players: GamePlayer[];
      board: (Mark | null)[];
      turn: Mark;
      winner: Mark | "draw";
    };

export function useRoomState(code?: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [channel, setChannel] = useState<Types.RealtimeChannelCallbacks | null>(null);

  useEffect(() => {
    if (!code) return;
    const realtime = getRealtime();
    const roomChannel = realtime.channels.get(`room:${code}`);
    setChannel(roomChannel);
    const onState = (msg: Types.Message) => {
      setState(msg.data as RoomState);
    };
    roomChannel.subscribe("state.update", onState);
    return () => {
      roomChannel.unsubscribe("state.update", onState);
      roomChannel.detach();
    };
  }, [code]);

  const send = useCallback(
    (name: string, data: unknown) => {
      if (!channel) return;
      channel.publish(name, data);
    },
    [channel],
  );

  const publishState = useCallback(
    (nextState: RoomState) => {
      setState(nextState);
      if (!channel) return;
      channel.publish("state.update", nextState);
    },
    [channel],
  );

  return useMemo(
    () => ({
      state,
      setState,
      channel,
      send,
      publishState,
    }),
    [state, channel, send, publishState],
  );
}
