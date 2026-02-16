// CPU AI - タイルベース移動
class CpuAI {
    constructor(difficulty) {
        this.difficulty = difficulty;
        this.pendingDir = DIR.NONE;
        this.gameTime = 0; // ゲーム経過時間
        this.lastMoveDir = DIR.NONE; // 慣性用: 前回の移動方向
    }

    update(player, dt, gameMap, bombManager, players) {
        this.gameTime += dt;
        const pos = player.getTilePos();

        // 危険回避は最優先（毎フレーム）
        if (this.isInDanger(pos.x, pos.y, bombManager, gameMap)) {
            const safeDir = this.findSafeDirection(pos.x, pos.y, gameMap, bombManager);
            if (safeDir) {
                this.pendingDir = safeDir;
                return { dx: safeDir.x, dy: safeDir.y, placeBomb: false };
            }
            const any = this.getWalkableDirs(pos.x, pos.y, gameMap, bombManager);
            if (any.length > 0) {
                const d = any[Math.floor(Math.random() * any.length)];
                return { dx: d.x, dy: d.y, placeBomb: false };
            }
            return { dx: 0, dy: 0, placeBomb: false };
        }

        // タイル中央に到着してから判断
        if (!player.isAtTarget()) {
            return { dx: this.pendingDir.x, dy: this.pendingDir.y, placeBomb: false };
        }

        // 開始3秒は爆弾置かない（逃げ場確保のため）
        const canBomb = this.gameTime > 3.0;

        const walkable = this.getWalkableDirs(pos.x, pos.y, gameMap, bombManager);

        // 動けない＆ブロックあり → 強制爆破（ただし開始直後は除外）
        if (canBomb && walkable.length === 0 && this.findAdjacentBlock(pos.x, pos.y, gameMap)) {
            return { dx: 0, dy: 0, placeBomb: true };
        }

        switch (this.difficulty) {
            case 'weak': return this.weakAI(player, gameMap, bombManager, players, walkable, canBomb);
            case 'normal': return this.normalAI(player, gameMap, bombManager, players, walkable, canBomb);
            case 'strong': return this.strongAI(player, gameMap, bombManager, players, walkable, canBomb);
        }
    }

    // 安全に爆弾を置けるかチェック（厳密版: BFSで安全地帯到達を確認）
    canSafelyBomb(x, y, firePower, gameMap, bombManager) {
        // 仮想爆弾を追加してシミュレーション
        const fakeBomb = { x, y, firePower, timer: BOMB_TIMER, ownerId: -1 };
        const originalBombs = bombManager.bombs;
        bombManager.bombs = [...originalBombs, fakeBomb];

        // BFSで安全地帯まで到達できるかチェック
        // 移動速度を考慮し、爆弾タイマー内に到達できる距離に制限
        const maxEscapeDist = Math.floor(BOMB_TIMER / 1000 * PLAYER_SPEED);
        const queue = [{ x, y, firstDir: null, dist: 0 }];
        const visited = new Set([`${x},${y}`]);
        let escapeDir = null;

        while (queue.length > 0) {
            const curr = queue.shift();
            // 現在地から離れていて、かつ危険ゾーンの外にいるなら逃走成功
            if (curr.dist > 0 && !this.isInDanger(curr.x, curr.y, bombManager, gameMap)) {
                escapeDir = curr.firstDir;
                break;
            }
            if (curr.dist >= maxEscapeDist) continue;
            for (const dir of DIRECTIONS) {
                const nx = curr.x + dir.x;
                const ny = curr.y + dir.y;
                const key = `${nx},${ny}`;
                if (visited.has(key)) continue;
                if (!gameMap.isWalkable(nx, ny)) continue;
                if (bombManager.hasBombAt(nx, ny)) continue;
                visited.add(key);
                queue.push({ x: nx, y: ny, firstDir: curr.firstDir || dir, dist: curr.dist + 1 });
            }
        }

        bombManager.bombs = originalBombs;
        return escapeDir;
    }

