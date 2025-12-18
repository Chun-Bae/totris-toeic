"use client";


import { useEffect, useRef, useState } from "react";
import wordsRaw from "../data/word.json";

const COLS = 10;
const ROWS = 20;
const BLOCK = 28;

// Preview(Next/Hold) 캔버스 크기/블록 크기
const PREVIEW_BLOCK = 20;
const PREVIEW_COLS = 6;
const PREVIEW_ROWS = 6;


type Vocab = {
  word: string;
  meaning: string;
  pron?: string;
  example?: string;
};

type WordPair = {
  word: string;
  meaning: string;
};

// TODO: 나중에 DB 연동 시 이 JSON 대신 /api/words(또는 DB)에서 로드하도록 교체
const TOEIC_WORDS: Vocab[] = (wordsRaw as WordPair[])
  .filter((w) => typeof w.word === "string" && typeof w.meaning === "string")
  .map((w) => ({ word: w.word, meaning: w.meaning }));

type Board = number[][];

type PieceDef = {
  name: string;
  shape: number[][];
  color: string;
};

type PieceCore = {
  name: string;
  shape: number[][];
  color: string;
  id: number; // 보드에 저장할 숫자(색상 인덱스 역할)
};

type ActivePiece = PieceCore & {
  x: number;
  y: number;
};

const PIECES: PieceDef[] = [
  { name: "I", color: "#60a5fa", shape: [[1, 1, 1, 1]] },
  { name: "O", color: "#facc15", shape: [[1, 1], [1, 1]] },
  { name: "T", color: "#a78bfa", shape: [[0, 1, 0], [1, 1, 1]] },
  { name: "S", color: "#34d399", shape: [[0, 1, 1], [1, 1, 0]] },
  { name: "Z", color: "#f87171", shape: [[1, 1, 0], [0, 1, 1]] },
  { name: "J", color: "#3b82f6", shape: [[1, 0, 0], [1, 1, 1]] },
  { name: "L", color: "#fb923c", shape: [[0, 0, 1], [1, 1, 1]] },
];

function deepCopyShape(shape: number[][]): number[][] {
  return shape.map((r) => [...r]);
}

function makeEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function makeCoreByIndex(idx: number): PieceCore {
  const def = PIECES[idx];
  return {
    name: def.name,
    shape: deepCopyShape(def.shape),
    color: def.color,
    id: idx + 1,
  };
}

function randomCore(): PieceCore {
  const idx = Math.floor(Math.random() * PIECES.length);
  return makeCoreByIndex(idx);
}

function spawnActiveFromCore(core: PieceCore): ActivePiece {
  const w = core.shape[0].length;
  const x = Math.floor(COLS / 2 - w / 2);
  return {
    ...core,
    shape: deepCopyShape(core.shape),
    x,
    y: 0,
  };
}

function rotateCW(mat: number[][]): number[][] {
  // (h x w) -> (w x h)
  const h = mat.length;
  const w = mat[0].length;
  const res = Array.from({ length: w }, () => Array(h).fill(0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      res[x][h - 1 - y] = mat[y][x];
    }
  }
  return res;
}

function collides(board: Board, piece: ActivePiece): boolean {
  const { shape, x: px, y: py } = piece;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[0].length; x++) {
      if (!shape[y][x]) continue;
      const bx = px + x;
      const by = py + y;

      if (bx < 0 || bx >= COLS || by < 0 || by >= ROWS) return true;
      if (board[by][bx] !== 0) return true;
    }
  }
  return false;
}

function merge(board: Board, piece: ActivePiece): void {
  const { shape, x: px, y: py, id } = piece;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[0].length; x++) {
      if (!shape[y][x]) continue;
      const bx = px + x;
      const by = py + y;
      if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
        board[by][bx] = id;
      }
    }
  }
}

function clearLines(board: Board): number {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    const full = board[y].every((v) => v !== 0);
    if (full) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      y++; // 같은 y를 다시 검사(행이 내려왔으니)
    }
  }
  return cleared;
}

