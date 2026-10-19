# 方块学院 BlockAcademy · 玩家说明书

一款跑在浏览器里的**体素沙盒小学科学教育游戏**。地图上分布着六个场景，每个场景住着几位居民 NPC。
这些 NPC **没有预写台词**——只定义性格，回答由 AI 临场生成。孩子通过自由对话、观看 3D 动态演示、动手搭建来学科学。

> 游戏内界面文案为英文（NPC 用英语对话，可当磨耳朵），本说明书为中文对照。

---

## 一、开始游戏

| 项目 | 说明 |
| --- | --- |
| 主地址 | https://game.xuepilot.com |
| 备用地址 | https://blockacademy.pages.dev |
| 设备要求 | 任意现代浏览器的桌面端（Chrome / Edge 优先），需要 WebGL |
| 需要下载吗 | 不需要。打开网页即玩 |
| 装到桌面 | 支持 PWA：在浏览器地址栏点「安装」，或手机端「添加到主屏幕」，装后可离线打开界面 |
| 性能 | 画面卡顿时关掉其他标签页；本作全部渲染在浏览器内完成，云上只是托管静态文件，换服务器不会更快 |

**怎么进入第一人称？** 点击画面即可锁定鼠标开始游戏；按 `ESC` 释放鼠标。

---

## 二、基本操作

| 操作 | 按键 |
| --- | --- |
| 移动 | `W A S D` |
| 疾跑 | `Shift` |
| 跳跃 | `空格` |
| 飞行 | `F`（任意模式都能切，本作保留的便捷键） |
| 飞行上升 / 下降 | `空格` / `Ctrl`（或 `Q`） |
| 视角 | 移动鼠标 |
| 挖掉方块 | 鼠标左键 |
| 放置方块 | 鼠标右键 |
| 切换手上方块 | 滚轮 或 数字键 `1`–`9` |
| 和 NPC 说话 / 触发演示台 | `E` |
| 打开地图 | `M` |
| 打开设置 | `O` |
| 打开玩家面板 | `P` |
| 打开帮助 | `H` |
| 打开命令台 | `T` 或 `/` |
| 关闭对话 / 释放鼠标 | `ESC` |

---

## 三、六个场景与居民

| 场景 | 主题 | 居民（命令名 / 显示名 / 身份） |
| --- | --- | --- |
| 🌿 Dawnlight Village 晨光村 | 植物、天气、四季 | `stone_pine` Elder Pinewood 村中长者 · `ling` Ling 爱乱跑的小探险家 |
| 🌳 Lively Forest 生机森林 | 食物链、生态、种子 | `lu_ming` Luming 护林员 · `xiao_man` Xiaoman 种子图书馆管理员 |
| 💧 Wandering River 漂流河谷 | 水循环、溶解、浮力 | `lan_po` Granny Lan 河流水文观察者 · `pao` Bubbles 爱吹牛的水精灵 |
| 💎 Crystal Caverns 水晶矿洞 | 岩石、化石、地层 | `pick` Old Pick 第七代矿工 · `vein` Vein 晶脉记录员 |
| 🔭 Starry Observatory 星空观测站 | 昼夜、四季、月相 | `star_see` Starsee 观星学徒 · `compass` Old Compass 观星台的守时人 |
| ⚡ Wonder Lab 万物实验室 | 电、热、力、光 | `quark` Dr. Quark 首席实验员 · `ember` Keeper Ember 火焰看守 · `archie` Archie 机械大师 |

共 **13 位**居民。在任何场景按 `E` 走到居民身边即可开聊。

---

## 四、和 NPC 聊天（双轨大脑）

本作的核心设计：**没有 API Key 也 100% 能玩**。

| 模式 | 行为 |
| --- | --- |
| 本地知识引擎（默认） | 内置小学科学知识库 + 性格引擎即时组织语言，**不需要联网、不需要 Key** |
| 真 LLM 驱动（可选） | 填入自己的 API Key 后，NPC 由大模型驱动，回答更自由 |

- LLM 请求失败会**自动降级**到本地引擎，并在对话里提示，不会卡住。
- NPC 之间有「传闻总线」：你跟 A 聊过的知识点，B 会知道并换个角度讲，不会鹦鹉学舌。

**怎么连 LLM：**
1. 标题页点「Connect an LLM」，或游戏内按 `O`
2. 点一个服务商预设（OpenAI / xAI Grok / DeepSeek / Kimi / 阿里千问 / 本地 Ollama）
3. 填入 API Key 和模型名 → 点「Test connection」验证 → 点「Save」

> 密钥与请求都经由同源 `/api/llm` 转发，**只存在你自己的浏览器里，服务器不保存任何密钥**。

