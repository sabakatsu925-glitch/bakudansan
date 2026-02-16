// 爆弾・爆発管理
class BombManager {
    constructor(gameMap) {
        this.map = gameMap;
        this.bombs = [];
        this.explosions = [];  // { x, y, timer }
    }

    placeBomb(player) {
        const tileX = Math.round(player.x);
        const tileY = Math.round(player.y);

        // 既に爆弾があるか
        if (this.getBombAt(tileX, tileY)) return false;

        // 設置数制限チェック
        const playerBombs = this.bombs.filter(b => b.ownerId === player.id);
        if (playerBombs.length >= player.maxBombs) return false;

        const bomb = {
            x: tileX,
            y: tileY,
            ownerId: player.id,
            firePower: player.firePower,
            timer: BOMB_TIMER,
            kicked: false,
            kickDir: null,
            kickProgress: 0,
        };

        this.bombs.push(bomb);
        return true;
    }

    placeMisobonBomb(misobon) {
        // みそボンは外周の好きな空きマスに爆弾を投げる
        const tileX = Math.round(misobon.targetX);
        const tileY = Math.round(misobon.targetY);

        if (tileX < 1 || tileX >= COLS - 1 || tileY < 1 || tileY >= ROWS - 1) return false;
        if (this.map.isSolid(tileX, tileY)) return false;
        if (this.getBombAt(tileX, tileY)) return false;

        const existingBombs = this.bombs.filter(b => b.ownerId === misobon.playerId);
        if (existingBombs.length >= MISOBON_BOMB_COUNT) return false;

        const bomb = {
            x: tileX,
            y: tileY,
            ownerId: misobon.playerId,
            firePower: MISOBON_FIRE_POWER,
            timer: BOMB_TIMER,
            kicked: false,
            kickDir: null,
            kickProgress: 0,
        };

        this.bombs.push(bomb);
        return true;
    }

    getBombAt(x, y) {
        return this.bombs.find(b => b.x === x && b.y === y);
    }

    kickBomb(tileX, tileY, direction) {
        const bomb = this.getBombAt(tileX, tileY);
        if (bomb && !bomb.kicked) {
            bomb.kicked = true;
            bomb.kickDir = direction;
            bomb.kickProgress = 0;
            return true;
        }
        return false;
    }

    update(dt, players, onExplosionHit) {
        // 爆弾タイマー更新
        const toExplode = [];
        for (const bomb of this.bombs) {
            if (bomb.kicked) {
                // キックされた爆弾の移動
                bomb.kickProgress += BOMB_KICK_SPEED * dt;
                if (bomb.kickProgress >= 1) {
                    bomb.kickProgress = 0;
                    const newX = bomb.x + bomb.kickDir.x;
                    const newY = bomb.y + bomb.kickDir.y;

                    if (this.map.isWalkable(newX, newY) && !this.getBombAt(newX, newY)) {
                        // プレイヤーがいるかチェック
                        const blocked = players.some(p =>
                            p.alive && Math.round(p.x) === newX && Math.round(p.y) === newY
                        );
                        if (!blocked) {
                            bomb.x = newX;
                            bomb.y = newY;
                        } else {
                            bomb.kicked = false;
                        }
                    } else {
                        bomb.kicked = false;
                    }
                }
            }

            bomb.timer -= dt * 1000;
            if (bomb.timer <= 0) {
                toExplode.push(bomb);
            }
        }

        // 爆発処理（連鎖含む）
        const exploded = new Set();
        const explodeQueue = [...toExplode];
        while (explodeQueue.length > 0) {
            const bomb = explodeQueue.shift();
            const key = `${bomb.x},${bomb.y}`;
            if (exploded.has(key)) continue;
            exploded.add(key);

            this.explodeBomb(bomb, explodeQueue, onExplosionHit);
            this.bombs = this.bombs.filter(b => b !== bomb);
        }

        // 爆発エフェクト更新
        this.explosions = this.explosions.filter(e => {
            e.timer -= dt * 1000;
            return e.timer > 0;
        });
    }

    explodeBomb(bomb, chainQueue, onExplosionHit) {
        const explosionCells = [{ x: bomb.x, y: bomb.y }];

        // 4方向に広がる
        for (const dir of DIRECTIONS) {
            for (let i = 1; i <= bomb.firePower; i++) {
                const nx = bomb.x + dir.x * i;
                const ny = bomb.y + dir.y * i;

                if (!this.map.canExplosionPass(nx, ny)) {
                    // ブロックなら破壊して止まる
                    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS &&
                        this.map.grid[ny][nx] === TILE.BLOCK) {
                        this.map.destroyBlock(nx, ny);
                    }
                    break;
                }

                explosionCells.push({ x: nx, y: ny });

                // 他の爆弾があれば誘爆
                const otherBomb = this.getBombAt(nx, ny);
                if (otherBomb) {
                    chainQueue.push(otherBomb);
                }
            }
        }

        // 爆発エフェクト追加
        for (const cell of explosionCells) {
            this.explosions.push({ x: cell.x, y: cell.y, timer: 500 });
        }

        // コールバックで当たり判定
        if (onExplosionHit) {
            onExplosionHit(explosionCells, bomb.ownerId);
        }
    }

    isExplosionAt(x, y) {
        return this.explosions.some(e => e.x === x && e.y === y);
    }

    hasBombAt(x, y) {
        return this.bombs.some(b => b.x === x && b.y === y);
    }

    reset() {
        this.bombs = [];
        this.explosions = [];
    }
}
