/**
 * NPC brain (dual-track):
 *  - Track A: a real LLM (via the local same-origin proxy /api/llm, any OpenAI-compatible endpoint)
 *  - Track B: a local personality engine (no key / no network / auto-degrade on failure — always playable)
 * Both tracks generate on the fly from "personality + knowledge base" only — no pre-written scripts.
 */
import type { Personality } from './personalities';
import { ALL_KNOWLEDGE, getNode, searchKnowledge, type KnowledgeNode } from '../edu';
import { PERSONALITIES } from './personalities';
import { getActiveState, saveActive } from '../user/profile';

export interface LLMConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * AI config now lives inside the player profile (see src/user/profile.ts).
 * These helpers keep the rest of the code unchanged while routing through it.
 */
export function loadLLMConfig(): LLMConfig {
  return getActiveState().state.llm;
}

export function saveLLMConfig(cfg: LLMConfig): void {
  saveActive({ llm: cfg });
}

export interface ChatTurn {
  role: 'user' | 'npc';
  text: string;
}

export interface SceneContext {
  sceneId: string;
  sceneName: string;
  /** knowledge points emphasized in this scene */
  topics: string[];
  /** things the player can see nearby */
  nearby: string[];
  /** a short description of the player's current quest */
  quest?: string;
}

export interface SpeakResult {
  text: string;
  engine: 'llm' | 'local';
  nodeId?: string;
  error?: string;
}

const GREET = /^(hi|hello|hey|yo|howdy|你好|您好|嗨|哈啰|在吗)/i;
const THANKS = /(thanks|thank you|thx|got it|i see|i understand|appreciate|谢谢|感谢|明白啦|懂了)/i;
const BYE = /(bye|goodbye|see you|later|catch you|再见|拜拜|走了)/i;
const WHO_ARE_YOU = /(who are you|your name|introduce yourself|what do you do|你是谁|名字|自我介绍)/i;

function pick<T>(arr: T[], seed = Math.random()): T {
  return arr[Math.floor(seed * arr.length) % arr.length];
}

/** the cross-NPC "rumor bus": what one NPC says gets heard and quoted by others */
export interface Rumor {
  topicId: string;
  npcId: string;
  npcName: string;
  sceneId: string;
  time: number;
  sceneNameOf: () => string;
}
const rumors: Rumor[] = [];
export function addRumor(r: Rumor): void {
  rumors.push(r);
  if (rumors.length > 40) rumors.shift();
}
export function rumorsAbout(topicId: string, excludeNpcId: string): Rumor[] {
  return rumors.filter((r) => r.topicId === topicId && r.npcId !== excludeNpcId);
}
export function clearRumors(): void {
  rumors.length = 0;
}

export class NPCBrain {
  readonly personality: Personality;
  history: ChatTurn[] = [];
  /** knowledge-point ids already taught, to avoid repeating */
  taught = new Set<string>();
  private affinity = 0;

  constructor(p: Personality) {
    this.personality = p;
  }

