require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const socket = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const app = express();

/* ======================
   SECURITY MIDDLEWARE (MUST BE FIRST)
   ====================== */

// Single unified security middleware that runs first
app.use((req, res, next) => {
  // X-Content-Type-Options: nosniff (prevent MIME sniffing)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-XSS-Protection (prevent XSS)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Cache control headers
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // X-Powered-By (custom value)
  res.setHeader('X-Powered-By', 'PHP 7.4.3');
  
  next();
});

// Additional helmet protection (not counted by FCC tests)
app.use(helmet({
  noSniff: false,  // Already handled above
  xssFilter: false, // Already handled above
  hidePoweredBy: false
}));

/* ======================
   STATIC + PARSING
   ====================== */

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Allow FCC testing connections
app.use(cors({ origin: '*' }));

/* ======================
   ROUTES
   ====================== */

app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

fccTestingRoutes(app);

// 404 handler
app.use(function (req, res) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

/* ======================
   SERVER + TEST RUNNER
   ====================== */

const portNum = process.env.PORT || 3000;

const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV === 'test') {
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

/* ======================
   SOCKET.IO GAME LOGIC
   ====================== */

const io = socket(server, {
  cors: {
    origin: '*'
  }
});

const players = {};
let collectibles = [];

app.locals.players = players;
app.locals.collectibles = collectibles;

function getRandomPosition() {
  return {
    x: Math.floor(Math.random() * 600) + 20,
    y: Math.floor(Math.random() * 400) + 40
  };
}

function generateCollectible() {
  const pos = getRandomPosition();
  return {
    x: pos.x,
    y: pos.y,
    value: 1,
    id: Date.now()
  };
}

collectibles.push(generateCollectible());

io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);

  const pos = getRandomPosition();
  players[socket.id] = {
    id: socket.id,
    x: pos.x,
    y: pos.y,
    score: 0,
    ping: 0
  };

  io.emit('game-state', {
    players: Object.values(players),
    collectibles: collectibles
  });

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

      io.emit('game-state', {
        players: Object.values(players),
        collectibles: collectibles
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('game-state', {
      players: Object.values(players),
      collectibles: collectibles
    });
  });

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
});

module.exports = app;
