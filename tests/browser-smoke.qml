import QtQuick
import QtQuick.Window
import QtWebEngine
import QtTest

Window {
    id: root
    width: 1440
    height: 1120
    visible: true
    TestCase {
        id: input
        when: false
    }
    WebEngineView {
        id: web
        anchors.fill: parent
        url: "http://127.0.0.1:5173/"
        onJavaScriptConsoleMessage: (level, message) => console.log("Browser: " + message)
        onLoadingChanged: function (request) {
            if (request.status === WebEngineView.LoadSucceededStatus)
                checkTimer.start();
            if (request.status === WebEngineView.LoadFailedStatus) {
                console.error(request.errorString);
                Qt.exit(1);
            }
        }
    }
    Timer {
        id: checkTimer
        interval: 400
        onTriggered: web.runJavaScript(`(function(){
          const q=id=>document.getElementById(id);
          function check(value,label){if(!value)throw new Error(label);}
          try {
            check(document.querySelectorAll('.window').length===4,'initial demo');
            q('clear').click();check(document.querySelectorAll('.window').length===0,'clear');
            q('format').click();q('add').click();
            const first=document.querySelector('.window'),before=first.style.cssText;
            q('add').click();check(document.querySelectorAll('.window').length===2,'add');
            check(document.querySelector('.window').style.left===first.style.left,'existing position');
            q('grid-toggle').click();check(q('grid').style.display==='none','grid toggle');
            const paddingBefore=q('safe-area').style.left;
            q('padding-left').value='90';q('padding-left').dispatchEvent(new Event('change'));
            check(q('safe-area').style.left!==paddingBefore,'independent padding');
            q('aspect').value='1080,1920';q('aspect').dispatchEvent(new Event('change'));
            check(q('area-label').textContent==='1080 × 1920','portrait');
            q('aspect').value='3440,1440';q('aspect').dispatchEvent(new Event('change'));
            q('grid-toggle').click();q('format').click();
            check(!document.body.scrollWidth || document.body.scrollWidth<=innerWidth,'horizontal overflow');
            const target=document.querySelector('#windows .window:last-child'),r=target.querySelector('.titlebar').getBoundingClientRect();
            return {ok:true,status:q('status').textContent,count:document.querySelectorAll('.window').length,x:r.x+25,y:r.y+10,left:target.style.left};
          }catch(e){return {ok:false,error:String(e)};}
        })()`, function (result) {
            console.log(JSON.stringify(result));
            if (!result || !result.ok) {
                Qt.exit(1);
                return;
            }
            root.originalLeft = result.left;
            input.mousePress(web, result.x, result.y, Qt.LeftButton);
            input.mouseMove(web, result.x + 35, result.y + 20, 30);
            input.mouseRelease(web, result.x + 35, result.y + 20, Qt.LeftButton);
            dragTimer.start();
        })
    }
    property string originalLeft
    Timer {
        id: dragTimer
        interval: 100
        onTriggered: web.runJavaScript("document.querySelector('#windows .window:last-child').style.left", function (left) {
            if (left === root.originalLeft) {
                console.error("Drag did not move the window");
                Qt.exit(1);
                return;
            }
            console.log("Pointer drag: PASS");
            captureTimer.start();
        })
    }
    Timer {
        id: captureTimer
        interval: 300
        onTriggered: web.grabToImage(function (result) {
            result.saveToFile("/tmp/kwin-compose-sandbox.png");
            console.log("Browser smoke: PASS");
            Qt.quit();
        })
    }
    Timer {
        running: true
        interval: 15000
        onTriggered: {
            console.error("Browser timeout");
            Qt.exit(1);
        }
    }
}