    // 敵が爆弾の爆風ラインに入っているか（直線上にいるか）
    isEnemyInBlastLine(x, y, firePower, enemy, gameMap) {
        const ep = enemy.getTilePos();
        for (const dir of DIRECTIONS) {
            for (let i = 1; i <= firePower; i++) {
                const nx = x + dir.x * i;
                const ny = y + dir.y * i;
                if (!gameMap.canExplosionPass(nx, ny)) break;
                if (nx === ep.x && ny === ep.y) return true;
            }
        }
        return false;
    }

    weakAI(player, gameMap, bombManager, players, walkable, canBomb) {
        const pos = player.getTilePos();

        // アイテム
        if (Math.random() < 0.35) {
            const d = this.findDirectionToItem(pos.x, pos.y, gameMap, bombManager);
            if (d) { this.pendingDir = d; return { dx: d.x, dy: d.y, placeBomb: false }; }
        }

        // ブロック爆破（20%、安全なら）
        if (canBomb && this.findAdjacentBlock(pos.x, pos.y, gameMap) && Math.random() < 0.20) {
            const escape = this.canSafelyBomb(pos.x, pos.y, player.firePower, gameMap, bombManager);
            if (escape) {
                this.pendingDir = escape;
                return { dx: escape.x, dy: escape.y, placeBomb: true };
            }
        }

        // 敵が近くにいたら攻撃（10%の確率 — 弱いので消極的）
        const enemy = this.findNearestEnemy(player, players);
        if (canBomb && enemy && Math.random() < 0.10) {
            const ep = enemy.getTilePos();
            const dist = Math.abs(ep.x - pos.x) + Math.abs(ep.y - pos.y);
            if (dist <= 4) {
                const escape = this.canSafelyBomb(pos.x, pos.y, player.firePower, gameMap, bombManager);
                if (escape) {
                    this.pendingDir = escape;
                    return { dx: escape.x, dy: escape.y, placeBomb: true };
                }
            }
        }

        // ブロック探し
        if (Math.random() < 0.5) {
            const d = this.findDirectionToBlock(pos.x, pos.y, gameMap, bombManager);
            if (d) { this.pendingDir = d; return { dx: d.x, dy: d.y, placeBomb: false }; }
        }

        // 敵へ向かう（フォールバック）
        if (enemy) {
            const ep = enemy.getTilePos();
            const d = this.findPathTo(pos.x, pos.y, ep.x, ep.y, gameMap, bombManager);
            if (d) { this.pendingDir = d; return { dx: d.x, dy: d.y, placeBomb: false }; }
        }

        // 慣性付きランダム移動
        return this.inertialMove(walkable);
    }

    normalAI(player, gameMap, bombManager, players, walkable, canBomb) {
        const pos = player.getTilePos();

        // アイテム（近くにあれば拾う）
        const itemDir = this.findDirectionToItem(pos.x, pos.y, gameMap, bombManager);
        if (itemDir) { this.pendingDir = itemDir; return { dx: itemDir.x, dy: itemDir.y, placeBomb: false }; }

        // 敵接近 → 攻撃を優先
        const enemy = this.findNearestEnemy(player, players);
        if (enemy) {
            const ep = enemy.getTilePos();
            const dist = Math.abs(ep.x - pos.x) + Math.abs(ep.y - pos.y);

            // 近距離で爆弾攻撃（距離5以内）
            if (canBomb && dist <= 5) {
                // 敵が爆風ラインにいるとき、または距離3以内なら攻撃
                const inLine = this.isEnemyInBlastLine(pos.x, pos.y, player.firePower, enemy, gameMap);
                if (inLine || dist <= 3) {
                    const escape = this.canSafelyBomb(pos.x, pos.y, player.firePower, gameMap, bombManager);
                    if (escape) {
                        this.pendingDir = escape;
                        return { dx: escape.x, dy: escape.y, placeBomb: true };
                    }
                }
            }

            // 敵へ接近
            if (dist > 3) {
                const d = this.findPathTo(pos.x, pos.y, ep.x, ep.y, gameMap, bombManager);
                if (d) { this.pendingDir = d; return { dx: d.x, dy: d.y, placeBomb: false }; }
            }
        }

        // ブロック爆破（敵が遠い or いない場合）
        if (canBomb && this.findAdjacentBlock(pos.x, pos.y, gameMap)) {
            const escape = this.canSafelyBomb(pos.x, pos.y, player.firePower, gameMap, bombManager);
            if (escape) {
                this.pendingDir = escape;
                return { dx: escape.x, dy: escape.y, placeBomb: true };
            }
        }

        // ブロック探し
        const blockDir = this.findDirectionToBlock(pos.x, pos.y, gameMap, bombManager);
        if (blockDir) { this.pendingDir = blockDir; return { dx: blockDir.x, dy: blockDir.y, placeBomb: false }; }

        // 敵へ向かう（フォールバック: ブロックもアイテムもない）
        if (enemy) {
            const ep = enemy.getTilePos();
            const d = this.findPathTo(pos.x, pos.y, ep.x, ep.y, gameMap, bombManager);
            if (d) { this.pendingDir = d; return { dx: d.x, dy: d.y, placeBomb: false }; }
        }

        // 慣性付きランダム移動
        return this.inertialMove(walkable);
    }

