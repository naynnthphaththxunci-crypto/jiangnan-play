#!/usr/bin/env python3
"""会话里的切图脚本，原样留档。

只适合重切棋子。不要整文件重跑：
- cut_customer 按圆裁，下半身会留一道弧。
- white_key 是 idle_preview 的全局色键，会把白毛抠穿，并把按钮压成方图。
客人成品是后来用边缘向内 flood fill 另抠的，不在这个文件里。
登录按钮要用 login_v2，不要用本脚本读的 /tmp/v8login。
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

PACK = Path("/tmp/v8pack/pack")
ROOT = Path("/workspace")
ITEMS = ROOT / "src/assets/items"
GUESTS = ROOT / "src/assets/guests"
UI = ROOT / "src/assets/ui"
ART = Path("/opt/cursor/artifacts")
ITEMS.mkdir(parents=True, exist_ok=True)
GUESTS.mkdir(parents=True, exist_ok=True)
UI.mkdir(parents=True, exist_ok=True)
ART.mkdir(parents=True, exist_ok=True)

def white_key(im: Image.Image, tolerance: float = 45, feather: float = 15) -> Image.Image:
    """Port of idle_preview.html: corner color, distance threshold, feathered edge."""
    rgba = im.convert("RGBA")
    arr = np.array(rgba).astype(np.float32)
    corners = np.stack([arr[0, 0, :3], arr[0, -1, :3], arr[-1, 0, :3], arr[-1, -1, :3]])
    bg = corners.mean(axis=0)
    dist = np.sqrt(((arr[:, :, :3] - bg) ** 2).sum(axis=2))
    alpha = arr[:, :, 3]
    alpha = np.where(dist < tolerance, 0, alpha)
    band = (dist >= tolerance) & (dist < tolerance + feather)
    alpha = np.where(band, np.floor(255 * ((dist - tolerance) / feather)), alpha)
    arr[:, :, 3] = np.clip(alpha, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")

def flood_clear(im: Image.Image, seeds, tol: float) -> Image.Image:
    """Connected background removal. seeds are (y, x). Uses Pillow's flood fill."""
    rgba = im.convert("RGBA")
    work = rgba.copy()
    sentinel = (255, 0, 255, 255)
    h, w = work.size[1], work.size[0]
    for y, x in seeds:
        if not (0 <= x < w and 0 <= y < h):
            continue
        pix = work.getpixel((x, y))
        if pix[0] == 255 and pix[1] == 0 and pix[2] == 255:
            continue
        ImageDraw.floodfill(work, (x, y), sentinel, thresh=int(tol))
    arr = np.array(work)
    src = np.array(rgba)
    hit = (arr[:, :, 0] == 255) & (arr[:, :, 1] == 0) & (arr[:, :, 2] == 255)
    src[hit, 3] = 0
    return Image.fromarray(src, "RGBA")

def cut_customer(im: Image.Image) -> Image.Image:
    """Colored disc plus a ring. Ears may stick out, so the radius is the median edge, not the bounding box."""
    rgba = im.convert("RGBA")
    w, h = rgba.size
    edge = [(0, x) for x in range(0, w, 4)] + [(h - 1, x) for x in range(0, w, 4)]
    edge += [(y, 0) for y in range(0, h, 4)] + [(y, w - 1) for y in range(0, h, 4)]
    cut = flood_clear(rgba, edge, 28)
    arr = np.array(cut)
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 40)
    if len(xs) < 10:
        return cut
    cx = float(np.median(xs))
    cy = float(np.median(ys))
    radii = []
    for deg in range(0, 360, 6):
        ang = math.radians(deg)
        for step in range(int(max(w, h) * 0.7), 0, -2):
            x = int(cx + math.cos(ang) * step)
            y = int(cy + math.sin(ang) * step)
            if 0 <= x < w and 0 <= y < h and alpha[y, x] > 40:
                radii.append(step)
                break
    rad = float(np.median(radii)) if radii else min(w, h) * 0.45
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    # Drop the ring itself. Ears beyond the ring stay.
    ring = (np.abs(dist - rad) < rad * 0.045) & (alpha > 20)
    arr[ring, 3] = 0
    cut = Image.fromarray(arr, "RGBA")
    # Interior wash: several seeds just inside the ring, away from the face at center.
    seeds = []
    for deg in (200, 220, 250, 290, 320, 20, 40):
        ang = math.radians(deg)
        seeds.append((int(cy + math.sin(ang) * rad * 0.78), int(cx + math.cos(ang) * rad * 0.78)))
    cut = flood_clear(cut, seeds, 38)
    arr = np.array(cut)
    # A second, slightly wider pass if a flat halo remains.
    alpha = arr[:, :, 3]
    halo = (dist > rad * 0.82) & (dist < rad * 0.98) & (alpha > 80)
    if halo.any():
        ys2, xs2 = np.where(halo)
        pick = int(len(xs2) / 2)
        cut = flood_clear(Image.fromarray(arr, "RGBA"), [(int(ys2[pick]), int(xs2[pick]))], 32)
    return cut