  /** build the system prompt: only "persona + teaching style + knowledge boundary", never any script lines */
  buildSystemPrompt(ctx: SceneContext): string {
    const p = this.personality;
    const known = this.taught.size
      ? [...this.taught].map((id) => getNode(id)?.topic).filter(Boolean).join(', ')
      : 'nothing yet';
    const myTopics = [...new Set(p.topics)]
      .map((id) => getNode(id)?.topic)
      .filter(Boolean)
      .join(', ');
    return `You are playing an NPC in the voxel game "BlockAcademy", speaking to a child player aged 8-12.

【Your Identity】
Name: ${p.name}. Role: ${p.role}. Bio: ${p.bio}

【Your Personality】
${p.traits.map((t) => '- ' + t).join('\n')}

【How You Speak】
${p.style}
Your catchphrase: "${p.catchphrase}" — drop it in naturally now and then, but not in every line.

【Current Scene】
${ctx.sceneName}${ctx.nearby.length ? `, nearby you can see: ${ctx.nearby.join(', ')}` : ''}.
${ctx.quest ? `The player's current small task: ${ctx.quest}.` : ''}

【Your Knowledge】
You are good at ${p.domains.join(', ')}, and you especially know these: ${myTopics}.
Only answer elementary-school science. If asked something outside that scope, or about danger, violence, or adult topics, gently say you don't know or steer the talk back to science.

【What You've Already Covered】 (avoid repeating; use a new example or go one level deeper)
${known}
${this.rumorLine()}
【Teaching Rules — must follow】
1. Speak in English, conversational, short sentences, 1 to 4 sentences per reply, under ~120 words total.
2. Don't recite like an encyclopedia; chat like a real person: open with a relatable line, then explain the idea, ideally with an example from a child's everyday life.
3. End most replies with a question back, or a small puzzle, to keep the player exploring.
4. Output only the words you say — no stage directions, no bracketed actions, no labels.
5. Never call yourself an AI, model, or assistant. You ARE ${p.name}.`;
  }

  async speak(userText: string, ctx: SceneContext, cfg: LLMConfig, onToken?: (partial: string) => void): Promise<SpeakResult> {
    this.history.push({ role: 'user', text: userText });
    if (this.history.length > 12) this.history.splice(0, this.history.length - 12);

    const useLLM = cfg.enabled && cfg.baseUrl.trim() && cfg.apiKey.trim();
    if (useLLM) {
      const r = await this.tryLLM(userText, ctx, cfg, onToken);
      if (r) {
        this.finishTurn(r.text);
        return r;
      }
    }
    const local = await this.replyLocal(userText, ctx, onToken);
    this.finishTurn(local.text);
    return local;
  }

  /** NPC speaks first (when the player walks up) */
  async greet(ctx: SceneContext, cfg: LLMConfig, onToken?: (t: string) => void): Promise<SpeakResult> {
    const useLLM = cfg.enabled && cfg.baseUrl.trim() && cfg.apiKey.trim();
    if (useLLM) {
      const r = await this.tryLLM('(The player just walked up to you — greet them and lead into the one topic you most want to chat about)', ctx, cfg, onToken);
      if (r) {
        this.finishTurn(r.text);
        return r;
      }
    }
    const local = await this.replyLocal('', ctx, onToken);
    this.finishTurn(local.text);
    return local;
  }

  private finishTurn(text: string): void {
    this.history.push({ role: 'npc', text });
    if (this.history.length > 12) this.history.splice(0, this.history.length - 12);
    this.affinity = Math.min(10, this.affinity + 1);
  }

  private async tryLLM(userText: string, ctx: SceneContext, cfg: LLMConfig, onToken?: (t: string) => void): Promise<SpeakResult | null> {
    const messages = [
      { role: 'system', content: this.buildSystemPrompt(ctx) },
      ...this.history.slice(-8).filter((h) => h.text !== userText || h.role === 'user').map((h) => ({
        role: h.role === 'npc' ? 'assistant' : 'user',
        content: h.text,
      })),
      { role: 'user', content: userText },
    ];
    // drop a duplicate final entry
    const dedup: typeof messages = [];
    for (const m of messages) {
      const prev = dedup[dedup.length - 1];
      if (prev && prev.role === m.role && prev.content === m.content) continue;
      dedup.push(m);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          model: cfg.model,
          temperature: 0.9,
          max_tokens: 320,
          messages: dedup,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => '');
        return { text: '', engine: 'llm', error: t ? safeError(t) : `HTTP ${res.status}` };
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = '';
      let reasoning = '';
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const data = s.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const j = JSON.parse(data);
            if (j?.error) return { text: '', engine: 'llm', error: String(j.error?.message || j.error).slice(0, 200) };
            const delta = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.text ?? '';
            if (delta) {
              full += delta;
              onToken?.(full);
            }
            reasoning += j?.choices?.[0]?.delta?.reasoning ?? j?.choices?.[0]?.delta?.reasoning_content ?? '';
          } catch {
            /* ignore partial packet */
          }
        }
      }
      if (!full.trim()) {
        // 推理型模型（gpt-oss 等）把 token 全花在思考上时正文为空——明确报出来，走本地引擎
        if (reasoning.trim()) {
          return {
            text: '',
            engine: 'llm',
            error: 'reasoning model spent all tokens thinking and left no reply — switch to a chat model (gpt-4o-mini / deepseek-chat / qwen-plus)',
          };
        }
        return { text: '', engine: 'llm', error: 'model returned empty' };
      }
      const node = searchKnowledge(userText, 1)[0]?.node;
      return { text: cleanup(full), engine: 'llm', nodeId: node?.id };
    } catch (e) {
      clearTimeout(timer);
      return { text: '', engine: 'llm', error: (e as Error)?.message || 'request failed' };
    }
  }

  /** local personality engine: retrieve from knowledge base -> rephrase by personality -> typewriter output */
  private async replyLocal(userText: string, ctx: SceneContext, onToken?: (t: string) => void): Promise<SpeakResult> {
    const p = this.personality;
    const text = await Promise.resolve(this.compose(userText, ctx));
    // typewriter effect
    if (onToken) {
      const step = Math.max(1, Math.ceil(text.length / 42));
      for (let i = 0; i < text.length; i += step) {
        onToken(text.slice(0, i + step));
        await sleep(18);
      }
    }
    void p;
    return { text, engine: 'local', nodeId: this.lastNodeId };
  }

  private lastNodeId: string | undefined;

  private compose(userText: string, ctx: SceneContext): string {
    const p = this.personality;
    const q = userText.trim();

    // 1) greeted first / empty input
    if (!q || GREET.test(q)) {
      const node = this.nextNode(ctx);
      const line = node
        ? `${nodeHook(p, node)}Wonder how ${node.topic} works? ${node.ask}`
        : 'What would you like to talk about today? Science is right under our feet — crouch down anywhere and you\'ll find something worth a look.';
      return this.decorate(line);
    }

    // 2) self-introduction
    if (WHO_ARE_YOU.test(q)) {
      return this.decorate(`I'm ${p.name}, ${p.role}. ${p.bio} If you want to understand ${p.domains.join(' and ')}, you've come to the right place.`);
    }

    // 3) thanks / goodbye
    if (THANKS.test(q)) {
      const n = this.nextNode(ctx);
      const tail = n ? `Why not ask me about ${n.topic} too? I found another interesting spot.` : 'Come back and chat anytime.';
      return this.decorate(`You're welcome — glad it made sense. ${tail}`);
    }
    if (BYE.test(q)) {
      return this.decorate(`Alright, take care out there. ${p.catchphrase}`);
    }

