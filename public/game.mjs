import Player from './Player.mjs';
import Collectible from './Collectible.mjs';

const socket = io();
const canvas = document.getElementById('game-window');
const context = canvas.getContext('2d');

// Game state
let players = [];
let collectibles = [];
let localPlayerId = null;
let keyStates = {};

// Canvas constants
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

// Setup socket events
socket.on('connect', () => {
  console.log('Connected to server');
  localPlayerId = socket.id;
});

socket.on('game-state', (data) => {
  players = data.players;
  collectibles = data.collectibles;
});

// Handle keyboard input
document.addEventListener('keydown', (e) => {
  keyStates[e.key] = true;
  
  const directions = {
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'w': 'up',
    'W': 'up',
    's': 'down',
    'S': 'down',
    'a': 'left',
    'A': 'left',
    'd': 'right',
    'D': 'right'
  };
  
  if (directions[e.key]) {
    e.preventDefault();
    socket.emit('move-player', { dir: directions[e.key], speed: 5 });
  }
});

document.addEventListener('keyup', (e) => {
  keyStates[e.key] = false;
});

// Game loop - render game state
function gameLoop() {
  // Clear canvas
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // Set background
  context.fillStyle = '#222';
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // Draw collectibles
  context.fillStyle = '#FFD700';
  collectibles.forEach(collectible => {
    context.fillRect(collectible.x - 5, collectible.y - 5, 10, 10);
  });
  
  // Draw players
  context.fillStyle = '#00FF00';
  players.forEach(player => {
    context.fillRect(player.x - 10, player.y - 10, 20, 20);
    
    // Draw player id
    context.fillStyle = '#FFFFFF';
    context.font = '10px Arial';
    context.fillText(player.score.toString(), player.x - 5, player.y + 20);
    context.fillStyle = '#00FF00';
  });
  
  // Draw rankings
  drawRankings();
  
  requestAnimationFrame(gameLoop);
}

// Draw rankings on canvas
function drawRankings() {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  context.fillRect(0, 0, 150, sortedPlayers.length * 20 + 10);
  
  context.fillStyle = '#FFFFFF';
  context.font = 'bold 12px Arial';
  context.fillText('RANKINGS', 5, 15);
  
  sortedPlayers.forEach((player, index) => {
    const isLocalPlayer = player.id === localPlayerId;
    context.fillStyle = isLocalPlayer ? '#FFD700' : '#FFFFFF';
    context.font = '10px Arial';
    context.fillText(
      `${index + 1}. Player: ${player.score}`,
      5,
      35 + index * 20
    );
  });
}

// Start game loop
gameLoop();
