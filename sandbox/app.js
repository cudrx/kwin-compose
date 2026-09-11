import {
  insetArea,
  makeGrid,
  snapAll,
  snapPosition,
  snapResize,
  snapWindow,
} from '../src/grid.js';
import {
  CONFIG_LIMITS,
  DEFAULT_CONFIG,
  normalizeConfig,
  WINDOW_PRESETS,
} from '../src/config.js';

const $ = (id) => document.getElementById(id),
  palette = [
    ['#33485f', '#748ba5', '#d1e3f5'],
    ['#514b40', '#96866b', '#f2dfb8'],
    ['#40534e', '#7e9a8b', '#d0e9db'],
    ['#50455d', '#9b87af', '#e7d8f3'],
    ['#544349', '#a77f8b', '#f4d7df'],
    ['#3b5058', '#739da8', '#d2ecf1'],
  ],
  names = ['Браузер', 'Терминал', 'Заметки', 'Редактор', 'Файлы', 'Музыка'];
let area = { x: 0, y: 0, width: 3440, height: 1440 },
  windows = [],
  nextId = 1,
  selected = null;

const config = () =>
  normalizeConfig({
    desiredStep: $('step').value,
    paddingLeft: $('padding-left').value,
    paddingRight: $('padding-right').value,
    paddingTop: $('padding-top').value,
    paddingBottom: $('padding-bottom').value,
  });
const snappingContext = () => {
  const current = config(),
    bounds = insetArea(area, {
      left: current.paddingLeft,
      right: current.paddingRight,
      top: current.paddingTop,
      bottom: current.paddingBottom,
    });

  return {
    grid: makeGrid(bounds, current),
    bounds,
  };
};
const message = (text) => ($('status').textContent = text);
const paddingKey = (side) => `padding${side[0].toUpperCase()}${side.slice(1)}`;

function displayWindow(window) {
  const element = document.createElement('article'),
    colors = palette[(window.number - 1) % palette.length];
  element.className = 'window' + (selected === window.id ? ' selected' : '');
  element.dataset.id = window.id;
  element.setAttribute('aria-label', window.title);
  element.style.cssText = `left:${((window.rect.x - area.x) / area.width) * 100}%;top:${((window.rect.y - area.y) / area.height) * 100}%;width:${(window.rect.width / area.width) * 100}%;height:${(window.rect.height / area.height) * 100}%;z-index:${window.z + 1};--window-bg:${colors[0]};--window-border:${colors[1]};--window-ink:${colors[2]}`;
  element.innerHTML =
    '<div class="titlebar"><span></span><button aria-label="Закрыть окно">×</button></div><div class="window-content"><div class="window-number"></div><div class="window-description">Пространство для твоей работы</div><div class="skeleton"></div><div class="skeleton short"></div><div class="skeleton"></div></div><div class="resize-handle" aria-label="Изменить размер"></div>';
  element.querySelector('.titlebar span').textContent = window.title;
  element.querySelector('.window-number').textContent = String(
    window.number,
  ).padStart(2, '0');
  element.querySelector('button').onclick = () => {
    windows = windows.filter((other) => other.id !== window.id);
    render();
    message('Окно удалено.');
  };
  element.querySelector('.titlebar').onpointerdown = (event) => {
    if (!event.target.closest('button')) drag(event, window, false);
  };
  element.querySelector('.resize-handle').onpointerdown = (event) =>
    drag(event, window, true);

  return element;
}

