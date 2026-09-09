import { makeGrid } from '../src/grid.js';
import { placeWindow, formatScene } from '../src/placement.js';
import { visibleArea } from '../src/geometry.js';
const $ = (id) => document.getElementById(id);
const palette = [
  ['#33485f', '#748ba5', '#d1e3f5'],
  ['#514b40', '#96866b', '#f2dfb8'],
  ['#40534e', '#7e9a8b', '#d0e9db'],
  ['#50455d', '#9b87af', '#e7d8f3'],
  ['#544349', '#a77f8b', '#f4d7df'],
  ['#3b5058', '#739da8', '#d2ecf1'],
];
const names = ['Браузер', 'Терминал', 'Заметки', 'Редактор', 'Файлы', 'Музыка'];
const anchorNames = [
  'сверху слева',
  'сверху справа',
  'посередине слева',
  'посередине справа',
  'снизу слева',
  'снизу справа',
];
let area = { x: 0, y: 0, width: 3440, height: 1440 },
  windows = [],
  nextId = 1,
  index = 0,
  thirdY,
  active = false,
  selected = null;
const options = () => ({ desiredStep: Number($('step').value) });
const grid = () => makeGrid(area, options());
function message(text) {
  $('status').textContent = text;
}
function displayWindow(w) {
  const el = document.createElement('article');
  el.className = 'window' + (selected === w.id ? ' selected' : '');
  el.dataset.id = w.id;
  el.setAttribute('aria-label', w.title);
  const colors = palette[(w.number - 1) % 6];
  el.style.cssText = `left:${(w.rect.x / area.width) * 100}%;top:${(w.rect.y / area.height) * 100}%;width:${(w.rect.width / area.width) * 100}%;height:${(w.rect.height / area.height) * 100}%;z-index:${w.z + 1};--window-bg:${colors[0]};--window-border:${colors[1]};--window-ink:${colors[2]}`;
  el.innerHTML =
    '<div class="titlebar"><span></span><button aria-label="Закрыть окно">×</button></div><div class="window-content"><div class="window-number"></div><div class="window-description">Пространство для твоей работы</div><div class="skeleton"></div><div class="skeleton short"></div><div class="skeleton"></div></div><div class="resize-handle" aria-label="Изменить размер"></div>';
  el.querySelector('.titlebar span').textContent = w.title;
  el.querySelector('.window-number').textContent = String(w.number).padStart(2, '0');
  el.querySelector('button').onclick = () => {
    windows = windows.filter((o) => o.id !== w.id);
    render();
    message('Окно закрыто. Позиция в цикле сохранена.');
  };
  el.querySelector('.titlebar').onpointerdown = (e) => {
    if (!e.target.closest('button')) drag(e, w, false);
  };
  el.querySelector('.resize-handle').onpointerdown = (e) => drag(e, w, true);
  return el;
}
function render() {
  const g = grid();
  $('stage').style.aspectRatio = `${area.width}/${area.height}`;
  $('stage').style.maxWidth = area.height > area.width ? '420px' : 'none';
  $('area-label').textContent = `${area.width} × ${area.height}`;
  $('grid-info').textContent =
    `${g.columns} × ${g.rows} ячеек · ${g.cellWidth.toFixed(1)} × ${g.cellHeight.toFixed(1)}`;
  const svg = $('grid');
  svg.setAttribute('viewBox', `0 0 ${area.width} ${area.height}`);
  svg.style.display = $('grid-toggle').checked ? 'block' : 'none';
  let path = '';
  for (let i = 0; i <= g.columns; i++) path += `M${g.x(i)},0V${area.height}`;
  for (let i = 0; i <= g.rows; i++) path += `M0,${g.y(i)}H${area.width}`;
  svg.innerHTML = `<path d="${path}" fill="none" stroke="#91a7c1" stroke-opacity=".10" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  $('safe-area').style.cssText =
    `left:${(g.bounds.x / area.width) * 100}%;top:${(g.bounds.y / area.height) * 100}%;right:${((area.width - g.bounds.x - g.bounds.width) / area.width) * 100}%;bottom:${((area.height - g.bounds.y - g.bounds.height) / area.height) * 100}%`;
  $('windows').replaceChildren(...windows.map(displayWindow));
  $('empty').style.display = windows.length ? 'none' : 'flex';
  $('mode').textContent = active ? '● Авторазмещение включено' : '○ Ручная сцена';
  $('mode').classList.toggle('active', active);
  $('anchors').innerHTML = anchorNames
    .map((_, i) => `<span class="${index % 6 === i ? 'next' : ''}">${i + 1}</span>`)
    .join('');
  $('next-anchor').textContent = `Следующая: ${(index % 6) + 1} · ${anchorNames[index % 6]}`;
  $('count').textContent = `${windows.length} окон`;
  $('records').replaceChildren(
    ...[...windows]
      .sort((a, b) => b.z - a.z)
      .map((w) => {
        const row = document.createElement('div');
        row.className = 'record';
        const visible = visibleArea(
          w.rect,
          windows.filter((o) => o.z > w.z).map((o) => o.rect),
        );
        row.innerHTML =
          '<span class="record-dot"></span><span class="name"></span><span class="dimensions"></span><span class="result"></span>';
        row.querySelector('.record-dot').style.background = palette[(w.number - 1) % 6][1];
        row.querySelector('.name').textContent = w.title;
        row.querySelector('.dimensions').textContent =
          `${Math.round(w.rect.width)} × ${Math.round(w.rect.height)} · ${Math.round(w.rect.x)}, ${Math.round(w.rect.y)}`;
        row.querySelector('.result').textContent =
          `${w.status} · видно ${Math.round((100 * visible) / (w.rect.width * w.rect.height))}%`;
        row.querySelector('.result').classList.toggle('fallback', w.status === 'Исходное место');
        return row;
      }),
  );
}
function drag(event, w, resize) {
  if (event.button !== 0) return;
  event.preventDefault();
  const target = event.currentTarget;
  target.setPointerCapture(event.pointerId);
  selected = w.id;
  w.z = Math.max(0, ...windows.map((o) => o.z)) + 1;
  const original = { ...w.rect },
    start = { x: event.clientX, y: event.clientY },
    bounds = $('stage').getBoundingClientRect();
  // Keep the captured element alive until pointerup.
  const el = target.closest('.window');
  el.style.zIndex = w.z + 1;
  function move(e) {
    const dx = ((e.clientX - start.x) * area.width) / bounds.width,
      dy = ((e.clientY - start.y) * area.height) / bounds.height;
    if (resize) {
      w.rect.width = Math.max(90, Math.min(area.width - w.rect.x, original.width + dx));
      w.rect.height = Math.max(90, Math.min(area.height - w.rect.y, original.height + dy));
    } else {
      w.rect.x = Math.max(0, Math.min(Math.max(0, area.width - w.rect.width), original.x + dx));
      w.rect.y = Math.max(0, Math.min(Math.max(0, area.height - w.rect.height), original.y + dy));
    }
    el.style.left = (w.rect.x / area.width) * 100 + '%';
    el.style.top = (w.rect.y / area.height) * 100 + '%';
    el.style.width = (w.rect.width / area.width) * 100 + '%';
    el.style.height = (w.rect.height / area.height) * 100 + '%';
  }
  function end() {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', end);
    w.status = 'Вручную';
    render();
    message('Ручная геометрия сохранена. Следующее окно учтёт её без округления.');
  }
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
}
function add() {
  const width = Number($('width').value),
    height = Number($('height').value);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 60 ||
    height < 60 ||
    width > 6000 ||
    height > 6000
  ) {
    message('Размеры должны быть от 60 до 6000.');
    return;
  }
  const number = nextId++,
    w = {
      id: String(number),
      number,
      title: names[(number - 1) % 6] + ' ' + number,
      z: Math.max(-1, ...windows.map((o) => o.z)) + 1,
      rect: {
        x: Math.max(0, (area.width - width) / 2),
        y: Math.max(0, (area.height - height) / 2),
        width,
        height,
      },
      status: 'Вручную',
    };
  if (active) {
    const result = placeWindow(w, windows, grid(), index, { thirdY });
    w.rect = result.rect;
    w.status = result.placed ? 'По сетке' : 'Исходное место';
    if (index % 6 === 2) thirdY = w.rect.y;
    index++;
    message(
      result.placed
        ? 'Новое окно размещено. Остальные окна не изменены.'
        : 'Допустимого места нет: окно осталось в исходной геометрии.',
    );
  } else message('Окно добавлено в свободную сцену. Авторазмещение пока выключено.');
  windows.push(w);
  selected = w.id;
  render();
}
function demo() {
  windows = [];
  index = 0;
  thirdY = undefined;
  nextId = 1;
  active = false;
  selected = null;
  const sizes = [
    [0.4, 0.65],
    [0.34, 0.58],
    [0.29, 0.7],
    [0.36, 0.56],
  ];
  for (let i = 0; i < 4; i++) {
    const number = nextId++;
    windows.push({
      id: String(number),
      number,
      title: names[i] + ' ' + number,
      z: i,
      rect: {
        x: area.width * (0.08 + i * 0.13),
        y: area.height * (0.06 + i * 0.08),
        width: Math.round(area.width * sizes[i][0]),
        height: Math.round(area.height * sizes[i][1]),
      },
      status: 'Вручную',
    });
  }
  render();
  message('Пример загружен. Нажми «Форматировать окна» или измени сцену вручную.');
}
$('add').onclick = add;
$('demo').onclick = demo;
$('format').onclick = () => {
  const result = formatScene(windows, grid());
  windows = result.windows.map((w) => ({
    ...w,
    status: result.results.find((r) => r.id === w.id)?.placed ? 'По сетке' : 'Исходное место',
  }));
  index = result.nextIndex;
  thirdY = result.thirdY;
  active = true;
  render();
  const placed = result.results.filter((r) => r.placed).length;
  message(
    `Размещено: ${placed} из ${windows.length}. Исходное место: ${windows.length - placed}. Авторазмещение новых окон включено.`,
  );
};
$('clear').onclick = () => {
  windows = [];
  index = 0;
  thirdY = undefined;
  active = false;
  selected = null;
  render();
  message('Сцена очищена. Добавь первое окно.');
};
$('grid-toggle').onchange = render;
$('step').onchange = () => {
  if (
    !Number.isFinite(Number($('step').value)) ||
    Number($('step').value) < 8 ||
    Number($('step').value) > 150
  )
    $('step').value = 30;
  render();
  message('Шаг изменён. Существующие окна сохраняют свои места до форматирования.');
};
$('aspect').onchange = () => {
  const [width, height] = $('aspect').value.split(',').map(Number);
  area = { x: 0, y: 0, width, height };
  demo();
  updatePreset();
  message('Новая рабочая область: пример сброшен, авторазмещение выключено.');
};
function updatePreset() {
  const p = { browser: [0.37, 0.67], terminal: [0.3, 0.54], notes: [0.24, 0.72] }[
    $('preset').value
  ];
  if (p) {
    $('width').value = Math.round((area.width * p[0]) / 30) * 30;
    $('height').value = Math.round((area.height * p[1]) / 30) * 30;
  }
}
$('preset').onchange = updatePreset;
for (const id of ['width', 'height'])
  $(id).oninput = () => {
    $('preset').value = 'custom';
  };
demo();
updatePreset();
