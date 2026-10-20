# BlockAcademy · Player's Manual

A **voxel sandbox science game for elementary school** that runs right in your browser. The world has several themed areas, each home to a few resident NPCs.
These NPCs **have no written scripts**—only a personality is defined, and their answers are generated live by AI. Kids learn science through free conversation, watching 3D animated demos, and hands-on building.

> The in-game interface text is in English (NPCs speak English, which also helps with listening practice); this manual is the English companion guide.

---

## 1. Getting Started

| Item | Notes |
| --- | --- |
| Main address | https://game.xuepilot.com |
| Backup address | https://blockacademy.pages.dev |
| Device requirements | Works on **computer / tablet / phone**; any modern browser (Chrome, Edge, Safari); needs WebGL |
| Download needed? | No. Just open the webpage and play |
| Install to desktop / phone | PWA supported: click "Install" in the address bar, or "Add to Home Screen" on mobile; then it opens like an app |
| How to play on phone | After opening, choose **BEDROCK EDITION**. Bottom-left is a virtual joystick, right side has buttons; drag an empty area of the screen to look around |
| Performance | On phones it auto-lowers resolution and reduces the number of creatures. Everything renders inside the browser; the cloud only hosts static files, so switching servers won't make it faster |

**How to enter first-person?** On a computer, click the screen to lock the mouse; press `ESC` to open the **pause menu**. On a phone you can play right away—no locking needed.

---

## 2. JAVA EDITION and BEDROCK EDITION

The title screen has two big buttons; pick one to enter:

| Edition | For | Difference |
| --- | --- | --- |
| 🖥️ **JAVA EDITION** | Computer (keyboard + mouse) | Full keyboard & mouse controls; has a unique **`F3` debug screen** (shows coordinates, facing, creature count, FPS, game mode, time, and health—just like Minecraft Java Edition) |
| 📱 **BEDROCK EDITION** | Phone / tablet (touchscreen) | Bottom-left virtual joystick to move, **drag the right half of the screen to look**; right-side button group: ⬆ jump / ⬇ descend / ⛏ mine (hold to keep mining) / 🧱 place (hold to keep placing) / 🪶 fly / 💨 fart; top-left: ☰ menu / 🎒 inventory / 💬 command console; **game locks to landscape** (portrait shows a rotate hint; Android auto-locks) |

The first open auto-picks by device (touchscreen → BEDROCK), then remembers your choice. You can switch anytime in **Pause menu → 🖥️ Edition**, or with `/edition java` / `/edition bedrock`.

---

## 3. Basic Controls

### Computer (JAVA EDITION)

| Action | Key |
| --- | --- |
| Move | `W A S D` |
| Sprint | `Shift` |
| Jump | `Space` |
| Fly | `F` (works in any mode; a convenience key kept in this game) |
| Fly up / down | `Space` / `Ctrl` (or `Q`) |
| Look | Move the mouse |
| Mine a block | Left mouse button (hold to keep mining; faster with a pickaxe) |
| Fight monsters | Left mouse button (aim at a Shadow) |
| Place a block | Right mouse button |
| Switch held block | Scroll wheel or number keys `1`–`9` |
| **Open inventory / crafting** | `E` (when no one is in front of you) or `I` (anytime) |
| Talk to NPC / trigger demo stage | `E` |
| Pet / feed / milk & collect eggs | `E` (walk up to the animal) |
| **Fart** | `G` |
| **Wave to online players** | `V` (or `/wave`) |
| Off-hand swing | `C` (must put something in the "🖐 Offhand" slot in inventory first) |
| Open map | `M` |
| Open settings | `O` |
| Open player panel | `P` |
| Open help | `H` |
| Open command console | `T` or `/` |
| Debug screen | `F3` |
| **Pause menu** | `ESC` |

### Phone (BEDROCK EDITION)

| Want to do | How to tap |
| --- | --- |
| Walk | Push the bottom-left joystick in the direction you want to go |
| Look around | Drag on an **empty area of the screen** |
| Jump / descend | Right-side ⬆ / ⬇ (hold) |
| Mine a block | Right-side ⛏ (hold to keep mining) |
| Place a block | Right-side 🧱 |
| Fly | Right-side 🪶 toggle |
| Fart | Right-side 💨 |
| Inventory / crafting | Top-left 🎒 |
| Command console / chat | Top-left **⌘** (opens the command console; **tap ⌘ or 💬 again to close**, or just tap outside the console; input without a `/` is chat, visible to everyone in the same room) |
| Interact (talk to NPC / step on teleport pad / close console when open) | Top-left 💬 |
| Menu (back to title / switch mode / view chat log) | Top-left ☰ |
| Talk to NPC, open demo stage | Walk up and tap 💬, or follow the hint at the bottom of the screen |

---

## 4. The Themed Areas and Their Residents

