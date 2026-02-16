// メイン - 画面遷移とルーム管理
let game = null;
let network = null;
let soloMode = false;

// ホスト側: マッチング後のゲーム設定を保持
let pendingGameSettings = null;

// 画面遷移
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// PeerJSの読み込み
function loadPeerJS() {
    return new Promise((resolve, reject) => {
        if (typeof Peer !== 'undefined') {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('PeerJSの読み込みに失敗しました'));
        document.head.appendChild(script);
    });
}

// イベントリスナー設定
document.addEventListener('DOMContentLoaded', () => {
    // ひとりで遊ぶ
    document.getElementById('btn-solo').addEventListener('click', () => {
        showScreen('solo-screen');
    });

    // タイトル → ルーム作成
    document.getElementById('btn-create-room').addEventListener('click', () => {
        showScreen('create-screen');
    });

    // タイトル → ルーム参加
    document.getElementById('btn-join-room').addEventListener('click', () => {
        showScreen('join-screen');
    });

    // 戻るボタン
    document.getElementById('btn-back-solo').addEventListener('click', () => {
        showScreen('title-screen');
    });
    document.getElementById('btn-back-create').addEventListener('click', () => {
        showScreen('title-screen');
    });
    document.getElementById('btn-back-join').addEventListener('click', () => {
        showScreen('title-screen');
    });
    document.getElementById('btn-back-waiting').addEventListener('click', () => {
        if (network) network.disconnect();
        network = null;
        pendingGameSettings = null;
        document.getElementById('btn-start-game').style.display = 'none';
        showScreen('title-screen');
    });

    // ひとりで遊ぶ開始
    document.getElementById('btn-do-solo').addEventListener('click', () => {
        const cpu1 = document.getElementById('solo-cpu1').value;
        const cpu2 = document.getElementById('solo-cpu2').value;
        const cpu3 = document.getElementById('solo-cpu3').value;
        const timeLimit = parseInt(document.getElementById('solo-time').value);

        soloMode = true;
        network = null;
        startSoloGame(cpu1, cpu2, cpu3, timeLimit);
    });

    // ルーム作成実行
    document.getElementById('btn-do-create').addEventListener('click', async () => {
        const password = document.getElementById('create-password').value.trim();

        if (!password || password.length !== 4 || !/^\d{4}$/.test(password)) {
            alert('4桁の番号を入力してください');
            return;
        }

        try {
            await loadPeerJS();
            network = new NetworkManager();
            soloMode = false;

            showScreen('waiting-screen');
            document.getElementById('waiting-message').textContent = 'もう1人のプレイヤーを待っています...';
            document.getElementById('room-info').textContent = `合言葉: ${password}`;
            document.getElementById('btn-start-game').style.display = 'none';

            await network.createRoom(password);

            // ゲスト接続時: ゲーム開始ボタンを表示（まだゲームは始めない）
            network.onConnected = () => {
                document.getElementById('waiting-message').textContent = '相手が参加しました！';
                document.querySelector('.loader').style.display = 'none';
                document.getElementById('btn-start-game').style.display = 'block';

                // 設定を保持
                pendingGameSettings = {
                    cpu1Diff: document.getElementById('cpu1-difficulty').value,
                    cpu2Diff: document.getElementById('cpu2-difficulty').value,
                    timeLimit: parseInt(document.getElementById('time-limit').value),
                };
            };

            network.onDisconnected = () => {
                alert('相手の接続が切れました');
                pendingGameSettings = null;
                document.getElementById('btn-start-game').style.display = 'none';
                showScreen('title-screen');
            };

        } catch (err) {
            alert(err.message || 'ルームの作成に失敗しました');
            showScreen('create-screen');
        }
    });

    // ホスト: ゲーム開始ボタン（マッチング後に表示される）
    document.getElementById('btn-start-game').addEventListener('click', () => {
        if (!pendingGameSettings || !network || !network.connected) return;

        const { cpu1Diff, cpu2Diff, timeLimit } = pendingGameSettings;
        pendingGameSettings = null;
        document.getElementById('btn-start-game').style.display = 'none';

        startGame(0, cpu1Diff, cpu2Diff, timeLimit);
    });

    // ルーム参加実行
    document.getElementById('btn-do-join').addEventListener('click', async () => {
        const password = document.getElementById('join-password').value.trim();

        if (!password || password.length !== 4 || !/^\d{4}$/.test(password)) {
            alert('4桁の番号を入力してください');
            return;
        }

        try {
            await loadPeerJS();
            network = new NetworkManager();
            soloMode = false;

            showScreen('waiting-screen');
            document.getElementById('waiting-message').textContent = 'ルームに接続中...';
            document.getElementById('room-info').textContent = '';
            document.getElementById('btn-start-game').style.display = 'none';

            await network.joinRoom(password);

            // 接続成功 → ホストのゲーム開始を待つ
            document.getElementById('waiting-message').textContent = 'ホストがゲームを開始するのを待っています...';
            document.querySelector('.loader').style.display = 'block';

            network.onMessage = (data) => {
                if (data.type === 'start_round') {
                    startGame(1, data.cpu1Diff, data.cpu2Diff, data.timeLimit, data);
                }
            };

            network.onDisconnected = () => {
                alert('ホストとの接続が切れました');
                showScreen('title-screen');
            };

        } catch (err) {
            alert(err.message || 'ルームへの参加に失敗しました');
            showScreen('join-screen');
        }
    });

    // 次のラウンド（ホスト or ソロのみ。ゲストはホストの start_round を待つ）
    document.getElementById('btn-next-round').addEventListener('click', () => {
        if (game) {
            showScreen('game-screen');
            game.startRound();
        }
    });

    // タイトルへ戻る
    document.getElementById('btn-back-title').addEventListener('click', () => {
        if (game) game.destroy();
        game = null;
        if (network) network.disconnect();
        network = null;
        pendingGameSettings = null;
        showScreen('title-screen');
    });

    // 画面の向きロック要求
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
    }
});

