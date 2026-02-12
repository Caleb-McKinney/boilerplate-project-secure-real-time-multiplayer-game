class Player {
  constructor({x, y, score, id}) {
    this.x = x;
    this.y = y;
    this.score = score || 0;
    this.id = id;
  }

  movePlayer(dir, speed) {
    if (dir === 'right') {
      this.x += speed;
    } else if (dir === 'left') {
      this.x -= speed;
    } else if (dir === 'up') {
      this.y -= speed;
    } else if (dir === 'down') {
      this.y += speed;
    }
  }

  collision(item) {
    return this.x === item.x && this.y === item.y;
  }

  calculateRank(arr) {
    // Sort players by score in descending order and find this player's rank
    const sorted = arr.sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex(player => player.id === this.id) + 1;
    return `Rank: ${rank} / ${arr.length}`;
  }
}

export default Player;