def cut_story(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    edge = [(0, x) for x in range(0, w, 3)] + [(h - 1, x) for x in range(0, w, 3)]
    edge += [(y, 0) for y in range(0, h, 3)] + [(y, w - 1) for y in range(0, h, 3)]
    return flood_clear(rgba, edge, 34)

def inset_box(box, frac=0.1, top_extra=0.0):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    return (
        int(x0 + w * frac),
        int(y0 + h * (frac + top_extra)),
        int(x1 - w * frac),
        int(y1 - h * frac),
    )

def save_tile(sheet: Image.Image, box, path: Path):
    crop = sheet.crop(box)
    crop.save(path)

def checker(w, h, cell=12):
    img = Image.new("RGB", (w, h), (255, 255, 255))
    dr = ImageDraw.Draw(img)
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            if (x // cell + y // cell) % 2 == 0:
                dr.rectangle([x, y, x + cell, y + cell], fill=(210, 210, 210))
    return img

def main():
    # --- chain tiles ---
    food = Image.open(PACK / "chain_cat_food_512.png")
    fish = Image.open(PACK / "chain_fish_basket_to_boat_512.png")
    bev = Image.open(PACK / "chain_beverage_512.png")
    toys = Image.open(PACK / "chain_toys_plants_beds_512.png")

    food_rows = [(188, 375), (462, 649), (735, 924)]
    food_cols = [(91, 213), (333, 456), (549, 725), (800, 964)]
    fish_rows = [(161, 389), (428, 667), (709, 984)]
    fish_cols = [(36, 260), (279, 504), (522, 747), (766, 990)]
    bev_rows = [(176, 425), (441, 702), (718, 999)]
    bev_cols = [(27, 257), (276, 504), (523, 751), (770, 1000)]
    toy_rows = [(37, 201), (354, 517), (673, 835)]
    toy_cols = [
        [(38, 192), (197, 351), (356, 509), (515, 668), (674, 827)],
        [(38, 192), (197, 351), (356, 509), (515, 668), (673, 827), (832, 986)],
        [(38, 192), (197, 351), (356, 510), (515, 668), (673, 827), (832, 986)],
    ]

    mapping = []

    def add(chain, level, name, sheet, pos, placeholder=False):
        mapping.append({
            "chain": chain, "level": level, "name": name,
            "source": sheet, "pos": pos, "placeholder": placeholder,
        })

    # food 1-11
    food_names = [
        "一撮猫草麦胚", "嫩绿小猫草", "瓦碟小鱼干", "粗陶鱼肉碎", "青瓷猫爪肉饼",
        "砂锅浓鱼汤", "铜雕小火锅", "双层朱漆食盒", "三层描金馔盒", "龙凤御膳锦瓮", "蓬莱百味宝鼎",
    ]
    n = 0
    for r, row in enumerate(food_rows):
        for c, col in enumerate(food_cols):
            n += 1
            if n > 11:
                continue
            box = inset_box((col[0], row[0], col[1], row[1]), 0.12)
            save_tile(food, box, ITEMS / f"food_{n}.png")
            add("猫粮", n, food_names[n - 1], "chain_cat_food_512.png", f"第{r+1}行第{c+1}格")

    boat_names = [
        "劈篾细竹条", "竹编捕鱼倒须", "粗编腰挎小鱼篓", "熟桐油防水鱼篓", "铜环活鱼大网兜",
        "带盖双耳深水篓", "临水双桨小竹排", "水乡摇橹乌篷船", "双橹张网捕鱼木船", "扬帆出水大飞驳", "豪华双桅金鳞宝船",
    ]
    n = 0
    for r, row in enumerate(fish_rows):
        cols = fish_cols if r < 2 else fish_cols[:3]
        for c, col in enumerate(cols):
            n += 1
            box = inset_box((col[0], row[0], col[1], row[1]), 0.08, top_extra=0.18)
            save_tile(fish, box, ITEMS / f"boat_{n}.png")
            note = f"第{r+1}行第{c+1}格，图内标 Lv.{n}"
            if n == 4:
                note += "（画面是金坛，和文案熟桐油鱼篓不完全一样，仍按标号）"
            add("鱼篓", n, boat_names[n - 1], "chain_fish_basket_to_boat_512.png", note)

    bev_names = [
        "一勺清洌山泉", "粗陶蓄水钵", "铜吊子滚沸水", "碎瓷粗碗凉茶", "青翠竹筒鲜果汁",
        "冷泡绿茶玻璃瓶", "陶罐冰镇酸梅汤", "宜兴紫砂大红袍", "荷叶碗雪梨羹", "醉仙玉石桃花酿", "瑶池百花神仙露",
    ]
    n = 0
    for r, row in enumerate(bev_rows):
        cols = bev_cols if r < 2 else bev_cols[:3]
        for c, col in enumerate(cols):
            n += 1
            box = inset_box((col[0], row[0], col[1], row[1]), 0.1, top_extra=0.16)
            save_tile(bev, box, ITEMS / f"bev_{n}.png")
            add("饮料", n, bev_names[n - 1], "chain_beverage_512.png", f"第{r+1}行第{c+1}格，图内标 Lv.{n}")

    # toys: 5 tiles, not 1:1 with levels 1-5
    toy_assign = [
        (2, "缠丝小麻球", "第1行第1格，蓝毛线球，按造型对到 2 级"),
        (3, "竹篾空心球", "第1行第2格，竹球带铃，按造型对到 3 级"),
        (6, "靛蓝布鱼偶", "第1行第3格，蓝布鱼，按造型对到 6 级"),
        (9, "机关走线木匣", "第1行第4格，木匣探出老鼠，按造型对到 9 级"),
        (10, "飞檐红木戏猫亭", "第1行第5格，小亭，按造型对到 10 级"),
    ]
    for i, (level, name, pos) in enumerate(toy_assign):
        col = toy_cols[0][i]
        row = toy_rows[0]
        box = inset_box((col[0], row[0], col[1], row[1]), 0.08)
        save_tile(toys, box, ITEMS / f"toy_{level}.png")
        add("玩具", level, name, "chain_toys_plants_beds_512.png", pos)
    for level, name in [
        (1, "一截麻绳头"), (4, "野雉羽逗猫竿"), (5, "柳条编织浅筐"),
        (7, "雕漆猫爬架"), (8, "竹编双层戏篓"), (11, "乾坤万趣百宝阁"),
    ]:
        add("玩具", level, name, "", "占位", True)

    plant_assign = [
        (2, "陶土泥钵小芽", "第2行第1格，陶盆双芽，对到 2 级"),
        (3, "青瓷香草小盆", "第2行第2格，蓝盆薄荷，对到 3 级"),
        (4, "案头青石菖蒲", "第2行第3格，河石青草，对到 4 级"),
        (5, "紫砂双色兰花钵", "第2行第4格，紫盆兰花，对到 5 级"),
        (7, "迎客微盘古松", "第2行第5格，松树盆景，对到 7 级"),
        (10, "荧光瑶台万寿松", "第2行第6格，发光松，对到 10 级"),
    ]
    for i, (level, name, pos) in enumerate(plant_assign):
        col = toy_cols[1][i]
        row = toy_rows[1]
        box = inset_box((col[0], row[0], col[1], row[1]), 0.08)
        save_tile(toys, box, ITEMS / f"plant_{level}.png")
        add("花盆", level, name, "chain_toys_plants_beds_512.png", pos)
    for level, name in [(1, "破瓦陶土片"), (6, "假山叠石水影盆"), (8, "白玉缠枝茶梅桩"), (9, "琼楼山水锦绣景")]:
        add("花盆", level, name, "", "占位", True)

    bed_assign = [
        (2, "粗编蒲草坐垫", "第3行第1格，圆草垫，对到 2 级"),
        (3, "蓝染碎布软窝", "第3行第2格，蓝花软窝，对到 3 级"),
        (5, "暖绒杉木小卧榻", "第3行第3格，木床粉垫，对到 5 级"),
        (6, "悬空吊绳小竹巢", "第3行第4格，吊球窝，对到 6 级"),
        (9, "双层飞檐猫小楼", "第3行第5格，两层木楼，对到 9 级"),
        (11, "紫禁猫仙天枢殿", "第3行第6格，金殿，按结局造型对到 11 级"),
    ]
    for i, (level, name, pos) in enumerate(bed_assign):
        col = toy_cols[2][i]
        row = toy_rows[2]
        box = inset_box((col[0], row[0], col[1], row[1]), 0.08)
        save_tile(toys, box, ITEMS / f"bed_{level}.png")
        add("猫窝", level, name, "chain_toys_plants_beds_512.png", pos)
    for level, name in [(1, "晒干金黄稻草"), (4, "低沿竹编椭圆筐"), (7, "红木雕花围栏床"), (8, "微缩木雕拔步床"), (10, "琉璃飞檐避暑行宫")]:
        add("猫窝", level, name, "", "占位", True)

    # contact sheet
    thumbs = []
    labels = []
    for row in mapping:
        if row["placeholder"]:
            continue
        chain_id = {"猫粮": "food", "玩具": "toy", "花盆": "plant", "鱼篓": "boat", "猫窝": "bed", "饮料": "bev"}[row["chain"]]
        thumbs.append(Image.open(ITEMS / f"{chain_id}_{row['level']}.png").convert("RGBA"))
        labels.append(f"{row['chain']}{row['level']}")
    cols = 8
    tw, th = 96, 96
    rows_n = math.ceil(len(thumbs) / cols)
    sheet = Image.new("RGB", (cols * tw, rows_n * (th + 18)), (244, 236, 220))
    dr = ImageDraw.Draw(sheet)
    for i, im in enumerate(thumbs):
        r, c = divmod(i, cols)
        im.thumbnail((tw - 8, th - 8))
        sheet.paste(im, (c * tw + 4, r * (th + 18) + 2), im)
        dr.text((c * tw + 4, r * (th + 18) + th - 2), labels[i], fill=(40, 28, 22))
    sheet.save(ART / "item-slices.png")

    lines = ["# 棋子切图对照", "", "| 链 | 等级 | 名字 | 来源 |", "| --- | --- | --- | --- |"]
    for row in sorted(mapping, key=lambda e: (e["chain"], e["level"])):
        src = "占位（色块+中文名）" if row["placeholder"] else f"{row['source']} {row['pos']}"
        lines.append(f"| {row['chain']} | {row['level']} | {row['name']} | {src} |")
    text = "\n".join(lines) + "\n"
    (ART / "item-mapping.md").write_text(text, encoding="utf-8")
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs/棋子切图对照.md").write_text(text, encoding="utf-8")

    # customers
    guests = {
        "teaGuest": "npc_customer_teaguest_512.png",
        "scholar": "npc_customer_scholar_512.png",
        "embroider": "npc_customer_embroideress_512.png",
        "boatman": "npc_customer_boatman_512.png",
        "squire": "npc_customer_landlord_512.png",
        "fisherman": "npc_customer_fisherman_512.png",
    }
    before_after = []
    for key, filename in guests.items():
        src = Image.open(PACK / filename).convert("RGB")
        cut = cut_customer(src)
        cut.resize((512, 512), Image.Resampling.LANCZOS).save(GUESTS / f"{key}.png")
        # edge zoom: left original, right cutout on checker, both cropped to the right edge of the circle
        bw = 220
        left = src.resize((512, 512)).crop((512 - bw, 80, 512, 512 - 80))
        right_src = cut.resize((512, 512))
        board = checker(bw, left.height)
        board.paste(right_src.crop((512 - bw, 80, 512, 512 - 80)), (0, 0), right_src.crop((512 - bw, 80, 512, 512 - 80)))
        pair = Image.new("RGB", (bw * 2 + 8, left.height), (40, 40, 40))
        pair.paste(left, (0, 0))
        pair.paste(board, (bw + 8, 0))
        before_after.append((key, pair))
    # stack
    width = max(p.width for _, p in before_after)
    height = sum(p.height + 28 for _, p in before_after)
    preview = Image.new("RGB", (width, height), (30, 28, 26))
    dr = ImageDraw.Draw(preview)
    y = 0
    for key, pair in before_after:
        dr.text((8, y + 4), f"{key}  左原图边缘 / 右抠图边缘", fill=(255, 244, 230))
        preview.paste(pair, (0, y + 24))
        y += pair.height + 28
    preview.save(ART / "customer-edges.png")

    stories = {
        "ruyue": "story_wen_ruyue_full.png",
        "xiaotao": "story_xiao_tao_full.png",
        "zhao": "story_zhao_wenxuan_full.png",
        "liu": "story_liu_guniang_full.png",
    }
    for key, filename in stories.items():
        cut = cut_story(Image.open(PACK / filename))
        cut.save(GUESTS / f"{key}.png")

    # login button + ui via the preview page's white key
    btn = white_key(Image.open("/tmp/v8login/login/btn_enter.jpg"), 45, 15)
    # trim transparent bounds
    arr = np.array(btn)
    ys, xs = np.where(arr[:, :, 3] > 12)
    if len(xs):
        btn = btn.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    btn.save(UI / "btn_enter.png")
    Image.open("/tmp/v8login/login/login_bg.jpg").save(UI / "login_bg.jpg", quality=90)

    for name in ["ui_btn_stash_512", "ui_btn_build_512", "ui_info_scroll_box", "ui_topbar_group"]:
        src = Image.open(PACK / f"{name}.png")
        white_key(src, 45, 15).save(UI / f"{name}.png")

    print("items", len(list(ITEMS.glob('*.png'))))
    print("guests", len(list(GUESTS.glob('*.png'))))
    print("mapping", len(mapping), "placeholders", sum(1 for m in mapping if m["placeholder"]))

if __name__ == "__main__":
    main()
