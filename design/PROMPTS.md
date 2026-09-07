# Промпты

Каждый промпт полный. Копируешь блок целиком, вставляешь в ChatGPT, получаешь картинку. Ничего подставлять не надо.

Порядок работы: сначала база (персонаж в трусах), потом причёска отдельным файлом, потом одежда поверх базы.

---

## Как это работает, коротко

Собрать персонажа из независимо сгенерированных слоёв идеально не выйдет: генератор каждый раз чуть двигает пропорции, и рукав не сядет на плечо.

Поэтому:

- **База и причёски** генерятся отдельными файлами на прозрачном фоне.
- **Одежда** генерится поверх готовой базы: кидаешь в чат картинку базы и следом промпт из раздела «Одежда». Это image-to-image, персонаж остаётся тем же.

Сохраняй так:

```
assets/base/<имя>.png       персонаж в трусах, лысый, 512 высотой
assets/hair/<имя>.png       причёска накладкой
assets/outfit/<имя>.png     готовый образ целиком
```

---

# 1 · Базы

Персонаж стоит в одних трусах. Голова лысая, причёска надевается потом.

## Леопард

```
Flat vector cartoon character, full body, front view, standing straight, symmetrical, arms relaxed slightly away from the body. Chibi proportions: the head is one third of the total height, the body is short and sturdy. The character is a young man wearing only leopard print boxer briefs, nothing else, bare chest, bare feet. Average build, light skin. Completely bald head, no hair at all. Slightly awkward but confident pose, faintly amused expression. Simple face: white rectangular eyes with a black outline, thick straight black eyebrows, tiny nose, single line mouth, one small hoop earring in the left ear. Thick uniform black outline of even weight across the whole figure, flat fills only, no shading, no gradients, no texture. Transparent background, character centered with even margins, full body visible including feet. Sticker style, clean edges, high contrast. No background, no shadow under the feet, no text, no perspective, not 3d, not realistic, no props.
```

## Чёрные

```
Flat vector cartoon character, full body, front view, standing straight, symmetrical, arms relaxed slightly away from the body. Chibi proportions: the head is one third of the total height, the body is short and sturdy. The character is a young man wearing only plain black boxer briefs with a thin white waistband, nothing else, bare chest, bare feet. Athletic build, tan skin. Completely bald head, no hair at all. Slightly awkward but confident pose, faintly amused expression. Simple face: white rectangular eyes with a black outline, thick straight black eyebrows, tiny nose, single line mouth, one small hoop earring in the left ear. Thick uniform black outline of even weight across the whole figure, flat fills only, no shading, no gradients, no texture. Transparent background, character centered with even margins, full body visible including feet. Sticker style, clean edges, high contrast. No background, no shadow under the feet, no text, no perspective, not 3d, not realistic, no props.
```

## Белые

```
Flat vector cartoon character, full body, front view, standing straight, symmetrical, arms relaxed slightly away from the body. Chibi proportions: the head is one third of the total height, the body is short and sturdy. The character is a young man wearing only plain white boxer briefs with a grey waistband, nothing else, bare chest, bare feet. Slim build, light skin. Completely bald head, no hair at all. Slightly awkward but confident pose, faintly amused expression. Simple face: white rectangular eyes with a black outline, thick straight black eyebrows, tiny nose, single line mouth, one small hoop earring in the left ear. Thick uniform black outline of even weight across the whole figure, flat fills only, no shading, no gradients, no texture. Transparent background, character centered with even margins, full body visible including feet. Sticker style, clean edges, high contrast. No background, no shadow under the feet, no text, no perspective, not 3d, not realistic, no props.
```

## Сердечки

```
Flat vector cartoon character, full body, front view, standing straight, symmetrical, arms relaxed slightly away from the body. Chibi proportions: the head is one third of the total height, the body is short and sturdy. The character is a young man wearing only white boxer briefs covered in small red hearts, nothing else, bare chest, bare feet. Stocky build, light skin. Completely bald head, no hair at all. Slightly embarrassed but proud pose, faintly amused expression. Simple face: white rectangular eyes with a black outline, thick straight black eyebrows, tiny nose, single line mouth, one small hoop earring in the left ear. Thick uniform black outline of even weight across the whole figure, flat fills only, no shading, no gradients, no texture. Transparent background, character centered with even margins, full body visible including feet. Sticker style, clean edges, high contrast. No background, no shadow under the feet, no text, no perspective, not 3d, not realistic, no props.
```

## Полоска