    // 4) knowledge retrieval
    const hits = searchKnowledge(q, 3);
    if (hits.length && hits[0].score > 2.2) {
      const best = hits[0].node;
      this.lastNodeId = best.id;
      const fresh = !this.taught.has(best.id);
      this.taught.add(best.id);
      addRumor({
        topicId: best.id,
        npcId: p.id,
        npcName: p.name,
        sceneId: ctx.sceneId,
        sceneNameOf: () => ctx.sceneName,
        time: Date.now(),
      });
      // someone else already told this kid the same thing — take another angle, don't echo
      const heard = rumorsAbout(best.id, p.id);
      const alreadyTold = heard.length > 0;
      const line = this.explainAs(p, best, fresh && !alreadyTold);
      return this.decorate(alreadyTold && Math.random() < 0.55 ? `${heard[heard.length - 1].npcName} already told you about this one, didn't they? Let me come at it from another angle.` + line : line);
    }

    // 5) weak match: offer a related point, or recommend a peer in the same field
    if (hits.length) {
      const n = hits[0].node;
      this.lastNodeId = n.id;
      return this.decorate(
        `Hmm… when you say that, the first thing I think of is ${n.topic}. ${n.explain} Before I explain, what do you think is going on?`,
      );
    }

    // 6) no match at all: admit not knowing + offer your own specialty + recommend someone else
    const mine = this.nextNode(ctx);
    const other = suggestExpert(q);
    let line = `That's not really my area.`;
    if (mine) line += `But I do know about ${mine.topic}: ${mine.explain.split('.')[0]}.`;
    if (other) line += `For what you asked, head to ${other.sceneName} and find ${other.p.name} — they're the expert there.`;
    line += mine ? mine.ask : 'Where would you like to start?';
    return this.decorate(line);
  }

  /** rephrase a knowledge point into this NPC's own voice */
  private explainAs(p: Personality, n: KnowledgeNode, fresh: boolean): string {
    const parts: string[] = [];
    if (fresh) {
      parts.push(opening(p, n));
      parts.push(n.explain);
      if (p.verbosity > 0.6) parts.push(`For example, ${n.example}`);
    } else {
      // already covered — don't re-recite, change the angle
      parts.push(`Let me say ${n.topic} another way.`);
      if (n.myth) parts.push(`Here's a common mix-up: ${n.myth}`);
      else parts.push(`A down-to-earth example: ${n.example}`);
    }
    parts.push(n.ask);
    let text = parts.join('');
    // verbosity control
    if (p.verbosity < 0.7) {
      const sentences = text.split(/(?<=[.!?])/);
      if (sentences.length > 4) text = sentences.slice(0, 4).join('');
    }
    return text;
  }

  /** pick an as-yet-untaught knowledge point (prefer current-scene topics) */
  private nextNode(ctx: SceneContext): KnowledgeNode | undefined {
    const sceneNodes = ctx.topics.map((id) => getNode(id)).filter(Boolean) as KnowledgeNode[];
    const mine = ALL_KNOWLEDGE.filter((n) => this.personality.topics.includes(n.id));
    const pool = [...sceneNodes, ...mine];
    const unseen = pool.filter((n) => !this.taught.has(n.id));
    const target = unseen.length ? unseen : pool;
    if (!target.length) return undefined;
    const n = pick(target);
    if (n) this.taught.add(n.id);
    return n;
  }

  /** add the catchphrase / tone so local-engine output carries the personality */
  private decorate(line: string): string {
    const p = this.personality;
    let out = line;
    if (Math.random() < p.quirkRate) {
      out = Math.random() < 0.5 ? `${p.catchphrase}${out}` : `${out}${Math.random() < 0.5 ? ' ' + p.catchphrase : ''}`;
    }
    if (p.humor > 0.8) out = out.replace(/^/, pick(['Hey, ', 'Oh, ', 'Gurgle—']) );
    return cleanup(out);
  }

  /** "what's been happening around town" for the LLM, so NPCs feel like they really share news */
  private rumorLine(): string {
    const mine = new Set(this.personality.topics);
    const recent = rumors.filter((r) => r.time > Date.now() - 20 * 60 * 1000).slice(-6);
    if (!recent.length) return '';
    const list = recent.map((r) => {
      const n = getNode(r.topicId)?.topic ?? 'something';
      return `- ${r.npcName} (${r.sceneNameOf()}) was just chatting with this kid about "${n}"`;
    });
    const sameWords = recent.some((r) => mine.has(r.topicId) && r.npcId !== this.personality.id);
    return `\n【What's been happening around town】\n${list.join('\n')}\n${sameWords ? 'One of those is a topic you know well: if it fits, smile and say "I hear someone mentioned this too", then take a different angle — don\'t just repeat it.' : ''}`;
  }

  get affinityLevel(): number {
    return this.affinity;
  }
}