function render() {
  const context = snappingContext(),
    currentGrid = context.grid,
    bounds = context.bounds,
    svg = $('grid');
  $('stage').style.aspectRatio = `${area.width}/${area.height}`;
  $('stage').style.maxWidth = area.height > area.width ? '420px' : 'none';
  $('area-label').textContent = `${area.width} × ${area.height}`;
  $('grid-info').textContent =
    `${currentGrid.columns} × ${currentGrid.rows} ячеек · ${currentGrid.cellWidth.toFixed(1)} × ${currentGrid.cellHeight.toFixed(1)}`;
  svg.setAttribute(
    'viewBox',
    `${area.x} ${area.y} ${area.width} ${area.height}`,
  );
  svg.style.display = $('grid-toggle').checked ? 'block' : 'none';
  let path = '';
  for (let index = 0; index <= currentGrid.columns; index++)
    path += `M${currentGrid.x(index)},${area.y}V${area.y + area.height}`;
  for (let index = 0; index <= currentGrid.rows; index++)
    path += `M${area.x},${currentGrid.y(index)}H${area.x + area.width}`;
  svg.innerHTML = `<path d="${path}" fill="none" stroke="#91a7c1" stroke-opacity=".10" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  $('safe-area').style.cssText =
    `left:${((bounds.x - area.x) / area.width) * 100}%;top:${((bounds.y - area.y) / area.height) * 100}%;right:${((area.x + area.width - bounds.x - bounds.width) / area.width) * 100}%;bottom:${((area.y + area.height - bounds.y - bounds.height) / area.height) * 100}%`;
  $('windows').replaceChildren(...windows.map(displayWindow));
  $('empty').style.display = windows.length ? 'none' : 'flex';
  $('count').textContent = `${windows.length} окон`;
  $('records').replaceChildren(
    ...[...windows]
      .sort((a, b) => b.z - a.z)
      .map((window) => {
        const row = document.createElement('div');
        row.className = 'record';
        row.innerHTML =
          '<span class="record-dot"></span><span class="name"></span><span class="dimensions"></span><span class="result"></span>';
        row.querySelector('.record-dot').style.background =
          palette[(window.number - 1) % 6][1];
        row.querySelector('.name').textContent = window.title;
        row.querySelector('.dimensions').textContent =
          `${Math.round(window.rect.width)} × ${Math.round(window.rect.height)} · ${Math.round(window.rect.x)}, ${Math.round(window.rect.y)}`;
        row.querySelector('.result').textContent = window.status;
        return row;
      }),
  );
}

function drag(event, window, resize) {
  if (event.button !== 0) return;
  event.preventDefault();
  const target = event.currentTarget,
    original = { ...window.rect },
    start = { x: event.clientX, y: event.clientY },
    bounds = $('stage').getBoundingClientRect(),
    element = target.closest('.window');
  target.setPointerCapture(event.pointerId);
  selected = window.id;
  window.z = Math.max(0, ...windows.map((other) => other.z)) + 1;
  element.style.zIndex = window.z + 1;
  function move(current) {
    const dx = ((current.clientX - start.x) * area.width) / bounds.width,
      dy = ((current.clientY - start.y) * area.height) / bounds.height;
    if (resize) {
      window.rect.width = Math.max(60, original.width + dx);
      window.rect.height = Math.max(60, original.height + dy);
    } else {
      window.rect.x = original.x + dx;
      window.rect.y = original.y + dy;
    }
    element.style.left = ((window.rect.x - area.x) / area.width) * 100 + '%';
    element.style.top = ((window.rect.y - area.y) / area.height) * 100 + '%';
    element.style.width = (window.rect.width / area.width) * 100 + '%';
    element.style.height = (window.rect.height / area.height) * 100 + '%';
  }
  function end() {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', end);
    window.rect = resize
      ? snapResize(original, window.rect, snappingContext())
      : snapPosition(window.rect, snappingContext());
    window.status = resize ? 'Ресайз по сетке' : 'Позиция по сетке';
    render();
    message(
      resize
        ? 'Изменённые края подогнаны.'
        : 'Положение подогнано, размер сохранён.',
    );
  }
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
}

function add() {
  const width = Number($('width').value),
    height = Number($('height').value);
  if (
    ![width, height].every(Number.isFinite) ||
    width < CONFIG_LIMITS.minimumWindowSize ||
    height < CONFIG_LIMITS.minimumWindowSize ||
    width > CONFIG_LIMITS.maximumWindowSize ||
    height > CONFIG_LIMITS.maximumWindowSize
  ) {
    message(
      `Размеры должны быть от ${CONFIG_LIMITS.minimumWindowSize} до ${CONFIG_LIMITS.maximumWindowSize}.`,
    );
    return;
  }
  const number = nextId++,
    window = {
      id: String(number),
      number,
      title: names[(number - 1) % names.length] + ' ' + number,
      z: Math.max(-1, ...windows.map((other) => other.z)) + 1,
      rect: snapWindow(
        {
          x: area.x + Math.max(0, (area.width - width) / 2),
          y: area.y + Math.max(0, (area.height - height) / 2),
          width,
          height,
        },
        snappingContext(),
      ),
      status: 'Открыто по сетке',
    };
  windows.push(window);
  selected = window.id;
  render();
  message('Новое окно подогнано. Остальные окна не изменены.');
}

function demo() {
  windows = [];
  nextId = 1;
  selected = null;
  const sizes = [
    [0.4, 0.65],
    [0.34, 0.58],
    [0.29, 0.7],
    [0.36, 0.56],
  ];
  for (let index = 0; index < sizes.length; index++) {
    const number = nextId++,
      raw = {
        x: area.x + area.width * (0.08 + index * 0.13),
        y: area.y + area.height * (0.06 + index * 0.08),
        width: Math.round(area.width * sizes[index][0]),
        height: Math.round(area.height * sizes[index][1]),
      };
    windows.push({
      id: String(number),
      number,
      title: names[index] + ' ' + number,
      z: index,
      rect: snapWindow(raw, snappingContext()),
      status: 'Открыто по сетке',
    });
  }
  render();
  message('Пример загружен. Перекрытия разрешены, каждое окно независимо.');
}

$('add').onclick = add;
$('demo').onclick = demo;
$('format').onclick = () => {
  windows = snapAll(windows, snappingContext()).map((window) => ({
    ...window,
    status: 'Подогнано целиком',
  }));
  render();
  message('Все окна подогнаны независимо рядом с текущими местами.');
};
$('clear').onclick = () => {
  windows = [];
  nextId = 1;
  selected = null;
  render();
  message('Сцена очищена. Добавь первое окно.');
};
$('grid-toggle').onchange = render;
$('step').onchange = () => {
  $('step').value = config().desiredStep;
  render();
  message(
    'Шаг изменён. Существующие окна сохраняют геометрию до следующего действия.',
  );
};
for (const side of ['left', 'right', 'top', 'bottom']) {
  const id = `padding-${side}`;
  $(id).onchange = () => {
    $(id).value = config()[paddingKey(side)];
    render();
    message('Внутренние отступы изменены независимо от шага сетки.');
  };
}
$('aspect').onchange = () => {
  const [width, height] = $('aspect').value.split(',').map(Number);
  area = { x: 0, y: 0, width, height };
  demo();
};

$('step').min = CONFIG_LIMITS.minimumStep;
$('step').max = CONFIG_LIMITS.maximumStep;
$('step').value = DEFAULT_CONFIG.desiredStep;
for (const side of ['left', 'right', 'top', 'bottom']) {
  const input = $(`padding-${side}`),
    key = paddingKey(side);
  input.min = 0;
  input.max = CONFIG_LIMITS.maximumPadding;
  input.value = DEFAULT_CONFIG[key];
}
$('width').min = CONFIG_LIMITS.minimumWindowSize;
$('width').max = CONFIG_LIMITS.maximumWindowSize;
$('height').min = CONFIG_LIMITS.minimumWindowSize;
$('height').max = CONFIG_LIMITS.maximumWindowSize;
$('width').value = WINDOW_PRESETS.browser.width;
$('height').value = WINDOW_PRESETS.browser.height;
$('preset').onchange = () => {
  const selectedPreset = WINDOW_PRESETS[$('preset').value];
  if (selectedPreset) {
    $('width').value = selectedPreset.width;
    $('height').value = selectedPreset.height;
  }
};

demo();
