const colorHex = {
  red: 0xe74c3c,
  green: 0x2ecc71,
  yellow: 0xf1c40f,
  blue: 0x3498db
};

export class LudoScene extends Phaser.Scene {
  constructor() {
    super('LudoScene');
    this.trackPoints = [];
    this.tokenSprites = new Map();
  }

  create() {
    this.createBoard();
  }

  createBoard() {
    const g = this.add.graphics();
    const size = 680;
    const cell = 24;
    const startX = 60;
    const startY = 20;

    g.fillStyle(0xf5f6fa, 1);
    g.fillRoundedRect(startX, startY, size, size, 12);
    g.lineStyle(3, 0x2d3436, 1);
    g.strokeRoundedRect(startX, startY, size, size, 12);

    this.trackPoints = buildTrackPoints(startX + 340, startY + 340, 260, 52);
    for (const point of this.trackPoints) {
      g.fillStyle(0xc7d3de, 1);
      g.fillCircle(point.x, point.y, 8);
    }

    this.yardPoints = buildYardPoints(startX, startY);
    this.homePoints = buildHomePoints(startX + 340, startY + 340);

    for (const [color, points] of Object.entries(this.yardPoints)) {
      for (const p of points) {
        g.fillStyle(colorHex[color], 0.35);
        g.fillCircle(p.x, p.y, cell / 2);
      }
    }
  }

  renderState(room) {
    const players = room.players || [];
    const occupiedKeys = new Set();

    for (const player of players) {
      for (const token of player.tokens) {
        const key = `${player.userId}:${token.tokenId}`;
        occupiedKeys.add(key);
        const pos = this.resolveTokenPosition(player.color, token.progress, token.tokenId);
        this.upsertTokenSprite(key, pos, player.color);
      }
    }

    for (const key of [...this.tokenSprites.keys()]) {
      if (!occupiedKeys.has(key)) {
        this.tokenSprites.get(key).destroy();
        this.tokenSprites.delete(key);
      }
    }
  }

  resolveTokenPosition(color, progress, tokenId) {
    const tokenIndex = Number(tokenId.split('-')[1]);

    if (progress < 0) {
      return this.yardPoints[color][tokenIndex];
    }

    if (progress <= 51) {
      const offset = startOffset(color);
      return this.trackPoints[(offset + progress) % 52];
    }

    const homeProgress = Math.min(progress - 52, 5);
    return this.homePoints[color][homeProgress];
  }

  upsertTokenSprite(key, pos, color) {
    let sprite = this.tokenSprites.get(key);
    if (!sprite) {
      sprite = this.add.circle(pos.x, pos.y, 11, colorHex[color], 1);
      sprite.setStrokeStyle(2, 0x111111, 1);
      this.tokenSprites.set(key, sprite);
      return;
    }

    this.tweens.add({
      targets: sprite,
      x: pos.x,
      y: pos.y,
      duration: 180,
      ease: 'Sine.easeOut'
    });
  }
}

function buildTrackPoints(cx, cy, radius, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const angle = ((Math.PI * 2) / count) * i - Math.PI / 2;
    out.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return out;
}

function buildYardPoints(startX, startY) {
  return {
    red: [
      { x: startX + 120, y: startY + 120 },
      { x: startX + 200, y: startY + 120 },
      { x: startX + 120, y: startY + 200 },
      { x: startX + 200, y: startY + 200 }
    ],
    green: [
      { x: startX + 480, y: startY + 120 },
      { x: startX + 560, y: startY + 120 },
      { x: startX + 480, y: startY + 200 },
      { x: startX + 560, y: startY + 200 }
    ],
    yellow: [
      { x: startX + 480, y: startY + 480 },
      { x: startX + 560, y: startY + 480 },
      { x: startX + 480, y: startY + 560 },
      { x: startX + 560, y: startY + 560 }
    ],
    blue: [
      { x: startX + 120, y: startY + 480 },
      { x: startX + 200, y: startY + 480 },
      { x: startX + 120, y: startY + 560 },
      { x: startX + 200, y: startY + 560 }
    ]
  };
}

function buildHomePoints(cx, cy) {
  return {
    red: Array.from({ length: 6 }, (_, i) => ({ x: cx - 220 + i * 35, y: cy - 15 })),
    green: Array.from({ length: 6 }, (_, i) => ({ x: cx + 15, y: cy - 220 + i * 35 })),
    yellow: Array.from({ length: 6 }, (_, i) => ({ x: cx + 220 - i * 35, y: cy + 15 })),
    blue: Array.from({ length: 6 }, (_, i) => ({ x: cx - 15, y: cy + 220 - i * 35 }))
  };
}

function startOffset(color) {
  if (color === 'red') return 0;
  if (color === 'green') return 13;
  if (color === 'yellow') return 26;
  return 39;
}
