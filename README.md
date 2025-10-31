# Wagon Tooltip & Badges — Production Bundle

## Файлы
- `wagon.module.js` — JS-модуль с API `window.WagonUI.init(options)`
- `wagon.module.css` — стили (не ломают сетку, только позиционируют бейджи/тултип)
- `data/wagons_2000.json` — база вагонов (пример на 2000 записей)
- `assets/` — папка с иконками (подставляются по полю «Тип»)

## Быстрое подключение
Вставьте перед `</head>`:
```html
<link rel="stylesheet" href="./wagon.module.css">
```
Перед `</body>`:
```html
<script src="./wagon.module.js" data-auto-init data-url="./data/wagons_2000.json"></script>
<script>
  // или явная инициализация (более гибкая):
  WagonUI.init({
    dataUrl: './data/wagons_2000.json',
    youngYear: 2018,
    cellSelector: '[data-number],[data-wagon-id]',
    typeToAsset: {
      'одноэтажный': './assets/wagon_one.png',
      'двухэтажный': './assets/wagon_two.png'
    },
    debug: false
  });
</script>
```

## Разметка
Добавьте для каждого вагона `data-number="########"` (8 цифр) или `data-wagon-id="N"`. Пример:
```html
<div class="cell" data-number="12345678">
  <img class="wagon-img" src="./assets/wagon_one.png" alt="Вагон">
</div>
```

Если `data-number` нет, модуль попробует:
- извлечь номер из текста ячейки (форматы `########` или `###-#####`),
- извлечь номер из имени файла картинки (например `.../assets/12345678.png`).

## Особенности
- ★ — если `Постройка >= 2018`
- «Х» — если `Переход = Х`
- если вагон не найден — элемент подсвечивается и показывается уведомление
- модуль не меняет лэйаут; добавляет только классы, бейджи и тултип (position:fixed)
- поддерживает динамически добавляемые вагоны (MutationObserver)

## Советы
- Пути на GitHub Pages должны быть относительными (`./...`).
- Убедитесь, что `data/wagons_2000.json` и иконки в `assets/` доступны по сети (200 OK).
