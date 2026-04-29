export type Cell = number;
export type Board = Cell[][];
export type Direction = "left" | "right" | "up" | "down";

export const BOARD_SIZE = 4;

export function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

export function cloneBoard(b: Board): Board {
  return b.map((row) => [...row]);
}

export function addRandomTile(b: Board): Board {
  const empty: Array<[number, number]> = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (b[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return b;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const next = cloneBoard(b);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

export function newGame(): Board {
  return addRandomTile(addRandomTile(emptyBoard()));
}

function slideRowLeft(row: Cell[]): { row: Cell[]; gained: number } {
  const filtered = row.filter((v) => v !== 0);
  const merged: Cell[] = [];
  let gained = 0;
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const sum = filtered[i] * 2;
      merged.push(sum);
      gained += sum;
      i++;
    } else {
      merged.push(filtered[i]);
    }
  }
  while (merged.length < BOARD_SIZE) merged.push(0);
  return { row: merged, gained };
}

function reverseRows(b: Board): Board {
  return b.map((row) => [...row].reverse());
}

function transpose(b: Board): Board {
  const out: Board = emptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      out[c][r] = b[r][c];
    }
  }
  return out;
}

export function move(b: Board, dir: Direction): { board: Board; gained: number; moved: boolean } {
  let working = b;
  if (dir === "right") working = reverseRows(working);
  else if (dir === "up") working = transpose(working);
  else if (dir === "down") working = reverseRows(transpose(working));

  let gained = 0;
  const slid: Board = working.map((row) => {
    const r = slideRowLeft(row);
    gained += r.gained;
    return r.row;
  });

  let result = slid;
  if (dir === "right") result = reverseRows(result);
  else if (dir === "up") result = transpose(result);
  else if (dir === "down") result = transpose(reverseRows(result));

  const moved = !boardsEqual(b, result);
  return { board: result, gained, moved };
}

function boardsEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

export function isGameOver(b: Board): boolean {
  for (const dir of ["left", "right", "up", "down"] as Direction[]) {
    const { moved } = move(b, dir);
    if (moved) return false;
  }
  return true;
}

export function maxTile(b: Board): number {
  let max = 0;
  for (const row of b) for (const v of row) if (v > max) max = v;
  return max;
}
