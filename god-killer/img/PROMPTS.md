# รายการภาพของ God Killer

ตอนนี้ภาพครบทุกไฟล์แล้ว (สร้างด้วย Leonardo.ai แล้วตัดเป็น 256×256) ถ้ามีภาพที่สวยกว่า ใช้ชื่อไฟล์เดิมทับได้เลย · `make_art.py` คือภาพวาดเวกเตอร์ชุดสำรอง ถ้ารันจะเขียนทับภาพทั้งหมด

วางไฟล์ภาพตามชื่อในตารางลงโฟลเดอร์นี้ (`god-killer/img/<หมวด>/<เลข>.webp`) แล้ว push ภาพจะขึ้นในเกมเอง ไม่ต้องแก้โค้ด
ถ้ายังไม่มีไฟล์ เกมจะแสดงตราสัญลักษณ์สีแทน

- ขนาด: 512×512 พิกเซล ไฟล์ .webp (แปลงด้วย squoosh.app ให้ไฟล์ละไม่เกิน ~60 KB)
- ภาพจะถูกครอปเป็นวงกลม ให้หน้าหรือตัวละครอยู่กลางภาพ
- ใช้ style เดียวกันทุกภาพ เพื่อให้เป็นชุดเดียวกัน (ต่อท้ายทุก prompt ด้วยข้อความนี้):

```
dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square
```

## เทพ (การ์ดสนามต่อสู้) — `gods/`

| ไฟล์ | ชื่อ | prompt |
|---|---|---|
| `gods/01.webp` | จอมเทพอัสนี | god of thunder, crackling blue lightning crown, stern eyes, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `gods/02.webp` | เทพสงครามกระบี่โลหิต | god of war, crimson armor, scarred face, twin spears, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `gods/03.webp` | ราชันยมโลก | god of death, pale lavender robes, skull mask, spirit wisps, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `gods/04.webp` | เทพีลิขิตฟ้า | goddess of fate, golden threads of destiny, blindfold, spinning wheel halo, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `gods/05.webp` | ราชามังกรทะเลบูรพา | god of the sea, teal scales, coral crown, crashing waves, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `gods/06.webp` | เทพเพลิงจูหรง | god of fire, burning orange hair, molten skin cracks, embers, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `gods/07.webp` | เซียนเฒ่ากาลเวลา | god of time, clockwork halo, sand flowing from hands, ageless face, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `gods/08.webp` | เทพธิดาฉางเอ๋อ | moon goddess, silver hair, crescent moon diadem, cold moonlight, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `gods/09.webp` | จักรพรรดิสุริยัน | sun god, blinding golden sun disc halo, radiant armor, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `gods/10.webp` | จักรพรรดิหยก | supreme king of gods, many-layered cosmic halo, galaxy robes, overwhelming presence, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |

## สิ่งมีชีวิตสูงสุด (บอส UB) — `ultimates/`

| ไฟล์ | ชื่อ | prompt |
|---|---|---|
| `ultimates/01.webp` | เทพพิทักษ์ประตูสวรรค์ | sky guardian titan, ice-blue wings of light, celestial armor, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `ultimates/02.webp` | อสูรโกลาหลฮุ่นตุ้น | chaos demon, violet void flesh, many eyes, shifting shapes, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `ultimates/03.webp` | ปฐมเทพผานกู่ | nameless primordial being, faceless white silhouette, reality cracking around it, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |

## มอนสเตอร์ — `monsters/`

| ไฟล์ | ชื่อ | prompt |
|---|---|---|
| `monsters/01.webp` | วิญญาณหมอกพันปี | mist spirit, translucent ghost in fog, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `monsters/02.webp` | หมาป่าอสูรเงา | shadow wolf, black smoke fur, glowing eyes, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `monsters/03.webp` | หุ่นศิลาเฝ้าสุสาน | stone golem, mossy rock body, glowing runes, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `monsters/04.webp` | อสรพิษทมิฬพันพิษ | black venom serpent, dripping green poison, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `monsters/05.webp` | ปีศาจเพลิงนรก | fire demon, horns, burning body, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `monsters/06.webp` | ยักษ์เฝ้าขุนเขา | mountain giant, Thai yaksha guardian style, stone crown, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `monsters/07.webp` | เทพพระเจ้ามักกร | Makara, mythical Thai sea beast, crocodile body with elephant trunk snout, fish tail, golden Thai scales, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `monsters/08.webp` | อสูรอัสนีปีกดำ | lightning demon, storm wings, electric claws, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `monsters/09.webp` | อสูรกงล้อกาล | time demon, broken clock face, fractured hourglass, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `monsters/10.webp` | จักรพรรดิมาร | demon king, obsidian throne armor, burning red crown, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |

