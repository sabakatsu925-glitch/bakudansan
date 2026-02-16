// タッチ入力管理
class InputManager {
    constructor() {
        this.dx = 0;
        this.dy = 0;
        this.bombPressed = false;
        this.kickPressed = false;

        this.joystickActive = false;
        this.joystickStartX = 0;
        this.joystickStartY = 0;
        this.joystickTouchId = null;

        this.joystickBase = null;
        this.joystickStick = null;

        // キーボード入力（PC開発用）
        this.keys = {};
    }

    init() {
        this.createJoystick();
        this.setupTouchEvents();
        this.setupKeyboardEvents();
        this.setupButtons();
    }

    createJoystick() {
        const zone = document.getElementById('joystick-zone');
        zone.innerHTML = '';

        this.joystickBase = document.createElement('div');
        this.joystickBase.className = 'joystick-base';
        zone.appendChild(this.joystickBase);

        this.joystickStick = document.createElement('div');
        this.joystickStick.className = 'joystick-stick';
        this.joystickBase.appendChild(this.joystickStick);
    }

    setupTouchEvents() {
        const zone = document.getElementById('joystick-zone');

        zone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            this.joystickTouchId = touch.identifier;
            this.joystickActive = true;

            const rect = this.joystickBase.getBoundingClientRect();
            this.joystickStartX = rect.left + rect.width / 2;
            this.joystickStartY = rect.top + rect.height / 2;

            this.updateJoystick(touch.clientX, touch.clientY);
        }, { passive: false });

        zone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier === this.joystickTouchId) {
                    this.updateJoystick(touch.clientX, touch.clientY);
                }
            }
        }, { passive: false });

        const endTouch = (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === this.joystickTouchId) {
                    this.joystickActive = false;
                    this.joystickTouchId = null;
                    this.dx = 0;
                    this.dy = 0;
                    this.joystickStick.style.transform = 'translate(-50%, -50%)';
                }
            }
        };

        zone.addEventListener('touchend', endTouch, { passive: false });
        zone.addEventListener('touchcancel', endTouch, { passive: false });
    }

    updateJoystick(touchX, touchY) {
        const diffX = touchX - this.joystickStartX;
        const diffY = touchY - this.joystickStartY;
        const maxDist = 45;

        const dist = Math.sqrt(diffX * diffX + diffY * diffY);
        const clampedDist = Math.min(dist, maxDist);

        let normX = 0, normY = 0;
        if (dist > 5) { // デッドゾーン
            normX = diffX / dist;
            normY = diffY / dist;
        }

        // ジョイスティックの表示位置
        const displayX = normX * clampedDist;
        const displayY = normY * clampedDist;
        this.joystickStick.style.transform = `translate(calc(-50% + ${displayX}px), calc(-50% + ${displayY}px))`;

        // 入力値（-1 〜 1）
        if (dist > 10) {
            this.dx = normX;
            this.dy = normY;
        } else {
            this.dx = 0;
            this.dy = 0;
        }
    }

    setupButtons() {
        const bombBtn = document.getElementById('btn-bomb');
        const kickBtn = document.getElementById('btn-kick');

        bombBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.bombPressed = true;
        }, { passive: false });
        bombBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
        }, { passive: false });

        kickBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.kickPressed = true;
        }, { passive: false });
        kickBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
        }, { passive: false });
    }

    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === ' ') this.bombPressed = true;
            if (e.key === 'k') this.kickPressed = true;
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    getInput() {
        let dx = this.dx;
        let dy = this.dy;

        // キーボードフォールバック
        if (this.keys['ArrowLeft'] || this.keys['a']) dx = -1;
        if (this.keys['ArrowRight'] || this.keys['d']) dx = 1;
        if (this.keys['ArrowUp'] || this.keys['w']) dy = -1;
        if (this.keys['ArrowDown'] || this.keys['s']) dy = 1;

        const bomb = this.bombPressed;
        const kick = this.kickPressed;
        this.bombPressed = false;
        this.kickPressed = false;

        return { dx, dy, bomb, kick };
    }

    showKickButton(show) {
        document.getElementById('btn-kick').style.display = show ? 'flex' : 'none';
    }
}
