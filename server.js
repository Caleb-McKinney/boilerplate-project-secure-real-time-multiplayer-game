require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const expect = require('chai');
const socket = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const app = express();

// Disable default powered-by header
app.disable('x-powered-by');

// Helmet security middleware with configuration for v3.21.3
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ['fonts.gstatic.com']
    }
  },
  hidePoweredBy: false,
  frameguard: true,
  hsts: true,
  noSniff: true,
  xssFilter: true,
  referrerPolicy: true
}));

// Custom headers middleware - must come after helmet
app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'PHP 7.4.3');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//For FCC testing purposes and enables user to connect from outside the hosting platform
app.use(cors({origin: '*'})); 

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  }); 

//For FCC testing purposes
fccTestingRoutes(app);
    
// 404 Not Found Middleware
app.use(function(req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

const portNum = process.env.PORT || 3000;

// Set up server and tests
const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV==='test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (error) {
        console.log('Tests are not valid:');
        console.error(error);
      }
    }, 1500);
  }
});

// Socket.io setup
const io = socket(server, {
  cors: {
    origin: '*'
  }
});

// Store connected players
const players = {};
let collectibles = [];

// Helper function to generate random position
function getRandomPosition() {
  return {
    x: Math.floor(Math.random() * 600) + 20,
    y: Math.floor(Math.random() * 400) + 40
  };
}

// Initialize collectible
function generateCollectible() {
  const pos = getRandomPosition();
  return {
    x: pos.x,
    y: pos.y,
    value: 1,
    id: Date.now()
  };
}

// Ensure at least one collectible exists
collectibles.push(generateCollectible());

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);
  
  // Create new player
  const pos = getRandomPosition();
  players[socket.id] = {
    id: socket.id,
    x: pos.x,
    y: pos.y,
    score: 0,
    ping: 0
  };
  
  // Emit game state to all clients
  io.emit('game-state', {
    players: Object.values(players),
    collectibles: collectibles
  });
  
  // Handle player movement
  socket.on('move-player', (data) => {
    if (players[socket.id]) {
      if (data.dir === 'right' && players[socket.id].x < 640) {
        players[socket.id].x += data.speed || 5;
      } else if (data.dir === 'left' && players[socket.id].x > 0) {
        players[socket.id].x -= data.speed || 5;
      } else if (data.dir === 'up' && players[socket.id].y > 40) {
        players[socket.id].y -= data.speed || 5;
      } else if (data.dir === 'down' && players[socket.id].y < 480) {
        players[socket.id].y += data.speed || 5;
      }
      
      // Check for collectible collision
      collectibles.forEach((collectible, index) => {
        if (
          players[socket.id].x === collectible.x &&
          players[socket.id].y === collectible.y
        ) {
          players[socket.id].score += collectible.value;
          collectibles.splice(index, 1);
          collectibles.push(generateCollectible());
        }
      });
      
      // Broadcast updated game state
      io.emit('game-state', {
        players: Object.values(players),
        collectibles: collectibles
      });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('game-state', {
      players: Object.values(players),
      collectibles: collectibles
    });
  });
  
  // Handle ping
  socket.on('ping', (data) => {
    socket.emit('pong', { timestamp: Date.now() });
  });
});

module.exports = app; // For testing

