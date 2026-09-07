# Промпты для персонажей и шмота

Три слоя, в таком порядке: **база** (персонаж в трусах), **причёска**, **одежда**.
База генерится один раз на персонажа. Всё остальное надевается поверх.

---

## Сначала честно про метод

Идеально собрать персонажа из независимо сгенерированных PNG-слоёв не выйдет: генератор каждый раз чуть двигает пропорции, и рукав не сядет на плечо. Есть два рабочих пути.

**Путь A, надёжный (рекомендую начать с него).** Генеришь базу. Дальше каждый образ делаешь **image-to-image**: кидаешь картинку базы в чат и пишешь «этот же персонаж, та же поза, то же лицо, надень на него X». Получаешь готовый образ целиком. Слоёв нет, зато ничего не разъезжается. Минус: каждая комбинация это отдельная картинка.

**Путь B, гибкий.** Одежда генерится как **плоский предмет на прозрачном фоне**, без тела, и накладывается кодом в фиксированные координаты. Работает для шапок, очков, футболок анфас. Плохо работает для всего, что должно облегать. Минус: подгонять придётся руками.

Практично: базы и причёски по пути B, одежду по пути A. Гардероб тогда собирается из готовых образов, а мелочёвка накладывается сверху.

---

## Общий канон

Он одинаковый для базы, причёсок и шмота. Не меняй ни слова между генерациями, иначе стиль поедет.

```
Flat vector cartoon, thick uniform black outline, no shading, no gradients, no texture.
Front view, symmetrical, standing straight, arms relaxed slightly away from the body.
Chibi proportions: head is one third of total height, short sturdy body.
Simple face: white rectangular eyes with black outline, thick straight eyebrows,
tiny nose, single line mouth, one small hoop earring in the left ear.
Transparent background, character centered, even margins, full body visible including feet.
Sticker style, clean edges, high contrast.
```

**Убрать из выдачи:**
```
no shading, no gradient, no glow, no background, no shadow under feet, no text,
no perspective, not 3d, not realistic, no extra characters, no props in hands
```

**Палитра**

```
чернила    #252323    обводка, тёмные вещи
белый      #FFFFFF    фон интерфейса, белые вещи
мята       #8EFF8E    главный акцент
барвинок   #9F9FED    вторичный
слейт      #736CED    вторичный тёмный
кожа       #F2C89C / #C98A5E / #8D5524
```

---

## Слой 1 · База: персонаж в трусах

Это стартовый вид. Персонаж стоит в одних трусах, немного нелепо, и это нормально: смешной старт делает первую одежду наградой.

**Шаблон:**

```
[КАНОН]
The character wears only [ТРУСЫ] boxer briefs and nothing else. Bare chest, bare feet.
[ТЕЛО] build. [КОЖА] skin. Bald head, no hair (hair is added separately).
Slightly awkward confident pose, faintly amused expression.
```

**Варианты трусов:**

| Ключ | Подстановка |
|---|---|
| `leopard` | `leopard print` |
| `black` | `plain black` |
| `white` | `plain white with a thin waistband` |
| `hearts` | `white with small red hearts` |
| `stripes` | `blue and white horizontal stripes` |
| `mint` | `mint green #8EFF8E` |
| `flames` | `black with orange flame print` |
| `banana` | `yellow with banana print` |

**Варианты тела:** `slim` · `average` · `stocky` · `athletic`
**Варианты кожи:** `light` · `tan` · `brown` · `dark`

Голова генерится **лысой**. Причёска отдельным слоем, иначе не переоденешь.

---

## Слой 2 · Причёски

Генерятся отдельно, по пути B, как накладка.

```
[КАНОН, но только про стиль линии и заливки]
A single hairstyle asset only: [ПРИЧЁСКА], flat vector, thick black outline, flat fill,
no head, no face, no body, transparent background, front view, centered.
The hairstyle is drawn as if worn on a head 260 pixels wide, sitting on top of the skull line.
```

| Ключ | Подстановка |
|---|---|
| `mohawk` | `bright orange mohawk` |
| `curly` | `short dark curly hair` |
| `buzz` | `black buzz cut` |
| `long` | `shoulder length straight black hair` |
| `bleached` | `bleached blond short hair with dark roots` |
| `braids` | `cornrow braids` |
| `bun` | `top knot bun` |
| `cap` | `black snapback cap worn backwards` |
| `bandana` | `mint green bandana tied at the back` |

---

## Слой 3 · Одежда

Путь A, на базовом персонаже. В чат кидаешь PNG базы и пишешь:

```
Same character, same pose, same face, same proportions, same style.
Now dressed in: [ВЕРХ], [НИЗ], [ОБУВЬ].
Keep the thick black outline, flat colors, no shading, transparent background.
Do not change the head, the face or the body proportions.
```

**Верх:**

| Ключ | Подстановка |
|---|---|
| `bandtee` | `oversized black band t-shirt with a white skull print` |
| `crewneck` | `oversized navy crewneck sweatshirt` |
| `tank` | `white ribbed tank top` |
| `hoodie` | `mint green #8EFF8E oversized hoodie` |
| `longsleeve` | `washed black long sleeve tee` |
| `rashguard` | `purple #736CED long sleeve rashguard` |

**Низ:**

| Ключ | Подстановка |
|---|---|
| `baggy` | `wide baggy light blue jeans` |
| `cargo` | `olive cargo shorts` |
| `black_shorts` | `plain black shorts above the knee` |
| `ripped` | `ripped wide grey jeans` |
| `sweats` | `dark grey sweatpants` |

**Обувь:**

| Ключ | Подстановка |
|---|---|
| `converse` | `black low top canvas sneakers with white soles and white crew socks` |
| `chunky` | `chunky white sneakers with white crew socks` |
| `slides` | `black slides` |
| `barefoot` | `barefoot` |

---

## Что делать с выдачей

Годится, только если проходит все четыре:

1. **Силуэт.** Залей персонажа сплошным чёрным. Узнаётся? Если нет, форма дробная.
2. **Толщина линии.** Одна на всей фигуре. Тоньше на мелочах значит другой стиль, и рядом с остальными будет видно.
3. **64 пикселя.** Уменьши до иконки. Лицо читается? Если нет, деталей много.
4. **Поля.** По центру, без тени под ногами, фон реально прозрачный.

Не прошло хоть одно, перегенерируй тем же промптом. Руками не правь: ручная правка одного персонажа и есть то, из-за чего потом разъезжается весь набор.

---

## Файлы

```
assets/base/<трусы>_<тело>_<кожа>.png     512 высотой, прозрачный
assets/hair/<ключ>.png                     накладка, прозрачный
assets/outfit/<верх>_<низ>_<обувь>.png     готовый образ целиком
```

Начни с малого: две базы, три причёски, три образа. Проверь, что они смотрятся как один набор, и только потом разгоняй.
