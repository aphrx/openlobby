"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Types } from "ably";
import { getRealtime } from "./ably-client";
import type { GameId } from "./games/types";
import type { CodeCard, Role, Team } from "./games/codenames";
import type { UnoCard, UnoColor, UnoDirection } from "./games/uno";

export type Player = { id: string; name: string };
export type Mark = "X" | "O";
export type GamePlayer = Player & { mark: Mark };
export type RoomState =
  | { phase: "lobby"; code: string; players: Player[]; votes: Record<string, GameId> }
  | {
      phase: "ttt";
      code: string;
      players: GamePlayer[];
      board: (Mark | null)[];
      turn: Mark;
      winner: Mark | "draw" | null;
    }
  | {
      phase: "word";
      code: string;
      players: Player[];
      prompt: string;
      submissions: Record<string, string>;
    };

export type CodePlayer = Player & { team: Team | null; role: Role };

export type CodenamesSetupState = {
  phase: "codenames-setup";
  code: string;
  players: CodePlayer[];
  startingTeam: Team;
};

export type CodenamesPlayState = {
  phase: "codenames-play";
  code: string;
  players: CodePlayer[];
  cards: CodeCard[];
  turn: Team;
  remaining: Record<Team, number>;
  winner: Team | null;
};

export type UnoPlayer = Player & { hand: UnoCard[] };

export type UnoState = {
  phase: "uno";
  code: string;
  players: UnoPlayer[];
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  currentColor: UnoColor;
  turnIndex: number;
  direction: UnoDirection;
  winner: string | null;
};

export type ExtendedRoomState = RoomState | CodenamesSetupState | CodenamesPlayState | UnoState;

export function useRoomState(code?: string) {
  const [state, setState] = useState<ExtendedRoomState | null>(null);
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
    (nextState: ExtendedRoomState) => {
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
