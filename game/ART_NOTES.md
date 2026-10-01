# 本地原创素材说明

本轮使用内置 imagegen 生成透明 PNG，再保存到本项目。角色参考本项目已有的原创 `actors.png`，没有使用 Warcraft 素材。PNG 保留透明通道；运行时依据源矩形和脚底锚点播放，避免不同帧的武器伸展导致角色跳位。

- `assets/walls.png`：石墙、加固墙、符文墙，三列一行。运行时提取每列透明边界用于绘制。
- `assets/elf-work.png`：精灵准备、举锤、前击、收锤，四帧横排。
- `assets/troll-attack.png`：巨魔蓄力、举锤、命中、收招，四帧横排。
- `assets/actors.png`：沿用行走素材，改为精确源矩形裁切，避免相邻动作串帧。

## 最终生成提示词

### 主墙

Create a production-ready transparent PNG game sprite sheet for an original snowy fantasy RTS browser game. Three equal square cells in one horizontal row, exact 3-column 1-row grid, no text, no labels, no borders. Each cell contains ONE complete solid defensive wall barrier, viewed orthographically from a steep 55-degree overhead game camera. The wall runs NORTH-SOUTH in screen space: long axis vertical in image, blocking an east-west narrow road; show its broad WEST-facing masonry side and snowy top, not a front-facing horizontal castle wall. Cell 1 rugged low grey-blue stone wall with rough uneven rocks and snow caps. Cell 2 reinforced tall stone wall with dark iron bands and stout end pillars. Cell 3 ornate fortified dark stone wall with subtle cyan runes, metal buttresses, glowing icy crystal caps. Consistent wall footprint and centered ground anchor across all cells, whole sprite contained with 12 percent transparent margin. No door, no doorway, no arch, no gap: each is an unbroken barrier. Detailed hand-painted 3D pre-rendered game art, crisp readable silhouettes, cool slate stones, subtle warm brass accents, snow highlights, ambient occlusion and soft small ground contact shadow. Match an elegant original high-fantasy snowy forest RTS. No logos, no copyrighted game assets. All background genuinely transparent, no terrain tile, no floor platform, no checkerboard.

### 精灵施工

Create ONE horizontal animation strip, FOUR columns in ONE ROW ONLY on a transparent wide canvas. Reference attached sheet only for identity: blonde elf adult with pointed ears, teal cape, brown leather, hand-painted pre-rendered 3D fantasy RTS. Show only that elf, four sequential standing wall-repair poses facing right: ready with hammer, hammer raised, hammer extended striking forward at chest height, recovery. No anvil, no table, no block, no wall, no floor shadow. Each frame entirely inside its own quarter of image width, ample 15% empty space per cell. All four identical scale, head size, feet planted on SAME horizontal baseline at 85% image height. Full body visible including hammer in highest pose, no clipping anywhere. Fixed orthographic 3/4 overhead camera, original game asset, no text or labels, transparent background.

### 巨魔攻击

Create ONE horizontal animation strip, FOUR columns in ONE ROW ONLY on a transparent wide canvas. Reference attached sheet only for identity: same original blue-grey large muscular troll, fur shoulders, leather, stone maul, pre-rendered painterly 3D fantasy RTS. Show only troll, four sequential attack poses facing LEFT: windup maul drawn back, maul raised high overhead, powerful maul impact strike toward left at chest height, recovery. Each frame entirely inside its own quarter of canvas width, 15% empty margins. All four frames same body proportions, same scale, same feet baseline at 85% canvas height. Full character and maul in highest pose fits completely within frame, no clipping. Fixed orthographic 3/4 overhead camera, cool natural lighting, transparent background, no floor or props, no text, labels, borders, no copyrighted designs.

生成图没有严格遵守等宽分格，因此代码使用实际透明轮廓的源矩形，不直接平均切图。
