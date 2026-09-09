// Executed only by KWin; tests import the generated functions in isolation.
if (typeof workspace !== 'undefined') {
  const composeTimers = new Set();
  function composeSchedule(fn, delay) {
    const timer = new QTimer();
    let live = true;
    timer.singleShot = true;
    timer.interval = delay;
    composeTimers.add(timer);
    function cancel() {
      if (!live) return;
      live = false;
      timer.stop();
      composeTimers.delete(timer);
      timer.deleteLater();
    }
    timer.timeout.connect(function () {
      cancel();
      fn();
    });
    timer.start();
    return cancel;
  }
  const composeAdapter = createKwinAdapter(workspace, {
    areaOption: KWin.MaximizeArea,
    schedule: composeSchedule,
    config: () => ({
      desiredStep: readConfig('DesiredStep', 30),
      left: readConfig('MarginLeft', 1),
      right: readConfig('MarginRight', 1),
      top: readConfig('MarginTop', 1),
      bottom: readConfig('MarginBottom', 2),
    }),
    log: (message) => console.log('[kwin-compose] ' + message),
  });
  createController(composeAdapter);
}
