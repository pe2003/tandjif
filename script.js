document.addEventListener('DOMContentLoaded', () => {
  const boardSize = 10;
  const shipSizes = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
  let shots = 0;
  let hits = 0;
  let playerSunkShips = 0;
  let enemySunkShips = 0;
  let playerBoard = [];
  let enemyBoard = [];
  let playerShips = [];
  let enemyShips = [...shipSizes.map(size => ({ size, sunk: false }))];
  let playerId;
  let yourTurn = false;
  let isComputerGame = false;
  let computerShots = new Set();
  let difficulty = 'easy'; // По умолчанию лёгкий уровень
  let computerHits = []; // Для отслеживания попаданий компьютера

  const playerBoardElement = document.getElementById('playerBoard');
  const enemyBoardElement = document.getElementById('enemyBoard');
  const shotsDisplay = document.getElementById('shots');
  const hitsDisplay = document.getElementById('hits');
  const sunkShipsDisplay = document.getElementById('sunkShips');
  const statusDisplay = document.getElementById('status');
  const shipStatusDisplay = document.getElementById('shipStatus');
  const resultDisplay = document.getElementById('result');
  const restartButton = document.getElementById('restartButton');
  const playWithComputerButton = document.getElementById('playWithComputerButton');
  const backgroundMusic = document.getElementById('backgroundMusic');

  let socket = null;

  function connectToServer() {
    if (socket) socket.close();
socket = new WebSocket('wss://battleship-websocket.onrender.com');
    setupSocketListeners();
  }

  function createBoards() {
    playerBoardElement.innerHTML = '';
    enemyBoardElement.innerHTML = '';
    playerBoard = Array(boardSize).fill().map(() => Array(boardSize).fill(0));
    enemyBoard = Array(boardSize).fill().map(() => Array(boardSize).fill(0));
    playerShips = [];
    enemyShips = [...shipSizes.map(size => ({ size, sunk: false }))];
    computerShots.clear();
    computerHits = [];

    for (let i = 0; i < boardSize * boardSize; i++) {
      const playerCell = document.createElement('div');
      playerCell.classList.add('cell');
      playerCell.dataset.index = i;
      playerBoardElement.appendChild(playerCell);

      const enemyCell = document.createElement('div');
      enemyCell.classList.add('cell');
      enemyCell.dataset.index = i;
      enemyCell.addEventListener('click', handleEnemyClick);
      enemyBoardElement.appendChild(enemyCell);
    }
  }

  function placeShips(board, shipSizes) {
    const placedShips = [];
    shipSizes.forEach(size => {
      let placed = false;
      while (!placed) {
        const isHorizontal = Math.random() < 0.5;
        const row = Math.floor(Math.random() * boardSize);
        const col = Math.floor(Math.random() * boardSize);
        if (canPlaceShip(board, row, col, size, isHorizontal)) {
          const ship = { size, cells: [], sunk: false };
          for (let i = 0; i < size; i++) {
            if (isHorizontal) {
              board[row][col + i] = 1;
              ship.cells.push(row * boardSize + col + i);
            } else {
              board[row + i][col] = 1;
              ship.cells.push((row + i) * boardSize + col);
            }
          }
          placedShips.push(ship);
          placed = true;
        }
      }
    });
    return placedShips;
  }

  function canPlaceShip(board, row, col, size, isHorizontal) {
    if (isHorizontal) {
      if (col + size > boardSize) return false;
      for (let i = 0; i < size; i++) {
        if (board[row][col + i] !== 0 || isAdjacentOccupied(board, row, col + i)) return false;
      }
    } else {
      if (row + size > boardSize) return false;
      for (let i = 0; i < size; i++) {
        if (board[row + i][col] !== 0 || isAdjacentOccupied(board, row + i, col)) return false;
      }
    }
    return true;
  }

  function isAdjacentOccupied(board, row, col) {
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        const newRow = row + r;
        const newCol = col + c;
        if (newRow >= 0 && newRow < boardSize && newCol >= 0 && newCol < boardSize) {
          if (board[newRow][newCol] !== 0) return true;
        }
      }
    }
    return false;
  }

  function placePlayerShips(shipsData) {
    playerShips = shipsData;
    playerShips.forEach(ship => {
      ship.cells.forEach(index => {
        const row = Math.floor(index / boardSize);
        const col = index % boardSize;
        playerBoard[row][col]

 = 1;
        const cell = playerBoardElement.querySelector(`[data-index="${index}"]`);
        if (cell) cell.classList.add('ship');
      });
    });
  }

  function updateShipStatus() {
    const remainingEnemyShips = enemyShips.filter(ship => !ship.sunk);
    const remainingPlayerShips = playerShips.filter(ship => !ship.sunk);
  
    const enemyShipCount = {};
    const playerShipCount = {};
  
    remainingEnemyShips.forEach(ship => {
      enemyShipCount[ship.size] = (enemyShipCount[ship.size] || 0) + 1;
    });
    remainingPlayerShips.forEach(ship => {
      playerShipCount[ship.size] = (playerShipCount[ship.size] || 0) + 1;
    });
  
    // Создаём визуальное представление кораблей
    let enemyStatusHTML = '';
    let playerStatusHTML = '';
  
    // Для противника
    [4, 3, 2, 1].forEach(size => {
      const count = enemyShipCount[size] || 0;
      for (let i = 0; i < count; i++) {
        const squares = Array(size).fill('<span class="ship-square"></span>').join('');
        enemyStatusHTML += `<div class="ship-row">${squares}</div>`;
      }
    });
    if (!enemyStatusHTML) enemyStatusHTML = 'Нет';
  
    // Для игрока
    [4, 3, 2, 1].forEach(size => {
      const count = playerShipCount[size] || 0;
      for (let i = 0; i < count; i++) {
        const squares = Array(size).fill('<span class="ship-square"></span>').join('');
        playerStatusHTML += `<div class="ship-row">${squares}</div>`;
      }
    });
    if (!playerStatusHTML) playerStatusHTML = 'Нет';
  
    shipStatusDisplay.innerHTML = `
      <div class="ship-status-container">
        <div class="ship-status-column">
          <div class="ship-status-title">Осталось у противника (${remainingEnemyShips.length}/10):</div>
          ${enemyStatusHTML}
        </div>
        <div class="ship-status-column">
          <div class="ship-status-title">Осталось у вас (${remainingPlayerShips.length}/10):</div>
          ${playerStatusHTML}
        </div>
      </div>
    `;
  }
  
  function handleEnemyClick(e) {
    if (!yourTurn || (!isComputerGame && !socket)) return;
    const cell = e.target;
    const index = parseInt(cell.dataset.index);
    const row = Math.floor(index / boardSize);
    const col = index % boardSize;

    if (cell.classList.contains('miss') || cell.classList.contains('hit') || cell.classList.contains('dead-zone')) return;

    shots++;
    shotsDisplay.textContent = shots;

    if (isComputerGame) {
      handleComputerGameShot(row, col);
    } else {
      socket.send(JSON.stringify({ type: 'shot', player: playerId, row, col }));
    }
  }

  function handleComputerGameShot(row, col) {
    let hit = false;
    const cell = enemyBoardElement.querySelector(`[data-index="${row * boardSize + col}"]`);
    if (enemyBoard[row][col] === 1) {
      hit = true;
      enemyBoard[row][col] = 2;
      cell.classList.add('hit');
      hits++;
      hitsDisplay.textContent = hits;
      checkShipSunk(enemyBoard, enemyShips, row, col);
    } else {
      enemyBoard[row][col] = -1;
      cell.classList.add('miss');
      yourTurn = false;
      setTimeout(computerTurn, 500);
    }
  }

  function computerTurn() {
    if (!isComputerGame || yourTurn) return;

    let row, col, index;
    if (difficulty === 'easy') {
      // Лёгкий уровень: случайные выстрелы
      do {
        index = Math.floor(Math.random() * (boardSize * boardSize));
        row = Math.floor(index / boardSize);
        col = index % boardSize;
      } while (computerShots.has(index));
    } else if (difficulty === 'medium' && computerHits.length > 0) {
      // Средний уровень: добивание случайным образом
      const lastHit = computerHits[computerHits.length - 1];
      const directions = [
        { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }
      ];
      const possibleShots = directions
        .map(dir => ({
          row: lastHit.row + dir.r,
          col: lastHit.col + dir.c
        }))
        .filter(shot => 
          shot.row >= 0 && shot.row < boardSize && 
          shot.col >= 0 && shot.col < boardSize && 
          !computerShots.has(shot.row * boardSize + shot.col)
        );
      if (possibleShots.length > 0) {
        const shot = possibleShots[Math.floor(Math.random() * possibleShots.length)];
        row = shot.row;
        col = shot.col;
        index = row * boardSize + col;
      } else {
        do {
          index = Math.floor(Math.random() * (boardSize * boardSize));
          row = Math.floor(index / boardSize);
          col = index % boardSize;
        } while (computerShots.has(index));
      }
    } else if (difficulty === 'hard' && computerHits.length > 0) {
      // Сложный уровень: умное добивание
      const hit = findNextShotForHard();
      row = hit.row;
      col = hit.col;
      index = row * boardSize + col;
    } else {
      // Если нет попаданий или случайный выстрел на сложном уровне
      do {
        index = Math.floor(Math.random() * (boardSize * boardSize));
        row = Math.floor(index / boardSize);
        col = index % boardSize;
      } while (computerShots.has(index));
    }

    computerShots.add(index);
    const cell = playerBoardElement.querySelector(`[data-index="${index}"]`);
    if (playerBoard[row][col] === 1) {
      playerBoard[row][col] = 2;
      cell.classList.add('hit');
      computerHits.push({ row, col });
      checkShipSunk(playerBoard, playerShips, row, col);
      setTimeout(computerTurn, 500); // Продолжаем ход компьютера
    } else {
      playerBoard[row][col] = -1;
      cell.classList.add('miss');
      yourTurn = true;
      statusDisplay.textContent = 'Ваш ход!';
    }
  }

  function findNextShotForHard() {
    if (computerHits.length === 1) {
      const hit = computerHits[0];
      const directions = [
        { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }
      ];
      const possibleShots = directions
        .map(dir => ({
          row: hit.row + dir.r,
          col: hit.col + dir.c
        }))
        .filter(shot => 
          shot.row >= 0 && shot.row < boardSize && 
          shot.col >= 0 && shot.col < boardSize && 
          !computerShots.has(shot.row * boardSize + shot.col)
        );
      return possibleShots[Math.floor(Math.random() * possibleShots.length)];
    } else if (computerHits.length > 1) {
      const sortedHits = computerHits.sort((a, b) => (a.row * boardSize + a.col) - (b.row * boardSize + b.col));
      const isHorizontal = sortedHits[0].row === sortedHits[1].row;
      if (isHorizontal) {
        const minCol = Math.min(...sortedHits.map(h => h.col));
        const maxCol = Math.max(...sortedHits.map(h => h.col));
        if (minCol > 0 && !computerShots.has(sortedHits[0].row * boardSize + (minCol - 1))) {
          return { row: sortedHits[0].row, col: minCol - 1 };
        } else if (maxCol < boardSize - 1 && !computerShots.has(sortedHits[0].row * boardSize + (maxCol + 1))) {
          return { row: sortedHits[0].row, col: maxCol + 1 };
        }
      } else {
        const minRow = Math.min(...sortedHits.map(h => h.row));
        const maxRow = Math.max(...sortedHits.map(h => h.row));
        if (minRow > 0 && !computerShots.has((minRow - 1) * boardSize + sortedHits[0].col)) {
          return { row: minRow - 1, col: sortedHits[0].col };
        } else if (maxRow < boardSize - 1 && !computerShots.has((maxRow + 1) * boardSize + sortedHits[0].col)) {
          return { row: maxRow + 1, col: sortedHits[0].col };
        }
      }
    }
    // Если не нашли логичный ход, стреляем случайно
    let index;
    do {
      index = Math.floor(Math.random() * (boardSize * boardSize));
    } while (computerShots.has(index));
    return { row: Math.floor(index / boardSize), col: index % boardSize };
  }

  function checkShipSunk(board, ships, row, col) {
    const index = row * boardSize + col;
    let sunkShip = null;

    for (const ship of ships) {
      if (ship.cells.includes(index) && !ship.sunk) {
        const allHit = ship.cells.every(i => {
          const r = Math.floor(i / boardSize);
          const c = i % boardSize;
          return board[r][c] === 2;
        });
        if (allHit) {
          ship.sunk = true;
          sunkShip = ship;
          if (board === playerBoard) {
            playerSunkShips++;
            computerHits = computerHits.filter(h => !ship.cells.includes(h.row * boardSize + h.col)); // Очищаем попадания потопленного корабля
          } else {
            enemySunkShips++;
            sunkShipsDisplay.textContent = enemySunkShips;
          }
          break;
        }
      }
    }

    if (sunkShip) {
      sunkShip.cells.forEach(i => {
        const r = Math.floor(i / boardSize);
        const c = i % boardSize;
        markAroundSunk(board === playerBoard ? playerBoardElement : enemyBoardElement, r, c);
      });
    }
    updateShipStatus();
    if (board === playerBoard) checkLoss();
    else checkWin();
  }

  function markAroundSunk(boardElement, row, col) {
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        const newRow = row + r;
        const newCol = col + c;
        if (newRow >= 0 && newRow < boardSize && newCol >= 0 && newCol < boardSize) {
          const index = newRow * boardSize + newCol;
          const cell = boardElement.querySelector(`[data-index="${index}"]`);
          if (cell && !cell.classList.contains('hit') && !cell.classList.contains('miss')) {
            cell.classList.add('miss');
            if (boardElement === enemyBoardElement && isComputerGame) {
              enemyBoard[newRow][newCol] = -1;
            } else if (boardElement === playerBoardElement) {
              computerShots.add(index);
            }
          }
        }
      }
    }
  }

  function checkLoss() {
    if (playerSunkShips === shipSizes.length) {
      resultDisplay.textContent = 'Вы проиграли!';
      resultDisplay.classList.add('lose');
      restartButton.style.display = 'inline';
      restartButton.textContent = 'Сыграть ещё раз?';
      yourTurn = false;
      backgroundMusic.pause();
    }
  }

  function checkWin() {
    if (enemySunkShips === shipSizes.length) {
      resultDisplay.textContent = 'Вы выиграли!';
      resultDisplay.classList.add('win');
      restartButton.style.display = 'inline';
      restartButton.textContent = 'Сыграть ещё раз?';
      yourTurn = false;
      backgroundMusic.pause();
    }
  }

  function setupSocketListeners() {
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Получено сообщение:', data);
      if (data.type === 'player') {
        playerId = data.id;
        createBoards();
        placePlayerShips(data.ships);
        updateShipStatus();
        statusDisplay.textContent = playerId === 0 ? 'Ожидание второго игрока...' : 'Ожидание начала...';
      } else if (data.type === 'start') {
        yourTurn = data.turn;
        statusDisplay.textContent = yourTurn ? 'Ваш ход!' : 'Ход противника...';
        backgroundMusic.play();
      } else if (data.type === 'hit') {
        const cell = playerBoardElement.querySelector(`[data-index="${data.row * boardSize + data.col}"]`);
        if (cell) {
          cell.classList.add('hit');
          playerBoard[data.row][data.col] = 2;
          checkShipSunk(playerBoard, playerShips, data.row, data.col);
        }
      } else if (data.type === 'miss') {
        const cell = playerBoardElement.querySelector(`[data-index="${data.row * boardSize + data.col}"]`);
        if (cell) {
          cell.classList.add('miss');
          playerBoard[data.row][data.col] = -1;
        }
      } else if (data.type === 'result') {
        const cell = enemyBoardElement.querySelector(`[data-index="${data.row * boardSize + data.col}"]`);
        if (cell) {
          if (data.hit) {
            cell.classList.add('hit');
            enemyBoard[data.row][data.col] = 2;
            hits++;
            hitsDisplay.textContent = hits;
          } else {
            cell.classList.add('miss');
            enemyBoard[data.row][data.col] = -1;
          }
        }
      } else if (data.type === 'sunk') {
        if (yourTurn) {
          const sunkShipSize = data.cells.length;
          enemyShips.find(ship => !ship.sunk && ship.size === sunkShipSize).sunk = true;
          data.cells.forEach(index => {
            const row = Math.floor(index / boardSize);
            const col = index % boardSize;
            const cell = enemyBoardElement.querySelector(`[data-index="${index}"]`);
            if (cell) {
              cell.classList.add('hit');
              enemyBoard[row][col] = 2;
            }
          });
          if (data.deadZone && Array.isArray(data.deadZone)) {
            data.deadZone.forEach(({ row, col }) => {
              const index = row * boardSize + col;
              const cell = enemyBoardElement.querySelector(`[data-index="${index}"]`);
              if (cell && !cell.classList.contains('hit')) {
                cell.classList.add('dead-zone');
                enemyBoard[row][col] = -1;
              }
            });
          }
          enemySunkShips++;
          sunkShipsDisplay.textContent = enemySunkShips;
          checkWin();
        } else {
          const sunkShipSize = data.cells.length;
          playerShips.find(ship => !ship.sunk && ship.cells.length === sunkShipSize).sunk = true;
          data.cells.forEach(index => {
            const row = Math.floor(index / boardSize);
            const col = index % boardSize;
            const cell = playerBoardElement.querySelector(`[data-index="${index}"]`);
            if (cell) {
              cell.classList.add('hit');
              playerBoard[row][col] = 2;
            }
          });
          checkShipSunk(playerBoard, playerShips, data.cells[0] / boardSize, data.cells[0] % boardSize);
        }
        updateShipStatus();
      } else if (data.type === 'turn') {
        yourTurn = data.yourTurn;
        statusDisplay.textContent = yourTurn ? 'Ваш ход!' : 'Ход противника...';
      } else if (data.type === 'gameOver') {
        if (data.result === 'win') {
          resultDisplay.textContent = 'Вы выиграли!';
          resultDisplay.classList.add('win');
        } else {
          resultDisplay.textContent = 'Вы проиграли!';
          resultDisplay.classList.add('lose');
        }
        restartButton.style.display = 'inline';
        restartButton.textContent = 'Сыграть ещё раз?';
        yourTurn = false;
        backgroundMusic.pause();
      } else if (data.type === 'error') {
        resultDisplay.textContent = data.message;
        resultDisplay.classList.add('lose');
        restartButton.style.display = 'inline';
        restartButton.textContent = 'Сыграть ещё раз?';
        backgroundMusic.pause();
      }
    };
  }

  function startGame() {
    shots = 0;
    hits = 0;
    playerSunkShips = 0;
    enemySunkShips = 0;
    shotsDisplay.textContent = shots;
    hitsDisplay.textContent = hits;
    sunkShipsDisplay.textContent = enemySunkShips;
    statusDisplay.textContent = 'Ожидание второго игрока...';
    resultDisplay.textContent = '';
    resultDisplay.classList.remove('win', 'lose');
    restartButton.style.display = 'none';
    playWithComputerButton.style.display = 'inline';
    isComputerGame = false;
    createBoardsIFrame = false;
    createBoards();
    connectToServer();
    updateShipStatus();
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
  }

  function startComputerGame() {
    shots = 0;
    hits = 0;
    playerSunkShips = 0;
    enemySunkShips = 0;
    shotsDisplay.textContent = shots;
    hitsDisplay.textContent = hits;
    sunkShipsDisplay.textContent = enemySunkShips;
    statusDisplay.textContent = 'Ваш ход!';
    resultDisplay.textContent = '';
    resultDisplay.classList.remove('win', 'lose');
    restartButton.style.display = 'none';
    playWithComputerButton.style.display = 'none';
    isComputerGame = true;
    yourTurn = true;

    createBoards();
    playerShips = placeShips(playerBoard, shipSizes);
    enemyShips = placeShips(enemyBoard, shipSizes);
    placePlayerShips(playerShips);
    updateShipStatus();

    if (socket) socket.close();
    socket = null;

    // Добавляем выбор сложности
    const difficultySelect = document.createElement('select');
    difficultySelect.innerHTML = `
      <option value="easy">Лёгкий</option>
      <option value="medium">Средний</option>
      <option value="hard">Сложный</option>
    `;
    difficultySelect.addEventListener('change', (e) => {
      difficulty = e.target.value;
    });
    document.body.insertBefore(difficultySelect, restartButton);

    backgroundMusic.play();
  }

  restartButton.addEventListener('click', startGame);
  playWithComputerButton.addEventListener('click', startComputerGame);

  startGame();
});