    strongAI(player, gameMap, bombManager, players, walkable, canBomb) {
        const pos = player.getTilePos();

        // 敵追い詰め（最優先）
        const enemy = this.findNearestEnemy(player, players);
        if (enemy) {
            const ep = enemy.getTilePos();
            const dist = Math.abs(ep.x - pos.x) + Math.abs(ep.y - pos.y);

            // 近距離で爆弾攻撃（距離6以内）
            if (canBomb && dist <= 6) {
                const inLine = this.isEnemyInBlastLine(pos.x, pos.y, player.firePower, enemy, gameMap);
                if (inLine || dist <= 4) {
                    const escape = this.canSafelyBomb(pos.x, pos.y, player.firePower, gameMap, bombManager);
                    if (escape) {
                        this.pendingDir = escape;
                        return { dx: escape.x, dy: escape.y, placeBomb: true };
                    }
                }
            }

            // 積極的に敵へ接近
            const d = this.findPathTo(pos.x, pos.y, ep.x, ep.y, gameMap, bombManager);
            if (d) { this.pendingDir = d; return { dx: d.x, dy: d.y, placeBomb: false }; }
        }

        // アイテム
        const itemDir = this.findDirectionToItem(pos.x, pos.y, gameMap, bombManager);
        if (itemDir) { this.pendingDir = itemDir; return { dx: itemDir.x, dy: itemDir.y, placeBomb: false }; }

        // ブロック爆破（ルート開拓）
        if (canBomb && this.findAdjacentBlock(pos.x, pos.y, gameMap)) {
            const escape = this.canSafelyBomb(pos.x, pos.y, player.firePower, gameMap, bombManager);
            if (escape) {
                this.pendingDir = escape;
                return { dx: escape.x, dy: escape.y, placeBomb: true };
            }
        }

        const blockDir = this.findDirectionToBlock(pos.x, pos.y, gameMap, bombManager);
        if (blockDir) { this.pendingDir = blockDir; return { dx: blockDir.x, dy: blockDir.y, placeBomb: false }; }

        // 慣性付きランダム移動
        return this.inertialMove(walkable);
    }

    // --- ユーティリティ ---

    // 慣性付きランダム移動（上下揺れ防止）
    inertialMove(walkable) {
        if (walkable.length === 0) {
            this.pendingDir = DIR.NONE;
            return { dx: 0, dy: 0, placeBomb: false };
        }

        // 前回と同じ方向が歩けるなら70%の確率で維持
        if (this.lastMoveDir && this.lastMoveDir.x !== 0 || this.lastMoveDir.y !== 0) {
            const canContinue = walkable.find(d => d.x === this.lastMoveDir.x && d.y === this.lastMoveDir.y);
            if (canContinue && Math.random() < 0.70) {
                this.pendingDir = canContinue;
                return { dx: canContinue.x, dy: canContinue.y, placeBomb: false };
            }
        }

        // 新しい方向をランダムに選択（前回と逆方向は避ける）
        let candidates = walkable.filter(d =>
            !(d.x === -this.lastMoveDir.x && d.y === -this.lastMoveDir.y)
        );
        if (candidates.length === 0) candidates = walkable;

        const d = candidates[Math.floor(Math.random() * candidates.length)];
        this.pendingDir = d;
        this.lastMoveDir = d;
        return { dx: d.x, dy: d.y, placeBomb: false };
    }