```
Flat vector cartoon character, full body, front view, standing straight, symmetrical, arms relaxed slightly away from the body. Chibi proportions: the head is one third of the total height, the body is short and sturdy. The character is a young man wearing only blue and white horizontally striped boxer briefs, nothing else, bare chest, bare feet. Average build, brown skin. Completely bald head, no hair at all. Slightly awkward but confident pose, faintly amused expression. Simple face: white rectangular eyes with a black outline, thick straight black eyebrows, tiny nose, single line mouth, one small hoop earring in the left ear. Thick uniform black outline of even weight across the whole figure, flat fills only, no shading, no gradients, no texture. Transparent background, character centered with even margins, full body visible including feet. Sticker style, clean edges, high contrast. No background, no shadow under the feet, no text, no perspective, not 3d, not realistic, no props.
```

## Огонь

```
Flat vector cartoon character, full body, front view, standing straight, symmetrical, arms relaxed slightly away from the body. Chibi proportions: the head is one third of the total height, the body is short and sturdy. The character is a young man wearing only black boxer briefs with an orange flame print along the sides, nothing else, bare chest, bare feet. Athletic build, dark skin. Completely bald head, no hair at all. Slightly awkward but confident pose, faintly amused expression. Simple face: white rectangular eyes with a black outline, thick straight black eyebrows, tiny nose, single line mouth, one small hoop earring in the left ear. Thick uniform black outline of even weight across the whole figure, flat fills only, no shading, no gradients, no texture. Transparent background, character centered with even margins, full body visible including feet. Sticker style, clean edges, high contrast. No background, no shadow under the feet, no text, no perspective, not 3d, not realistic, no props.
```

## Бананы

```
Flat vector cartoon character, full body, front view, standing straight, symmetrical, arms relaxed slightly away from the body. Chibi proportions: the head is one third of the total height, the body is short and sturdy. The character is a young man wearing only bright yellow boxer briefs covered in small banana prints, nothing else, bare chest, bare feet. Slim build, tan skin. Completely bald head, no hair at all. Slightly ridiculous but very confident pose, faintly amused expression. Simple face: white rectangular eyes with a black outline, thick straight black eyebrows, tiny nose, single line mouth, one small hoop earring in the left ear. Thick uniform black outline of even weight across the whole figure, flat fills only, no shading, no gradients, no texture. Transparent background, character centered with even margins, full body visible including feet. Sticker style, clean edges, high contrast. No background, no shadow under the feet, no text, no perspective, not 3d, not realistic, no props.
```

## Мятные

```
Flat vector cartoon character, full body, front view, standing straight, symmetrical, arms relaxed slightly away from the body. Chibi proportions: the head is one third of the total height, the body is short and sturdy. The character is a young man wearing only mint green boxer briefs, color hex 8EFF8E, nothing else, bare chest, bare feet. Average build, light skin. Completely bald head, no hair at all. Slightly awkward but confident pose, faintly amused expression. Simple face: white rectangular eyes with a black outline, thick straight black eyebrows, tiny nose, single line mouth, one small hoop earring in the left ear. Thick uniform black outline of even weight across the whole figure, flat fills only, no shading, no gradients, no texture. Transparent background, character centered with even margins, full body visible including feet. Sticker style, clean edges, high contrast. No background, no shadow under the feet, no text, no perspective, not 3d, not realistic, no props.
```

---

# 2 · Причёски

Отдельные файлы. Без головы, без лица, без тела. Накладываются на лысую базу.

## Ирокез

```
A single hairstyle asset only, nothing else in the image. A bright orange mohawk with sharp spikes, drawn as a flat vector shape with a thick uniform black outline and a flat fill, no shading and no gradients. It is drawn as if worn on a bald head that is 260 pixels wide, sitting along the top of the skull line, so it can be layered onto a character. Front view, symmetrical, centered on a transparent background. No head, no face, no ears, no neck, no body, no background, no shadow, no text. Sticker style, clean edges.
```

## Кудри

```
A single hairstyle asset only, nothing else in the image. Short dark brown curly hair with a rounded silhouette and a few visible curl shapes, drawn as a flat vector shape with a thick uniform black outline and a flat fill, no shading and no gradients. It is drawn as if worn on a bald head that is 260 pixels wide, sitting along the top of the skull line, so it can be layered onto a character. Front view, symmetrical, centered on a transparent background. No head, no face, no ears, no neck, no body, no background, no shadow, no text. Sticker style, clean edges.
```

## Бокс

```
A single hairstyle asset only, nothing else in the image. A very short black buzz cut with a clean straight hairline, drawn as a flat vector shape with a thick uniform black outline and a flat fill, no shading and no gradients. It is drawn as if worn on a bald head that is 260 pixels wide, sitting along the top of the skull line, so it can be layered onto a character. Front view, symmetrical, centered on a transparent background. No head, no face, no ears, no neck, no body, no background, no shadow, no text. Sticker style, clean edges.
```

## Обесцвеченные

