// Bingo win detection utilities

const GRID_SIZE = 5;

const ROWS = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
];

const COLUMNS = [
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
];

const DIAGONALS = [
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

function checkWins(card) {
  const completedPositions = new Set(
    card.filter((c) => c.answer !== null).map((c) => c.position)
  );

  const completedCount = completedPositions.size;

  const completedRows = ROWS.filter((row) =>
    row.every((pos) => completedPositions.has(pos))
  );

  const completedColumns = COLUMNS.filter((col) =>
    col.every((pos) => completedPositions.has(pos))
  );

  const completedDiagonals = DIAGONALS.filter((diag) =>
    diag.every((pos) => completedPositions.has(pos))
  );

  return {
    completedCount,
    hasRow: completedRows.length > 0,
    hasColumn: completedColumns.length > 0,
    hasDiagonal: completedDiagonals.length > 0,
    hasBlackout: completedCount === 25,
    completedRows: completedRows.map((r) => ROWS.indexOf(r)),
    completedColumns: completedColumns.map((c) => COLUMNS.indexOf(c)),
    completedDiagonals: completedDiagonals.map((d) => DIAGONALS.indexOf(d)),
  };
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateCard(questions) {
  // Pick 24 random questions (center is free)
  const shuffled = shuffleArray(questions).slice(0, 24);
  const card = [];

  for (let i = 0; i < 25; i++) {
    if (i === 12) {
      // Free center square
      card.push({
        position: 12,
        questionId: "free",
        questionText: "FREE SPACE",
        answer: "FREE",
        completedAt: new Date().toISOString(),
      });
    } else {
      const qIndex = i < 12 ? i : i - 1;
      card.push({
        position: i,
        questionId: shuffled[qIndex].id,
        questionText: shuffled[qIndex].text,
        answer: null,
        completedAt: null,
      });
    }
  }

  return card;
}

module.exports = { checkWins, generateCard, shuffleArray, ROWS, COLUMNS, DIAGONALS };
