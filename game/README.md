# 江南合成

竖屏合成经营。网页和微信小游戏共用同一套规则。棋盘 7×9。这份说明是交给下一位的交接，不是功能介绍。

当前源码在本仓库 `main`。发布到 GitHub Pages 时，源码放在 [naynnthphaththxunci-crypto/jiangnan-play](https://github.com/naynnthphaththxunci-crypto/jiangnan-play) 的 `game/` 目录；玩家打开的是该仓库根目录的单文件 `index.html`。

## 进度

已做完，并随提交 `316eddb` 上线（单文件 HTML 约 7.96 MB，`7961167` 字节）：

- Phase A：六条新链（猫粮、玩具、花盆、鱼篓、猫窝、饮料）。6 级及以上的链上棋子本身就是母棋。棋子切片在 `src/assets/items/`，对照表在 `docs/棋子切图对照.md`。
- Phase B：六位客人抠图站在柜台后面（陆老伯、柳砚、晴娘、阿桨、金老爷、鲍大叔）。剧情全身立绘是温如月、小桃、赵文轩、柳姑娘。浣熊仍是色块。

还没做：

- Phase C：登录屏。素材是 `login_v2`（背景招牌「姑苏客栈」、按钮「进入客栈」），还没接到游戏里。
- Phase D：界面切片、客人待机动画、对照清单逐条自检。
- 单文件体积：目标压到 4 MB 以下（按显示尺寸 ×2 的 WebP 或量化 PNG）。现在大约 8 MB，还没压。

## 安装

需要 Node.js 22（这台机器是 `v22.23.4`）和随它带的 npm（这台是 `10.9.9`）。

```bash
npm install
```

## 本地运行

```bash
npm run dev
```

开发服务器是 `vite --host 127.0.0.1 --port 47321 --strictPort`。浏览器打开终端里打印的地址，一般是 `http://127.0.0.1:47321/`。

测试：

```bash
npm test
```

## 打单文件 HTML

```bash
npm run build
node scripts/inline-html.mjs
```

`npm run build` 先做类型检查，再打到 `dist/`（`vite.config.ts` 里 `base` 是 `'./'`，资源内联上限 1 MB）。`scripts/inline-html.mjs` 把 `dist/index.html` 引用的 CSS 和 JS 收成一个文件，并把里面的 PNG 换成 data URL。

不带参数时，输出是 `dist/jiangnan.html`。要写到别的路径：

```bash
node scripts/inline-html.mjs /你的路径/jiangnan.html
```

## 发布到 GitHub Pages

仓库：[naynnthphaththxunci-crypto/jiangnan-play](https://github.com/naynnthphaththxunci-crypto/jiangnan-play)。

1. 把打好的单文件 HTML 复制成该仓库根目录的 `index.html`（覆盖旧的）。
2. 保留根目录的 `.nojekyll`，不要删。Pages 直接发这个 `index.html`。
3. 这份源码放到同一仓库的 `game/`。解压源码包时，包内就是项目根（直接是 `package.json`），解进 `game/` 即得到 `game/package.json`。

微信小游戏另打：`npm run build:wx`，用微信开发者工具打开 `dist-wx/`。AppID 在 `jiangnan.config.json`，不要改。

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