```
A single hairstyle asset only, nothing else in the image. Short bleached blond hair with visible dark roots at the top, slightly messy, drawn as a flat vector shape with a thick uniform black outline and flat two tone fill, no shading and no gradients. It is drawn as if worn on a bald head that is 260 pixels wide, sitting along the top of the skull line, so it can be layered onto a character. Front view, symmetrical, centered on a transparent background. No head, no face, no ears, no neck, no body, no background, no shadow, no text. Sticker style, clean edges.
```

## Косички

```
A single hairstyle asset only, nothing else in the image. Black cornrow braids running straight back across the scalp, with the braid lines visible as simple parallel strokes, drawn as a flat vector shape with a thick uniform black outline and a flat fill, no shading and no gradients. It is drawn as if worn on a bald head that is 260 pixels wide, sitting along the top of the skull line, so it can be layered onto a character. Front view, symmetrical, centered on a transparent background. No head, no face, no ears, no neck, no body, no background, no shadow, no text. Sticker style, clean edges.
```

## Длинные

```
A single hairstyle asset only, nothing else in the image. Straight black shoulder length hair with a center part, framing where the face would be, drawn as a flat vector shape with a thick uniform black outline and a flat fill, no shading and no gradients. It is drawn as if worn on a bald head that is 260 pixels wide, sitting along the top of the skull line, so it can be layered onto a character. Front view, symmetrical, centered on a transparent background. No head, no face, no ears, no neck, no body, no background, no shadow, no text. Sticker style, clean edges.
```

## Пучок

```
A single hairstyle asset only, nothing else in the image. Dark hair pulled back into a top knot bun, with the bun sitting high above the skull line and the sides smooth, drawn as a flat vector shape with a thick uniform black outline and a flat fill, no shading and no gradients. It is drawn as if worn on a bald head that is 260 pixels wide, sitting along the top of the skull line, so it can be layered onto a character. Front view, symmetrical, centered on a transparent background. No head, no face, no ears, no neck, no body, no background, no shadow, no text. Sticker style, clean edges.
```

## Кепка

```
A single headwear asset only, nothing else in the image. A black snapback cap worn backwards, with the flat brim pointing behind the head and the strap visible at the front, drawn as a flat vector shape with a thick uniform black outline and a flat fill, no shading and no gradients. It is drawn as if worn on a bald head that is 260 pixels wide, sitting along the top of the skull line, so it can be layered onto a character. Front view, symmetrical, centered on a transparent background. No head, no face, no ears, no neck, no body, no background, no shadow, no text. Sticker style, clean edges.
```

## Бандана

```
A single headwear asset only, nothing else in the image. A mint green bandana, hex 8EFF8E, tied around the head with the knot and two short tails hanging on the right side, drawn as a flat vector shape with a thick uniform black outline and a flat fill, no shading and no gradients. It is drawn as if worn on a bald head that is 260 pixels wide, sitting along the top of the skull line, so it can be layered onto a character. Front view, symmetrical, centered on a transparent background. No head, no face, no ears, no neck, no body, no background, no shadow, no text. Sticker style, clean edges.
```

---

# 3 · Одежда

Работает поверх базы. Порядок: прикрепи в чат PNG базы, следом вставь промпт.

## Бэнд-ти и бэгги

```
Use the attached character image. Same character, same pose, same face, same body proportions, same art style. Now he is dressed in an oversized black band t-shirt with a white skull print on the chest, wide baggy light blue jeans that break over the shoes, black low top canvas sneakers with white soles and white crew socks. Keep the thick uniform black outline of even weight, flat fills only, no shading, no gradients, no texture. Keep the head, the face and the proportions exactly as they are, change only the clothing. Transparent background, character centered with even margins, full body visible. Sticker style, clean edges. No background, no shadow under the feet, no text, not 3d, not realistic.
```

## Худи и карго

```
Use the attached character image. Same character, same pose, same face, same body proportions, same art style. Now he is dressed in an oversized mint green hoodie, hex 8EFF8E, with the hood down and a front pocket, olive green cargo shorts ending above the knee with visible side pockets, chunky white sneakers with white crew socks. Keep the thick uniform black outline of even weight, flat fills only, no shading, no gradients, no texture. Keep the head, the face and the proportions exactly as they are, change only the clothing. Transparent background, character centered with even margins, full body visible. Sticker style, clean edges. No background, no shadow under the feet, no text, not 3d, not realistic.
```

## Майка и чёрные шорты

```
Use the attached character image. Same character, same pose, same face, same body proportions, same art style. Now he is dressed in a white ribbed tank top, plain black shorts ending above the knee, black slides worn with white crew socks. Keep the thick uniform black outline of even weight, flat fills only, no shading, no gradients, no texture. Keep the head, the face and the proportions exactly as they are, change only the clothing. Transparent background, character centered with even margins, full body visible. Sticker style, clean edges. No background, no shadow under the feet, no text, not 3d, not realistic.
```