// ソロプレイ（人間1 + CPU3）
// P1=人間, P2=CPU1, P3=CPU2, P4=CPU3 の順に対応
function startSoloGame(cpu1Diff, cpu2Diff, cpu3Diff, timeLimit) {
    showScreen('game-screen');

    game = new Game();
    game.soloMode = true;
    // P3=cpu2Diff, P4=cpu3Diff で初期化
    game.init(0, cpu2Diff, cpu3Diff, timeLimit, null);

    // P2もCPUにする（cpu1Diff）
    game.players[1].isCpu = true;
    game.players[1].cpuDifficulty = cpu1Diff;
    game.cpuAIs[1] = new CpuAI(cpu1Diff);

    game.startRound();
}

// マルチプレイ（人間2 + CPU2）
function startGame(localPlayerId, cpu1Diff, cpu2Diff, timeLimit, initialData) {
    showScreen('game-screen');

    game = new Game();
    game.soloMode = false;
    game.init(localPlayerId, cpu1Diff, cpu2Diff, timeLimit, network);

    if (initialData && network && !network.isHost) {
        game.gameMap.grid = initialData.mapGrid;
        game.gameMap.items = initialData.mapItems || [];
        game.gameMap.computeFallingOrder();

        for (let i = 0; i < game.players.length; i++) {
            game.players[i].reset(SPAWN_POSITIONS[i]);
        }
        game.timeRemaining = timeLimit;
        game.state = GAME_STATE.COUNTDOWN;
        game.countdownTimer = 0;
        game.countdownCount = 3;
        game.running = true;
        game.lastTime = performance.now();
        requestAnimationFrame((t) => game.gameLoop(t));

        network.onMessage = (data) => game.handleNetworkMessage(data);
    } else {
        game.startRound();
    }
}
