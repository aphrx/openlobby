import type { GameInfo } from "../types";

export const wordWall: GameInfo = {
  id: "word-wall",
  name: "Word Wall",
  playersNeeded: "2 players",
};

export const prompts = [
  "Write one word that describes your day.",
  "Write one word a villain would put on a welcome mat.",
  "Write one word you'd never want to hear a doctor say.",
  "Write one word that belongs in a space adventure.",
  "Write one word that sounds like a dance move.",
  "Write one word your pet is secretly thinking.",
];

export function pickPrompt() {
  return prompts[Math.floor(Math.random() * prompts.length)];
}
