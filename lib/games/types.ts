export type GameId = "tic-tac-toe" | "word-wall" | "codenames" | "uno";

export type GameInfo = {
  id: GameId;
  name: string;
  playersNeeded: string;
};
