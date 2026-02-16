// アイテム管理
class ItemManager {
    constructor(gameMap) {
        this.map = gameMap;
    }

    applyItem(player, itemType) {
        switch (itemType) {
            case ITEM_TYPE.FIRE_UP:
                player.firePower++;
                break;
            case ITEM_TYPE.BOMB_UP:
                player.maxBombs++;
                break;
            case ITEM_TYPE.KICK:
                player.hasKick = true;
                break;
        }
    }

    checkPickup(player) {
        const tileX = Math.round(player.x);
        const tileY = Math.round(player.y);
        const item = this.map.getItemAt(tileX, tileY);
        if (item) {
            this.applyItem(player, item.type);
            this.map.removeItemAt(tileX, tileY);
            return item.type;
        }
        return null;
    }
}
