import type { GameInfo } from "../types";
import type { Mark } from "../../useRoomState";

export const ticTacToe: GameInfo = {
  id: "tic-tac-toe",
  name: "Tic Tac Toe",
  playersNeeded: "2 players",
};

export const emptyBoard: (Mark | null)[] = Array.from({ length: 9 }, () => null);

export function checkWinner(board: (Mark | null)[]) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every((cell) => cell)) return "draw";
  return null;
}
