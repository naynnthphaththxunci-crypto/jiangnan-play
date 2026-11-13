# 音效说明

游戏里的合成音效在运行时用 Web Audio 振荡器写成，没有采样。开场漫画另用了下面这些 CC0 录音，裁短后转成单声道 mp3。协议都是 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)，可以商用，不需要署名。

## 合成音效

| 声音 | 用途 | 来源 | 协议 |
| --- | --- | --- | --- |
| 合成叮 | 两子棋合成时的撞击 | 本项目原创合成（正弦 + 三角波上滑） | CC0 / 公有领域 |
| 产出 | 点母棋，子棋飞出 | 本项目原创合成 | CC0 / 公有领域 |
| 落位 | 子棋落入格子 | 本项目原创合成 | CC0 / 公有领域 |
| 铜钱 | 交单时铜钱起飞，以及每一枚落入钱数 | 本项目原创合成 | CC0 / 公有领域 |
| 不足 | 体力不够、冷却、交不了单 | 本项目原创合成 | CC0 / 公有领域 |
| 修缮 | 花铜钱做小活、升级、补体力 | 本项目原创合成 | CC0 / 公有领域 |
| 轻点 | 点剧情、按钮 | 本项目原创合成 | CC0 / 公有领域 |

## 开场漫画

文件在 `src/assets/audio/`。音效都小于 30KB，配乐每段小于 300KB。

| 文件 | 用途 | 来源 | 协议 | 大约大小 |
| --- | --- | --- | --- | --- |
| bed-tense.mp3 | 第 1、2 页循环的低沉古筝 | [guzheng solo](https://freesound.org/people/neolein/sounds/472707/) by neolein, Freesound | CC0 | 106 KB |
| bed-gentle.mp3 | 第 3 页循环的温柔古风 | [A ride through chinese valley](https://freesound.org/people/neolein/sounds/573972/) by neolein, Freesound（古筝、二胡、扬琴） | CC0 | 106 KB |
| bed-rain.mp3 | 第 3 页叠在音乐上的雨声 | [Slowly Raining Loop](https://freesound.org/people/unfa/sounds/177479/) by unfa, Freesound | CC0 | 71 KB |
| sfx-crickets.mp3 | 第 1 页旁白时的夜里虫鸣，音量小 | [Crickets during the night, close to the beach in Mexico](https://freesound.org/people/felix.blume/sounds/479041/) by felix.blume, Freesound | CC0 | 27 KB |
| sfx-hmm.mp3 | 温如月疑惑的「嗯？」 | [Hmm question.wav](https://freesound.org/people/esperar/sounds/170768/) by esperar, Freesound（女声） | CC0 | 5 KB |
| sfx-hmph.mp3 | 温如月冷冷的「哼」 | [Woman Exasperated Sigh, Breathe Out](https://freesound.org/people/monsterthing/sounds/663651/) by monsterthing, Freesound（女声，截了开头） | CC0 | 5 KB |
| sfx-snore.mp3 | 赵文轩的呼噜，一声比一声长 | [Male Snore 2.wav](https://freesound.org/people/mattyharm/sounds/432996/) by mattyharm, Freesound（同一声拉开三次） | CC0 | 24 KB |
| sfx-tear.mp3 | 撕休书，跟「嘶啦——！」一起响 | [Paper Tear.MP3](https://freesound.org/people/FunWithSound/sounds/367684/) by FunWithSound, Freesound | CC0 | 6 KB |

微信版优先使用 `wx.createWebAudioContext()`，接口和网页版同一套合成。没有音频环境、或某条录音还没载入时，游戏照常进行，只是少这一声。
