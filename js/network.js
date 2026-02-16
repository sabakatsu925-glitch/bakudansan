// PeerJS ネットワーク管理
class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.connected = false;
        this.onMessage = null;
        this.onConnected = null;
        this.onDisconnected = null;
        this.onError = null;
    }

    // 4桁パスワードからPeer IDを生成（英数字のみ）
    generatePeerId(password) {
        return 'bakudansanroom' + password;
    }

    // ルーム作成（ホスト）
    async createRoom(password) {
        return new Promise((resolve, reject) => {
            const peerId = this.generatePeerId(password);
            this.isHost = true;
            let settled = false;

            this.peer = new Peer(peerId, {
                debug: 2,
            });

            this.peer.on('open', (id) => {
                console.log('Room created with ID:', id);

                this.peer.on('connection', (conn) => {
                    console.log('Guest connected!');
                    this.conn = conn;
                    this.setupConnection(conn);
                });

                if (!settled) {
                    settled = true;
                    resolve(id);
                }
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Host error:', err.type, err);
                if (!settled) {
                    settled = true;
                    if (err.type === 'unavailable-id') {
                        reject(new Error('この番号のルームは既に存在します。別の番号を試してください'));
                    } else {
                        reject(new Error('ルーム作成に失敗: ' + (err.message || err.type)));
                    }
                }
            });

            // タイムアウト（PeerJSサーバーに繋がらない場合）
            setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('サーバーに接続できませんでした。ネットワークを確認してください'));
                }
            }, 15000);
        });
    }

    // ルーム参加（ゲスト）
    async joinRoom(password) {
        return new Promise((resolve, reject) => {
            const hostPeerId = this.generatePeerId(password);
            this.isHost = false;
            let settled = false;

            this.peer = new Peer(undefined, {
                debug: 2,
            });

            this.peer.on('open', (myId) => {
                console.log('Guest peer opened with ID:', myId);
                console.log('Connecting to host:', hostPeerId);

                const conn = this.peer.connect(hostPeerId, {
                    reliable: true,
                    serialization: 'json',
                });

                conn.on('open', () => {
                    console.log('Connection to host opened!');
                    this.conn = conn;
                    this.setupConnection(conn);
                    if (!settled) {
                        settled = true;
                        resolve();
                    }
                });

                conn.on('error', (err) => {
                    console.error('Connection error:', err);
                    if (!settled) {
                        settled = true;
                        reject(new Error('ルームに接続できませんでした'));
                    }
                });
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Guest error:', err.type, err);
                if (!settled) {
                    settled = true;
                    if (err.type === 'peer-unavailable') {
                        reject(new Error('ルームが見つかりません。番号を確認してください'));
                    } else {
                        reject(new Error('接続エラー: ' + (err.message || err.type)));
                    }
                }
            });

            // タイムアウト
            setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('接続がタイムアウトしました。番号を確認してください'));
                }
            }, 15000);
        });
    }

    setupConnection(conn) {
        this.connected = true;

        conn.on('data', (data) => {
            if (this.onMessage) this.onMessage(data);
        });

        conn.on('close', () => {
            this.connected = false;
            if (this.onDisconnected) this.onDisconnected();
        });

        conn.on('error', (err) => {
            console.error('Connection error after setup:', err);
        });

        if (this.onConnected) this.onConnected();
    }

    send(data) {
        if (this.conn && this.connected) {
            try {
                this.conn.send(data);
            } catch (e) {
                console.error('Send error:', e);
            }
        }
    }

    disconnect() {
        if (this.conn) {
            try { this.conn.close(); } catch (e) {}
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
        }
        this.conn = null;
        this.peer = null;
        this.connected = false;
    }
}
