# -*- coding: utf-8 -*-
"""桌面图标生成：紫圆角方块 + 三条白线（与浏览器插件同视觉）。
输出 desktop/assets/icon.png (1024) 与 icon.ico (16/32/48/64/128/256)。"""
import os
from PIL import Image, ImageDraw

S = 4096          # 4x 超采样抗锯齿
OUT = 1024
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # desktop/
ASSETS = os.path.join(BASE, 'assets')
os.makedirs(ASSETS, exist_ok=True)

img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# —— 圆角方块 + 对角渐变 ——
TL = (109, 93, 246)    # #6D5DF6
BR = (165, 90, 243)    # #A55AF3
grad = Image.new('RGBA', (S, S))
gd = ImageDraw.Draw(grad)
for i in range(S):
    t = i / (S - 1)
    gd.line([(0, i), (S, i)], fill=(
        int(TL[0] + (BR[0] - TL[0]) * t),
        int(TL[1] + (BR[1] - TL[1]) * t),
        int(TL[2] + (BR[2] - TL[2]) * t), 255))
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.235), fill=255)
img.paste(grad, (0, 0), mask)

# —— 三条白色圆头线（长 / 中 / 短） ——
stroke = int(S * 0.078)
cx0 = int(S * 0.205)
widths = [0.59, 0.505, 0.335]
ys = [0.375, 0.50, 0.625]
d = ImageDraw.Draw(img)
for w, y in zip(widths, ys):
    x0, x1 = cx0, int(S * w) + cx0
    yc = int(S * y)
    d.rounded_rectangle([x0, yc - stroke // 2, x1, yc + stroke // 2],
                        radius=stroke // 2, fill=(255, 255, 255, 255))

# —— 缩放出图 ——
icon = img.resize((OUT, OUT), Image.LANCZOS)
icon.save(os.path.join(ASSETS, 'icon.png'))

# —— ICO：多尺寸嵌入（PIL 以 PNG 数据写入各尺寸） ——
icon.save(os.path.join(ASSETS, 'icon.ico'),
          sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

print('icon.png', os.path.getsize(os.path.join(ASSETS, 'icon.png')), 'bytes')
print('icon.ico', os.path.getsize(os.path.join(ASSETS, 'icon.ico')), 'bytes')