| Scene | Theme | Residents (command name / display name / role) |
| --- | --- | --- |
| 🌿 Dawnlight Village | Plants, weather, the four seasons | `stone_pine` Elder Pinewood village elder · `ling` Ling a little explorer who loves to wander |
| 🌳 Lively Forest | Food chains, ecosystems, seeds | `lu_ming` Luming the forest ranger · `xiao_man` Xiaoman the seed-library keeper |
| 💧 Wandering River | Water cycle, dissolving, buoyancy | `lan_po` Granny Lan river hydrology watcher · `pao` Bubbles a braggy water sprite |
| 💎 Crystal Caverns | Rocks, fossils, rock layers | `pick` Old Pick the 7th-generation miner · `vein` Vein the crystal-vein recorder |
| 🔭 Starry Observatory | Day/night, seasons, moon phases | `star_see` Starsee the stargazing apprentice · `compass` Old Compass the observatory timekeeper |
| ⚡ Wonder Lab | Electricity, heat, force, light | `quark` Dr. Quark chief experimenter · `ember` Keeper Ember flame keeper · `archie` Archie the machine master |
| 🔢 Math Academy | **UK/US elementary math (grade 4 and up)** | `fiona` Fraction Fiona the fraction-pizza shop owner · `gideon` Geo Gideon the geometry-garden knight · `sylvia` Stat Sylvia the data-stats tower keeper |

A total of **16 residents**. In any scene, walk up to a resident and press `E` to start chatting.

### 🔢 Math Academy (Grade 4+ math dungeon)

Math isn't about memorizing formulas—it's **a building you can walk into**:

