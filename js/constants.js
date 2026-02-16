// ゲーム定数
const COLS = 13;
const ROWS = 11;

// タイルタイプ
const TILE = {
    EMPTY: 0,
    WALL: 1,      // 破壊不可の壁
    PILLAR: 2,    // 破壊不可の柱
    BLOCK: 3,     // 破壊可能なブロック
    FALLING: 4,   // 落下ブロック（ラスト30秒）
};

// プレイヤーカラー
const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const PLAYER_NAMES = ['P1', 'P2', 'P3', 'P4'];

// スポーン位置（4隅）
const SPAWN_POSITIONS = [
    { x: 1, y: 1 },     // 左上
    { x: COLS - 2, y: ROWS - 2 }, // 右下
    { x: COLS - 2, y: 1 },        // 右上
    { x: 1, y: ROWS - 2 },        // 左下
];

// 爆弾
const BOMB_TIMER = 3000;      // 3秒
const DEFAULT_FIRE_POWER = 1;
const DEFAULT_BOMB_COUNT = 1;
const BOMB_KICK_SPEED = 5;    // タイル/秒

// アイテムタイプ
const ITEM_TYPE = {
    FIRE_UP: 'fire_up',
    BOMB_UP: 'bomb_up',
    KICK: 'kick',
};

// アイテムドロップ率（合計で50%ドロップ、残り50%何も出ない）
const ITEM_DROP_RATE = 0.50;
const ITEM_WEIGHTS = {
    [ITEM_TYPE.FIRE_UP]: 0.4,
    [ITEM_TYPE.BOMB_UP]: 0.4,
    [ITEM_TYPE.KICK]: 0.2,
};

// 移動速度（タイル/秒）
const PLAYER_SPEED = 3.5;

// ゲーム状態
const GAME_STATE = {
    WAITING: 'waiting',
    COUNTDOWN: 'countdown',
    PLAYING: 'playing',
    SUDDEN_DEATH: 'sudden_death',
    ROUND_END: 'round_end',
    MATCH_END: 'match_end',
};

// みそボン
const MISOBON_FIRE_POWER = 1;
const MISOBON_BOMB_COUNT = 1;
const MISOBON_SPEED = 2.5;

// 落下ブロックの間隔（ms）
const FALLING_BLOCK_INTERVAL = 300;

// 勝利ポイント
const WIN_POINTS = 2;

// 方向
const DIR = {
    NONE: { x: 0, y: 0 },
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
};

const DIRECTIONS = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
