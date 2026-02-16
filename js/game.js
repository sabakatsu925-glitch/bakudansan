// ゲームメインループ
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.gameMap = new GameMap();
        this.bombManager = new BombManager(this.gameMap);
        this.itemManager = new ItemManager(this.gameMap);
        this.misobonManager = new MisobonManager();
        this.renderer = new Renderer(this.canvas);
        this.input = new InputManager();
        this.network = null;

        this.players = [];
        this.cpuAIs = [];
        this.localPlayerId = 0;

        this.state = GAME_STATE.WAITING;
        this.timeLimit = 150; // 秒
        this.timeRemaining = 0;
        this.suddenDeathTime = 30; // ラスト30秒
        this.fallingTimer = 0;

        this.countdownTimer = 0;
        this.countdownCount = 3;
        this.roundEndTimer = 0;

        this.lastTime = 0;
        this.running = false;
        this.soloMode = false;

        // 設定
        this.cpu1Difficulty = 'normal';
        this.cpu2Difficulty = 'normal';

        // 同期スロットル
        this.syncTimer = 0;
        this.syncInterval = 1 / 20; // 20回/秒

        // resizeハンドラ参照（destroyで解除用）
        this._resizeHandler = null;
    }

    // ホストまたはソロか判定（ゲームロジックの権限を持つ側）
    isAuthority() {
        return !this.network || this.network.isHost || this.soloMode;
    }

    init(localPlayerId, cpu1Diff, cpu2Diff, timeLimit, network) {
        this.localPlayerId = localPlayerId;
        this.cpu1Difficulty = cpu1Diff;
        this.cpu2Difficulty = cpu2Diff;
        this.timeLimit = timeLimit;
        this.network = network;

        this.input.init();

        // プレイヤー作成
        this.players = [
            new Player(0, SPAWN_POSITIONS[0], false),    // 人間1（ホスト）
            new Player(1, SPAWN_POSITIONS[1], false),    // 人間2（ゲスト）
            new Player(2, SPAWN_POSITIONS[2], true, cpu1Diff), // CPU1
            new Player(3, SPAWN_POSITIONS[3], true, cpu2Diff), // CPU2
        ];

        // CPU AI
        this.cpuAIs = [
            null, null,
            new CpuAI(cpu1Diff),
            new CpuAI(cpu2Diff),
        ];

        // リサイズ（古いリスナーを解除してから）
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }
        this._resizeHandler = () => this.renderer.resize();
        this.renderer.resize();
        window.addEventListener('resize', this._resizeHandler);

        // ネットワークメッセージ処理
        if (this.network) {
            this.network.onMessage = (data) => this.handleNetworkMessage(data);
        }
    }

    startRound() {
        // マップ生成
        this.gameMap.generate();
        this.bombManager.reset();
        this.misobonManager.removeAll();

        // プレイヤーリセット
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].reset(SPAWN_POSITIONS[i]);
        }

        this.timeRemaining = this.timeLimit;
        this.fallingTimer = 0;

        // カウントダウン開始
        this.state = GAME_STATE.COUNTDOWN;
        this.countdownTimer = 0;
        this.countdownCount = 3;

        // ホストならゲスト側にマップを同期
        if (this.network && this.network.isHost) {
            this.network.send({
                type: 'start_round',
                mapGrid: this.gameMap.grid,
                mapItems: this.gameMap.items,
                timeLimit: this.timeLimit,
                cpu1Diff: this.cpu1Difficulty,
                cpu2Diff: this.cpu2Difficulty,
            });
        }

        if (!this.running) {
            this.running = true;
            this.lastTime = performance.now();
            requestAnimationFrame((t) => this.gameLoop(t));
        }
    }

    gameLoop(currentTime) {
        if (!this.running) return;

        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05); // 最大50ms
        this.lastTime = currentTime;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    update(dt) {
        switch (this.state) {
            case GAME_STATE.COUNTDOWN:
                this.updateCountdown(dt);
                break;
            case GAME_STATE.PLAYING:
            case GAME_STATE.SUDDEN_DEATH:
                this.updatePlaying(dt);
                break;
            case GAME_STATE.ROUND_END:
                this.roundEndTimer -= dt;
                if (this.roundEndTimer <= 0) {
                    this.running = false;
                    this.showResult();
                }
                break;
        }
    }

    updateCountdown(dt) {
        this.countdownTimer += dt;
        if (this.countdownTimer >= 1) {
            this.countdownTimer = 0;
            this.countdownCount--;
            if (this.countdownCount < 0) {
                this.state = GAME_STATE.PLAYING;
            }
        }
    }

    updatePlaying(dt) {
        const isAuth = this.isAuthority();

        // タイマー更新（権限側のみ。ゲストはsyncで受け取る）
        if (isAuth) {
            this.timeRemaining -= dt;
        }
        this.updateTimerDisplay();

        // ラスト30秒チェック（権限側のみ）
        if (isAuth) {
            if (this.timeRemaining <= this.suddenDeathTime && this.state !== GAME_STATE.SUDDEN_DEATH) {
                this.state = GAME_STATE.SUDDEN_DEATH;
                this.misobonManager.eliminateAll(this.players);
            }
        }

        // 落下ブロック（権限側のみ）
        if (isAuth && this.state === GAME_STATE.SUDDEN_DEATH) {
            this.fallingTimer += dt * 1000;
            if (this.fallingTimer >= FALLING_BLOCK_INTERVAL) {
                this.fallingTimer -= FALLING_BLOCK_INTERVAL;
                const pos = this.gameMap.dropNextBlock();
                if (pos) {
                    // 落下ブロックにプレイヤーが当たったら即死
                    for (const player of this.players) {
                        if (!player.alive) continue;
                        const tp = player.getTilePos();
                        if (tp.x === pos.x && tp.y === pos.y) {
                            player.die();
                        }
                    }
                    // 爆弾も消す
                    this.bombManager.bombs = this.bombManager.bombs.filter(
                        b => !(b.x === pos.x && b.y === pos.y)
                    );
                }
            }
        }

        // ローカルプレイヤー入力
        const localPlayer = this.players[this.localPlayerId];
        if (localPlayer.alive && !localPlayer.isMisobon) {
            const input = this.input.getInput();
            localPlayer.move(input.dx, input.dy, dt, this.gameMap, this.bombManager);

            if (input.bomb) {
                if (isAuth) {
                    this.bombManager.placeBomb(localPlayer);
                }
            }

            // キックボタン表示
            this.input.showKickButton(localPlayer.hasKick);

            // アイテム拾う（権限側のみ。ゲストはホストの同期に従う）
            if (isAuth) {
                this.itemManager.checkPickup(localPlayer);
            }

            // ネットワーク送信
            if (this.network) {
                this.network.send({
                    type: 'player_input',
                    playerId: this.localPlayerId,
                    x: localPlayer.x,
                    y: localPlayer.y,
                    dx: input.dx,
                    dy: input.dy,
                    bomb: input.bomb,
                    direction: localPlayer.direction,
                });
            }
        } else if (localPlayer.isMisobon) {
            // みそボンモード
            const input = this.input.getInput();
            this.misobonManager.updateMisobonPosition(this.localPlayerId, input.dx, input.dy);
            if (input.bomb) {
                const misobon = this.misobonManager.getMisobon(this.localPlayerId);
                if (misobon) {
                    this.bombManager.placeMisobonBomb(misobon);
                }
            }
        }

        // CPU更新（権限側のみ）
        if (isAuth) {
            for (let i = 0; i < this.players.length; i++) {
                const player = this.players[i];
                if (!player.isCpu) continue;

                if (player.alive && !player.isMisobon) {
                    const ai = this.cpuAIs[i];
                    const action = ai.update(player, dt, this.gameMap, this.bombManager, this.players);
                    if (action) {
                        // 爆弾を先に設置（現在位置に置く）
                        if (action.placeBomb) {
                            this.bombManager.placeBomb(player);
                        }
                        // CPUはタイルベース移動（逃走開始）
                        const pos = player.getTilePos();
                        const targetX = pos.x + action.dx;
                        const targetY = pos.y + action.dy;
                        // 移動先が安全かチェック
                        if (action.dx !== 0 || action.dy !== 0) {
                            if (this.gameMap.isWalkable(targetX, targetY) &&
                                !this.bombManager.hasBombAt(targetX, targetY)) {
                                player.cpuMove(targetX, targetY, dt);
                            } else {
                                // 現在のタイル中央に戻る
                                player.cpuMove(pos.x, pos.y, dt);
                            }
                        } else {
                            // 移動なし → タイル中央にスナップ
                            player.cpuMove(pos.x, pos.y, dt);
                        }
                    }
                    this.itemManager.checkPickup(player);
                } else if (player.isMisobon) {
                    const misobon = this.misobonManager.getMisobon(player.id);
                    if (misobon) {
                        this.misobonManager.updateCpuMisobon(misobon, dt, this.players);
                        // たまに爆弾を投げる
                        if (Math.random() < 0.02) {
                            this.bombManager.placeMisobonBomb(misobon);
                        }
                    }
                }
            }
        }

        // 爆弾更新（権限側のみ）
        if (isAuth) {
            this.bombManager.update(dt, this.players, (explosionCells, ownerId) => {
                this.handleExplosionHits(explosionCells, ownerId);
            });
        }

        // ゲーム状態同期（ホスト→ゲスト、スロットル付き）
        if (this.network && this.network.isHost) {
            this.syncTimer += dt;
            if (this.syncTimer >= this.syncInterval) {
                this.syncTimer = 0;
                this.syncGameState();
            }
        }

        // 勝利チェック（権限側のみ）
        if (isAuth) {
            this.checkWinCondition();

            // 時間切れ
            if (this.timeRemaining <= 0) {
                this.endRound(null); // 引き分け
            }
        }
    }

    handleExplosionHits(explosionCells, ownerId) {
        for (const cell of explosionCells) {
            for (const player of this.players) {
                if (!player.alive || player.isMisobon) continue;
                const tp = player.getTilePos();
                if (tp.x === cell.x && tp.y === cell.y) {
                    // ラスト30秒前ならみそボンに
                    if (this.state !== GAME_STATE.SUDDEN_DEATH) {
                        // みそボンの爆弾で倒された場合は入れ替え
                        const ownerPlayer = this.players.find(p => p.id === ownerId);
                        if (ownerPlayer && ownerPlayer.isMisobon) {
                            this.misobonManager.swapWithPlayer(ownerId, player.id, this.players);
                        } else {
                            this.misobonManager.addMisobon(player);
                        }
                    } else {
                        player.die();
                    }
                }
            }
        }
    }

    checkWinCondition() {
        const alivePlayers = this.players.filter(p => p.alive && !p.isMisobon);

        if (alivePlayers.length <= 1) {
            if (alivePlayers.length === 1) {
                this.endRound(alivePlayers[0]);
            } else {
                this.endRound(null); // 全滅 = 引き分け
            }
        }
    }

    endRound(winner) {
        if (this.state === GAME_STATE.ROUND_END || this.state === GAME_STATE.MATCH_END) return;

        if (winner) {
            winner.score++;
        }

        this.state = GAME_STATE.ROUND_END;
        this.roundEndTimer = 3; // 3秒後にリザルト
        this.roundWinner = winner;

        // ホストならラウンド終了も同期
        if (this.network && this.network.isHost) {
            this.syncGameState();
        }
    }

    showResult() {
        const gameScreen = document.getElementById('game-screen');
        const resultScreen = document.getElementById('result-screen');

        // 優勝チェック
        const champion = this.players.find(p => p.score >= WIN_POINTS);

        if (champion) {
            document.getElementById('result-title').textContent = '🏆 優勝！';
            document.getElementById('result-content').textContent =
                `${PLAYER_NAMES[champion.id]} が優勝！`;
            document.getElementById('btn-next-round').style.display = 'none';
        } else {
            document.getElementById('result-title').textContent = 'ラウンド結果';
            document.getElementById('result-content').textContent =
                this.roundWinner
                    ? `${PLAYER_NAMES[this.roundWinner.id]} WIN!`
                    : '引き分け';
            // マルチプレイでゲストの場合は次ラウンドボタンを非表示（ホストのみ操作）
            if (this.network && !this.network.isHost) {
                document.getElementById('btn-next-round').style.display = 'none';
            } else {
                document.getElementById('btn-next-round').style.display = 'block';
            }
        }

        // スコア表示
        const scoresDiv = document.getElementById('result-scores');
        scoresDiv.innerHTML = '';
        for (const player of this.players) {
            const div = document.createElement('div');
            div.className = 'result-player';
            div.style.background = PLAYER_COLORS[player.id];
            div.textContent = `${PLAYER_NAMES[player.id]}: ${player.score}pt`;
            if (champion && player.id === champion.id) {
                div.classList.add('winner');
            }
            scoresDiv.appendChild(div);
        }

        gameScreen.classList.remove('active');
        resultScreen.classList.add('active');
    }

    handleNetworkMessage(data) {
        switch (data.type) {
            case 'player_input':
                // ゲストの入力をホスト側で反映
                if (this.network.isHost && data.playerId !== this.localPlayerId) {
                    const player = this.players[data.playerId];
                    if (player && player.alive) {
                        player.x = data.x;
                        player.y = data.y;
                        player.direction = data.direction;
                        if (data.bomb) {
                            this.bombManager.placeBomb(player);
                        }
                        // ゲスト側プレイヤーのアイテム取得もホストで処理
                        this.itemManager.checkPickup(player);
                    }
                }
                break;

            case 'game_state':
                // ゲスト側: ホストからの状態同期
                if (!this.network.isHost) {
                    this.applyGameState(data);
                }
                break;

            case 'start_round':
                // ゲスト側: ラウンド開始
                if (!this.network.isHost) {
                    this.gameMap.grid = data.mapGrid;
                    this.gameMap.items = data.mapItems;
                    this.gameMap.computeFallingOrder();
                    this.timeLimit = data.timeLimit;
                    this.cpu1Difficulty = data.cpu1Diff;
                    this.cpu2Difficulty = data.cpu2Diff;

                    // プレイヤーリセット（スコアは維持）
                    for (let i = 0; i < this.players.length; i++) {
                        this.players[i].reset(SPAWN_POSITIONS[i]);
                    }
                    this.timeRemaining = this.timeLimit;
                    this.state = GAME_STATE.COUNTDOWN;
                    this.countdownTimer = 0;
                    this.countdownCount = 3;
                    this.bombManager.reset();
                    this.misobonManager.removeAll();

                    showScreen('game-screen');

                    if (!this.running) {
                        this.running = true;
                        this.lastTime = performance.now();
                        requestAnimationFrame((t) => this.gameLoop(t));
                    }
                }
                break;
        }
    }

    syncGameState() {
        if (!this.network || !this.network.isHost) return;

        const playerStates = this.players.map(p => ({
            x: p.x, y: p.y,
            alive: p.alive,
            isMisobon: p.isMisobon,
            firePower: p.firePower,
            maxBombs: p.maxBombs,
            hasKick: p.hasKick,
            direction: p.direction,
            moving: p.moving,
            score: p.score,
        }));

        this.network.send({
            type: 'game_state',
            players: playerStates,
            bombs: this.bombManager.bombs.map(b => ({
                x: b.x, y: b.y, ownerId: b.ownerId, firePower: b.firePower,
                timer: b.timer, kicked: b.kicked, kickDir: b.kickDir,
            })),
            explosions: this.bombManager.explosions.map(e => ({
                x: e.x, y: e.y, timer: e.timer,
            })),
            items: this.gameMap.items,
            mapGrid: this.gameMap.grid,
            timeRemaining: this.timeRemaining,
            state: this.state,
            misobons: this.misobonManager.misobons,
        });
    }

    applyGameState(data) {
        // プレイヤー状態の同期
        for (let i = 0; i < data.players.length; i++) {
            const ps = data.players[i];
            const player = this.players[i];
            // ローカルプレイヤーの位置はローカルで管理（ただしアイテム等は同期）
            if (i !== this.localPlayerId) {
                player.x = ps.x;
                player.y = ps.y;
                player.direction = ps.direction;
                player.moving = ps.moving;
            }
            player.alive = ps.alive;
            player.isMisobon = ps.isMisobon;
            player.firePower = ps.firePower;
            player.maxBombs = ps.maxBombs;
            player.hasKick = ps.hasKick;
            player.score = ps.score;
        }

        this.bombManager.bombs = data.bombs;
        this.bombManager.explosions = data.explosions;
        this.gameMap.items = data.items;
        this.gameMap.grid = data.mapGrid;
        this.timeRemaining = data.timeRemaining;
        this.state = data.state;
        this.misobonManager.misobons = data.misobons;

        this.updateTimerDisplay();
        this.input.showKickButton(this.players[this.localPlayerId].hasKick);

        // ゲスト側: ROUND_ENDを受け取ったらタイマー開始
        if (this.state === GAME_STATE.ROUND_END && this.roundEndTimer <= 0) {
            this.roundEndTimer = 3;
            // 勝者を特定
            let maxScore = -1;
            let winner = null;
            for (const p of this.players) {
                if (p.score > maxScore) {
                    maxScore = p.score;
                    winner = p;
                }
            }
            this.roundWinner = winner;
        }
    }

    updateTimerDisplay() {
        const display = document.getElementById('timer-display');
        const minutes = Math.floor(Math.max(0, this.timeRemaining) / 60);
        const seconds = Math.floor(Math.max(0, this.timeRemaining) % 60);
        display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (this.timeRemaining <= this.suddenDeathTime) {
            display.classList.add('warning');
        } else {
            display.classList.remove('warning');
        }

        // スコア更新
        for (let i = 0; i < this.players.length; i++) {
            const el = document.getElementById(`p${i + 1}-score`);
            if (el) el.textContent = `${PLAYER_NAMES[i]}: ${this.players[i].score}`;
        }
    }

    draw() {
        this.renderer.render(
            this.gameMap,
            this.players,
            this.bombManager,
            this.misobonManager,
            this.state
        );

        if (this.state === GAME_STATE.COUNTDOWN) {
            this.renderer.renderCountdown(this.countdownCount);
        }

        if (this.state === GAME_STATE.ROUND_END) {
            const winnerName = this.roundWinner ? PLAYER_NAMES[this.roundWinner.id] : null;
            this.renderer.renderRoundEnd(winnerName);
        }
    }

    destroy() {
        this.running = false;
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }
        if (this.network) {
            this.network.disconnect();
        }
    }
}
