import type { GameInfo } from "../types";

export const codenames: GameInfo = {
  id: "codenames",
  name: "Codenames",
  playersNeeded: "4+ players",
};

export type Team = "red" | "blue";
export type Role = "spymaster" | "guesser";
export type CardColor = Team | "neutral" | "assassin";

export type CodeCard = {
  word: string;
  color: CardColor;
  revealed: boolean;
};

const WORDS = [
  "Apple",
  "Bridge",
  "Glass",
  "Tiger",
  "Piano",
  "Jupiter",
  "Doctor",
  "Knight",
  "Forest",
  "Rocket",
  "Castle",
  "Circle",
  "Lightning",
  "Diamond",
  "Shadow",
  "Orange",
  "Camera",
  "Library",
  "Bottle",
  "Garden",
  "Pirate",
  "Planet",
  "Dragon",
  "Robot",
  "Anchor",
  "River",
  "Tablet",
  "Spiral",
  "Cactus",
  "Mirror",
  "Museum",
  "Engine",
  "Market",
  "Thunder",
  "Rocket",
  "Battery",
  "Helmet",
  "Needle",
  "Sailor",
  "Signal",
  "Turkey",
  "Canyon",
  "Falcon",
  "Bubble",
  "Comet",
  "Crown",
  "Feather",
  "Galaxy",
  "Harbor",
  "Jungle",
  "Lantern",
  "Magnet",
  "Marble",
  "Sphinx",
  "Temple",
  "Tunnel",
  "Velvet",
  "Whisper",
  "Winter",
  "Zombie",
  "Tornado",
  "Volcano",
  "Sapphire",
  "Quartz",
  "Viking",
  "Whale",
  "Wizard",
  "Saturn",
  "Orbit",
  "Coral",
  "Lemon",
  "Alps",
  "Atlas",
  "Beacon",
  "Blizzard",
  "Cobra",
  "Desert",
  "Eagle",
  "Forest",
  "Fossil",
  "Giant",
  "Harpoon",
  "Icicle",
  "Lagoon",
  "Lighthouse",
  "Meteor",
  "Oasis",
  "Palace",
  "Quartz",
  "Ranger",
  "Rhythm",
  "Sahara",
  "Tanker",
  "Temple",
  "Voyage",
  "Warden",
];

function sample<T>(list: T[], count: number) {
  const copy = [...list];
  const result: T[] = [];
  for (let i = 0; i < count && copy.length > 0; i += 1) {
    const index = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(index, 1)[0]);
  }
  return result;
}

export function generateBoard() {
  const words = sample(WORDS, 25);
  const startingTeam: Team = Math.random() > 0.5 ? "red" : "blue";
  const otherTeam: Team = startingTeam === "red" ? "blue" : "red";
  const colors: CardColor[] = [];
  colors.push(...Array.from({ length: 9 }, () => startingTeam));
  colors.push(...Array.from({ length: 8 }, () => otherTeam));
  colors.push(...Array.from({ length: 7 }, () => "neutral" as const));
  colors.push("assassin");
  const shuffled = sample(colors, colors.length);
  const cards: CodeCard[] = words.map((word, idx) => ({
    word,
    color: shuffled[idx],
    revealed: false,
  }));
  return { cards, startingTeam };
}
