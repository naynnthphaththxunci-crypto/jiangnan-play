# 江南合成

网页试玩以 GitHub Pages 的完整美术包为开发基准，源码在 `web/`。棋盘为 7×9，原存档键为 `jiangnan.save.v1`。

## 本地开发

```bash
npm ci
npm run dev
npm test
```

开发服务器地址为 `http://127.0.0.1:47321/`。完整包的棋子素材与 PSD 摆放数据在 `web/piece-items.js`、`web/piece-producers.js`，谛听窝原图在 `web/diting-nest/`。开局棋盘和茶壶存档迁移分别在 `web/opening-board.js`、`web/teapot.js`。`web/playtest.js` 来自原发布包，保留了其中的压缩变量名。

## 构建与发布

```bash
npm run build
npm run preview
```

构建输出到 `dist/`，包含同版的 `index.html` 和 `fast.html`。验证新档、旧档、教程和棋盘后，把 `dist/` 的内容覆盖到仓库根目录下的 `preview/`，提交到 `main`。固定试玩入口为 [GitHub Pages](https://naynnthphaththxunci-crypto.github.io/jiangnan-play/preview/)。

早期 TypeScript 原型使用 `npm run build:prototype`，输出到 `dist-prototype/`。如需为原型生成单文件，可再运行 `node scripts/inline-html.mjs`。以下原型记录仍可供参考。微信小游戏使用 `npm run build:wx`，生成的 `dist-wx/` 可用微信开发者工具打开。

## 已知问题

- 客人抠图的发丝、衣边上有细白边。
- 早期按圆裁的那一刀会在下半身留下一道弧。仓库里现在的客人图是后来用边缘向内 flood fill 重抠的，个别边缘仍可能看到残留。
- 浣熊没有立绘，订单上仍是色块。
- 这些等级没有切片，游戏里是色块加中文名：玩具 1、4、5、7、8、11；花盆 1、6、8、9；猫窝 1、4、7、8、10。
- 鱼篓 4 级文案是「熟桐油防水鱼篓」，图上是一只金坛，按原图等级号用了，没有改画。

## 原始资源在哪

本 git 仓库里没有原始包，只有切完、抠完的成品：

- 棋子：`src/assets/items/`（`food_1.png` 这种名字）
- 客人与剧情：`src/assets/guests/`
- 对照：`docs/棋子切图对照.md`

`src/assets/ui/` 不在 git 里。那是早期脚本用角落色键抠出来的界面和旧登录按钮，游戏没有引用。Phase C 不要用这张按钮。

这台机器上用过的上传包（不在 git 里）：

- 资源包：`/home/ubuntu/.cursor/projects/workspace/uploads/pack.tar_d7a8.gz`，解压在 `/tmp/v8pack/pack/`（ASCII 文件名，四张 `chain_*_512.png`、六张 `npc_customer_*_512.png`、四张 `story_*_full.png`、`merge_producers_config.json`）。
- 登录新图（Phase C，未接入）：`/home/ubuntu/.cursor/projects/workspace/uploads/login_v2.tar_ed82.gz`，里面是 `login/login_bg.jpg`、`login/btn_enter.jpg`。
- 旧登录包不要用：`/home/ubuntu/.cursor/projects/workspace/uploads/login.tar_2bfa.gz`。

共享盘上的同一套原件：

- `/workspace/jiangnan/allen_pack_1108/`：原始包，中文文件名。
- `/workspace/jiangnan/v8/pack/`：ASCII 文件名的副本，和上面 `/tmp/v8pack/pack/` 是同一套内容。

## 切图和抠图怎么重跑

脚本：`scripts/v8_assets.py`（从会话里的 `/tmp/v8_assets.py` 抄进来，只加了开头的警告）。依赖 Pillow 和 numpy。它假定资源包在 `/tmp/v8pack/pack`，项目在 `/workspace`。路径不对就改文件顶部的 `PACK` 和 `ROOT`。

只重切棋子时，跑这个文件会把客人和 `src/assets/ui/` 一起覆盖掉。客人部分（`cut_customer`）按圆裁，下半身会留弧；`white_key` 是 `idle_preview.html` 那种「取样一个角的颜色、全局删相近色」，会把白猫抠穿，并把按钮收成方图。这两段不要当最终流程。

棋子格子坐标、等级对应和占位名单都在这个脚本的 `main()` 前半段，写出的表就是 `docs/棋子切图对照.md`。成品文件名是 `{food|toy|plant|boat|bed|bev}_{等级}.png`。

仓库里现用的客人图不是这个脚本的 `cut_customer` 产物，是后来用 OpenCV 从图像边缘向内 flood fill 另抠的，脚本没有保存下来。剧情全身（`ruyue`、`xiaotao`、`zhao`、`liu`）用的是脚本里的 `cut_story`：从四边向内 flood fill。重做客人时走边缘 flood fill 或 rembg 这一类，不要走 `white_key`，也不要把图强行缩成 512×512 的正方形（登录按钮尤其要留原比例）。

`scripts/inline-html.mjs` 只负责把构建结果收成单文件，不切图。
