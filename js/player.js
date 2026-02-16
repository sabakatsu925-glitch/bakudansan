// プレイヤー管理
class Player {
    constructor(id, spawnPos, isCpu = false, cpuDifficulty = null) {
        this.id = id;
        this.x = spawnPos.x;
        this.y = spawnPos.y;
        this.spawnPos = { ...spawnPos };
        this.isCpu = isCpu;
        this.cpuDifficulty = cpuDifficulty;

        this.alive = true;
        this.isMisobon = false;
        this.firePower = DEFAULT_FIRE_POWER;
        this.maxBombs = DEFAULT_BOMB_COUNT;
        this.hasKick = false;

        this.direction = DIR.DOWN;
        this.moving = false;
        this.score = 0;

        // CPU用: タイルベース移動
        this.targetTileX = spawnPos.x;
        this.targetTileY = spawnPos.y;
    }

    reset(spawnPos) {
        this.x = spawnPos.x;
        this.y = spawnPos.y;
        this.alive = true;
        this.isMisobon = false;
        this.firePower = DEFAULT_FIRE_POWER;
        this.maxBombs = DEFAULT_BOMB_COUNT;
        this.hasKick = false;
        this.direction = DIR.DOWN;
        this.moving = false;
        this.targetTileX = spawnPos.x;
        this.targetTileY = spawnPos.y;
    }

    // 人間プレイヤー用: アナログ移動
    move(dx, dy, dt, gameMap, bombManager) {
        if (!this.alive || this.isMisobon) return;

        const speed = PLAYER_SPEED * dt;
        let newX = this.x + dx * speed;
        let newY = this.y + dy * speed;

        const halfSize = 0.3;

        // X方向
        if (dx !== 0) {
            const testX = newX + (dx > 0 ? halfSize : -halfSize);
            const tileX = Math.floor(testX + 0.5);
            const tileYTop = Math.floor(this.y - halfSize + 0.5);
            const tileYBot = Math.floor(this.y + halfSize - 0.01 + 0.5);

            let blocked = false;
            for (let ty = tileYTop; ty <= tileYBot; ty++) {
                if (this._isTileBlocked(tileX, ty, gameMap, bombManager)) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) {
                newX = this.x;
                // コーナー補正
                if (dy === 0) {
                    const centerY = Math.round(this.y);
                    const diff = centerY - this.y;
                    if (Math.abs(diff) > 0.05) {
                        newY = this.y + Math.sign(diff) * speed;
                    }
                }
            }
        }

        // Y方向
        if (dy !== 0) {
            const testY = newY + (dy > 0 ? halfSize : -halfSize);
            const tileY = Math.floor(testY + 0.5);
            const tileXLeft = Math.floor(newX - halfSize + 0.5);
            const tileXRight = Math.floor(newX + halfSize - 0.01 + 0.5);

            let blocked = false;
            for (let tx = tileXLeft; tx <= tileXRight; tx++) {
                if (this._isTileBlocked(tx, tileY, gameMap, bombManager)) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) {
                newY = this.y;
                if (dx === 0) {
                    const centerX = Math.round(this.x);
                    const diff = centerX - this.x;
                    if (Math.abs(diff) > 0.05) {
                        newX = this.x + Math.sign(diff) * speed;
                    }
                }
            }
        }

        this.x = Math.max(0.5, Math.min(COLS - 1.5, newX));
        this.y = Math.max(0.5, Math.min(ROWS - 1.5, newY));

        if (dx !== 0 || dy !== 0) {
            if (Math.abs(dx) > Math.abs(dy)) {
                this.direction = dx > 0 ? DIR.RIGHT : DIR.LEFT;
            } else {
                this.direction = dy > 0 ? DIR.DOWN : DIR.UP;
            }
            this.moving = true;
        } else {
            this.moving = false;
        }
    }

    // CPU用: タイルからタイルへ移動（引っかからない）
    cpuMove(targetX, targetY, dt) {
        if (!this.alive || this.isMisobon) return;

        this.targetTileX = targetX;
        this.targetTileY = targetY;

        const speed = PLAYER_SPEED * dt;
        const diffX = this.targetTileX - this.x;
        const diffY = this.targetTileY - this.y;

        // まずX軸を揃えてからY軸（直角移動）
        if (Math.abs(diffX) > 0.05) {
            this.x += Math.sign(diffX) * Math.min(speed, Math.abs(diffX));
            this.direction = diffX > 0 ? DIR.RIGHT : DIR.LEFT;
            this.moving = true;
        } else if (Math.abs(diffY) > 0.05) {
            this.x = this.targetTileX; // X軸をスナップ
            this.y += Math.sign(diffY) * Math.min(speed, Math.abs(diffY));
            this.direction = diffY > 0 ? DIR.DOWN : DIR.UP;
            this.moving = true;
        } else {
            // 到着
            this.x = this.targetTileX;
            this.y = this.targetTileY;
            this.moving = false;
        }
    }

    isAtTarget() {
        return Math.abs(this.x - this.targetTileX) < 0.05 &&
               Math.abs(this.y - this.targetTileY) < 0.05;
    }

    _isTileBlocked(tileX, tileY, gameMap, bombManager) {
        if (gameMap.isSolid(tileX, tileY)) return true;

        if (bombManager.hasBombAt(tileX, tileY)) {
            const myTileX = Math.round(this.x);
            const myTileY = Math.round(this.y);
            if (tileX === myTileX && tileY === myTileY) return false;

            if (this.hasKick) {
                const ddx = tileX - myTileX;
                const ddy = tileY - myTileY;
                if (ddx !== 0 || ddy !== 0) {
                    const dir = ddx > 0 ? DIR.RIGHT : ddx < 0 ? DIR.LEFT : ddy > 0 ? DIR.DOWN : DIR.UP;
                    bombManager.kickBomb(tileX, tileY, dir);
                }
            }
            return true;
        }

        return false;
    }

    getTilePos() {
        return { x: Math.round(this.x), y: Math.round(this.y) };
    }

    die() {
        this.alive = false;
    }

    becomeMisobon() {
        this.isMisobon = true;
        this.alive = false;
    }
}
