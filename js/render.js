// 描画管理
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.animFrame = 0;
    }

    resize() {
        const gameScreen = document.getElementById('game-screen');
        const hud = document.getElementById('game-hud');
        const controls = document.getElementById('controls');

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - (hud ? hud.offsetHeight : 0) - 140;

        // タイルサイズを画面に合わせて計算
        const maxTileW = this.canvas.width / COLS;
        const maxTileH = this.canvas.height / ROWS;
        this.tileSize = Math.floor(Math.min(maxTileW, maxTileH));

        // 中央揃え
        this.offsetX = Math.floor((this.canvas.width - COLS * this.tileSize) / 2);
        this.offsetY = Math.floor((this.canvas.height - ROWS * this.tileSize) / 2);
    }

    render(gameMap, players, bombManager, misobonManager, gameState) {
        this.animFrame++;
        const ctx = this.ctx;
        const ts = this.tileSize;

        // 背景
        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);

        // マップ描画
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const tile = gameMap.grid[y][x];
                const px = x * ts;
                const py = y * ts;

                switch (tile) {
                    case TILE.EMPTY:
                        ctx.fillStyle = '#4a8c3f';
                        ctx.fillRect(px, py, ts, ts);
                        // グリッド線
                        ctx.strokeStyle = '#3d7534';
                        ctx.lineWidth = 0.5;
                        ctx.strokeRect(px, py, ts, ts);
                        break;
                    case TILE.WALL:
                        ctx.fillStyle = '#555';
                        ctx.fillRect(px, py, ts, ts);
                        ctx.fillStyle = '#666';
                        ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
                        // 壁のパターン
                        ctx.fillStyle = '#555';
                        ctx.fillRect(px + ts / 2 - 1, py, 2, ts);
                        ctx.fillRect(px, py + ts / 2 - 1, ts, 2);
                        break;
                    case TILE.PILLAR:
                        ctx.fillStyle = '#4a8c3f';
                        ctx.fillRect(px, py, ts, ts);
                        ctx.fillStyle = '#777';
                        ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
                        ctx.fillStyle = '#888';
                        ctx.fillRect(px + 3, py + 3, ts - 6, ts - 6);
                        break;
                    case TILE.BLOCK:
                        ctx.fillStyle = '#4a8c3f';
                        ctx.fillRect(px, py, ts, ts);
                        ctx.fillStyle = '#c4883a';
                        ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
                        ctx.fillStyle = '#a87030';
                        ctx.fillRect(px + 3, py + ts / 2 - 1, ts - 6, 2);
                        ctx.fillRect(px + ts / 2 - 1, py + 3, 2, ts - 6);
                        break;
                    case TILE.FALLING:
                        ctx.fillStyle = '#4a8c3f';
                        ctx.fillRect(px, py, ts, ts);
                        // 落下ブロック - 赤みがかったブロック
                        const flash = Math.sin(this.animFrame * 0.1) * 0.2 + 0.8;
                        ctx.fillStyle = `rgba(180, 50, 50, ${flash})`;
                        ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
                        ctx.fillStyle = '#aa3333';
                        ctx.fillRect(px + 3, py + ts / 2 - 1, ts - 6, 2);
                        break;
                }
            }
        }

        // アイテム描画
        for (const item of gameMap.items) {
            const px = item.x * ts;
            const py = item.y * ts;
            const iconSize = ts * 0.6;
            const offset = (ts - iconSize) / 2;

            ctx.font = `${iconSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            switch (item.type) {
                case ITEM_TYPE.FIRE_UP:
                    ctx.fillText('🔥', px + ts / 2, py + ts / 2);
                    break;
                case ITEM_TYPE.BOMB_UP:
                    ctx.fillText('💣', px + ts / 2, py + ts / 2);
                    break;
                case ITEM_TYPE.KICK:
                    ctx.fillText('👟', px + ts / 2, py + ts / 2);
                    break;
            }
        }

        // 爆弾描画
        for (const bomb of bombManager.bombs) {
            const px = bomb.x * ts;
            const py = bomb.y * ts;

            // 爆弾本体
            const pulseScale = 1 + Math.sin(this.animFrame * 0.15) * 0.1;
            const size = ts * 0.7 * pulseScale;
            const bx = px + ts / 2;
            const by = py + ts / 2;

            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(bx, by, size / 2, 0, Math.PI * 2);
            ctx.fill();

            // 導火線
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(bx, by - size / 2);
            ctx.lineTo(bx + size * 0.2, by - size / 2 - size * 0.2);
            ctx.stroke();

            // 火花
            if (Math.random() > 0.5) {
                ctx.fillStyle = '#ffaa00';
                ctx.beginPath();
                ctx.arc(bx + size * 0.2, by - size / 2 - size * 0.2, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 爆発エフェクト
        for (const exp of bombManager.explosions) {
            const px = exp.x * ts;
            const py = exp.y * ts;
            const alpha = exp.timer / 500;

            ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.8})`;
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = `rgba(255, 200, 0, ${alpha * 0.6})`;
            ctx.fillRect(px + ts * 0.1, py + ts * 0.1, ts * 0.8, ts * 0.8);
            ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.4})`;
            ctx.fillRect(px + ts * 0.25, py + ts * 0.25, ts * 0.5, ts * 0.5);
        }

        // プレイヤー描画
        for (const player of players) {
            if (!player.alive) continue;

            const px = player.x * ts;
            const py = player.y * ts;
            const color = PLAYER_COLORS[player.id];

            // 体
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(px + ts / 2, py + ts * 0.4, ts * 0.3, 0, Math.PI * 2);
            ctx.fill();

            // 頭（白）
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(px + ts / 2, py + ts * 0.25, ts * 0.2, 0, Math.PI * 2);
            ctx.fill();

            // 目
            ctx.fillStyle = '#000';
            const eyeOffsetX = player.direction.x * ts * 0.05;
            const eyeOffsetY = player.direction.y * ts * 0.03;
            ctx.beginPath();
            ctx.arc(px + ts * 0.42 + eyeOffsetX, py + ts * 0.23 + eyeOffsetY, ts * 0.04, 0, Math.PI * 2);
            ctx.arc(px + ts * 0.58 + eyeOffsetX, py + ts * 0.23 + eyeOffsetY, ts * 0.04, 0, Math.PI * 2);
            ctx.fill();

            // 体下半分
            ctx.fillStyle = color;
            ctx.fillRect(px + ts * 0.25, py + ts * 0.4, ts * 0.5, ts * 0.35);

            // 足
            const walkOffset = player.moving ? Math.sin(this.animFrame * 0.3) * ts * 0.08 : 0;
            ctx.fillStyle = '#333';
            ctx.fillRect(px + ts * 0.25, py + ts * 0.7, ts * 0.18, ts * 0.15);
            ctx.fillRect(px + ts * 0.57, py + ts * 0.7 + walkOffset, ts * 0.18, ts * 0.15);

            // プレイヤー名
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${ts * 0.25}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(PLAYER_NAMES[player.id], px + ts / 2, py - 2);
        }

        // みそボン描画
        if (misobonManager) {
            for (const m of misobonManager.misobons) {
                const px = m.x * ts;
                const py = m.y * ts;
                const color = PLAYER_COLORS[m.playerId];

                // 半透明のゴースト
                ctx.globalAlpha = 0.5 + Math.sin(this.animFrame * 0.08) * 0.2;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(px + ts / 2, py + ts * 0.4, ts * 0.3, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(px + ts / 2, py + ts * 0.25, ts * 0.2, 0, Math.PI * 2);
                ctx.fill();

                // 「みそ」テキスト
                ctx.fillStyle = '#ff0';
                ctx.font = `bold ${ts * 0.22}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('みそ', px + ts / 2, py - 2);

                ctx.globalAlpha = 1;
            }
        }

        ctx.restore();
    }

    // カウントダウン表示
    renderCountdown(count) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${this.canvas.width * 0.2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(count > 0 ? count : 'GO!', this.canvas.width / 2, this.canvas.height / 2);
    }

    // ラウンド終了表示
    renderRoundEnd(winnerName) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${this.canvas.width * 0.08}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(winnerName ? `${winnerName} WIN!` : 'DRAW', this.canvas.width / 2, this.canvas.height / 2);
    }
}
