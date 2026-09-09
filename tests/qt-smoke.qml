import QtQml
import "../package/contents/code/main.js" as Compose

QtObject {
    Component.onCompleted: {
        try {
            const g = Compose.makeGrid({
                x: -1200,
                y: 10,
                width: 1200,
                height: 900
            });
            const snapped = Compose.snapWindow({
                x: -1112,
                y: 83,
                width: 317,
                height: 248
            }, g);
            if (snapped.x !== -1110 || snapped.y !== 70 || snapped.width !== 330 || snapped.height !== 240)
                throw new Error("window snapping failed");
            const moved = Compose.snapPosition({
                x: -1112,
                y: 83,
                width: 317,
                height: 248
            }, g);
            if (moved.width !== 317 || moved.height !== 248)
                throw new Error("position snapping changed size");
            const output = { name: "DP-1" }, desktop = { id: "d1" };
            const w = {
                internalId: "qt",
                normalWindow: true,
                output: output,
                desktops: [desktop],
                maximizeMode: 0,
                moveable: true,
                resizeable: true,
                minimized: false,
                hidden: false,
                frameGeometry: Qt.rect(100, 100, 320, 340),
                clientGeometry: Qt.rect(110, 130, 300, 300),
                minSize: Qt.size(100, 100),
                maxSize: Qt.size(500, 500)
            };
            const ws = {
                currentDesktop: desktop,
                stackingOrder: [w],
                clientArea: function () {
                    return Qt.rect(-1200, 10, 1200, 900);
                }
            };
            const adapter = Compose.createKwinAdapter(ws, { areaOption: 0 });
            const area = adapter.area(w), limits = adapter.limits(w);
            if (area.width !== 1200 || area.x !== -1200)
                throw new Error("QRect conversion failed");
            if (limits.minHeight !== 140 || limits.maxWidth !== 520)
                throw new Error("adapter limits failed");
            console.log("Qt JavaScript smoke: PASS");
            Qt.quit();
        } catch (error) {
            console.error(error);
            Qt.exit(1);
        }
    }
}
