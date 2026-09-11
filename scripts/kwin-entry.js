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
    config: () =>
      normalizeConfig({
        desiredStep: readConfig('DesiredStep', DEFAULT_CONFIG.desiredStep),
        paddingLeft: readConfig('PaddingLeft', DEFAULT_CONFIG.paddingLeft),
        paddingRight: readConfig('PaddingRight', DEFAULT_CONFIG.paddingRight),
        paddingTop: readConfig('PaddingTop', DEFAULT_CONFIG.paddingTop),
        paddingBottom: readConfig(
          'PaddingBottom',
          DEFAULT_CONFIG.paddingBottom,
        ),
        floatingPanelInset: readConfig(
          'FloatingPanelInset',
          DEFAULT_CONFIG.floatingPanelInset,
        ),
      }),
    log: (message) => console.log('[kwin-compose] ' + message),
  });
  createController(composeAdapter);
}