function drawPreview(
  ctx: CanvasRenderingContext2D,
  core: PieceCore | null,
  label: string
) {
  const w = PREVIEW_COLS * PREVIEW_BLOCK;
  const h = PREVIEW_ROWS * PREVIEW_BLOCK;

  // 배경
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, w, h);

  // 라벨(캔버스 내부 상단)
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "12px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(label, 8, 16);

  if (!core) {
    // 빈 슬롯 표시
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.strokeRect(6, 22, w - 12, h - 28);
    return;
  }

  const shape = core.shape;
  const sh = shape.length;
  const sw = shape[0].length;

  // 가운데 정렬
  const offsetX = Math.floor((PREVIEW_COLS - sw) / 2) * PREVIEW_BLOCK;
  const offsetY = Math.floor((PREVIEW_ROWS - sh) / 2) * PREVIEW_BLOCK + 10;

  // 블록
  ctx.fillStyle = core.color;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (!shape[y][x]) continue;
      const px = offsetX + x * PREVIEW_BLOCK;
      const py = offsetY + y * PREVIEW_BLOCK;
      ctx.fillRect(px + 2, py + 2, PREVIEW_BLOCK - 4, PREVIEW_BLOCK - 4);
    }
  }

  // 테두리
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.strokeRect(6, 22, w - 12, h - 28);
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const holdCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const boardRef = useRef<Board>(makeEmptyBoard());

  // 현재/다음/홀드
  const pieceRef = useRef<ActivePiece>(spawnActiveFromCore(randomCore()));
  const nextRef = useRef<PieceCore>(randomCore());
  const holdRef = useRef<PieceCore | null>(null);
  const canHoldRef = useRef<boolean>(true);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  // 라인 삭제 시 보여줄 단어(팝업)
  const [vocabPopup, setVocabPopup] = useState<Vocab | null>(null);

  useEffect(() => {
    // 메인 캔버스
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = COLS * BLOCK;
    canvas.height = ROWS * BLOCK;

    // 프리뷰 캔버스
    const nextCanvas = nextCanvasRef.current;
    const holdCanvas = holdCanvasRef.current;
    if (nextCanvas) {
      nextCanvas.width = PREVIEW_COLS * PREVIEW_BLOCK;
      nextCanvas.height = PREVIEW_ROWS * PREVIEW_BLOCK;
    }
    if (holdCanvas) {
      holdCanvas.width = PREVIEW_COLS * PREVIEW_BLOCK;
      holdCanvas.height = PREVIEW_ROWS * PREVIEW_BLOCK;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nextCtx = nextCanvas?.getContext("2d") ?? null;
    const holdCtx = holdCanvas?.getContext("2d") ?? null;

    const colorsById = (id: number) => PIECES[id - 1]?.color ?? "#ffffff";

    const pickRandomVocab = (): Vocab => {
      if (TOEIC_WORDS.length === 0) return { word: "(no data)", meaning: "단어 데이터가 비어 있습니다" };
      return TOEIC_WORDS[Math.floor(Math.random() * TOEIC_WORDS.length)];
    };

    const draw = () => {
      // === Preview 패널 렌더 ===
      if (nextCtx) drawPreview(nextCtx, nextRef.current, "NEXT");
      if (holdCtx) drawPreview(holdCtx, holdRef.current, "HOLD");

      // === 메인 필드 렌더 ===
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 보드
      const board = boardRef.current;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const v = board[y][x];
          if (v === 0) continue;
          ctx.fillStyle = colorsById(v);
          ctx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
        }
      }

      // 1) 고스트 피스(착지 예상 위치) - 테두리만(더 깔끔)
      if (!gameOver) {
        const cur = pieceRef.current;
        let ghost: ActivePiece = { ...cur };
        while (true) {
          const down: ActivePiece = { ...ghost, y: ghost.y + 1 };
          if (collides(board, down)) break;
          ghost = down;
        }

        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = ghost.color;
        ctx.lineWidth = 2;
        for (let y = 0; y < ghost.shape.length; y++) {
          for (let x = 0; x < ghost.shape[0].length; x++) {
            if (!ghost.shape[y][x]) continue;
            const px = (ghost.x + x) * BLOCK;
            const py = (ghost.y + y) * BLOCK;
            ctx.strokeRect(px + 3, py + 3, BLOCK - 6, BLOCK - 6);
          }
        }
        ctx.restore();
      }

      // 현재 피스
      const p = pieceRef.current;
      ctx.fillStyle = p.color;
      for (let y = 0; y < p.shape.length; y++) {
        for (let x = 0; x < p.shape[0].length; x++) {
          if (!p.shape[y][x]) continue;
          const px = (p.x + x) * BLOCK;
          const py = (p.y + y) * BLOCK;
          ctx.fillRect(px + 1, py + 1, BLOCK - 2, BLOCK - 2);
        }
      }

      // 격자(맨 위에)
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK, 0);
        ctx.lineTo(x * BLOCK, ROWS * BLOCK);
        ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK);
        ctx.lineTo(COLS * BLOCK, y * BLOCK);
        ctx.stroke();
      }

      if (gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 8);
        ctx.font = "14px system-ui";
        ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 18);
      }
    };

    let last = performance.now();
    let acc = 0;
    const DROP_MS = 500;

    const lockAndSpawnNext = () => {
      const board = boardRef.current;
      const cur = pieceRef.current;

      // 고정
      merge(board, cur);

      // 라인 삭제 & 점수
      const c = clearLines(board);
      if (c > 0) {
        setLines((prev) => prev + c);
        setScore((prev) => prev + [0, 100, 300, 500, 800][c]);

        // 라인 삭제 “한 번”당 단어 1개만 표시 (여러 줄 동시 삭제여도 1개)
        setVocabPopup(pickRandomVocab());
      }

      // 홀드는 새 피스가 나왔을 때 다시 가능
      canHoldRef.current = true;

      // 다음 피스 스폰(2) NEXT 적용
      const nextActive = spawnActiveFromCore(nextRef.current);
      nextRef.current = randomCore();

      if (collides(board, nextActive)) {
        setGameOver(true);
      } else {
        pieceRef.current = nextActive;
      }
    };

    const stepDown = () => {
      const board = boardRef.current;
      const cur = pieceRef.current;

      const moved: ActivePiece = { ...cur, y: cur.y + 1 };
      if (!collides(board, moved)) {
        pieceRef.current = moved;
        return;
      }

      lockAndSpawnNext();
    };

    const loop = (now: number) => {
      const dt = now - last;
      last = now;

      if (!gameOver) {
        acc += dt;
        while (acc >= DROP_MS) {
          acc -= DROP_MS;
          stepDown();
        }
      }

      draw();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    const tryMove = (dx: number, dy: number) => {
      if (gameOver) return;
      const board = boardRef.current;
      const cur = pieceRef.current;
      const moved: ActivePiece = { ...cur, x: cur.x + dx, y: cur.y + dy };
      if (!collides(board, moved)) pieceRef.current = moved;
    };

    const tryRotate = () => {
      if (gameOver) return;
      const board = boardRef.current;
      const cur = pieceRef.current;
      const rotated: ActivePiece = { ...cur, shape: rotateCW(cur.shape) };

      // 간단한 “벽 킥” 흉내: 좌/우로 한 칸씩 밀어보기
      const kicks = [0, -1, 1, -2, 2];
      for (const k of kicks) {
        const test: ActivePiece = { ...rotated, x: rotated.x + k };
        if (!collides(board, test)) {
          pieceRef.current = test;
          return;
        }
      }
    };

    const hardDrop = () => {
      if (gameOver) return;
      const board = boardRef.current;
      let cur = pieceRef.current;

      while (true) {
        const down: ActivePiece = { ...cur, y: cur.y + 1 };
        if (collides(board, down)) break;
        cur = down;
      }
      pieceRef.current = cur;
      lockAndSpawnNext();
    };

    // 3) HOLD 기능 (C 또는 Shift)
    const hold = () => {
      if (gameOver) return;
      if (!canHoldRef.current) return;

      const board = boardRef.current;
      const cur = pieceRef.current;

      const curCore: PieceCore = {
        name: cur.name,
        shape: deepCopyShape(cur.shape),
        color: cur.color,
        id: cur.id,
      };

      if (!holdRef.current) {
        // 처음 홀드: 현재를 홀드에 넣고, NEXT를 현재로 꺼내오고, NEXT를 새로 뽑음
        holdRef.current = curCore;
        const nextActive = spawnActiveFromCore(nextRef.current);
        nextRef.current = randomCore();

        if (collides(board, nextActive)) {
          setGameOver(true);
        } else {
          pieceRef.current = nextActive;
        }
      } else {
        // 스왑
        const temp = holdRef.current;
        holdRef.current = curCore;
        const swapped = spawnActiveFromCore(temp);

        if (collides(board, swapped)) {
          setGameOver(true);
        } else {
          pieceRef.current = swapped;
        }
      }

      // 한 번 홀드하면, 다음 락까지 홀드 불가
      canHoldRef.current = false;
    };

    const restart = () => {
      boardRef.current = makeEmptyBoard();

      // current/next/hold 초기화
      const curCore = randomCore();
      pieceRef.current = spawnActiveFromCore(curCore);
      nextRef.current = randomCore();
      holdRef.current = null;
      canHoldRef.current = true;

      setScore(0);
      setLines(0);
      setGameOver(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") tryMove(-1, 0);
      else if (e.key === "ArrowRight") tryMove(1, 0);
      else if (e.key === "ArrowDown") tryMove(0, 1);
      else if (e.key === "ArrowUp") tryRotate();
      else if (e.key === " ") hardDrop();
      else if (e.key === "c" || e.key === "C" || e.key === "Shift") hold();
      else if (e.key.toLowerCase() === "r") restart();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gameOver]);

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 w-full max-w-[760px]">
        <div className="flex items-end justify-between w-full">
          <div>
            <h1 className="text-2xl font-bold">Totris</h1>
            <p className="opacity-70 text-sm">
              ← → 이동 / ↓ 소프트드롭 / ↑ 회전 / Space 하드드롭 / C(or Shift)
              홀드 / R 재시작
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="opacity-70">Score</div>
            <div className="text-xl font-bold">{score}</div>
            <div className="opacity-70 mt-1">Lines: {lines}</div>
          </div>
        </div>

        <div className="flex items-start gap-6">
          <div className="w-[140px] flex flex-col items-center gap-2">
            <div className="text-sm font-semibold">HOLD</div>
            <canvas ref={holdCanvasRef} className="rounded-xl shadow-lg" />
            <div className="text-xs opacity-70">C / Shift</div>
          </div>

          <canvas ref={canvasRef} className="rounded-xl shadow-lg" />

          <div className="w-[140px] flex flex-col items-center gap-2">
            <div className="text-sm font-semibold">NEXT</div>
            <canvas ref={nextCanvasRef} className="rounded-xl shadow-lg" />
          </div>
        </div>

        <div className="w-full rounded-xl border border-white/10 bg-black/30 backdrop-blur px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">TOEIC 단어</div>
            <div className="text-xs opacity-60">라인을 지우면 갱신됩니다</div>
          </div>

          {vocabPopup ? (
            <div className="mt-2">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-xl font-bold tracking-tight">{vocabPopup.word}</div>
                {vocabPopup.pron && (
                  <div className="text-xs opacity-70">{vocabPopup.pron}</div>
                )}
              </div>
              <div className="text-sm mt-1 opacity-90">{vocabPopup.meaning}</div>
              {vocabPopup.example && (
                <div className="text-xs mt-2 opacity-70">{vocabPopup.example}</div>
              )}
            </div>
          ) : (
            <div className="mt-2 text-sm opacity-70">아직 표시된 단어가 없습니다.</div>
          )}
        </div>
      </div>
    </main>
  );
}