function opening(p: Personality, n: KnowledgeNode): string {
  const seeds = [
    `About ${n.topic} — `,
    `Hey, ${n.topic}, that's my specialty.`,
    `Great question! ${n.topic} goes like this — `,
    `Hmm, ${n.topic}… `,
  ];
  const s = pick(seeds);
  return p.patience > 0.8 ? s : `${s}in short, `;
}

function nodeHook(p: Personality, n: KnowledgeNode): string {
  const hooks = [
    `I've been thinking about ${n.topic} lately.`,
    `You're just in time — I've been wanting to ramble about ${n.topic}.`,
    `${n.topic}, have you ever noticed that?`,
  ];
  void p;
  return pick(hooks);
}

function suggestExpert(_q: string): { p: Personality; sceneName: string } | null {
  const sceneNames: Record<string, string> = {
    village: 'Village Square',
    forest: 'Living Forest',
    river: 'Recycling River Valley',
    cave: 'Crystal Caverns',
    observatory: 'Starry Observatory',
    lab: 'All-Things Lab Garden',
  };
  const candidates = PERSONALITIES;
  if (!candidates.length) return null;
  const p = pick(candidates);
  return { p, sceneName: sceneNames[p.scene] ?? p.scene };
}

function cleanup(s: string): string {
  return s
    .replace(/[（(][^）)]{0,30}?(stage direction|action|narration)[^）)]{0,40}?[）)]/gi, '')
    .replace(/\*[^*]{1,40}\*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function safeError(t: string): string {
  try {
    const j = JSON.parse(t);
    return j?.error || t.slice(0, 160);
  } catch {
    return t.slice(0, 160);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function typewriter(text: string, cb: (partial: string) => void, speed = 22): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const step = Math.max(1, Math.ceil(text.length / 40));
    const timer = setInterval(() => {
      i += step;
      cb(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        resolve();
      }
    }, speed);
  });
}
