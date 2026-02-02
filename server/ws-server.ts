import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";
import { z } from "zod";

type Player = { id: string; name: string };
type RoomState =
  | { phase: "lobby"; code: string; players: Player[] }
  | { phase: "prompt"; code: string; prompt: string; submissions: Record<string, string>; players: Player[] };

type ClientMsg =
  | { type: "room.join"; code: string; name: string }
  | { type: "room.watch"; code: string }
  | { type: "host.claim"; code: string }
  | { type: "host.create" }
  | { type: "host.start"; code: string }
  | { type: "game.submit"; code: string; playerId: string; text: string };

const MsgSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("room.join"), code: z.string().min(2), name: z.string().min(1).max(24) }),
  z.object({ type: z.literal("room.watch"), code: z.string().min(2) }),
  z.object({ type: z.literal("host.claim"), code: z.string().min(2) }),
  z.object({ type: z.literal("host.create") }),
  z.object({ type: z.literal("host.start"), code: z.string().min(2) }),
  z.object({
    type: z.literal("game.submit"),
    code: z.string().min(2),
    playerId: z.string().min(1),
    text: z.string().min(1).max(200),
  }),
]);

type Client = { ws: any; playerId?: string; roomCode?: string; isHost?: boolean };

const rooms = new Map<string, { state: RoomState; clients: Set<Client> }>();

function broadcast(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const payload = JSON.stringify({ type: "state.update", state: room.state });
  for (const c of room.clients) c.ws.send(payload);
}

function createRoomCode() {
  return nanoid(4).toUpperCase();
}

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

const wss = new WebSocketServer({ port: 8080 });
console.log("WS server on ws://localhost:8080");

wss.on("connection", (ws) => {
  const client: Client = { ws };

  ws.on("message", (raw) => {
    let msg: ClientMsg;
    try {
      msg = MsgSchema.parse(JSON.parse(raw.toString()));
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      return;
    }

    if (msg.type === "host.create") {
      const code = createRoomCode();
      rooms.set(code, { state: { phase: "lobby", code, players: [] }, clients: new Set([client]) });
      client.roomCode = code;
      client.isHost = true;
      ws.send(JSON.stringify({ type: "room.created", code }));
      broadcast(code);
      return;
    }

    if (msg.type === "host.claim") {
      let room = rooms.get(msg.code);
      if (!room) {
        room = { state: { phase: "lobby", code: msg.code, players: [] }, clients: new Set() };
        rooms.set(msg.code, room);
      }
      client.roomCode = msg.code;
      client.isHost = true;
      room.clients.add(client);
      ws.send(JSON.stringify({ type: "room.created", code: msg.code }));
      broadcast(msg.code);
      return;
    }

    const room = rooms.get(msg.code);
    if (!room) {
      ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
      return;
    }

    // attach client to room if needed
    if (!client.roomCode) {
      client.roomCode = msg.code;
      room.clients.add(client);
    }

    if (msg.type === "room.join") {
      const playerId = nanoid(10);
      client.playerId = playerId;

      if (room.state.phase !== "lobby") {
        ws.send(JSON.stringify({ type: "error", message: "Game already started" }));
        return;
      }

      room.state.players.push({ id: playerId, name: msg.name });
      ws.send(JSON.stringify({ type: "joined", playerId }));
      broadcast(msg.code);
      return;
    }

    if (msg.type === "room.watch") {
      ws.send(JSON.stringify({ type: "state.update", state: room.state }));
      return;
    }

    if (msg.type === "host.start") {
      if (!client.isHost) {
        ws.send(JSON.stringify({ type: "error", message: "Host only" }));
        return;
      }
      room.state = {
        phase: "prompt",
        code: msg.code,
        prompt: pickPrompt(),
        submissions: {},
        players: room.state.players,
      };
      broadcast(msg.code);
      return;
    }

    if (msg.type === "game.submit") {
      if (room.state.phase !== "prompt") return;
      const exists = room.state.players.some((p) => p.id === msg.playerId);
      if (!exists) return;
      room.state.submissions[msg.playerId] = msg.text;
      broadcast(msg.code);
      return;
    }
  });

  ws.on("close", () => {
    const code = client.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    room.clients.delete(client);
    if (client.playerId) {
      room.state.players = room.state.players.filter((p) => p.id !== client.playerId);
      if (room.state.phase === "prompt") {
        const { [client.playerId]: _, ...rest } = room.state.submissions;
        room.state.submissions = rest;
      }
      broadcast(code);
    }
    if (room.clients.size === 0) rooms.delete(code);
  });
});