---

## 五、3D 演示台与任务勋章

- 场景里有**发光演示台**，站上去按 `E` 播放带解说的 3D 动画（如「叶子的小工厂」「水的旅行」「地层里的时间表」）。
- 播放中可用 `◀ Prev` / `Next ▶` / `🔁 Replay` / `Skip` 控制。
- 左上角任务面板显示当前场景的待办：**聊天、看演示、搭方块**都会推进进度，全部完成可拿该场景勋章，共 6 枚。

---

## 六、玩家系统（多玩家存档）

一台设备可以有多个玩家档案，互不干扰——适合家里几个孩子共用，或教室共用一台电脑。

入口：标题页「👥 Players」、设置页「👥 Switch player」、游戏内按 `P`。

| 能力 | 说明 |
| --- | --- |
| 新建玩家 | 填名字 + 选头像 + 选颜色 → 「＋ Add player」 |
| 切换玩家 | 点某一行的「切换」，游戏会同步刷新该玩家的 AI 设置、语音、进度、NPC 勋章 |
| 删除玩家 | 点「删除」（会连带删掉该玩家的全部进度，**不可恢复**；至少保留 1 个玩家） |
| 每人独立的内容 | AI 配置、语音开关、学习进度与勋章 |

> ⚠️ 玩家档案存在**浏览器本地**（localStorage）。换浏览器、清缓存、换设备都不会同步——这是纯静态网页无后端的固有限制。旧版存档会在首次启动时自动迁入默认的 "Explorer" 玩家，不会丢失。

---

## 七、命令大全（Minecraft 风格）

按 `T` 或 `/` 打开命令台，输入 `/help` 查看全部。
**坐标支持 MC 式相对坐标**：`~` = 当前位置，`~10` = 偏移 +10，`~-3` = 偏移 −3。

### 移动
| 命令 | 示例 | 说明 |
| --- | --- | --- |
| `/tp <x> <y> <z>` | `/tp 64 30 64` | 传送到坐标 |
| `/tp <场景名>` | `/tp cave` | 传送到场景（支持 `village` `forest` `river` `cave` `observatory` `lab`，也认部分名字） |
| `/tp ~ ~10 ~` | — | 相对坐标：原地上升 10 格 |
| `/teleport ...` | `/teleport forest` | `/tp` 的完整别名 |
| `/locate` | — | 显示当前坐标 |
| `/fly` | — | 开关飞行 |

### 建造
| 命令 | 示例 | 说明 |
| --- | --- | --- |
| `/setblock <x> <y> <z> <方块>` | `/setblock ~ ~1 ~ lamp` | 放置单个方块 |
| `/fill <x1> <y1> <z1> <x2> <y2> <z2> <方块>` | `/fill 60 20 60 66 24 66 brick` | 填充立方体区域 |
| `/fill <区域> <方块> replace <目标>` | `/fill 60 20 60 66 24 66 stone replace dirt` | 只把指定方块替换掉 |
| `/clone <区域> <tx> <ty> <tz>` | `/clone 60 20 60 66 24 66 80 20 80` | 复制区域到目标点（会连空气一起复制，即覆盖目标区） |
| `/give <方块> [数量]` | `/give glass` | 把方块放进快捷栏（最多 18 格） |
| `/clear` | — | 快捷栏恢复默认 10 格 |

### 世界
| 命令 | 示例 | 说明 |
| --- | --- | --- |
| `/gamemode <模式>` | `/gamemode creative` | 切换游戏模式 |
| 模式名 | 也可用 | 效果 |
| `creative` | `c` `1` | 开飞行 + 自由建造（**默认**） |
| `survival` | `s` `0` | 关飞行 + 正常建造 |
| `adventure` | `a` `2` | 关飞行 + **不能放置/挖掘** |
| `spectator` | `sp` `3` | 开飞行 + **穿墙**（`空格`上升 /`Ctrl`下降）+ 不能建造 |
| `/time day` | `/time night` `/time noon` `/time sunrise` | 切换时间 |
| `/time set <0-100>` | `/time set 60` | 设置黑暗度百分比 |
| `/time add <0-100>` | `/time add 20` | 在当前时间上推进 |
| `/day` / `/night` | — | 快捷切到白天 / 夜晚 |
| `/weather clear` | `/weather rain` | 切换天气 |
| `/weather thunder` | — | 雷暴（下雨 + 变暗） |