| Area | Building | The math behind it |
| --- | --- | --- |
| 🍕 Fraction Pizza Shop | Giant 8-slice pizza + equivalent-fraction wall | Meaning of fractions, **1/2 = 2/4 = 4/8 equivalent**, common denominators |
| 📐 Geometry Garden | 12-ray angle turntable + perfectly symmetrical garden | Measuring angles (30°/60°/90°/180°), lines of symmetry |
| 📊 Data Tower | 5 bar charts + a balance scale | Mean / median / mode, reading charts |
| 🌉 Ratio Bridge | One railing every 2 blocks (1:2) + a ten-step percent hill | Ratios & proportions, percentages 10%→100% |
| 🧮 Number Plaza | Black-and-white checkerboard floor + clock tower (3 o'clock = 90°) | Coordinate plane, clock angles |
| 🔟 Southeast Path | 10 gradient-colored steps | Decimals 0.1 → 1.0 on a number line |

Demo stages: **🍕 The Pizza That Cuts Itself** (equivalent-fraction 3D pizza) and **📐 The Turning Ray** (angle turntable).

### 💙 About one of the little authors: Grayson

This world has two authors—Dad and **Grayson**. His mark is left in Dawnlight Village:

- **🏠 Grayson's Cabin**: northeast corner of the village, the only house with quartz walls + a blue roof + crystal pillars at the four corners; a quartz path leads to the door, and a knowledge-lamp glows on the roof
- **🗿 Grayson Statue**: northwest corner of the village square, a blue-clad figure holding a knowledge-lamp, with a ring of crystals at its feet
- Walk up to the cabin to unlock the achievement "💙 Visited Grayson's House"; type `/grayson` anytime to see the easter-egg locations

---

## 5. Chatting with NPCs (Dual-Track Brain)

The core design: **playable 100% without an API key**.

| Mode | Behavior |
| --- | --- |
| Local knowledge engine (default) | A built-in elementary-science knowledge base + personality engine that organizes language on the fly—**no internet, no key needed** |
| Real LLM driven (optional) | After entering your own API Key, NPCs are driven by a large model and answer more freely |

- LLM request failures **auto-fall back** to the local engine and show a note in the chat, so it never gets stuck.
- NPCs have a "gossip bus": a fact you discussed with A, B will know and explain from another angle—no parroting.

**How to connect an LLM:**
1. On the title screen tap "Connect an LLM", or press `O` in-game
2. Tap a provider preset (OpenAI / xAI Grok / DeepSeek / Kimi / Alibaba Qwen / local Ollama)
3. Enter your API Key and model name → tap "Test connection" to verify → tap "Save"

> Keys and requests are relayed through the same-origin `/api/llm` proxy; **they live only in your own browser—the server saves no keys**.

---

## 6. 3D Demo Stages and Quest Badges

- There are **glowing demo stages** in the world; stand on one and press `E` to play a narrated 3D animation (e.g. "The Leaf's Little Factory", "The Journey of Water", "Time Tables in the Rock Layers").
- During playback use `◀ Prev` / `Next ▶` / `🔁 Replay` / `Skip` to control.
- The quest panel in the top-left shows the current scene's to-dos: **chatting, watching a demo, building blocks, and taking the long way** all advance progress; finish them all to earn that scene's badge—7 badges total.

---

## 7. Survival Loop: Gather → Craft → Build

The game **defaults to survival mode with an empty inventory**—start by punching a tree barehanded; everything is up to you (want free building? switch to creative: Pause menu → 🎮 Game Mode, or `/gamemode creative`; when you switch, if your inventory is empty you get a starter set of blocks, and the inventory also has an "📚 All blocks" palette you can take from infinitely):

1. **Punch a tree barehanded** → get `wood`
2. Put 1 wood in the 2×2 inventory → **4 planks**
3. 2 planks → **4 sticks**
4. 4 planks arranged 2×2 → **crafting table**
5. Place the crafting table **on the ground**, stand beside it and open the 3×3 grid to make **pickaxe / axe / shovel / sword / hoe**
6. 8 cobblestone around a ring → **furnace** (iron ore→iron ingot, sand→glass, wheat→bread)

### Inventory & Crafting

| Function | How to use |
| --- | --- |
| Open | `E` (when no one is in front) or `I` |
| Three tabs | 🎒 **Bag (2×2)** portable crafting · 🪚 **Table (3×3)** stand beside a crafting table · 🔥 **Furnace** stand beside a furnace |
| Pick up / put down | Tap once to grab the whole stack, tap an empty slot to drop; two identical stacks auto-merge; different ones swap places |
| Take the product | Tap the green slot on the right → consumes materials, product goes to your hand |
| Hotbar | The 9 slots at the bottom, mapped to number keys `1`–`9` |
| **Off-hand (left hand)** | Put something in "🖐 Offhand" and the left hand appears at bottom-left; press `C` to swing it |
| Creative-mode inventory | Tap "📚 All blocks" in the inventory to take any block infinitely |
| Eat | With food in hand, tap "🍽 Eat" (or select it in the hotbar and tap), restores hunger and health |

**Tool roles**: pickaxes mine stone faster, axes chop wood faster, shovels dig dirt/sand faster, swords deal high damage to monsters. Higher tier (wood → stone → iron → crystal) = faster.

### 🧪 Chemistry & Physics Crafting (real principles)

The crafting table is an **experiment bench**—every recipe below is backed by real science:

| Craft | Materials | Real principle |
| --- | --- | --- |
| 🫧 Carbon dioxide ×2 | Baking soda + vinegar | **Acid-base neutralization**: NaHCO₃ + acetic acid → lots of CO₂ bubbles (volcano experiment) |
| 🟤 Rust | Iron ingot + water + oxygen | **Oxidation**: iron + oxygen + water slowly forms rust (chemical change, irreversible) |
| ⚪ Quicklime | Limestone (furnace) | **Thermal decomposition**: CaCO₃ heated → CaO + CO₂ (industrial calcination) |
| 🥛 Slaked lime | Quicklime + water | **Exothermic reaction**: quicklime releases lots of heat with water, becomes calcium hydroxide (good for whitewashing) |
| 🪣 Cement mortar → ⬛ Concrete ×4 | Sand + quicklime + water | **Cementitious material**: mortar glues sand grains into a whole; harder than stone once set |
| 🌊 Salt water → 🧂 Salt (furnace) | Salt + water | **Dissolving** (physical change) → **evaporative crystallization** (salt-field principle) |
| 🥤 Sugar water | Sugar + water | Sugar dissolves; stirring and heating both speed it up |
| 🎈 Hydrogen ×2 / 🌬️ Oxygen | Battery + water (placed vertically) | **Electrolysis of water**: battery on top with "negative terminal down" doubles hydrogen; battery on bottom gives oxygen—2:1 volume ratio |
| 💧 Water | Hydrogen×2 + oxygen + coal | **Exploding-gas experiment**: 2H₂ + O₂ ignited → 2H₂O, a "bang" and back to water |
| 🔋 Battery | Iron block + crystal shard + coal | A device that turns chemical energy into electrical energy |
| 🔌 Circuit board | Copper ingot×8 + glass | **Conductor/insulator**: copper traces, fiberglass board insulates |
| 🟠 Copper ingot | Copper ore (furnace) | Smelting: ore → metal |
| 🧲 Magnet | Iron ingot×3 + crystal shard | Iron magnet charged; poles (N/S) are strongest |
| 🪞 Plane mirror ×2 | Glass×3 + iron block×3 | **Silvering reflection**: glass + silver-white metal = mirror reflection |
| 🔍 Convex lens ×2 | Glass ring (8 blocks) | Thicker in the middle, thinner at edges → focuses parallel sunlight to a point (can start a fire) |

New blocks added: **copper ore / limestone / rust block / plane mirror / convex lens / concrete / magnet / carbon-dioxide bubble**—all minable, placeable, and `/give`-able.
New furnace recipes: copper ingot ← copper ore · salt ← salt water · quicklime ← limestone.

### New blocks
Blue flower / pink flower / white flower / tall grass / hay block / **crafting table** / **furnace** / **torch** (glows) / glowstone / bookshelf / bedrock (unbreakable) / carrot / **copper ore / limestone / rust block / plane mirror / convex lens / concrete / magnet / carbon-dioxide bubble** (chemistry-physics kit)

---

## 8. Animals, Pets, Friends, and the Sky

### Animals & Pets

| Animal | Likes to eat | Barehand interaction gives |
| --- | --- | --- |
| 🐄 Cow | Wheat | Milk |
| 🐖 Pig | Carrot | Leather |
| 🐑 Sheep | Wheat | White wool |
| 🐔 Chicken | Wheat | Egg |
| 🐕 Dog | Bread | — |
| 🐈 Cat | Bread | — |
| 🟢 Slime | — | — |

**Tame a pet**: hold what it loves to eat, walk up and press `E`, **feed it 3 times** and it becomes your pet, following you around.
**Collect produce**: press `E` barehanded (each animal has a 25-second cooldown).

### Make Friends (villagers)

1. Walk up to a resident and press `E` to chat
2. Hold something in your hand, tap the **🎁** at the bottom-right of the dialog
3. After gifting **3 times**, they say "I'll follow you!", then will **follow you**, and **when you place a block they'll add one beside you**
4. Friendship shows in the top-left corner

### The Sky

- ☀️ **Sun** hangs in the sky by day, 🌙 **Moon** takes over at night, complete with **craters**
- ⭐ After dark, **stars** gradually brighten (F3 shows current darkness)
- ☁️ **Clouds** drift slowly, dimming at night
- To watch the day/night cycle: command `/cycle on` (one round every 15 minutes), turn off with `/cycle off`
- 🌑 After dark, **Shadows** appear (they hit you, costing some health); they burn away at dawn. Drive them off with your **sword**
- 💀 When health hits zero you wake at the spawn point; **items in your bag are not lost**

### Farting

- Press `G` (or tap 💨 on phone, or command `/fart`)
- Has sound effect + green gas; **nearby animals get blown away**
- Eat a **magic bean** 🫘 and you'll definitely let one out
- Achievements: first fart 💨 / 25 farts 🏆

### Achievements
First block mined, first craft, first tool made, first meal, first pet, first good friend, first Shadow driven off, first house built with a villager… a popup appears when achieved.

---

## 9. Player System (multi-player profiles)

One device can have several player profiles that don't interfere with each other—great for several kids sharing a home, or a classroom sharing one computer.

Entry: title screen "👥 Players", settings "👥 Switch player", or press `P` in-game.

| Ability | Notes |
| --- | --- |
| New player | Fill in name + pick avatar + pick color → "＋ Add player" |
| Switch player | Tap "Switch" on a row; the game refreshes that player's AI settings, voice, progress, and NPC badges |
| Delete player | Tap "Delete" (also deletes all that player's progress, **cannot be undone**; keep at least 1 player) |
| Each player's own content | AI config, voice toggle, learning progress & badges, **inventory items**, **chat log**, **villager friendship**, **achievements**, **edition choice**, **volume** |
| **Chat log** | Pause menu → "💬 Chat Log"; see every word this player said to residents (last 300 entries), can be cleared |

> ⚠️ Player profiles are stored **locally in the browser** (localStorage). Switching browsers, clearing cache, or changing devices won't sync—this is a hard limit of a pure static site with no backend. Old saves auto-migrate into the default "Explorer" player on first launch, so nothing is lost.

---

## 10. Multiplayer (beta)

The game has been upgraded to **multiplayer**: open the page and it auto-connects, **zero config**. A few people in the same room is enough for testing; it can scale up smoothly later.

### How to play with others

1. Open https://game.xuepilot.com and you auto-enter the public room `main`
2. To play separately with a friend: Pause menu → **🌐 Online Players** → change room name → tap "🔗 Copy invite link" and send the link to a friend (with `?room=roomname`; opening it joins the same room)
3. In settings (`O`) you can change the **Broker**, change the **room name**, or turn off multiplayer (after which it's pure single-player)

### What you can do while connected

| Feature | Notes |
| --- | --- |
| **See each other** | Online players in the same scene show as **voxel figures** (clothed in your avatar color), with a nameplate above the head and a walking wobble when moving |
| **Chat** | Open the command console (`T` / ⌘), type **without a `/`** to chat: visible to the whole room, a bubble appears above the other person's head, a floating log appears bottom-left, and it's saved to the chat log |
| **Wave** | `V` or `/wave`; the other screen pops "👋 XXX waved at you" and the figure raises its hand |
| **Fart sync** | When you fart, the whole room sees the green gas + a hint (animals still get blown away) |
| **Build the world together** | Every block you mine / place is **broadcast and synced**; friends see the same world as you (synced only to those online at the time) |
| **Online list** | Pause menu → 🌐 Online Players: shows room, connection status, and which scene each person is in; the top bar also has a small "🟢 Online · Room "xx" · N players" pill |
| `/list online` | View the online players in the current room from the command console |

### Technical notes and honest reminders

- Transport uses **MQTT over WSS public broker** (default `wss://broker.emqx.io:8084/mqtt`): a pure static site has no WebSocket server, so this is a **zero-registration, zero-config** testing approach; you can switch to your own broker anytime in settings.
- **The room name is the password**: only people with the same room name on the public broker can see each other; for private play, pick a room name others can't guess. Chat goes through the public broker, so **don't share sensitive info in-game**.
- Online status uses MQTT **retained messages + Last Will (LWT)**: on an abnormal disconnect (closing the page directly) the broker automatically clears our status, so others immediately see you vanish; there's also a 7-second heartbeat fallback.
- World differences do only **real-time incremental broadcast**: blocks others mined/placed before you joined won't be retro-synced (the terrain itself is fixed design, identical for everyone).
- Turning off multiplayer doesn't affect any single-player feature; on disconnect it auto-reconnects, and the top bar pill shows "🟡 Connecting".

---

## 11. Full Command List (Minecraft style)

Press `T` or `/` to open the command console, type `/help` to see them all.
**Coordinates support MC-style relative coords**: `~` = current position, `~10` = offset +10, `~-3` = offset −3.

### Movement
| Command | Example | Notes |
| --- | --- | --- |
| `/tp <x> <y> <z>` | `/tp 64 30 64` | Teleport to coordinates |
| `/tp <scene name>` | `/tp cave` | Teleport to a scene (supports `village` `forest` `river` `cave` `observatory` `lab`, and some names) |
| `/tp ~ ~10 ~` | — | Relative coords: rise 10 blocks in place |
| `/teleport ...` | `/teleport forest` | Full alias of `/tp` |
| `/locate` | — | Show current coordinates |
| `/fly` | — | Toggle flight |

### Building
| Command | Example | Notes |
| --- | --- | --- |
| `/setblock <x> <y> <z> <block>` | `/setblock ~ ~1 ~ lamp` | Place a single block |
| `/fill <x1> <y1> <z1> <x2> <y2> <z2> <block>` | `/fill 60 20 60 66 24 66 brick` | Fill a cuboid region |
| `/fill <region> <block> replace <target>` | `/fill 60 20 60 66 24 66 stone replace dirt` | Replace only the specified block |
| `/clone <region> <tx> <ty> <tz>` | `/clone 60 20 60 66 24 66 80 20 80` | Copy a region to a target point (copies air too, i.e. overwrites the target) |
| `/give <block> [count]` | `/give glass` | Put a block in the hotbar (max 18 slots) |
| `/clear` | — | Reset hotbar to default 10 slots |
| `/grayson` | alias `/author` | See the easter-egg location of Grayson, one of the little authors |

### World
| Command | Example | Notes |
| --- | --- | --- |
| `/gamemode <mode>` | `/gamemode creative` | Switch game mode |
| mode name | also usable | effect |
| `creative` | `c` `1` | Flight on + free building (**default**) |
| `survival` | `s` `0` | Flight off + normal building |
| `adventure` | `a` `2` | Flight off + **can't place/mine** |
| `spectator` | `sp` `3` | Flight on + **pass through walls** (`Space` up / `Ctrl` down) + can't build |
| `/time day` | `/time night` `/time noon` `/time sunrise` | Switch time |
| `/time set <0-100>` | `/time set 60` | Set darkness percentage |
| `/time add <0-100>` | `/time add 20` | Advance from current time |
| `/day` / `/night` | — | Quick switch to day / night |
| `/weather clear` | `/weather rain` | Switch weather |
| `/weather thunder` | — | Thunderstorm (rain + darken) |

### Chat
| Command | Example | Notes |
| --- | --- | --- |
| `/say <text>` | `/say Class, let's go!` | Broadcast a message (visible to same-room players when multiplayer) |
| `/me <text>` | `/me is observing a leaf` | Output an action as "* player name text" |
| `/wave` | — | Wave to all online players (same as `V`) |
| `/title <text>` | `/title Level 3 cleared` | Show a big title in the center of the screen |
| `/tellraw <text>` | `/tellraw Watch your step` | Output a message directly |
| `/stopsound` | — | Stop all NPC read-aloud voice |
| **Type without `/`** | `Hello everyone!` | Multiplayer chat: broadcast to all players in the same room |

### Info
| Command | Example | Notes |
| --- | --- | --- |
| `/list` | — | List the six scenes (default) |
| `/list npcs` | — | List residents in the current scene |
| `/list players` | — | List all local player profiles (`▶` = current) |
| `/list online` | — | List online players in the multiplayer room and their scenes |
| `/list blocks` | — | List all block names |
| `/seed` | — | Show a session random number (see note below) |
| `/summon <resident>` | `/summon quark` | Summon that resident beside you (by id or name, e.g. `/summon Archie`) |

### Life
| Command | Example | Notes |
| --- | --- | --- |
| `/kill` | — | Respawn at spawn point immediately |
| `/spawnpoint [x y z]` | `/spawnpoint` / `/spawnpoint 64 30 64` | Set respawn point (no args = current position) |
| `/setworldspawn [x y z]` | — | Same as above (MC alias) |
| `/heal` | — | Full health |
| `/feed` | — | Full hunger |

### Survival & audio/visual
| Command | Example | Notes |
| --- | --- | --- |
| `/give <item> [count]` | `/give wood_pickaxe` / `/give bread 5` | Give an item (blocks, tools, food, resources all recognized) |
| `/craft` / `/bag` | — | Open inventory directly (= `E`) |
| `/fart` | — | 💨 let one out |
| `/mobs` | — | List nearby creatures |
| `/pets` | — | List your pets |
| `/cycle on` | `/cycle off` | Day/night cycle toggle |
| `/sound on` | `/sound off` | Sound effect toggle |
| `/volume <0-100>` | `/volume 60` | Volume |
| `/edition java` | `/edition bedrock` | Switch edition (keyboard-mouse / touch) |

**Common block names** (`/give` `/setblock` `/fill` shared; also `/list blocks` for the full list):
`grass` `dirt` `stone` `cobble` `stone_brick` `sand` `sandstone` `wood` `leaves` `plank` `brick` `glass`
`snow` `ice` `gravel` `coal_ore` `iron_ore` `gold_ore` `crystal_ore` `quartz`
`wool_white` `wool_red` `wool_blue` `wool_yellow` `wool_purple` `wool_green`
`lamp` `metal` `obsidian` `farmland` `wheat` `flower_red` `flower_yellow` `cactus` `mushroom` `star` `cloud` `portal` `board`
`flower_blue` `flower_pink` `flower_white` `tall_grass` `hay` `crafting_table` `furnace` `torch` `glowstone` `bookshelf` `bedrock` `carrot`

> About `/seed`: each scene's terrain in this game is **hand-designed fixed terrain** (everyone sees the same map); the random number shown by `/seed` **is not used in terrain generation**, it's just for records.

---

## 12. Frequently Asked Questions

| Question | Answer |
| --- | --- |
| Can't open the webpage | Always use **`https://`** (with the s). If you get a DNS error, flush your local DNS (admin CMD run `ipconfig /flushdns`), use an incognito window, or temporarily turn off your local proxy. Backup address `https://blockacademy.pages.dev` |
| How to close the command console | Press `ESC`, or tap the **"✕ Close"** button at the top-right of the console. On phone, **tap ⌘ or 💬 again** to close, or just tap outside the console; tap "Send" when done |
| Phone is in portrait | The game is designed for landscape: on Android/Chrome it tries to auto-lock landscape when you start; iPhone doesn't allow web pages to lock orientation, so a rotate hint pops up—just turn your phone sideways (the hint has a "Go fullscreen and lock landscape" button to try) |
| Can't tap the console on phone / keyboard won't pop | Fixed (see fix log at the end): root cause was the whole console missing touch-click permission + iOS only pops the keyboard on click-type gestures + **the phone's Service Worker cache locked the old app locally** (redeploys never updated). All fixed now; new versions auto-refresh |
| Groq connection test failed | Make sure the address is `https://api.groq.com/openai/v1` (tap the **Groq** preset in settings to auto-fill), model `llama-3.3-70b-versatile`; filling the root domain `https://api.groq.com` is now auto-corrected too. The test button now passes through the real upstream error (401/404 and the reason) |
| LLM test says "empty reply" | Usually you picked a **reasoning model** (e.g. `openai/gpt-oss-120b`): all tokens went to "thinking" and the body was empty. Switch to a chat model (`gpt-4o-mini` / `deepseek-chat` / `qwen-plus` / `grok-3-mini`) |
| Stuck wandering the village, can't get out | Every teleport pad has a **sky-high light beam + floating icon**; just follow the beam; Dawnlight Village has four lit roads through the ringed hills straight to the pad. Too lazy to walk? Press `M` to open the map and teleport directly |
| Teleport pad unstepable / on water / on tree tops | All fixed (see fix log): now every scene's pad has a small flattened clearing, always reachable from spawn |
| Blocked at the map edge | That's the invisible wall at the world border, intentional—without it you'd walk out into endless void |
| Must I fill in an API Key | **No.** You can play fully without one; NPCs answer with the built-in knowledge engine |
| Can I play without internet | Yes (PWA opens the UI + local knowledge engine). Only "real LLM driven" needs internet |
| No sound from voice read-aloud | Press `O` to open settings, tap "🔊 Voice" to enable; uses the browser's built-in speech synthesis, no voice pack to download |
| No sound from game effects | First time you must **tap the screen once** (browsers require a user action before audio plays); still nothing? Press `ESC` → "🔊 Sound" toggle, or use `/sound on` |
| Stuck / want to restart | Press `M` to switch scenes, or `/kill` to return to spawn; to clear progress, make a new player |
| My progress is gone | Player profiles are stored locally in the browser; you only lose them by switching browsers or clearing cache. Old saves auto-migrate into the "Explorer" player |
| Phone screen laggy | Resolution was auto-lowered. Close other apps; switch to **adventure mode** in the pause menu to save a bit more rendering |
| Can't tap buttons on phone | Make sure you're on BEDROCK EDITION (Pause menu → 🖥️ Edition to switch) |
| Can't see friend in multiplayer | ① Is the top bar pill "🟢 Online"; ② Do the two of you have the same room name (`/list online` to check); ③ Are you in the same scene—only the same scene shows avatars; press `M` to teleport to the same scene |
| Is multiplayer safe | Room name is the password; pick an unguessable name for private play; chat goes through the public broker, **don't share sensitive info**; don't want multiplayer? Turn it off in settings—single-player features are unaffected |
| Can't open crafting table | The 3×3 "🪚 Table" tab requires standing **beside a crafting table**; the village tool shed and village entrance have ready-made ones |
| Inventory full | When the 36 slots on you are full it warns you can't fit more; drop or store elsewhere (no chests yet in this game) |
| Want to build without effort | Switch back to **creative mode** (Pause menu → 🎮 Game Mode); flight + infinite blocks return |

---

## 13. For Teachers / Parents

- **Question prompts**: NPCs respond best to open-ended questions. Encourage kids to ask "Why are leaves green?" "Where does water end up?" instead of just tapping preset buttons.
- **Connect across scenes**: Knowledge is connected—the same "water cycle" is taught as evaporation in the river, as rain/snow at the observatory, and as the three states of matter in the lab.
- **Hands-on reinforcement**: Quests include "build 10 blocks"; have the child actually build what they understood.
- **Privacy**: No key = zero external requests; with a key it's still your own account, and the game collects no data.

---

## 14. Developer Info

```bash
npm install
npm run dev        # http://127.0.0.1:5173 (includes /api/llm relay middleware)
npm run build      # tsc --noEmit + vite build
npm run serve      # production static server :4173
npm run typecheck  # type check
npm run smoke      # offline smoke: six-scene terrain / NPC spawn points / grid self-check
```

- Frontend: Vite 5 + TypeScript + Three.js; the voxel engine is fully hand-written; textures are procedurally generated canvas atlases, **no external image assets**.
- Deploy: Cloudflare Pages (static) + Pages Functions `functions/api/llm.js` for SSE relay; push to GitHub `main` branch and Actions deploys automatically.
- Directories: `src/core` voxel engine · `src/npc` personality & dual-track brain · `src/edu` knowledge base/quests/demos · `src/world` scenes & terrain · `src/ui` interface · `src/net` multiplayer (MQTT over WSS) · `src/user/profile.ts` player system · `server` local proxy.

---

## Appendix: Change Log Overview

| Need | How |
| --- | --- |
| Want to fart | `G` key / 💨 button / `/fart`, with sound + gas + scares animals |
| Empty inventory + animated sound effects | Survival mode starts with empty inventory; waving, mining, placing, footsteps, jumping, entering water all have procedurally synthesized sound (no audio files loaded) |
| Weapons and tools | Wood / stone / iron / crystal four tiers × pickaxe axe shovel sword hoe, 20 pieces total; mining speed and sword damage scale with tier |
| Villagers can voice / chat | Dialog uses browser read-aloud (enable in settings); chat log fully saved |
| Village with houses and farms | Dawnlight Village expanded: 6 houses + tool shed + well + windmill + 2 market stalls + 2 farm plots + pasture fence + hay piles + five colors of flowers (northeast corner also has Grayson's Cabin, northwest of the square has Grayson Statue) |
| Sun clouds stars moon | Sky system: a moving sun (with halo) / moon with craters / 1100 gradually brightening stars / 26 drifting clouds, all following the player |
| JAVA / BEDROCK editions | Choose on title screen; JAVA = keyboard-mouse + `F3` debug screen, BEDROCK = virtual joystick + button group + mobile-first layout |
| Creatures animals flowers | Cow / Pig / Sheep / Chicken / Dog / Cat / Slime / Shadow; 12 new blocks added |
| Gather → craft → build with villagers | Full chain: punch tree → planks → sticks → crafting table → tools → furnace; gift 3 times to become good friends with a villager, who follows you and adds blocks for you |
| Right hand shown, left hidden | First-person two-hand model: right hand always shown; left hand only appears when the off-hand (Offhand) has something, press `C` to swing |
| Menu page + save chat | `ESC` pause menu (continue / switch mode / inventory / chat log / players / help / settings / sound / edition / back to title); dialog saved per player profile |
| More fun | Achievement system, pets, dropped items, hunger & health, fall damage, day/night cycle, 5 new flowers |

---

## Appendix 2: Usability Fix Log (Batch 2)

| Feedback | Root cause | Fix |
| --- | --- | --- |
| Console has no way to close | Could only close via ESC when input focused; no visible close entry | Added a title bar + **✕ Close button** + "Send" button to the console; show how to close when opened; focus out then T/ESC also closes |
| Phone mode can't input commands, can't exit | Input focus wasn't inside a tap gesture (keyboard won't pop), and no tappable send/close button | ⌘ button opens console; "Send" button submits; ✕ closes; touch mode console moved to upper half of screen, input 16px to prevent iOS auto-zoom |
| Phone mode mis-taps | When console/inventory/menu open, the touch layer still covers the UI, so a brush scrolls the view | Any open UI turns off the touch layer entirely; auto-restores after closing |
| Phone can't chat with NPC | 💬 button opened the console, no chat entry | 💬 changed to "interact": chat if NPC nearby, teleport if on a pad, otherwise open console; plus a ⌘ command button |
| Can't get out of village | Ringed hills +16 blocks outside village, ~1.4 slope can't jump; pads had only coordinates no appearance | Four lit roads through the ringed hills straight to pads; pads get **sky-high light beam + floating icon**; village-entry toast guide |
| Walk out of map into void | World border had no collision; reading outside was treated as air | Added invisible wall (also rescues all scenes) |
| 3 pads unreachable | `groundAt` treated tree canopy/roof/water as ground, pads got raised into the air | Added `terrainY` (ignores leaves/wood) + `padPlaza` (clear a flattened clearing); river demo pad fixed with a wooden boardwalk to the dock; lab rainbow pad moved from arc top to the ground in front of the arc |

All the above fixes have **automated tests** as a safety net: `npm run smoke` now does a BFS reachability check on 19 teleport pads across 6 scenes; if a "pad-on-a-tree" happens again it errors out directly.

---

## Appendix 3: Batch 3 Fixes & Upgrades

| Feedback | Root cause | Fix |
| --- | --- | --- |
| iPhone console **can't input, can't exit** | Two stacked bugs: ① `#ui-root` is `pointer-events:none`, and `#cmd-console` missed `pointer-events:auto`—the whole console (input/send/✕) was **completely untappable** on touch (desktop only used keyboard so it didn't show); ② iOS calling `focus()` inside a `pointerdown` gesture won't pop the keyboard | ① Console explicitly enables `pointer-events:auto`; ② On open, focus + extra focus on `pointerup/click/touchend` (iOS only pops keyboard on click-type gestures); ③ Touch mode ✕/send enlarged to 44px tappable area, input always 16px to prevent iOS auto-zoom |
| Test LLM says "Connected but got empty reply" | Model `openai/gpt-oss-120b` is a **reasoning model**; the test gave only 24 token budget, all spent "thinking", body empty, misjudged as "wrong model name" | Test budget raised to 800, and three failures distinguished: empty body but reasoning detected → hint to switch to chat model; SSE error frame → pass through upstream error; truly empty → then hint to check model name. NPC dialog path also recognizes reasoning models and explicitly falls back to the local engine |
| Want multiplayer | Pure static site has no WebSocket server | Upgraded to multiplayer (see section 10): MQTT over WSS public broker zero-config; retained + LWT online status; voxel avatar + nameplate + chat bubble; chat / wave / fart / block-edit real-time sync; room name is password, can switch broker or turn off anytime |
| Mobile might mis-select JAVA | Title screen highlights JAVA by default; touch devices pick wrong and get no joystick | Touch devices entering JAVA show a reminder to switch to BEDROCK in the menu |

The multiplayer protocol has an **end-to-end self-check** safety net (two clients see each other's presence / chat / block-edit / will-clear), which can be re-run temporarily on the dev machine: connect to the public broker and simulate two clients sending/receiving all message types.

---

## Appendix 4: Batch 4 Fixes (phone console relapse + Groq connectivity + empty-inventory start)

| Feedback | Root cause | Fix |
| --- | --- | --- |
| iPhone console **always** can't pop keyboard, can't close, tapping 💬 any number of times does nothing | ① **PWA Service Worker is cache-first**: old SW permanently locked the old `index.html` along with the old bundle in the phone's local storage; however many times the server deployed, the phone kept opening old code—so previous fixes "didn't take"; ② 💬 button, when the console was already open, only called `openConsole()` again, with no close branch | ① SW revamped: page navigation is **network-first** (fall back to cache on failure), static assets stale-while-revalidate, new SW auto-refreshes once on takeover; and registers with a **versioned filename `sw.v3.js`** (fixed name sw.js gets cached for 4 hours, new SW can't take over); `_headers` disables cache for `sw.js`/`sw.v3.js`/`index.html`; ② 💬 / ⌘ both changed to **toggles**: console open, tap again to close |
| Groq connectivity test still fails | ① Generic URL normalization joined `https://api.groq.com` into `/v1` (Groq's version path is **`/openai/v1`**) → 404; ② Test function parsed the proxy layer's returned JSON error as an SSE stream, swallowing the real error and still showing "empty reply" | ① Both proxies (CF Pages / local dev) add a Groq branch for normalization; settings adds a **Groq preset** (address + recommended model auto-filled); ② On non-200, test first reads the upstream error text and passes it through, and gives a Groq-specific hint based on baseUrl |
| Son's need "inventory empty at start" not met | Default was **creative mode** and started by giving 9 starter blocks | Default changed to **survival mode**, no longer gives anything at start (empty-inventory start, chop wood and craft yourself); switching to creative gives starter blocks only if inventory is empty, plus a palette |

Groq correct config: address `https://api.groq.com/openai/v1`, model `llama-3.3-70b-versatile` (free quota, fast; the `gpt-oss` series are reasoning models and NPC dialog will be noticeably slower).

> 📱 **Phone users note**: if after upgrading you still see the old UI, it's the old PWA cache acting up. New versions now **auto-refresh once** on deploy; if still not updated, close the tab and reopen (on iOS you can also swipe-close in Safari's tab manager and reopen).

---

## Appendix 5: Batch 5 (Math Academy + chemistry/physics crafting)

**New content**
- **Seventh scene "Math Academy"**: UK/US elementary math grade 4+ (CCSSM) turned into walkable buildings—fraction pizza shop (1/2=2/4=4/8 equivalent wall), geometry garden (12-ray angle dial + perfectly symmetrical garden), data tower (bar charts + balance), ratio bridge (railings 1:2 + ten-step percent hill), number plaza (coordinate checkerboard + clock tower 3 o'clock = 90°), decimal path (0.1→1.0 gradient steps).
- **3 math NPCs**: Fraction Fiona 🍕 / Geo Gideon 📐 / Stat Sylvia 📊, personalities still define character not lines.
- **Math knowledge base fifth domain "Mathematics"**: 28 knowledge points (fractions, decimals, ratios & percentages, expressions & equations, angles, triangles, symmetry, area perimeter volume, coordinates, unit conversion, statistics, probability, negatives…), both local engine and LLM can teach.
- **3 new 3D demos**: 🍕 The Pizza That Cuts Itself (equivalent fractions), 📐 The Turning Ray (angle dial), 🌋 Volcano in a Flask (acid-base volcano, hung in the lab).
- **Big chemistry / physics crafting expansion**: 43 → **61 recipes**, adding acid-base neutralization, oxidation rusting, limestone thermal decomposition, quicklime exothermic, electrolysis of water, exploding gas, dissolving & crystallization, cement mortar, silvering mirror, convex lens, magnet, circuit board; new blocks copper ore/limestone/rust block/plane mirror/convex lens/concrete/magnet/carbon-dioxide bubble (atlas slot 8×8=64 full, atlas expanded to 12×12=144).

**Real bugs fixed along the way**
- Observatory teleport pad (88,92) **probabilistically unreachable**: floating star blocks raised `groundY` to 30+ blocks high, pad got mounted on the stars. Changed pad to use `terrainY` (ignores floating decoration) and clear the sky above the pad before placing.
- Village southeast pad unreachable: tree canopy remnants (`gateRoad` only cleared 5 blocks high) walled the pad in; raised clear height to 10 blocks and fixed a direct road.
- **explore quest never counted** (forest/academy "walk 30 blocks" quest could never complete before): main loop added a distance-from-spawn check, once every 0.5s.