## สัตว์เลี้ยง — `pets/`

| ไฟล์ | ชื่อ | prompt |
|---|---|---|
| `pets/01.webp` | กระเรียนหยก | jade crane, elegant, glowing green feathers, cute companion, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `pets/02.webp` | จิ้งจอกเก้าหาง | nine-tailed fox, orange fur, spirit flames, cute companion, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `pets/03.webp` | เต่าดำเสวียนอู่ | sacred turtle, blue shell with glowing runes, cute companion, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `pets/04.webp` | พยัคฆ์เพลิง | flame tiger cub, red-orange stripes of fire, cute companion, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `pets/05.webp` | นกเพลิงจูเชว่ | fire phoenix hamsa, Thai-style golden swan of flame, cute companion, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `pets/06.webp` | กิเลนสวรรค์ | celestial qilin, golden scales, cloud hooves, cute companion, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |

## ดันเจียน (ภาพสถานที่ ใช้ prompt แบบ landscape icon) — `dungeons/`

| ไฟล์ | ชื่อ | prompt |
|---|---|---|
| `dungeons/01.webp` | ถ้ำผลึกวิญญาณ | crystal cave entrance, glowing blue crystals, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `dungeons/02.webp` | ป่าอสูรหมื่นลี้ | cursed forest, twisted trees, purple mist, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `dungeons/03.webp` | ภูผาเพลิงนรก | hellish volcano, lava rivers, ash sky, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |
| `dungeons/04.webp` | วังมังกรใต้สมุทร | undersea palace, Thai temple spires, bioluminescent coral, dark mythic Thai-fantasy, painterly digital art, bust portrait, centered, dramatic rim light, deep indigo background, ornate gold details, high detail, no text, square |

## ตัวเอก (ภาพในสนามต่อสู้) — `hero/`

ตอนนี้ `hero/01.webp` คือภาพที่เรนเดอร์จาก SVG ใน `god-killer/icons.js` (ใช้ภาพ SVG นั้นแทนเมื่อโหลดไฟล์ไม่ได้) ถ้าสร้างภาพ AI แล้ว ใช้ชื่อไฟล์เดิมทับได้เลย

| ไฟล์ | ชื่อ | prompt |
|---|---|---|
| `hero/01.webp` | ท่าน (ตัวเอก) | young male cultivator swordsman, long black hair in a topknot with gold hairpin, flowing hair in the wind, dark jade hanfu robe with gold trim and red sash, holding an upright jian sword whose edge glows jade, swirling qi aura and faint gold rings behind him, calm determined face, bust portrait, centered, round-frame composition, xianxia cultivation fantasy, Chinese ink-wash painting with fine gold linework, ink-black and deep indigo background, soft jade qi glow, cinnabar accents, painterly digital art, high detail, no text, square |

## ไอคอน (ฝึกกาย วิชาเวท สร้าง อุปกรณ์ วัตถุดิบ)

ตอนนี้ไอคอนเหล่านี้เป็น SVG ที่วาดด้วยโค้ดใน `god-killer/icons.js` ถ้าจะเปลี่ยนเป็นภาพ AI ให้ตั้งชื่อตามคอลัมน์แรก (เช่น `icons/train-1.webp`, 128×128) แล้วต้องต่อโค้ดใน `GKICONS.badge` เพิ่มให้โหลดไฟล์ก่อน
ไอคอนแสดงเล็กมาก (30 พิกเซล) ให้ใช้รูปทรงเดียวชัด ๆ ไม่มีรายละเอียดเล็ก ต่อท้ายทุก prompt ด้วย:

