// マップ管理
class GameMap {
    constructor() {
        this.grid = [];
        this.items = [];  // マップ上のアイテム
        this.fallingOrder = []; // 落下ブロックの順番
        this.fallingIndex = 0;
    }

    generate() {
        this.grid = [];
        this.items = [];
        this.fallingIndex = 0;

        for (let y = 0; y < ROWS; y++) {
            this.grid[y] = [];
            for (let x = 0; x < COLS; x++) {
                if (x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1) {
                    // 外壁
                    this.grid[y][x] = TILE.WALL;
                } else if (x % 2 === 0 && y % 2 === 0) {
                    // 柱（偶数座標）
                    this.grid[y][x] = TILE.PILLAR;
                } else {
                    this.grid[y][x] = TILE.EMPTY;
                }
            }
        }

        // スポーン地点の周辺を広めに空けてからブロック配置
        // 十字2マス + 斜め1マス = 逃げ場を確保
        const safeTiles = new Set();
        for (const sp of SPAWN_POSITIONS) {
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const dist = Math.abs(dx) + Math.abs(dy);
                    // マンハッタン距離2以内（十字2マス＋斜め1マス）
                    if (dist <= 2) {
                        const nx = sp.x + dx;
                        const ny = sp.y + dy;
                        if (nx >= 1 && nx < COLS - 1 && ny >= 1 && ny < ROWS - 1) {
                            // 柱（偶数座標）は壊せないのでスキップ
                            if (!(nx % 2 === 0 && ny % 2 === 0)) {
                                safeTiles.add(`${nx},${ny}`);
                            }
                        }
                    }
                }
            }
        }

        // ブロック配置
        for (let y = 1; y < ROWS - 1; y++) {
            for (let x = 1; x < COLS - 1; x++) {
                if (this.grid[y][x] === TILE.EMPTY && !safeTiles.has(`${x},${y}`)) {
                    if (Math.random() < 0.75) {
                        this.grid[y][x] = TILE.BLOCK;
                    }
                }
            }
        }

        // 落下ブロックの渦巻き順序を計算
        this.computeFallingOrder();
    }

    computeFallingOrder() {
        this.fallingOrder = [];
        const visited = new Set();

        let top = 1, bottom = ROWS - 2, left = 1, right = COLS - 2;

        while (top <= bottom && left <= right) {
            // 上辺: 左→右
            for (let x = left; x <= right; x++) {
                const key = `${x},${top}`;
                if (!visited.has(key)) {
                    this.fallingOrder.push({ x, y: top });
                    visited.add(key);
                }
            }
            top++;

            // 右辺: 上→下
            for (let y = top; y <= bottom; y++) {
                const key = `${right},${y}`;
                if (!visited.has(key)) {
                    this.fallingOrder.push({ x: right, y });
                    visited.add(key);
                }
            }
            right--;

            // 下辺: 右→左
            for (let x = right; x >= left; x--) {
                const key = `${x},${bottom}`;
                if (!visited.has(key)) {
                    this.fallingOrder.push({ x, y: bottom });
                    visited.add(key);
                }
            }
            bottom--;

            // 左辺: 下→上
            for (let y = bottom; y >= top; y--) {
                const key = `${left},${y}`;
                if (!visited.has(key)) {
                    this.fallingOrder.push({ x: left, y });
                    visited.add(key);
                }
            }
            left++;
        }
    }

    dropNextBlock() {
        if (this.fallingIndex >= this.fallingOrder.length) return null;
        const pos = this.fallingOrder[this.fallingIndex];
        this.fallingIndex++;

        // 柱以外のマスに落下ブロックを置く
        if (this.grid[pos.y][pos.x] !== TILE.WALL) {
            this.grid[pos.y][pos.x] = TILE.FALLING;
            // そのマスのアイテムを消す
            this.removeItemAt(pos.x, pos.y);
        }
        return pos;
    }

    isWalkable(x, y) {
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
        const tile = this.grid[y][x];
        return tile === TILE.EMPTY;
    }

    isSolid(x, y) {
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
        const tile = this.grid[y][x];
        return tile !== TILE.EMPTY;
    }

    destroyBlock(x, y) {
        if (this.grid[y][x] === TILE.BLOCK) {
            this.grid[y][x] = TILE.EMPTY;
            // アイテムドロップ判定
            if (Math.random() < ITEM_DROP_RATE) {
                const item = this.rollItem();
                if (item) {
                    this.items.push({ x, y, type: item });
                }
            }
            return true;
        }
        return false;
    }

    rollItem() {
        const rand = Math.random();
        let cumulative = 0;
        for (const [type, weight] of Object.entries(ITEM_WEIGHTS)) {
            cumulative += weight;
            if (rand < cumulative) return type;
        }
        return ITEM_TYPE.FIRE_UP;
    }

    getItemAt(x, y) {
        return this.items.find(item => item.x === x && item.y === y);
    }

    removeItemAt(x, y) {
        this.items = this.items.filter(item => !(item.x === x && item.y === y));
    }

    // 爆風が通れるかチェック（壁・柱・ブロック・落下ブロックで止まる）
    canExplosionPass(x, y) {
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
        const tile = this.grid[y][x];
        return tile === TILE.EMPTY;
    }
}