### 聊天
| 命令 | 示例 | 说明 |
| --- | --- | --- |
| `/say <文字>` | `/say 同学们出发！` | 广播一条消息 |
| `/me <文字>` | `/me 正在观察叶片` | 以「* 玩家名 文字」形式输出动作 |
| `/title <文字>` | `/title 第 3 关 达成` | 屏幕中央显示大字标题 |
| `/tellraw <文字>` | `/tellraw 注意脚下` | 直接输出一条消息 |
| `/stopsound` | — | 停止所有 NPC 朗读语音 |

### 信息
| 命令 | 示例 | 说明 |
| --- | --- | --- |
| `/list` | — | 列出六个场景（默认） |
| `/list npcs` | — | 列出当前场景的居民 |
| `/list players` | — | 列出本机所有玩家档案（`▶` 为当前） |
| `/list blocks` | — | 列出全部方块名 |
| `/seed` | — | 显示一个会话随机数（见下方说明） |
| `/summon <居民>` | `/summon quark` | 在你身边召唤该居民（认 id 或名字，如 `/summon Archie`） |

### 生命
| 命令 | 示例 | 说明 |
| --- | --- | --- |
| `/kill` | — | 立即在出生点复活 |
| `/spawnpoint [x y z]` | `/spawnpoint` / `/spawnpoint 64 30 64` | 设置重生点（不带参数 = 当前位置） |
| `/setworldspawn [x y z]` | — | 同上（MC 别名） |

**常用方块名**（`/give` `/setblock` `/fill` 通用，也可按 `/list blocks` 查全部）：
`grass` `dirt` `stone` `cobble` `stone_brick` `sand` `sandstone` `wood` `leaves` `plank` `brick` `glass`
`snow` `ice` `gravel` `coal_ore` `iron_ore` `gold_ore` `crystal_ore` `quartz`
`wool_white` `wool_red` `wool_blue` `wool_yellow` `wool_purple` `wool_green`
`lamp` `metal` `obsidian` `farmland` `wheat` `flower_red` `flower_yellow` `cactus` `mushroom` `star` `cloud` `portal` `board`

> 关于 `/seed`：本作每个场景的地形是**手工设计的固定地形**（所有人看到的地图一致），`/seed` 显示的随机数**不参与地形生成**，仅供记录。

---

## 八、常见问题

| 问题 | 解答 |
| --- | --- |
| 打不开网页 | 一定用 **`https://`**（带 s）。若提示 DNS 错误，刷新本机 DNS（管理员 CMD 运行 `ipconfig /flushdns`）、换无痕窗口、或暂时关掉本地代理。备用地址 `https://blockacademy.pages.dev` |
| 一定要填 API Key 吗 | **不需要**。不填也能完整游玩，NPC 用内置知识引擎作答 |
| 没网能玩吗 | 能（PWA 打开界面 + 本地知识引擎）。只有「真 LLM 驱动」需要联网 |
| 语音朗读没声音 | 按 `O` 打开设置，点「🔊 Voice」开启；用的是浏览器自带语音合成，无需下载语音包 |
| 卡住了 / 想重来 | 按 `M` 换场景，或 `/kill` 回出生点；想清空进度请新建一个玩家 |
| 我的进度不见了 | 玩家档案存在浏览器本地，换浏览器或清了缓存才会丢。旧版存档会自动迁入 "Explorer" 玩家 |

---

## 九、给老师 / 家长

- **提问示范**：NPC 对开放式问题反应最好。鼓励孩子问「为什么叶子是绿的？」「水最后去哪了？」而不是只点预设按钮。
- **跨场景串联**：知识是连着的——同一个「水循环」在河谷讲蒸发、在观测站讲雨雪、在实验室讲三态变化。
- **动手巩固**：任务里有「搭 10 个方块」，让孩子把理解的东西真的搭出来。
- **隐私**：不填 Key 就零外部请求；填了 Key 也是你自己的账号，本作不收集任何数据。

---

## 十、开发者信息

```bash
npm install
npm run dev        # http://127.0.0.1:5173（含 /api/llm 转发中间件）
npm run build      # tsc --noEmit + vite build
npm run serve      # 生产静态服务器 :4173
npm run typecheck  # 类型检查
npm run smoke      # 离线冒烟：六个场景地形 / NPC 落点 / 网格自检
```

- 前端：Vite 5 + TypeScript + Three.js，体素引擎全部自写，贴图为程序化生成的 canvas 图集，**不依赖任何外部图片资源**。
- 部署：Cloudflare Pages（静态）+ Pages Functions `functions/api/llm.js` 做 SSE 转发；推到 GitHub `main` 分支由 Actions 自动部署。
- 目录：`src/core` 体素引擎 · `src/npc` 性格与双轨大脑 · `src/edu` 知识库/任务/演示 · `src/world` 场景与地形 · `src/ui` 界面 · `src/user/profile.ts` 玩家系统 · `server` 本地代理。