```
Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square
```

| ไฟล์ | ชื่อ | prompt |
|---|---|---|
| `icons/train-1.webp` | ยืนม้า | young martial artist in a deep horse stance, fists forward, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/train-2.webp` | ชกหุ่นไม้ | wooden wing chun training dummy with three arms, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/train-3.webp` | วิ่งบันไดพันขั้น | endless stone stairway up a misty mountain, red sun, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/train-4.webp` | ว่ายทวนน้ำตก | golden carp swimming up a roaring waterfall, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/train-5.webp` | ชกศิลา | cracked boulder split by a single punch, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/train-6.webp` | แบกภูผา | tiny cultivator lifting a whole mountain over his head, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/train-7.webp` | ยืนฝ่าอัสนี | heavenly lightning bolt striking down from a storm cloud, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/train-8.webp` | ต้านพายุสวรรค์ | spiralling celestial storm vortex, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/skill-1.webp` | เคล็ดลมปราณเบื้องต้น | meditating cultivator in lotus pose inside a ring of qi, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/skill-2.webp` | หมัดพยัคฆ์คู่ | three glowing tiger claw slashes, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/skill-3.webp` | เกราะชี่คุ้มกาย | cultivator inside a hexagonal jade qi barrier, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/skill-4.webp` | วิชาตัวเบา | floating feather drifting over a cloud wisp, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/skill-5.webp` | ฝ่ามือเพลิงหยาง | open palm wreathed in yang fire, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/skill-6.webp` | เนตรทิพย์ส่องฟ้า | radiant third eye opening in the sky, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/skill-7.webp` | กระบี่จิตไร้รูป | flying sword with a translucent jade after-image, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/skill-8.webp` | ตราผนึกเทพ | yellow Taoist talisman with red sealing script inside a seal ring, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/create-clone.webp` | ร่างเงา | cultivator with a translucent shadow clone beside him, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/create-light.webp` | แสงสวรรค์ | radiant heavenly sun with eight brush rays, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/create-stone.webp` | ศิลา | balanced stack of smooth river stones, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/create-soil.webp` | ปฐพี | mound of layered earth with a small sprout, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/create-air.webp` | วายุ | curling wind streams in cloud-scroll style, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/create-water.webp` | ธารา | water droplet holding small waves, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/create-plant.webp` | พฤกษา | bamboo stalk with brush-painted leaves, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/create-beast.webp` | สัตว์ป่า | sika deer head with antlers, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/create-human.webp` | มนุษย์ | the Chinese brush character for person with a red seal stamp, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/gear-weapon.webp` | กระบี่สังหารเทพ | straight jian sword with a pale jade blade and red tassel, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/gear-armor.webp` | เสื้อเกราะเทวะ | lamellar armour with round chest mirror and shoulder guards, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/gear-ring.webp` | แหวนหยกศรัทธา | gold ring set with a faceted jade stone, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/gear-amulet.webp` | จี้หยกวิญญาณ | jade bi disc pendant on a cord with red tassel, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/mat-ore.webp` | แร่ผลึกวิญญาณ | cluster of glowing jade spirit crystals, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/mat-wood.webp` | ไม้หอมพันปี | slice of ancient fragrant agarwood with growth rings, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/mat-ember.webp` | แก่นเพลิงหยาง | core of yang fire, orange flame with golden heart, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |
| `icons/mat-pearl.webp` | ไข่มุกมังกร | luminous dragon pearl circled by golden flame wisps, Chinese ink-brush game icon, bold gold brush strokes with jade and cinnabar accents, soft golden glow, single centered emblem on a plain ink-black circle, xianxia cultivation style, clean silhouette readable at 32 pixels, no text, no border, square |

## เครื่องมือแนะนำ

- Leonardo.ai หรือ Scenario.gg: สร้างภาพจาก prompt ข้างบน (Scenario ฝึกสไตล์ให้ทั้งชุดเหมือนกันได้)
- remove.bg: ลบพื้นหลัง · Upscayl: ขยายภาพ · squoosh.app: แปลงเป็น WebP