    getWalkableDirs(x, y, gameMap, bombManager) {
        return DIRECTIONS.filter(d =>
            gameMap.isWalkable(x + d.x, y + d.y) &&
            !bombManager.hasBombAt(x + d.x, y + d.y)
        );
    }

    isInDanger(x, y, bombManager, gameMap) {
        for (const bomb of bombManager.bombs) {
            if (bomb.x === x && bomb.y === y) return true;
            for (const dir of DIRECTIONS) {
                for (let i = 1; i <= bomb.firePower; i++) {
                    const nx = bomb.x + dir.x * i;
                    const ny = bomb.y + dir.y * i;
                    if (!gameMap.canExplosionPass(nx, ny)) break;
                    if (nx === x && ny === y) return true;
                }
            }
        }
        return bombManager.isExplosionAt(x, y);
    }

    findSafeDirection(x, y, gameMap, bombManager) {
        const queue = [{ x, y, firstDir: null, dist: 0 }];
        const visited = new Set([`${x},${y}`]);
        while (queue.length > 0) {
            const curr = queue.shift();
            if (curr.dist > 0 && !this.isInDanger(curr.x, curr.y, bombManager, gameMap)) {
                return curr.firstDir;
            }
            if (curr.dist > 10) continue;
            for (const dir of DIRECTIONS) {
                const nx = curr.x + dir.x;
                const ny = curr.y + dir.y;
                const key = `${nx},${ny}`;
                if (visited.has(key)) continue;
                if (!gameMap.isWalkable(nx, ny)) continue;
                if (bombManager.hasBombAt(nx, ny)) continue;
                visited.add(key);
                queue.push({ x: nx, y: ny, firstDir: curr.firstDir || dir, dist: curr.dist + 1 });
            }
        }
        return null;
    }

    findAdjacentBlock(x, y, gameMap) {
        for (const dir of DIRECTIONS) {
            const nx = x + dir.x, ny = y + dir.y;
            if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && gameMap.grid[ny][nx] === TILE.BLOCK) return dir;
        }
        return null;
    }

    findDirectionToBlock(x, y, gameMap, bombManager) {
        return this.bfsFind(x, y, gameMap, bombManager, (nx, ny) => {
            for (const dir of DIRECTIONS) {
                const bx = nx + dir.x, by = ny + dir.y;
                if (bx >= 0 && bx < COLS && by >= 0 && by < ROWS && gameMap.grid[by][bx] === TILE.BLOCK) return true;
            }
            return false;
        });
    }

    findDirectionToItem(x, y, gameMap, bombManager) {
        return this.bfsFind(x, y, gameMap, bombManager, (nx, ny) => gameMap.getItemAt(nx, ny) !== undefined);
    }

    findNearestEnemy(player, players) {
        let nearest = null, minDist = Infinity;
        const pos = player.getTilePos();
        for (const o of players) {
            if (o.id === player.id || !o.alive || o.isMisobon) continue;
            const op = o.getTilePos();
            const d = Math.abs(op.x - pos.x) + Math.abs(op.y - pos.y);
            if (d < minDist) { minDist = d; nearest = o; }
        }
        return nearest;
    }

    findPathTo(fx, fy, tx, ty, gameMap, bombManager) {
        return this.bfsFind(fx, fy, gameMap, bombManager, (nx, ny) => nx === tx && ny === ty);
    }

    bfsFind(x, y, gameMap, bombManager, condition) {
        const queue = [{ x, y, firstDir: null, dist: 0 }];
        const visited = new Set([`${x},${y}`]);
        while (queue.length > 0) {
            const curr = queue.shift();
            if (curr.dist > 0 && condition(curr.x, curr.y)) return curr.firstDir;
            if (curr.dist > 25) continue;
            for (const dir of DIRECTIONS) {
                const nx = curr.x + dir.x, ny = curr.y + dir.y;
                const key = `${nx},${ny}`;
                if (visited.has(key) || !gameMap.isWalkable(nx, ny) || bombManager.hasBombAt(nx, ny)) continue;
                visited.add(key);
                queue.push({ x: nx, y: ny, firstDir: curr.firstDir || dir, dist: curr.dist + 1 });
            }
        }
        return null;
    }
}