## Свитшот и рваные джинсы

```
Use the attached character image. Same character, same pose, same face, same body proportions, same art style. Now he is dressed in an oversized navy blue crewneck sweatshirt, wide ripped grey jeans with torn knees, black low top canvas sneakers with white soles and white crew socks. Keep the thick uniform black outline of even weight, flat fills only, no shading, no gradients, no texture. Keep the head, the face and the proportions exactly as they are, change only the clothing. Transparent background, character centered with even margins, full body visible. Sticker style, clean edges. No background, no shadow under the feet, no text, not 3d, not realistic.
```

## Рашгард и шорты для грепплинга

```
Use the attached character image. Same character, same pose, same face, same body proportions, same art style. Now he is dressed in a purple long sleeve rashguard, hex 736CED, fitted to the body, black grappling shorts ending above the knee, and he is barefoot. Keep the thick uniform black outline of even weight, flat fills only, no shading, no gradients, no texture. Keep the head, the face and the proportions exactly as they are, change only the clothing. Transparent background, character centered with even margins, full body visible. Sticker style, clean edges. No background, no shadow under the feet, no text, not 3d, not realistic.
```

## Ги

```
Use the attached character image. Same character, same pose, same face, same body proportions, same art style. Now he is dressed in a white brazilian jiu jitsu gi: a thick white jacket with a wide overlapping collar, matching white trousers, and a white belt tied at the waist with a simple knot. He is barefoot. Keep the thick uniform black outline of even weight, flat fills only, no shading, no gradients, no texture. Keep the head, the face and the proportions exactly as they are, change only the clothing. Transparent background, character centered with even margins, full body visible. Sticker style, clean edges. No background, no shadow under the feet, no text, not 3d, not realistic.
```

## Беговой комплект

```
Use the attached character image. Same character, same pose, same face, same body proportions, same art style. Now he is dressed in a bright yellow sleeveless running singlet, short black running shorts, mint green running shoes, hex 8EFF8E, with white ankle socks. Keep the thick uniform black outline of even weight, flat fills only, no shading, no gradients, no texture. Keep the head, the face and the proportions exactly as they are, change only the clothing. Transparent background, character centered with even margins, full body visible. Sticker style, clean edges. No background, no shadow under the feet, no text, not 3d, not realistic.
```

## Домашний комплект

```
Use the attached character image. Same character, same pose, same face, same body proportions, same art style. Now he is dressed in a washed black long sleeve tee with the sleeves slightly pushed up, dark grey sweatpants, and white crew socks with no shoes. Keep the thick uniform black outline of even weight, flat fills only, no shading, no gradients, no texture. Keep the head, the face and the proportions exactly as they are, change only the clothing. Transparent background, character centered with even margins, full body visible. Sticker style, clean edges. No background, no shadow under the feet, no text, not 3d, not realistic.
```

## Косуха

```
Use the attached character image. Same character, same pose, same face, same body proportions, same art style. Now he is dressed in a black leather biker jacket with silver studs on the shoulders worn over a white t-shirt, black skinny jeans, and black boots. Keep the thick uniform black outline of even weight, flat fills only, no shading, no gradients, no texture. Keep the head, the face and the proportions exactly as they are, change only the clothing. Transparent background, character centered with even margins, full body visible. Sticker style, clean edges. No background, no shadow under the feet, no text, not 3d, not realistic.
```

## Разгрузочный день

```
Use the attached character image. Same character, same pose, same face, same body proportions, same art style. Now he is dressed in an oversized plain white t-shirt, loose light beige linen trousers, and purple slides, hex 9F9FED, worn with white socks. Keep the thick uniform black outline of even weight, flat fills only, no shading, no gradients, no texture. Keep the head, the face and the proportions exactly as they are, change only the clothing. Transparent background, character centered with even margins, full body visible. Sticker style, clean edges. No background, no shadow under the feet, no text, not 3d, not realistic.
```

---

# 4 · Приёмка

Картинка годится, только если проходит все четыре проверки:

1. **Силуэт.** Залей фигуру сплошным чёрным. Узнаётся? Если нет, форма слишком дробная.
2. **Толщина линии.** Одна на всей фигуре. Если на мелких деталях линия тоньше, это уже другой стиль, и рядом с остальными будет заметно.
3. **64 пикселя.** Уменьши до размера иконки. Лицо читается? Если нет, деталей слишком много.
4. **Поля.** По центру, фон реально прозрачный, тени под ногами нет.

Не прошло хотя бы одну, перегенерируй тем же промптом. Руками не правь: ручная правка одной картинки и есть то, из-за чего потом разъезжается весь набор.

Начни с двух баз, двух причёсок и двух образов. Посмотри их рядом в одном масштабе, и только потом делай остальные.
