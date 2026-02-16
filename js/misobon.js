// みそボンシステム
class MisobonManager {
    constructor() {
        this.misobons = []; // { playerId, x, y, targetX, targetY, direction, bombTimer }
    }

    addMisobon(player) {
        // 外周のランダムな位置に配置
        const side = Math.floor(Math.random() * 4);
        let x, y;
        switch (side) {
            case 0: x = Math.floor(Math.random() * COLS); y = -0.5; break; // 上
            case 1: x = Math.floor(Math.random() * COLS); y = ROWS - 0.5; break; // 下
            case 2: x = -0.5; y = Math.floor(Math.random() * ROWS); break; // 左
            case 3: x = COLS - 0.5; y = Math.floor(Math.random() * ROWS); break; // 右
        }

        this.misobons.push({
            playerId: player.id,
            x: x,
            y: y,
            targetX: Math.floor(COLS / 2), // フィールドの中央辺りを狙う
            targetY: Math.floor(ROWS / 2),
            side: side,
            moveOffset: 0,
        });

        player.becomeMisobon();
    }

    getMisobon(playerId) {
        return this.misobons.find(m => m.playerId === playerId);
    }

    updateMisobonPosition(playerId, dx, dy) {
        const m = this.getMisobon(playerId);
        if (!m) return;

        // 外周を移動
        const speed = MISOBON_SPEED * (1 / 60);

        if (m.side === 0 || m.side === 1) {
            // 上辺or下辺: 左右移動
            m.x = Math.max(-0.5, Math.min(COLS - 0.5, m.x + dx * speed));
        } else {
            // 左辺or右辺: 上下移動
            m.y = Math.max(-0.5, Math.min(ROWS - 0.5, m.y + dy * speed));
        }

        // ターゲット位置の更新（投げる先）
        // 外周の位置からフィールド内への投射方向
        this.updateTarget(m);
    }

    updateTarget(m) {
        // みそボンの位置から一番近いフィールド内のマスをターゲットに
        switch (m.side) {
            case 0: // 上辺
                m.targetX = Math.round(Math.max(1, Math.min(COLS - 2, m.x)));
                m.targetY = 1;
                break;
            case 1: // 下辺
                m.targetX = Math.round(Math.max(1, Math.min(COLS - 2, m.x)));
                m.targetY = ROWS - 2;
                break;
            case 2: // 左辺
                m.targetX = 1;
                m.targetY = Math.round(Math.max(1, Math.min(ROWS - 2, m.y)));
                break;
            case 3: // 右辺
                m.targetX = COLS - 2;
                m.targetY = Math.round(Math.max(1, Math.min(ROWS - 2, m.y)));
                break;
        }
    }

    // みそボンのCPU AI
    updateCpuMisobon(misobon, dt, players) {
        // 生きてるプレイヤーの位置に向かって移動
        const alivePlayer = players.find(p => p.alive && !p.isMisobon && p.id !== misobon.playerId);
        if (!alivePlayer) return;

        const targetTileX = Math.round(alivePlayer.x);
        const targetTileY = Math.round(alivePlayer.y);

        // 外周を移動して敵に近い位置へ
        if (misobon.side === 0 || misobon.side === 1) {
            const diff = targetTileX - misobon.x;
            const dx = diff > 0 ? 1 : diff < 0 ? -1 : 0;
            this.updateMisobonPosition(misobon.playerId, dx, 0);
        } else {
            const diff = targetTileY - misobon.y;
            const dy = diff > 0 ? 1 : diff < 0 ? -1 : 0;
            this.updateMisobonPosition(misobon.playerId, 0, dy);
        }
    }

    // みそボンの爆弾がプレイヤーに当たった → 入れ替え
    swapWithPlayer(misobonPlayerId, hitPlayerId, players) {
        const misobon = this.getMisobon(misobonPlayerId);
        if (!misobon) return false;

        const misobonPlayer = players.find(p => p.id === misobonPlayerId);
        const hitPlayer = players.find(p => p.id === hitPlayerId);
        if (!misobonPlayer || !hitPlayer) return false;

        // みそボンプレイヤーが内野に復帰
        misobonPlayer.alive = true;
        misobonPlayer.isMisobon = false;
        misobonPlayer.x = hitPlayer.x;
        misobonPlayer.y = hitPlayer.y;
        misobonPlayer.firePower = DEFAULT_FIRE_POWER;
        misobonPlayer.maxBombs = DEFAULT_BOMB_COUNT;
        misobonPlayer.hasKick = false;

        // 当たったプレイヤーがみそボンに
        this.misobons = this.misobons.filter(m => m.playerId !== misobonPlayerId);
        this.addMisobon(hitPlayer);

        return true;
    }

    removeAll() {
        this.misobons = [];
    }

    // ラスト30秒でみそボン全員脱落
    eliminateAll(players) {
        for (const m of this.misobons) {
            const player = players.find(p => p.id === m.playerId);
            if (player) {
                player.alive = false;
                player.isMisobon = false;
            }
        }
        this.misobons = [];
    }
}
