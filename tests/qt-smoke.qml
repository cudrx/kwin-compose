import QtQml
import "../package/contents/code/main.js" as Compose

QtObject {
    Component.onCompleted: {
        try {
            const g = Compose.makeGrid({
                x: 0,
                y: 0,
                width: 1200,
                height: 900
            });
            const a = {
                id: "a",
                rect: {
                    x: 400,
                    y: 300,
                    width: 300,
                    height: 300
                },
                z: 0
            };
            const result = Compose.placeWindow(a, [], g, 0);
            if (!result.placed || result.rect.x !== 30)
                throw new Error("placement failed");
            if (Compose.visibleArea({
                x: 0,
                y: 0,
                width: 100,
                height: 100
            }, [
                {
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 100
                }
            ]) !== 0)
                throw new Error("visibility failed");
            const full = Compose.formatScene([a], g);
            if (full.nextIndex !== 1)
                throw new Error("format failed");
            const output = {
                name: "DP-1"
            }, desktop = {
                id: "d1"
            };
            const w = {
                internalId: "qt",
                normalWindow: true,
                output: output,
                desktops: [desktop],
                maximizeMode: 0,
                frameGeometry: Qt.rect(100, 100, 320, 340),
                clientGeometry: Qt.rect(110, 130, 300, 300),
                minSize: Qt.size(100, 100),
                maxSize: Qt.size(500, 500)
            };
            const ws = {
                activeScreen: output,
                currentDesktop: desktop,
                stackingOrder: [w],
                clientArea: function () {
                    return Qt.rect(-1200, 10, 1200, 900);
                }
            };
            const adapter = Compose.createKwinAdapter(ws, {
                areaOption: 0
            });
            if (adapter.area().rect.width !== 1200 || adapter.area().rect.x !== -1200)
                throw new Error("QRect conversion failed");
            if (adapter.record(w).minHeight !== 140 || !adapter.belongs(w, adapter.area()))
                throw new Error("adapter failed");
            console.log("Qt JavaScript smoke: PASS");
            Qt.quit();
        } catch (error) {
            console.error(error);
            Qt.exit(1);
        }
    }
}
