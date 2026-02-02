import type { GameInfo } from "../types";

export const uno: GameInfo = {
  id: "uno",
  name: "Uno",
  playersNeeded: "2-8 players",
};

export type UnoColor = "red" | "yellow" | "green" | "blue";
export type UnoValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "wild4";

export type UnoCard = {
  id: string;
  color: UnoColor | "wild";
  value: UnoValue;
};

export type UnoDirection = 1 | -1;

const COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];

function makeId(color: UnoCard["color"], value: UnoValue, idx: number) {
  return `${color}-${value}-${idx}`;
}

export function buildDeck() {
  const cards: UnoCard[] = [];
  for (const color of COLORS) {
    cards.push({ id: makeId(color, "0", 0), color, value: "0" });
    const values: UnoValue[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"];
    values.forEach((value) => {
      cards.push({ id: makeId(color, value, 1), color, value });
      cards.push({ id: makeId(color, value, 2), color, value });
    });
  }
  for (let i = 0; i < 4; i += 1) {
    cards.push({ id: makeId("wild", "wild", i), color: "wild", value: "wild" });
    cards.push({ id: makeId("wild", "wild4", i), color: "wild", value: "wild4" });
  }
  return shuffle(cards);
}

export function shuffle<T>(list: T[]) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function canPlay(card: UnoCard, top: UnoCard, currentColor: UnoColor) {
  if (card.color === "wild") return true;
  if (card.color === currentColor) return true;
  if (card.value === top.value) return true;
  return false;
}

export function nextIndex(current: number, count: number, direction: UnoDirection, skip = 0) {
  let idx = current;
  for (let i = 0; i < 1 + skip; i += 1) {
    idx = (idx + direction + count) % count;
  }
  return idx;
}
