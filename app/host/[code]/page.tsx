"use client";
import { Space_Grotesk } from "next/font/google";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Types } from "ably";
import { games } from "../../../lib/games";
import type { GameId } from "../../../lib/games/types";
import { generateBoard } from "../../../lib/games/codenames";
import type { Role, Team } from "../../../lib/games/codenames";
import { checkWinner, emptyBoard } from "../../../lib/games/tic-tac-toe";
import { buildDeck, canPlay, nextIndex, type UnoCard, type UnoColor } from "../../../lib/games/uno";
import { pickPrompt } from "../../../lib/games/word-wall";
import { type CodePlayer, type GamePlayer, type Mark, type UnoPlayer, useRoomState } from "../../../lib/useRoomState";

const space = Space_Grotesk({ subsets: ["latin"] });

const EMPTY_BOARD = emptyBoard as (Mark | null)[];

export default function HostRoom() {
  const { code } = useParams<{ code: string }>();
  const { state, setState, channel, publishState } = useRoomState(code);
  const players = state?.players ?? [];
  const gamePlayers = state?.phase === "ttt" ? state.players : [];
  const [shareUrl, setShareUrl] = useState("");
  const board = state?.phase === "ttt" ? state.board : EMPTY_BOARD;
  const turn = state?.phase === "ttt" ? state.turn : null;
  const winner = state?.phase === "ttt" ? state.winner : null;
  const votes = state?.phase === "lobby" ? state.votes : {};
  const codenamesPlayers = state?.phase === "codenames-setup" || state?.phase === "codenames-play" ? state.players : [];
  const codenamesCards = state?.phase === "codenames-play" ? state.cards : [];
  const codenamesTurn = state?.phase === "codenames-play" ? state.turn : null;
  const codenamesWinner = state?.phase === "codenames-play" ? state.winner : null;
  const isCodenamesSetup = state?.phase === "codenames-setup";
  const isCodenamesPlay = state?.phase === "codenames-play";
  const isCodenames = isCodenamesSetup || isCodenamesPlay;
  const isUno = state?.phase === "uno";

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShareUrl(`${window.location.origin}/play/${code}`);
  }, [code]);

  useEffect(() => {
    if (!channel || !code || state) return;
    publishState({ phase: "lobby", code, players: [], votes: {} });
  }, [channel, code, publishState, state]);

  const updateState = useCallback(
    (updater: (current: typeof state) => typeof state) => {
      setState((current) => {
        const next = updater(current);
        if (next && channel) channel.publish("state.update", next);
        return next;
      });
    },
    [channel, setState],
  );

  useEffect(() => {
    if (!channel || !code) return;
    const onJoin = (msg: Types.Message) => {
      const data = msg.data as { playerId?: string; name?: string } | null;
      const playerId = data?.playerId;
      const name = data?.name?.trim();
      if (!playerId || !name) return;
      updateState((current) => {
        if (!current || current.phase === "lobby") {
          const base = current ?? { phase: "lobby", code, players: [], votes: {} };
          if (base.players.some((p) => p.id === playerId)) return base;
          return { ...base, players: [...base.players, { id: playerId, name }] };
        }
        return current;
      });
    };
    const onVote = (msg: Types.Message) => {
      const data = msg.data as { playerId?: string; gameId?: GameId } | null;
      const playerId = data?.playerId;
      const gameId = data?.gameId;
      if (!playerId || !gameId) return;
      updateState((current) => {
        if (!current || current.phase !== "lobby") return current;
        if (!current.players.some((p) => p.id === playerId)) return current;
        return { ...current, votes: { ...current.votes, [playerId]: gameId } };
      });
    };
    const onMove = (msg: Types.Message) => {
      const data = msg.data as { playerId?: string; index?: number } | null;
      const playerId = data?.playerId;
      const index = data?.index;
      if (!playerId || index === undefined) return;
      updateState((current) => {
        if (!current || current.phase !== "ttt") return current;
        const player = current.players.find((p) => p.id === playerId);
        if (!player) return current;
        if (player.mark !== current.turn) return current;
        if (current.board[index]) return current;
        const nextBoard = [...current.board];
        nextBoard[index] = player.mark;
        const result = checkWinner(nextBoard);
        if (result) {
          return {
            ...current,
            board: nextBoard,
            winner: result,
          };
        }
        return {
          ...current,
          board: nextBoard,
          turn: current.turn === "X" ? "O" : "X",
        };
      });
    };
    const onSubmit = (msg: Types.Message) => {
      const data = msg.data as { playerId?: string; text?: string } | null;
      const playerId = data?.playerId;
      const text = data?.text?.trim();
      if (!playerId || !text) return;
      updateState((current) => {
        if (!current || current.phase !== "word") return current;
        if (!current.players.some((p) => p.id === playerId)) return current;
        return { ...current, submissions: { ...current.submissions, [playerId]: text } };
      });
    };
    const onUnoPlay = (msg: Types.Message) => {
      const data = msg.data as { playerId?: string; cardId?: string; chosenColor?: UnoColor } | null;
      const playerId = data?.playerId;
      const cardId = data?.cardId;
      if (!playerId || !cardId) return;
      updateState((current) => {
        if (!current || current.phase !== "uno") return current;
        if (current.winner) return current;
        const playerIndex = current.players.findIndex((p) => p.id === playerId);
        if (playerIndex !== current.turnIndex) return current;
        const player = current.players[playerIndex];
        const card = player.hand.find((c) => c.id === cardId);
        if (!card) return current;
        const top = current.discardPile[current.discardPile.length - 1];
        if (!canPlay(card, top, current.currentColor)) return current;
        const nextHand = player.hand.filter((c) => c.id !== cardId);
        const nextPlayers = current.players.map((p, idx) =>
          idx === playerIndex ? { ...p, hand: nextHand } : p,
        );
        const nextDiscard = [...current.discardPile, card];
        let nextColor: UnoColor = current.currentColor;
        if (card.color === "wild") {
          if (!data?.chosenColor) return current;
          nextColor = data.chosenColor;
        } else {
          nextColor = card.color;
        }
        let nextDirection = current.direction;
        let skip = 0;
        let drawCount = 0;
        if (card.value === "reverse") nextDirection = (current.direction * -1) as 1 | -1;
        if (card.value === "skip") skip = 1;
        if (card.value === "draw2") drawCount = 2;
        if (card.value === "wild4") drawCount = 4;
        const nextTurn = nextIndex(current.turnIndex, current.players.length, nextDirection, skip);
        let nextPlayersWithDraw = nextPlayers;
        if (drawCount > 0) {
          const drawTarget = nextTurn;
          const deck = current.drawPile.length > 0 ? [...current.drawPile] : buildDeck();
          const drawn = deck.splice(0, drawCount);
          nextPlayersWithDraw = nextPlayers.map((p, idx) =>
            idx === drawTarget ? { ...p, hand: [...p.hand, ...drawn] } : p,
          );
          const skippedTurn = nextIndex(drawTarget, current.players.length, nextDirection, 0);
          const winner = nextHand.length === 0 ? player.id : null;
          return {
            ...current,
            players: nextPlayersWithDraw,
            discardPile: nextDiscard,
            drawPile: deck,
            currentColor: nextColor,
            direction: nextDirection,
            turnIndex: skippedTurn,
            winner,
          };
        }
        const winner = nextHand.length === 0 ? player.id : null;
        return {
          ...current,
          players: nextPlayersWithDraw,
          discardPile: nextDiscard,
          drawPile: current.drawPile,
          currentColor: nextColor,
          direction: nextDirection,
          turnIndex: nextTurn,
          winner,
        };
      });
    };
    const onUnoDraw = (msg: Types.Message) => {
      const data = msg.data as { playerId?: string } | null;
      const playerId = data?.playerId;
      if (!playerId) return;
      updateState((current) => {
        if (!current || current.phase !== "uno") return current;
        if (current.winner) return current;
        const playerIndex = current.players.findIndex((p) => p.id === playerId);
        if (playerIndex !== current.turnIndex) return current;
        const deck = current.drawPile.length > 0 ? [...current.drawPile] : buildDeck();
        const drawn = deck.shift();
        if (!drawn) return current;
        const nextPlayers = current.players.map((p, idx) =>
          idx === playerIndex ? { ...p, hand: [...p.hand, drawn] } : p,
        );
        const nextTurn = nextIndex(current.turnIndex, current.players.length, current.direction, 0);
        return {
          ...current,
          players: nextPlayers,
          drawPile: deck,
          turnIndex: nextTurn,
        };
      });
    };
    const onReveal = (msg: Types.Message) => {
      const data = msg.data as { playerId?: string; index?: number } | null;
      const playerId = data?.playerId;
      const index = data?.index;
      if (!playerId || index === undefined) return;
      updateState((current) => {
        if (!current || current.phase !== "codenames-play") return current;
        if (current.winner) return current;
        const player = current.players.find((p) => p.id === playerId);
        if (!player || player.role !== "guesser") return current;
        if (player.team !== current.turn) return current;
        const card = current.cards[index];
        if (!card || card.revealed) return current;
        const nextCards = current.cards.map((c, i) => (i === index ? { ...c, revealed: true } : c));
        if (card.color === "assassin") {
          const winnerTeam: Team = current.turn === "red" ? "blue" : "red";
          return { ...current, cards: nextCards, winner: winnerTeam };
        }
        if (card.color === "neutral" || card.color !== current.turn) {
          const nextTurn: Team = current.turn === "red" ? "blue" : "red";
          return { ...current, cards: nextCards, turn: nextTurn };
        }
        const nextRemaining = { ...current.remaining };
        nextRemaining[current.turn] = Math.max(0, nextRemaining[current.turn] - 1);
        if (nextRemaining[current.turn] === 0) {
          return { ...current, cards: nextCards, remaining: nextRemaining, winner: current.turn };
        }
        return { ...current, cards: nextCards, remaining: nextRemaining };
      });
    };
    const onEndTurn = (msg: Types.Message) => {
      const data = msg.data as { playerId?: string } | null;
      const playerId = data?.playerId;
      if (!playerId) return;
      updateState((current) => {
        if (!current || current.phase !== "codenames-play") return current;
        if (current.winner) return current;
        const player = current.players.find((p) => p.id === playerId);
        if (!player || player.team !== current.turn) return current;
        const nextTurn: Team = current.turn === "red" ? "blue" : "red";
        return { ...current, turn: nextTurn };
      });
    };
    channel.subscribe("player.join", onJoin);
    channel.subscribe("player.vote", onVote);
    channel.subscribe("player.move", onMove);
    channel.subscribe("player.submit", onSubmit);
    channel.subscribe("player.uno.play", onUnoPlay);
    channel.subscribe("player.uno.draw", onUnoDraw);
    channel.subscribe("player.reveal", onReveal);
    channel.subscribe("player.endTurn", onEndTurn);
    return () => {
      channel.unsubscribe("player.join", onJoin);
      channel.unsubscribe("player.vote", onVote);
      channel.unsubscribe("player.move", onMove);
      channel.unsubscribe("player.submit", onSubmit);
      channel.unsubscribe("player.uno.play", onUnoPlay);
      channel.unsubscribe("player.uno.draw", onUnoDraw);
      channel.unsubscribe("player.reveal", onReveal);
      channel.unsubscribe("player.endTurn", onEndTurn);
    };
  }, [channel, code, updateState]);

  const tally = useMemo(() => {
    const counts: Record<GameId, number> = { "tic-tac-toe": 0, "word-wall": 0, codenames: 0, uno: 0 };
    Object.values(votes).forEach((vote) => {
      if (vote in counts) counts[vote] += 1;
    });
    return counts;
  }, [votes]);

  const selectedGame = useMemo(() => {
    const entries = Object.entries(tally);
    let best: GameId = "tic-tac-toe";
    let bestCount = -1;
    for (const [gameId, count] of entries) {
      if (count > bestCount) {
        best = gameId as GameId;
        bestCount = count;
      }
    }
    return best;
  }, [tally]);

  const canStart =
    selectedGame === "codenames" ? players.length >= 4 : selectedGame === "uno" ? players.length >= 2 : players.length >= 2;
  const startGame = useCallback(() => {
    if (!code) return;
    if (selectedGame === "tic-tac-toe") {
      if (players.length < 2) return;
      const assigned: GamePlayer[] = [
        { ...players[0], mark: "X" },
        { ...players[1], mark: "O" },
      ];
      publishState({
        phase: "ttt",
        code,
        players: assigned,
        board: [...EMPTY_BOARD],
        turn: "X",
        winner: null,
      });
      return;
    }
    if (selectedGame === "codenames") {
      if (players.length < 4) return;
      const startingTeam: Team = Math.random() > 0.5 ? "red" : "blue";
      const setupPlayers: CodePlayer[] = players.map((p) => ({ ...p, team: null, role: "guesser" as Role }));
      publishState({
        phase: "codenames-setup",
        code,
        players: setupPlayers,
        startingTeam,
      });
      return;
    }
    if (selectedGame === "uno") {
      const deck = buildDeck();
      const dealt: UnoPlayer[] = players.map((p) => ({
        ...p,
        hand: deck.splice(0, 7),
      }));
      let top = deck.shift() as UnoCard | undefined;
      while (top && top.color === "wild") {
        deck.push(top);
        top = deck.shift();
      }
      if (!top) return;
      const currentColor = top.color as UnoColor;
      publishState({
        phase: "uno",
        code,
        players: dealt,
        drawPile: deck,
        discardPile: [top],
        currentColor,
        turnIndex: 0,
        direction: 1,
        winner: null,
      });
      return;
    }
    publishState({
      phase: "word",
      code,
      players,
      prompt: pickPrompt(),
      submissions: {},
    });
  }, [code, players, publishState, selectedGame]);

  const playAgain = useCallback(() => {
    if (!code) return;
    if (state?.phase === "lobby") return;
    if (state?.phase === "ttt") {
      const assigned = state?.players ?? [];
      if (assigned.length < 2) {
        publishState({
          phase: "lobby",
          code,
          players: assigned.map(({ id, name }) => ({ id, name })),
          votes: {},
        });
        return;
      }
      publishState({
        phase: "ttt",
        code,
        players: assigned,
        board: [...EMPTY_BOARD],
        turn: "X",
        winner: null,
      });
      return;
    }
    if (state?.phase === "word") {
      publishState({
        phase: "word",
        code,
        players: state.players,
        prompt: pickPrompt(),
        submissions: {},
      });
      return;
    }
    if (state?.phase === "codenames-play") {
      const { cards, startingTeam } = generateBoard();
      publishState({
        phase: "codenames-play",
        code,
        players: state.players,
        cards,
        turn: startingTeam,
        remaining: { red: startingTeam === "red" ? 9 : 8, blue: startingTeam === "blue" ? 9 : 8 },
        winner: null,
      });
      return;
    }
    if (state?.phase === "uno") {
      const deck = buildDeck();
      const dealt: UnoPlayer[] = state.players.map((p) => ({
        ...p,
        hand: deck.splice(0, 7),
      }));
      let top = deck.shift() as UnoCard | undefined;
      while (top && top.color === "wild") {
        deck.push(top);
        top = deck.shift();
      }
      if (!top) return;
      publishState({
        phase: "uno",
        code,
        players: dealt,
        drawPile: deck,
        discardPile: [top],
        currentColor: top.color as UnoColor,
        turnIndex: 0,
        direction: 1,
        winner: null,
      });
    }
  }, [code, publishState, state]);

  const backToVote = useCallback(() => {
    if (!code) return;
    if (!state || state.phase === "lobby") return;
    const basePlayers =
      state.phase === "ttt"
        ? state.players.map(({ id, name }) => ({ id, name }))
        : state.phase === "codenames-setup" || state.phase === "codenames-play"
        ? state.players.map(({ id, name }) => ({ id, name }))
        : state.players;
    publishState({ phase: "lobby", code, players: basePlayers, votes: {} });
  }, [code, publishState, state]);

  const setCodePlayerTeam = useCallback(
    (playerId: string, team: Team) => {
      updateState((current) => {
        if (!current || current.phase !== "codenames-setup") return current;
        const nextPlayers = current.players.map((p) => (p.id === playerId ? { ...p, team } : p));
        return { ...current, players: nextPlayers };
      });
    },
    [updateState],
  );

  const setCodePlayerRole = useCallback(
    (playerId: string, role: Role) => {
      updateState((current) => {
        if (!current || current.phase !== "codenames-setup") return current;
        const nextPlayers = current.players.map((p) => (p.id === playerId ? { ...p, role } : p));
        return { ...current, players: nextPlayers };
      });
    },
    [updateState],
  );

  const canStartCodenames = useMemo(() => {
    if (!isCodenamesSetup) return false;
    if (codenamesPlayers.length < 4) return false;
    const red = codenamesPlayers.filter((p) => p.team === "red");
    const blue = codenamesPlayers.filter((p) => p.team === "blue");
    if (red.length === 0 || blue.length === 0) return false;
    const redSpy = red.some((p) => p.role === "spymaster");
    const blueSpy = blue.some((p) => p.role === "spymaster");
    return redSpy && blueSpy;
  }, [codenamesPlayers, isCodenamesSetup]);

  const startCodenames = useCallback(() => {
    if (!isCodenamesSetup || !state) return;
    const { cards, startingTeam } = generateBoard();
    publishState({
      phase: "codenames-play",
      code,
      players: state.players,
      cards,
      turn: startingTeam,
      remaining: { red: startingTeam === "red" ? 9 : 8, blue: startingTeam === "blue" ? 9 : 8 },
      winner: null,
    });
  }, [code, isCodenamesSetup, publishState, state]);

  const status = useMemo(() => {
    if (!state) return "Waiting for players…";
    if (state.phase === "lobby") return "Waiting for 2 players.";
    if (state.phase === "ttt") return winner ? (winner === "draw" ? "Draw!" : `Winner: ${winner}`) : `Turn: ${state.turn}`;
    if (state.phase === "word") return state.prompt;
    if (state.phase === "codenames-play") {
      if (state.winner) return `Winner: ${state.winner}`;
      return `Turn: ${state.turn}`;
    }
    if (state.phase === "uno") {
      if (state.winner) return `Winner: ${state.winner}`;
      const current = state.players[state.turnIndex];
      return current ? `Turn: ${current.name}` : "Turn";
    }
    return " ";
  }, [state]);

  return (
    <main className={`page ${state?.phase !== "lobby" ? "playing" : ""} ${space.className}`}>
      {state?.phase === "lobby" && (
        <header className="hero">
          <div>
            <p className="eyebrow">Host Room</p>
            <h1 className="title">
              Code <span className="code">{code}</span>
            </h1>
            <p className="subtle">Players join at</p>
            <div className="share">{shareUrl}</div>
          </div>
          <div className="stats">
            <div>
              <p className="stat-label">Players</p>
              <p className="stat-value">{players.length}</p>
            </div>
            <div>
              <p className="stat-label">Status</p>
              <p className="stat-value">{state?.phase === "lobby" ? "Lobby" : "Game"}</p>
            </div>
          </div>
        </header>
      )}

      {state?.phase === "lobby" && (
        <section className="card">
          <div className="card-header">
            <h2>Lobby</h2>
            <button onClick={startGame} disabled={!canStart || !channel}>
              Start Game
            </button>
          </div>
          <div className="vote-grid">
            {games.map((game) => {
              const voters = players.filter((p) => votes[p.id] === game.id).map((p) => p.name);
              return (
                <div key={game.id} className={`vote-card ${selectedGame === game.id ? "selected" : ""}`}>
                  <h3>{game.name}</h3>
                  <p className="subtle">{game.playersNeeded}</p>
                  <p className="vote-count">{tally[game.id]} votes</p>
                  <div className="vote-names">
                    {voters.length === 0 ? <span className="empty">No votes yet</span> : voters.join(", ")}
                  </div>
                </div>
              );
            })}
          </div>
          {players.length === 0 ? (
            <p className="empty">Waiting for players…</p>
          ) : (
            <div className="player-grid">
              {players.map((p: any) => (
                <div key={p.id} className="player">
                  <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                  <span className="name">{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {state?.phase !== "lobby" && (
        <section className="card game-surface">
          <div className="card-header">
            <div className="name-row">
              {state?.phase === "ttt" &&
                gamePlayers.map((p) => {
                  const active = p.mark === turn;
                  return (
                    <div key={p.id} className={`name-pill ${active ? "active" : ""}`}>
                      <span className="pill-mark">{p.mark}</span>
                      <span>{p.name}</span>
                    </div>
                  );
                })}
              {state?.phase === "word" &&
                players.map((p) => (
                  <div key={p.id} className="name-pill">
                    <span>{p.name}</span>
                  </div>
                ))}
              {isCodenames &&
                codenamesPlayers.map((p) => (
                  <div key={p.id} className={`name-pill team-${p.team ?? "neutral"}`}>
                    <span className="pill-mark">{p.team ? p.team[0].toUpperCase() : "?"}</span>
                    <span>{p.name}</span>
                    <span className="role">{p.role}</span>
                  </div>
                ))}
              {isUno &&
                state.players.map((p, idx) => (
                  <div key={p.id} className={`name-pill ${state.turnIndex === idx ? "active" : ""}`}>
                    <span>{p.name}</span>
                    <span className="role">{p.hand.length} cards</span>
                  </div>
                ))}
            </div>
            <div className="header-actions">
              {state?.phase === "codenames-setup" ? (
                <button onClick={startCodenames} disabled={!channel || !canStartCodenames}>
                  Start Codenames
                </button>
              ) : (
                <button onClick={playAgain} disabled={!channel}>
                  {state?.phase === "word" ? "New Prompt" : "Play Again"}
                </button>
              )}
              <button className="ghost" onClick={backToVote} disabled={!channel}>
                Back to Vote
              </button>
            </div>
          </div>
          {state?.phase === "word" && <p className="prompt">{status}</p>}
          {state?.phase === "ttt" ? (
            <>
              <div className="board full">
                {board.map((cell, idx) => (
                  <div key={idx} className={`cell ${cell ? "filled" : ""}`}>
                    {cell ?? ""}
                  </div>
                ))}
              </div>
              <div className="legend">
                {gamePlayers.map((p) => (
                  <div key={p.id} className="legend-row">
                    <span className="legend-mark">{p.mark}</span>
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
              {winner && (
                <div className="postgame">
                  <p className="subtle">Game over. Play again or head back to vote.</p>
                </div>
              )}
            </>
          ) : (
            <>
              {state?.phase === "word" && (
                <div className="wall full">
                  {Object.entries(state?.submissions ?? {}).map(([playerId, text]) => {
                    const player = players.find((p: any) => p.id === playerId);
                    return (
                      <div key={playerId} className="word">
                        <span className="word-text">{text}</span>
                        <span className="word-by">{player?.name ?? "Unknown"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {state?.phase === "codenames-setup" && (
                <div className="setup-grid">
                  {codenamesPlayers.map((p) => (
                    <div key={p.id} className="setup-row">
                      <div className="setup-name">{p.name}</div>
                      <div className="setup-actions">
                        <button
                          className={`chip ${p.team === "red" ? "active red" : ""}`}
                          onClick={() => setCodePlayerTeam(p.id, "red")}
                        >
                          Red
                        </button>
                        <button
                          className={`chip ${p.team === "blue" ? "active blue" : ""}`}
                          onClick={() => setCodePlayerTeam(p.id, "blue")}
                        >
                          Blue
                        </button>
                        <button
                          className={`chip ${p.role === "spymaster" ? "active" : ""}`}
                          onClick={() => setCodePlayerRole(p.id, "spymaster")}
                        >
                          Spymaster
                        </button>
                        <button
                          className={`chip ${p.role === "guesser" ? "active" : ""}`}
                          onClick={() => setCodePlayerRole(p.id, "guesser")}
                        >
                          Guesser
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {state?.phase === "codenames-play" && (
                <>
                  <div className="prompt">
                    {codenamesWinner
                      ? `Winner: ${codenamesWinner}`
                      : `Turn: ${codenamesTurn} — Red ${state.remaining.red} / Blue ${state.remaining.blue}`}
                  </div>
                  <div className="codenames-grid">
                    {codenamesCards.map((card, idx) => (
                      <div
                        key={`${card.word}-${idx}`}
                        className={`code-card ${card.revealed ? card.color : "hidden"} ${
                          card.revealed ? "revealed" : ""
                        }`}
                      >
                        <span>{card.word}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {state?.phase === "uno" && (
                <>
                  <div className="prompt">{status}</div>
                  <div className="uno-row">
                  <div className="uno-pile">
                    <span className="uno-label">Draw</span>
                      <div className="uno-stack neat">
                        <div className="uno-card back" />
                        <div className="uno-card back layer" />
                        <div className="uno-card back layer" />
                      </div>
                      <span className="uno-count">{state.drawPile.length}</span>
                  </div>
                  <div className="uno-pile">
                    <span className="uno-label">Discard</span>
                      <div className="uno-stack messy">
                        <div className="uno-card layer tilt-left" />
                        <div className="uno-card layer tilt-right" />
                        <div className={`uno-card top ${state.discardPile[state.discardPile.length - 1]?.color ?? ""}`}>
                          <span className="uno-value">
                            {state.discardPile[state.discardPile.length - 1]?.value}
                          </span>
                        </div>
                      </div>
                      <span className="uno-count">{state.discardPile.length}</span>
                  </div>
                    <div className="uno-info">
                      <span className="uno-chip">Color: {state.currentColor}</span>
                      <span className="uno-chip">Direction: {state.direction === 1 ? "↻" : "↺"}</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}

      <style jsx>{`
        :global(body) {
          margin: 0;
          background: radial-gradient(circle at top, #f8f4ff, #fef7ed 55%, #f6fbff);
          color: #161319;
        }
        .page {
          min-height: 100vh;
          padding: 32px 28px 48px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .page.playing {
          padding: 0;
          gap: 0;
        }
        .hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          flex-wrap: wrap;
        }
        .eyebrow {
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-size: 12px;
          margin: 0 0 8px;
        }
        .title {
          font-size: clamp(28px, 5vw, 44px);
          margin: 0 0 8px;
        }
        .code {
          background: #161319;
          color: #fef7ed;
          padding: 6px 12px;
          border-radius: 999px;
          font-weight: 700;
        }
        .subtle {
          margin: 0 0 6px;
          color: #5a5661;
        }
        .share {
          background: #ffffff;
          border-radius: 12px;
          padding: 10px 14px;
          border: 1px solid #e8e2f2;
          font-size: 14px;
          word-break: break-all;
        }
        .stats {
          display: flex;
          gap: 16px;
          background: #ffffff;
          border: 1px solid #eee6f4;
          border-radius: 16px;
          padding: 16px 18px;
          min-width: 220px;
        }
        .stat-label {
          margin: 0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #6c6772;
        }
        .stat-value {
          margin: 6px 0 0;
          font-size: 24px;
          font-weight: 700;
        }
        .card {
          background: #ffffff;
          border: 1px solid #f0e7f6;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 18px 40px rgba(23, 15, 44, 0.06);
        }
        .game-surface {
          min-height: 100vh;
          border-radius: 0;
          border: none;
          box-shadow: none;
          display: flex;
          flex-direction: column;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .ghost {
          background: transparent;
          color: #161319;
          border: 1px solid #161319;
        }
        .vote-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
          margin: 16px 0 8px;
        }
        .vote-card {
          background: #fef7ed;
          border-radius: 16px;
          padding: 14px 16px;
          border: 1px solid #f4e2cc;
        }
        .vote-card.selected {
          border-color: #161319;
          box-shadow: 0 8px 18px rgba(22, 19, 25, 0.12);
        }
        .vote-card h3 {
          margin: 0 0 4px;
          font-size: 18px;
        }
        .vote-count {
          margin: 8px 0 0;
          font-weight: 700;
        }
        .vote-names {
          margin-top: 8px;
          font-size: 13px;
          color: #5a5661;
        }
        button {
          border: none;
          background: #161319;
          color: #fef7ed;
          padding: 10px 18px;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .player-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          margin-top: 16px;
        }
        .player {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f7f1ff;
          padding: 10px 12px;
          border-radius: 14px;
        }
        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #161319;
          color: #fef7ed;
          display: grid;
          place-items: center;
          font-weight: 700;
        }
        .name {
          font-weight: 600;
        }
        .name-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .name-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 999px;
          background: #ffffff;
          border: 1px solid #eee6f4;
          font-weight: 600;
        }
        .name-pill .role {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6c6772;
        }
        .name-pill.team-red {
          border-color: #d84a4a;
          box-shadow: 0 10px 18px rgba(216, 74, 74, 0.15);
        }
        .name-pill.team-blue {
          border-color: #3a6ed8;
          box-shadow: 0 10px 18px rgba(58, 110, 216, 0.15);
        }
        .name-pill.active {
          border-color: #161319;
          box-shadow: 0 10px 18px rgba(22, 19, 25, 0.18);
        }
        .pill-mark {
          background: #161319;
          color: #fef7ed;
          font-weight: 700;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 12px;
        }
        .prompt {
          font-size: 20px;
          margin: 0 0 18px;
        }
        .board {
          display: grid;
          grid-template-columns: repeat(3, minmax(84px, 120px));
          gap: 12px;
          justify-content: start;
          padding: 12px;
          background: linear-gradient(135deg, #f6ede0, #f9f2e7);
          border-radius: 18px;
          border: 1px solid #f4e2cc;
          box-shadow: inset 0 2px 8px rgba(40, 30, 20, 0.08);
        }
        .board.full {
          width: 100%;
          flex: 1;
          align-content: center;
          justify-content: center;
        }
        .cell {
          background: linear-gradient(180deg, #fff6e7, #f3e1c8);
          border-radius: 18px;
          border: 1px solid #e9d1b4;
          font-size: 34px;
          font-weight: 800;
          display: grid;
          place-items: center;
          height: 104px;
          color: #1d1820;
          box-shadow: 0 10px 16px rgba(32, 20, 10, 0.12), inset 0 2px 2px rgba(255, 255, 255, 0.6);
          transform: translateY(-1px);
        }
        .cell.filled {
          background: linear-gradient(180deg, #f7f1ff, #e8dcff);
          border-color: #d9c8ff;
          box-shadow: 0 10px 18px rgba(45, 24, 88, 0.14), inset 0 2px 2px rgba(255, 255, 255, 0.7);
        }
        .postgame {
          margin-top: 16px;
        }
        .setup-grid {
          display: grid;
          gap: 12px;
          margin-top: 8px;
        }
        .setup-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 16px;
          background: #fff7e9;
          border: 1px solid #f4e2cc;
          flex-wrap: wrap;
        }
        .setup-name {
          font-weight: 600;
        }
        .setup-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chip {
          border-radius: 999px;
          padding: 6px 12px;
          border: 1px solid #161319;
          background: transparent;
          color: #161319;
          font-weight: 600;
          cursor: pointer;
        }
        .chip.active {
          background: #161319;
          color: #fef7ed;
        }
        .chip.red.active {
          background: #d84a4a;
          border-color: #d84a4a;
        }
        .chip.blue.active {
          background: #3a6ed8;
          border-color: #3a6ed8;
        }
        .codenames-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(120px, 1fr));
          gap: 10px;
          margin-top: 12px;
        }
        .code-card {
          background: #fff7e9;
          border: 1px solid #f4e2cc;
          border-radius: 12px;
          padding: 12px;
          min-height: 64px;
          display: grid;
          place-items: center;
          text-align: center;
          font-weight: 600;
        }
        .code-card.red {
          background: #ffe2e2;
          border-color: #eaa3a3;
        }
        .code-card.blue {
          background: #e2edff;
          border-color: #9db8f1;
        }
        .code-card.neutral {
          background: #f0e6d6;
          border-color: #d5c4a6;
        }
        .code-card.assassin {
          background: #2a2025;
          color: #fef7ed;
          border-color: #2a2025;
        }
        .code-card.red.revealed {
          background: #ffd3d3;
          border-color: #d84a4a;
        }
        .code-card.blue.revealed {
          background: #d7e5ff;
          border-color: #3a6ed8;
        }
        .code-card.neutral.revealed {
          background: #ece4d6;
          border-color: #c9b79d;
        }
        .code-card.assassin.revealed {
          background: #2a2025;
          color: #fef7ed;
          border-color: #2a2025;
        }
        .uno-row {
          display: flex;
          gap: 18px;
          align-items: center;
          flex-wrap: wrap;
        }
        .uno-pile {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .uno-card {
          width: 90px;
          height: 130px;
          border-radius: 14px;
          background: #fef7ed;
          border: 1px solid #f4e2cc;
          display: grid;
          place-items: center;
          font-weight: 700;
          text-transform: uppercase;
        }
        .uno-stack {
          position: relative;
          width: 96px;
          height: 136px;
        }
        .uno-stack.neat .uno-card {
          position: absolute;
          inset: 0;
          box-shadow: 0 10px 18px rgba(32, 20, 10, 0.18);
        }
        .uno-stack.neat .uno-card.layer:nth-child(2) {
          transform: translate(3px, 3px);
          opacity: 0.95;
        }
        .uno-stack.neat .uno-card.layer:nth-child(3) {
          transform: translate(6px, 6px);
          opacity: 0.9;
        }
        .uno-stack.messy .uno-card {
          position: absolute;
          inset: 0;
          box-shadow: 0 12px 20px rgba(32, 20, 10, 0.2);
        }
        .uno-stack.messy .tilt-left {
          transform: rotate(-6deg) translate(-4px, 2px);
        }
        .uno-stack.messy .tilt-right {
          transform: rotate(6deg) translate(5px, 3px);
        }
        .uno-stack.messy .top {
          transform: rotate(0deg);
          z-index: 2;
        }
        .uno-card.back {
          background: repeating-linear-gradient(45deg, #161319, #161319 8px, #2c2532 8px, #2c2532 16px);
        }
        .uno-card.red {
          background: #ffb7b7;
          border-color: #d84a4a;
        }
        .uno-card.blue {
          background: #bcd4ff;
          border-color: #3a6ed8;
        }
        .uno-card.green {
          background: #b7f0c2;
          border-color: #3b9b55;
        }
        .uno-card.yellow {
          background: #ffe7a6;
          border-color: #d9a43b;
        }
        .uno-value {
          font-size: 20px;
        }
        .uno-label {
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6c6772;
        }
        .uno-count {
          font-size: 12px;
          color: #6c6772;
        }
        .uno-info {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .uno-chip {
          background: #ffffff;
          border: 1px solid #eee6f4;
          border-radius: 999px;
          padding: 6px 12px;
          font-weight: 600;
        }
        .wall {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
        }
        .wall.full {
          flex: 1;
        }
        .word {
          background: #fef7ed;
          border-radius: 16px;
          padding: 14px 16px;
          border: 1px solid #f4e2cc;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .word-text {
          font-size: 20px;
          font-weight: 700;
        }
        .word-by {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #6c6772;
        }
        .empty {
          margin-top: 16px;
          color: #7b7482;
        }
        @media (max-width: 600px) {
          .stats {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </main>
  );
}
