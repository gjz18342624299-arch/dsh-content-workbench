import { mkdir, readFile, readdir, rename, stat, writeFile, appendFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

export const name = 'dsh-content-workbench'
export const inject = ['webServer']

const ROOT = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(ROOT, '..', 'public')
// 项目登记簿（哪个项目在哪个文件夹）放在文档说明的固定位置；项目文件夹本身
// 一律由用户通过宿主目录选择器明确挑选（工作台开发规范第 6 节），工作台不在
// 默认位置、用户主目录或其他推测路径里静默创建项目目录。
// DSH_CONTENT_WORKBENCH_ROOT 仍可覆盖登记簿位置（开发与测试用）。
// 登记簿路径惰性求值：测试可以在 import 之后再改环境变量。
const registryDir = () => process.env.DSH_CONTENT_WORKBENCH_ROOT
  ? resolve(process.env.DSH_CONTENT_WORKBENCH_ROOT)
  : join(homedir(), 'Documents', 'DSH 内容创作')
const registryPath = () => join(registryDir(), 'projects.json')
const SCHEMA_VERSION = 1
const MAX_BODY = 24 * 1024 * 1024
const MAX_VERSIONS = 20

const ASSETS = {
  '/api/content/app': [join(PUBLIC, 'index.html'), 'text/html; charset=utf-8'],
  '/api/content/app.css': [join(PUBLIC, 'app.css'), 'text/css; charset=utf-8'],
  '/api/content/app.js': [join(PUBLIC, 'app.js'), 'text/javascript; charset=utf-8'],
}

// ── 平台与格式 ───────────────────────────────────────────
// 每种格式的结构约束同时驱动 UI 表单和 CONTEXT.md 里给 DSH 的写作规则，
// 改一处，两边一起变。
export const FORMATS = {
  wechat: {
    label: '公众号图文',
    titleMax: 64,
    fields: ['digest'],
    spec: [
      '标题不超过 64 字，要有打开欲但不做标题党。',
      '`digest` 填摘要，不超过 120 字，会显示在分享卡片上。',
      '正文用 markdown 写，多分小节（## 小节标题），段落宜短，忌大段文字墙。',
      '封面图放 `images` 数组里 `slot:"cover"` 的那一条，画面比例 2.35:1。',
    ],
  },
  xhs: {
    label: '小红书笔记',
    titleMax: 20,
    fields: ['tags'],
    spec: [
      '标题严格不超过 20 字，带 1-2 个 emoji，口语化。',
      '正文短句分段， emoji 自然点缀但不要每行都堆；多用「我」的视角和真实体验感。',
      '`tags` 填 5-10 个话题标签，不带 # 号，按热度从高到低排。',
      '封面图 3:4 竖版，放 `images` 数组里 `slot:"cover"` 的那一条。',
    ],
  },
  video: {
    label: '短视频脚本',
    titleMax: 40,
    fields: ['hook', 'durationTarget'],
    spec: [
      '`hook` 填前 3 秒钩子台词——决定完播率，必须具体、有冲突或悬念。',
      '`durationTarget` 填目标时长（秒）。',
      '正文按分镜写，每个分镜一个小节：画面（拍什么/字幕）+ 台词（口播原文）+ 时长 + BGM/音效提示。',
      '台词要念得出口，避免书面语；整体节奏前快后稳。',
    ],
  },
  zhihu: {
    label: '知乎回答',
    titleMax: 60,
    fields: [],
    spec: [
      '开头先给结论或亮明经历，再展开论证；逻辑链完整，专业但不说教。',
      '恰当引用数据和来源；没有来源的数字不要编，用「大约」「量级上」或标注待核。',
      '正文用 markdown，论证密度高于情绪密度。',
    ],
  },
}

export const TOPIC_STATUSES = ['candidate', 'writing', 'done']
export const TOPIC_STATUS_LABEL = { candidate: '候选', writing: '写作中', done: '已完成' }
export const DRAFT_STATUSES = ['outline', 'writing', 'review', 'ready', 'published']
export const DRAFT_STATUS_LABEL = { outline: '大纲', writing: '写作中', review: '校对中', ready: '就绪', published: '已发布' }
export const MATERIAL_KINDS = ['text', 'link', 'image', 'file']

const now = () => new Date().toISOString()
const num = (value, fallback = null) => (Number.isFinite(Number(value)) && value !== '' && value !== null ? Number(value) : fallback)
const text = (value, max = 200) => String(value ?? '').trim().slice(0, max)

export function slugify(value, fallback = '') {
  const cleaned = Array.from(String(value ?? '').normalize('NFC').toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, ''))
    .slice(0, 64).join('').replace(/-+$/g, '')
  return cleaned || fallback
}

// Windows 路径大小写不敏感，比较前统一小写；盘符之外的尾部分隔符抹掉。
const samePath = (a, b) => {
  const norm = value => {
    const out = resolve(String(value))
    return (process.platform === 'win32' ? out.toLowerCase() : out).replace(/[\\/]+$/, '')
  }
  return norm(a) === norm(b)
}

// ── 项目登记簿 ───────────────────────────────────────────
// projects.json：{ schemaVersion: 1, projects: [{id, name, folder, createdAt}] }
// 只登记用户明确挑选过的文件夹；读取失败一律当作空登记簿，不猜测、不自动建目录。
function normalizeRegistryEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = slugify(raw.id)
  const folder = String(raw.folder || '')
  if (!id || !isAbsolute(folder)) return null
  return { id, name: text(raw.name, 80) || id, folder: resolve(folder), createdAt: raw.createdAt || now() }
}

async function saveRegistry(registry) {
  await mkdir(registryDir(), { recursive: true })
  const target = registryPath()
  const temp = `${target}.${process.pid}.tmp`
  await writeFile(temp, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
  await rename(temp, target)
}

// 旧版（≤0.1）把项目放在固定数据目录下。首次启动时把那里已有的项目登记进来，
// 恢复用户既有资料；找不到就不写任何文件——没确认过位置之前，磁盘上什么都不留。
async function scanLegacyProjects() {
  const dir = registryDir()
  let entries = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return [] }
  const rows = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '.trash') continue
    const id = slugify(entry.name)
    if (!id) continue
    const folder = join(dir, entry.name)
    try {
      const raw = JSON.parse(await readFile(join(folder, 'project.json'), 'utf8'))
      rows.push({ id, name: text(raw?.project?.name, 80) || id, folder, createdAt: raw?.project?.createdAt || now() })
    } catch { /* 没有 project.json 的目录与本工作台无关 */ }
  }
  return rows
}

async function loadRegistry() {
  let raw = null
  try { raw = JSON.parse(await readFile(registryPath(), 'utf8')) } catch { /* 不存在或损坏都按首次运行处理 */ }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.projects)) {
    const legacy = await scanLegacyProjects()
    const registry = { schemaVersion: 1, projects: legacy }
    // 只有真的回收到旧项目才落盘；空登记簿不在用户机器上留痕迹。
    if (legacy.length) await saveRegistry(registry)
    return registry
  }
  const seenIds = new Set()
  const seenFolders = []
  const projects = []
  for (const entry of raw.projects.map(normalizeRegistryEntry).filter(Boolean)) {
    if (seenIds.has(entry.id) || seenFolders.some(folder => samePath(folder, entry.folder))) continue
    seenIds.add(entry.id)
    seenFolders.push(entry.folder)
    projects.push(entry)
  }
  return { schemaVersion: 1, projects }
}

async function registryRow(slug) {
  const id = slugify(slug)
  const registry = await loadRegistry()
  const row = registry.projects.find(p => p.id === id)
  if (!row) {
    const error = new Error('项目不存在或已从工作台移除')
    error.code = 'PROJECT_UNKNOWN'
    throw error
  }
  return { registry, row }
}

// ── shape ────────────────────────────────────────────────
function emptyProject(id, name, folder) {
  return {
    schemaVersion: SCHEMA_VERSION,
    project: {
      id, name, folder,
      persona: '',      // 账号人设与语气，写作时注入
      audience: '',     // 目标读者画像
      bannedWords: '',  // 禁用词，逗号或换行分隔
      insights: '',     // 复盘结论：发布后数据规律的沉淀，发散选题和写稿前先读它
      customAsks: [],   // 用户在设置里自定义的快捷指令（{id, label, request}）
      // 绑定的 DSH 会话 id。存这里而不是浏览器 localStorage：渲染进程每次启动
      // 端口都变，localStorage 是不同的源，重启即丢。
      sessionId: '',
      createdAt: now(), updatedAt: now(),
    },
    topics: [], drafts: [], materials: [],
    selectedTopicId: null, selectedDraftId: null,
    activity: [{ id: randomUUID(), at: now(), text: `创建项目「${name}」` }],
  }
}

const TOPIC_KEYS = new Set(['id', 'title', 'angle', 'formats', 'status', 'notes', 'score', 'createdAt', 'updatedAt'])
const DRAFT_KEYS = new Set(['id', 'topicId', 'format', 'title', 'digest', 'tags', 'hook', 'durationTarget',
  'outline', 'body', 'images', 'versions', 'status', 'published', 'createdAt', 'updatedAt'])
const MATERIAL_KEYS = new Set(['id', 'name', 'kind', 'content', 'tags', 'createdAt'])

export function normalizeTopic(raw, index = 0) {
  const topic = raw && typeof raw === 'object' ? raw : {}
  return {
    id: text(topic.id, 40) || `topic-${randomUUID().slice(0, 8)}`,
    title: text(topic.title, 120) || `选题 ${index + 1}`,
    angle: text(topic.angle, 500),
    formats: (Array.isArray(topic.formats) ? topic.formats : []).filter(f => FORMATS[f]).slice(0, 8),
    status: TOPIC_STATUSES.includes(topic.status) ? topic.status : 'candidate',
    notes: text(topic.notes, 2000),
    score: num(topic.score),
    createdAt: topic.createdAt || now(),
    updatedAt: topic.updatedAt || now(),
  }
}

export function normalizeImage(raw) {
  const image = raw && typeof raw === 'object' ? raw : {}
  return {
    id: text(image.id, 40) || `img-${randomUUID().slice(0, 8)}`,
    slot: image.slot === 'cover' ? 'cover' : 'inline',
    prompt: text(image.prompt, 1000),   // 想要的画面描述 / AI 生图提示词
    file: text(image.file, 300),        // 相对项目文件夹的路径，如 images/cover.png
    alt: text(image.alt, 200),
  }
}

export function normalizeVersion(raw) {
  const version = raw && typeof raw === 'object' ? raw : {}
  return {
    id: text(version.id, 40) || `ver-${randomUUID().slice(0, 8)}`,
    at: version.at || now(),
    note: text(version.note, 200),
    title: String(version.title ?? ''),
    body: String(version.body ?? ''),
  }
}

/** 自定义指令：标签 ≤20 字、内容 ≤500 字、最多 10 条。 */
function normalizeCustomAsks(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map(row => ({
      id: text(row?.id, 40) || `ask-${randomUUID().slice(0, 8)}`,
      label: text(row?.label, 20),
      request: text(row?.request, 500),
    }))
    .filter(row => row.label && row.request)
    .slice(0, 10)
}

/** 发布回填数据：全部字段宽容清洗，数字负数/非数归零。 */
export function normalizePublished(raw) {
  if (!raw || typeof raw !== 'object') return null
  const stat = v => Math.max(0, Math.round(num(v, 0) || 0))
  // 每日流量：按天记录阅读/点赞等，画趋势图用。日期非法的行直接丢弃。
  const daily = (Array.isArray(raw.daily) ? raw.daily : [])
    .map(row => ({
      date: text(row?.date, 10),
      reads: stat(row?.reads), likes: stat(row?.likes),
      comments: stat(row?.comments), shares: stat(row?.shares),
    }))
    .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-60)
  return {
    at: text(raw.at, 40) || now(),
    url: text(raw.url, 300),
    reads: stat(raw.reads), likes: stat(raw.likes), comments: stat(raw.comments), shares: stat(raw.shares),
    note: text(raw.note, 300),
    daily,
  }
}

export function normalizeDraft(raw, index = 0) {
  const draft = raw && typeof raw === 'object' ? raw : {}
  return {
    id: text(draft.id, 40) || `draft-${randomUUID().slice(0, 8)}`,
    topicId: text(draft.topicId, 40),
    format: FORMATS[draft.format] ? draft.format : 'wechat',
    title: String(draft.title ?? '').slice(0, 200),
    digest: text(draft.digest, 300),
    tags: (Array.isArray(draft.tags) ? draft.tags : []).map(t => text(t, 40)).filter(Boolean).slice(0, 15),
    hook: text(draft.hook, 500),
    durationTarget: num(draft.durationTarget),
    outline: (Array.isArray(draft.outline) ? draft.outline : []).map(o => text(o, 300)).filter(Boolean).slice(0, 30),
    body: String(draft.body ?? '').slice(0, 200000),
    images: (Array.isArray(draft.images) ? draft.images : []).map(normalizeImage).slice(0, 30),
    versions: (Array.isArray(draft.versions) ? draft.versions : []).map(normalizeVersion).slice(-MAX_VERSIONS),
    status: DRAFT_STATUSES.includes(draft.status) ? draft.status : 'outline',
    published: normalizePublished(draft.published),
    createdAt: draft.createdAt || now(),
    updatedAt: draft.updatedAt || now(),
  }
}

export function normalizeMaterial(raw, index = 0) {
  const material = raw && typeof raw === 'object' ? raw : {}
  return {
    id: text(material.id, 40) || `mat-${randomUUID().slice(0, 8)}`,
    name: text(material.name, 120) || `素材 ${index + 1}`,
    kind: MATERIAL_KINDS.includes(material.kind) ? material.kind : 'text',
    content: String(material.content ?? '').slice(0, 50000),
    tags: (Array.isArray(material.tags) ? material.tags : []).map(t => text(t, 40)).filter(Boolean).slice(0, 15),
    createdAt: material.createdAt || now(),
  }
}

/**
 * 读入时清洗：未知字段丢弃并记录（ignoredFields），让工作台能告诉 DSH 它写进来
 * 的东西哪些被静默丢掉了，而不是让 DSH 以为改动已生效。
 */
export function migrate(state, folder, slug) {
  const out = state && typeof state === 'object' ? state : {}
  out.schemaVersion = SCHEMA_VERSION
  const project = out.project && typeof out.project === 'object' ? out.project : {}
  project.id = slug
  project.name = text(project.name, 80) || slug
  project.folder = folder
  project.persona = text(project.persona, 2000)
  project.audience = text(project.audience, 1000)
  project.bannedWords = text(project.bannedWords, 1000)
  project.insights = text(project.insights, 4000)
  project.customAsks = normalizeCustomAsks(project.customAsks)
  project.sessionId = text(project.sessionId, 120)
  project.createdAt = project.createdAt || now()
  project.updatedAt = project.updatedAt || now()
  out.project = project

  const ignored = new Set()
  const collect = (raw, keys, label) => {
    if (!raw || typeof raw !== 'object') return
    for (const key of Object.keys(raw)) if (!keys.has(key)) ignored.add(`${label}.${key}`)
  }
  out.topics = (Array.isArray(out.topics) ? out.topics : []).map((raw, i) => { collect(raw, TOPIC_KEYS, 'topics[]'); return normalizeTopic(raw, i) })
  out.drafts = (Array.isArray(out.drafts) ? out.drafts : []).map((raw, i) => { collect(raw, DRAFT_KEYS, 'drafts[]'); return normalizeDraft(raw, i) })
  out.materials = (Array.isArray(out.materials) ? out.materials : []).map((raw, i) => { collect(raw, MATERIAL_KEYS, 'materials[]'); return normalizeMaterial(raw, i) })
  Object.defineProperty(out, 'ignoredFields', { value: [...ignored], enumerable: false, configurable: true })

  const topicIds = new Set(out.topics.map(t => t.id))
  // 选题被删后稿件保留，topicId 置空（归入「未关联」）。
  for (const draft of out.drafts) if (draft.topicId && !topicIds.has(draft.topicId)) draft.topicId = ''
  const draftIds = new Set(out.drafts.map(d => d.id))
  out.selectedTopicId = topicIds.has(out.selectedTopicId) ? out.selectedTopicId : (out.topics[0]?.id ?? null)
  out.selectedDraftId = draftIds.has(out.selectedDraftId) ? out.selectedDraftId : null
  out.activity = (Array.isArray(out.activity) ? out.activity : [])
    .filter(e => e && e.text)
    .map(e => ({ id: text(e.id) || randomUUID(), at: e.at || now(), text: text(e.text, 300) }))
    .slice(0, 200)
  return out
}

// ── context for the bound DSH session ────────────────────
function formatSpecLines() {
  const lines = []
  for (const [id, f] of Object.entries(FORMATS)) {
    lines.push(`### ${id}（${f.label}）`, '')
    for (const rule of f.spec) lines.push(`- ${rule}`)
    lines.push('')
  }
  return lines
}

function contextDocument(state) {
  const p = state.project
  const lines = [
    '# 内容创作工作台上下文', '',
    '你正在与 DSH Desktop 的「自媒体内容创作工作台」协作。本会话的工作目录就是当前项目文件夹。', '',
    '## 分工', '',
    '- 你负责机械劳动：发散选题、写大纲、写正文、按平台改写、起标题、写配图提示词、整理素材、导出成品。',
    '- 人负责判断：定选题、改语感、决定发不发。**不要替用户拍板，不要编造用户的亲身经历和观点。**',
    '- `project.json` 是工作台与你共用的唯一事实源，你直接编辑它，界面几秒内自动刷新。', '',
    '## 怎么跟用户说话', '',
    '**这份文档是写给你的，不是写给用户的。不要把里面的规则复述给他。**',
    '用户不关心 project.json 的字段名——他要的是「稿子写到哪了、标题哪个好、配图配什么」。',
    '需要确认时，说清楚你要做什么、影响什么，然后等他回答。排版从简，结论用短句。', '',
    '## 写作底线', '',
    '- 先读素材再动笔：`materials` 数组和 `materials/` 文件夹是用户给的料，能用的观点、数据、案例优先从里面来。',
    '- 没有来源的数字不要编。需要数据而素材里没有时，说明「这个数据需要你补」或用 web 工具查证并给出来源。',
    '- 遵守禁用词清单（见下文项目设置）；广告法极限词（最、第一、国家级……）默认不用。',
    '- 降低「AI 腔」：少用「首先/其次/总而言之」「赋能/抓手」这类八股，多用人话。', '',
    '## 项目设置', '',
    `账号人设与语气：${p.persona || '（未设置，提醒用户在工作台里补一句，比如「30 岁职场博主，说话直接带调侃」）'}`,
    `目标读者：${p.audience || '（未设置）'}`,
    `禁用词：${p.bannedWords || '（无）'}`, '',
    ...(p.insights ? ['## 历史复盘结论（先读再动笔）', '', p.insights, ''] : []),
    '## 选题 → 成稿工作流', '',
    '- 选题（topics）：候选 candidate → 写作中 writing → 已完成 done。一个选题可以产出多个平台的稿件。',
    '- 稿件（drafts）：大纲 outline → 写作中 writing → 校对中 review → 就绪 ready → 已发布 published。',
    '- 标准流程：确认选题方向 → 写 outline（大纲）→ 用户认可后写 body（正文）→ 按平台改写副本 → 配图 → 就绪后导出。',
    '- **大纲先于正文**：不要一上来就写两千字正文，先把大纲写进 `outline` 数组给用户看。',
    '- **发布后回填数据**：用户会把已发布稿件的阅读/点赞/评论填进稿件的 `published` 字段；',
    '  用户说「复盘」时，读所有 published 稿件的数据，**按平台分开比较**——各平台阅读量级不同，',
    '  先算各平台的总阅读和篇均阅读，别跨平台直接比总数；再在平台内部找选题角度、标题路子、开头方式与数据的相关性，',
    '  把结论（两三句、可执行）写进 `project.insights`——发散选题和写稿之前先读它，让历史表现参与决策。', '',
    '## 格式要求', '',
    ...formatSpecLines(),
    '## 编辑 project.json 的规则', '',
    '- 保留 `schemaVersion` 和已有条目的 `id`、`createdAt`；修改条目时更新它的 `updatedAt`（ISO 时间）。',
    '- 新增选题往 `topics` 追加：`id`(topic-xxxxxxxx)、`title`、`angle`(切入方向)、`formats`(目标平台数组)、`status:"candidate"`、`createdAt`、`updatedAt`。',
    '- 新增稿件往 `drafts` 追加：`id`(draft-xxxxxxxx)、`topicId`(可空)、`format`、`title`、`status:"outline"`、`outline:[]`、`body:""`、`images:[]`、`versions:[]`、`createdAt`、`updatedAt`。',
    '- **大改正文前先留档**：把当前的 `{title, body}` 追加进该稿件的 `versions`（字段：`id`(ver-xxxxxxxx)、`at`、`note`、`title`、`body`），最多保留 20 条，超了删最旧。',
    '- 图片：图片文件放进 `images/` 文件夹，在稿件的 `images` 数组里登记 `{id, slot, prompt, file, alt}`；',
    '  `slot` 用 `cover`（封面）或 `inline`（文内插图），`file` 填相对路径如 `images/cover.png`，`prompt` 填画面描述。',
    '  如果你有能力生成图片就直接生成进 `images/`；没有就把 `prompt` 写细，留给用户去生图。',
    '- 素材：文本/链接类素材追加进 `materials` 数组（`id`(mat-xxxxxxxx)、`name`、`kind`(text/link)、`content`、`tags`、`createdAt`）；',
    '  文件类素材放进 `materials/` 文件夹，`kind` 用 `file`、`content` 填相对路径。',
    '- 导出：就绪的稿件导出到 `exports/`，文件名 `<format>-<标题>.md`，含标题、摘要/标签等元信息和正文；导出在活动记录里记一笔。',
    '- 每条重要操作在 `activity` 头部追加 `{id, at, text}`，最多 200 条。', '',
    '## 当前状态', '',
    `选题 ${state.topics.length} 个（候选 ${state.topics.filter(t => t.status === 'candidate').length} / 写作中 ${state.topics.filter(t => t.status === 'writing').length} / 已完成 ${state.topics.filter(t => t.status === 'done').length}），` +
      `稿件 ${state.drafts.length} 篇，素材 ${state.materials.length} 条。`, '',
  ]
  if (state.ignoredFields?.length) {
    lines.push('## ⚠ 上次写入被丢弃的字段', '',
      '你（或上次会话）写进 project.json 的以下字段不在白名单里，已被清洗丢弃，如需保留请改用合法字段：', '')
    for (const f of state.ignoredFields) lines.push(`- ${f}`)
    lines.push('')
  }
  return lines.join('\n')
}

async function writeContext(folder, state) {
  const target = join(folder, 'CONTEXT.md')
  const content = contextDocument(state)
  try { if (await readFile(target, 'utf8') === content) return } catch {}
  await writeFile(target, content, 'utf8')
}

// ── persistence ──────────────────────────────────────────
async function scaffold(folder) {
  await Promise.all([
    mkdir(join(folder, 'images'), { recursive: true }),
    mkdir(join(folder, 'materials'), { recursive: true }),
    mkdir(join(folder, 'exports'), { recursive: true }),
  ])
}

export async function ensureProject(slug) {
  const { row } = await registryRow(slug)
  const folder = row.folder
  // 文件夹是用户当初确认过的位置。整个文件夹不见了（被移走、删除，或在未同步的
  // 另一台机器上）时不得自动重建同名目录——由客户端引导用户重新选择位置。
  const info = await stat(folder).catch(() => null)
  if (!info?.isDirectory()) {
    const error = new Error(`项目文件夹不存在：${folder}`)
    error.code = 'PROJECT_FOLDER_MISSING'
    throw error
  }
  const statePath = join(folder, 'project.json')
  let state
  try {
    state = migrate(JSON.parse(await readFile(statePath, 'utf8')), folder, row.id)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error('项目文件 project.json 无法解析，请先修复或移走它')
    // 文件夹在、状态文件不在：在用户确认过的文件夹里补齐项目结构。
    await scaffold(folder)
    state = emptyProject(row.id, row.name, folder)
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  }
  await writeContext(folder, state)
  return { folder, statePath, state }
}

/**
 * 新建项目。folder 必须是宿主目录选择器返回的绝对路径（用户明确确认的位置）。
 * 所选文件夹里已有 project.json 时认领这个现有项目（换机/重装后恢复），
 * 而不是在旁边再建一个。
 */
export async function createProject({ name, folder } = {}) {
  const label = text(name, 80)
  if (!label) throw new Error('项目名称不能为空')
  const rawFolder = String(folder || '')
  if (!rawFolder || !isAbsolute(rawFolder)) throw new Error('缺少用户选择的项目文件夹')
  const target = resolve(rawFolder)
  const registry = await loadRegistry()
  const byFolder = registry.projects.find(p => samePath(p.folder, target))
  if (byFolder) {
    const { state } = await ensureProject(byFolder.id)
    return { summary: projectSummary(state), adopted: true }
  }

  const statePath = join(target, 'project.json')
  let existing = null
  try { existing = JSON.parse(await readFile(statePath, 'utf8')) } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error('所选文件夹里的 project.json 无法解析')
  }
  if (existing && typeof existing === 'object') {
    const id = slugify(existing?.project?.id || basename(target), `project-${Date.now()}`)
    if (registry.projects.some(p => p.id === id)) throw new Error('这个文件夹里的项目已在工作台中')
    registry.projects.push({ id, name: text(existing?.project?.name, 80) || label, folder: target, createdAt: now() })
    await saveRegistry(registry)
    const { state } = await ensureProject(id)
    return { summary: projectSummary(state), adopted: true }
  }

  const base = slugify(label, `project-${Date.now()}`)
  let slug = base, suffix = 2
  while (registry.projects.some(row => row.id === slug)) slug = `${base}-${suffix++}`
  const finalName = slug === base ? label : `${label}（${suffix - 1}）`
  await scaffold(target)
  const state = emptyProject(slug, finalName, target)
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  await writeContext(target, state)
  registry.projects.push({ id: slug, name: finalName, folder: target, createdAt: now() })
  await saveRegistry(registry)
  return { summary: projectSummary(state), adopted: false }
}

/** 项目文件夹被移走后重新指定位置。目标里已有同 id 项目文件时直接认领。 */
export async function relinkProject({ project, folder } = {}) {
  const id = slugify(project)
  if (!id) throw new Error('缺少 project 参数')
  const rawFolder = String(folder || '')
  if (!rawFolder || !isAbsolute(rawFolder)) throw new Error('缺少用户选择的项目文件夹')
  const target = resolve(rawFolder)
  const registry = await loadRegistry()
  const row = registry.projects.find(p => p.id === id)
  if (!row) throw new Error('项目不存在或已从工作台移除')
  if (registry.projects.some(p => p.id !== id && samePath(p.folder, target))) throw new Error('该文件夹已登记为另一个项目')
  let existing = null
  try { existing = JSON.parse(await readFile(join(target, 'project.json'), 'utf8')) } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error('所选文件夹里的 project.json 无法解析')
  }
  if (existing) {
    const other = slugify(existing?.project?.id || '')
    if (other && other !== id) throw new Error('所选文件夹里是另一个项目')
  }
  // 目标文件夹还不存在时补建——这个位置是用户刚在系统选择器里明确确认的
  // （原生选择器里点「新建文件夹」返回的就是尚不存在的路径），不属于静默创建。
  const info = await stat(target).catch(() => null)
  if (!info?.isDirectory()) await scaffold(target)
  row.folder = target
  await saveRegistry(registry)
  const { state } = await ensureProject(id)
  return { summary: projectSummary(state) }
}

/** 从工作台移除项目：只撤销登记，用户文件原样留在磁盘上。 */
export async function removeProject(slug) {
  const { registry, row } = await registryRow(slug)
  registry.projects = registry.projects.filter(p => p.id !== row.id)
  await saveRegistry(registry)
  return { ok: true, kept: row.folder }
}

async function saveState(folder, state, log) {
  state.project.updatedAt = now()
  if (log?.text) {
    state.activity.unshift({ id: randomUUID(), at: now(), text: log.text })
    state.activity = state.activity.slice(0, 200)
  }
  const statePath = join(folder, 'project.json')
  const temp = `${statePath}.${process.pid}.tmp`
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  await rename(temp, statePath)
  if (log?.durable) await appendFile(join(folder, 'changelog.md'), `- ${now()} — ${log.text}\n`, 'utf8')
  await writeContext(folder, state)
  return state
}

function projectSummary(state) {
  return {
    id: state.project.id, name: state.project.name,
    sessionId: state.project.sessionId || '',
    folder: state.project.folder,
    topics: state.topics.length,
    drafts: state.drafts.length,
    materials: state.materials.length,
    updatedAt: state.project.updatedAt,
    statusLabel: !state.topics.length ? '还没有选题'
      : `${state.topics.filter(t => t.status !== 'done').length} 个选题在跟进 / ${state.drafts.length} 篇稿`,
  }
}

async function listProjects() {
  const { projects } = await loadRegistry()
  const rows = []
  for (const row of projects) {
    try {
      const raw = JSON.parse(await readFile(join(row.folder, 'project.json'), 'utf8'))
      rows.push(projectSummary(migrate(raw, row.folder, row.id)))
    } catch {
      // 文件夹被移走或 project.json 损坏：保留条目、标记 missing，由用户重新选择
      // 位置，不能让项目从列表里悄悄消失（那看起来像数据丢了）。
      rows.push({
        id: row.id, name: row.name, sessionId: '', folder: row.folder,
        topics: 0, drafts: 0, materials: 0, updatedAt: '',
        missing: true, statusLabel: '项目文件夹不在了',
      })
    }
  }
  return rows.sort((a, b) => Number(!!a.missing) - Number(!!b.missing) || String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

// ── actions ──────────────────────────────────────────────
const topicOf = (state, id) => state.topics.find(t => t.id === id)
const draftOf = (state, id) => state.drafts.find(d => d.id === id)
const materialOf = (state, id) => state.materials.find(m => m.id === id)

function requireTopic(state, id) {
  const topic = topicOf(state, id)
  if (!topic) throw new Error('选题不存在')
  return topic
}
function requireDraft(state, id) {
  const draft = draftOf(state, id)
  if (!draft) throw new Error('稿件不存在')
  return draft
}

export function applyAction(state, action) {
  const type = action?.type

  if (type === 'select-topic') {
    if (action.id !== null && !topicOf(state, action.id)) throw new Error('选题不存在')
    state.selectedTopicId = action.id
    return null
  }
  if (type === 'select-draft') {
    if (action.id !== null && !draftOf(state, action.id)) throw new Error('稿件不存在')
    state.selectedDraftId = action.id
    return null
  }
  if (type === 'bind-session') {
    const id = text(action.sessionId, 120)
    if (!id) throw new Error('会话 id 不能为空')
    state.project.sessionId = id
    state.project.updatedAt = now()
    return { text: '', durable: false }
  }
  if (type === 'rename-project') {
    const name = text(action.name, 80)
    if (!name) throw new Error('项目名称不能为空')
    const before = state.project.name
    if (name === before) return null
    state.project.name = name
    // 文件夹保持原 slug：改名文件夹会把绑定会话的 cwd 掀掉。
    return { text: `项目「${before}」改名为「${name}」`, durable: false }
  }
  if (type === 'project-meta') {
    const p = state.project
    if (typeof action.persona === 'string') p.persona = text(action.persona, 2000)
    if (typeof action.audience === 'string') p.audience = text(action.audience, 1000)
    if (typeof action.bannedWords === 'string') p.bannedWords = text(action.bannedWords, 1000)
    if (Array.isArray(action.customAsks)) p.customAsks = normalizeCustomAsks(action.customAsks)
    return { text: '更新项目设置', durable: false }
  }

  // ── topics ──
  if (type === 'create-topic') {
    const topic = normalizeTopic({ ...action.topic, id: undefined }, state.topics.length)
    state.topics.push(topic)
    state.selectedTopicId = topic.id
    return { text: `新增选题「${topic.title}」`, durable: true }
  }
  if (type === 'import-topics') {
    const rows = Array.isArray(action.topics) ? action.topics : []
    if (!rows.length) throw new Error('没有可导入的选题')
    let added = 0
    for (const row of rows.slice(0, 50)) {
      state.topics.push(normalizeTopic({ ...row, id: undefined }, state.topics.length))
      added += 1
    }
    return { text: `批量导入 ${added} 个选题`, durable: true }
  }
  if (type === 'update-topic') {
    const topic = requireTopic(state, action.id)
    const patch = action.patch && typeof action.patch === 'object' ? action.patch : {}
    const merged = normalizeTopic({ ...topic, ...patch, id: topic.id }, 0)
    Object.assign(topic, merged, { updatedAt: now() })
    return { text: `更新选题「${topic.title}」`, durable: false }
  }
  if (type === 'topic-status') {
    const topic = requireTopic(state, action.id)
    if (!TOPIC_STATUSES.includes(action.status)) throw new Error('状态不合法')
    topic.status = action.status
    topic.updatedAt = now()
    return { text: `「${topic.title}」状态改为${TOPIC_STATUS_LABEL[action.status]}`, durable: false }
  }
  if (type === 'delete-topic') {
    const topic = requireTopic(state, action.id)
    state.topics = state.topics.filter(t => t.id !== topic.id)
    for (const draft of state.drafts) if (draft.topicId === topic.id) draft.topicId = ''
    if (state.selectedTopicId === topic.id) state.selectedTopicId = state.topics[0]?.id ?? null
    return { text: `删除选题「${topic.title}」，其稿件已解除关联`, durable: true }
  }

  // ── drafts ──
  if (type === 'create-draft') {
    if (action.topicId) requireTopic(state, action.topicId)
    const draft = normalizeDraft({ ...action.draft, id: undefined, topicId: action.topicId ?? action.draft?.topicId }, state.drafts.length)
    state.drafts.push(draft)
    state.selectedDraftId = draft.id
    return { text: `新建${FORMATS[draft.format].label}稿「${draft.title || '未命名'}」`, durable: true }
  }
  if (type === 'update-draft') {
    const draft = requireDraft(state, action.id)
    const patch = action.patch && typeof action.patch === 'object' ? action.patch : {}
    // 保存即留档：正文有变化时，把保存前的状态自动存进历史版本；
    // 与最新一版完全相同则跳过（连续点保存不会刷出重复版本）。
    const bodyChanged = typeof patch.body === 'string' && patch.body !== draft.body
    const latest = draft.versions[draft.versions.length - 1]
    if (bodyChanged && draft.body && (!latest || latest.body !== draft.body)) {
      draft.versions.push({ id: `ver-${randomUUID().slice(0, 8)}`, at: now(), note: '保存前自动留档', title: draft.title, body: draft.body })
      draft.versions = draft.versions.slice(-MAX_VERSIONS)
    }
    const merged = normalizeDraft({ ...draft, ...patch, id: draft.id, versions: draft.versions }, 0)
    Object.assign(draft, merged, { updatedAt: now() })
    return { text: `更新稿件「${draft.title || '未命名'}」`, durable: false }
  }
  if (type === 'draft-status') {
    const draft = requireDraft(state, action.id)
    if (!DRAFT_STATUSES.includes(action.status)) throw new Error('状态不合法')
    draft.status = action.status
    draft.updatedAt = now()
    return { text: `「${draft.title || '未命名'}」状态改为${DRAFT_STATUS_LABEL[action.status]}`, durable: false }
  }
  if (type === 'publish-data') {
    const draft = requireDraft(state, action.id)
    draft.published = normalizePublished(action.published)
    // 回填数据自动推进到「已发布」；清空数据退回「就绪」。发布是里程碑，记进 changelog。
    draft.status = draft.published ? 'published' : (draft.status === 'published' ? 'ready' : draft.status)
    draft.updatedAt = now()
    return {
      text: draft.published
        ? `「${draft.title || '未命名'}」标记已发布，阅读 ${draft.published.reads}`
        : `「${draft.title || '未命名'}」取消发布标记`,
      durable: true,
    }
  }
  if (type === 'save-version') {
    const draft = requireDraft(state, action.id)
    draft.versions.push({ id: `ver-${randomUUID().slice(0, 8)}`, at: now(), note: text(action.note, 200), title: draft.title, body: draft.body })
    draft.versions = draft.versions.slice(-MAX_VERSIONS)
    return { text: `「${draft.title || '未命名'}」留存版本（共 ${draft.versions.length} 版）`, durable: false }
  }
  if (type === 'restore-version') {
    const draft = requireDraft(state, action.id)
    const version = draft.versions.find(v => v.id === action.versionId)
    if (!version) throw new Error('版本不存在')
    // 回滚前把当前状态也留一版，否则回滚本身就是一次不可逆的丢失。
    draft.versions.push({ id: `ver-${randomUUID().slice(0, 8)}`, at: now(), note: '回滚前自动留档', title: draft.title, body: draft.body })
    draft.versions = draft.versions.slice(-MAX_VERSIONS)
    draft.title = version.title
    draft.body = version.body
    draft.updatedAt = now()
    return { text: `「${draft.title || '未命名'}」回滚到 ${version.at} 的版本`, durable: true }
  }
  if (type === 'delete-draft') {
    const draft = requireDraft(state, action.id)
    state.drafts = state.drafts.filter(d => d.id !== draft.id)
    if (state.selectedDraftId === draft.id) state.selectedDraftId = null
    return { text: `删除稿件「${draft.title || '未命名'}」`, durable: true }
  }

  // ── materials ──
  if (type === 'add-material') {
    const material = normalizeMaterial({ ...action.material, id: undefined }, state.materials.length)
    state.materials.push(material)
    return { text: `新增素材「${material.name}」`, durable: false }
  }
  if (type === 'update-material') {
    const material = materialOf(state, action.id)
    if (!material) throw new Error('素材不存在')
    const patch = action.patch && typeof action.patch === 'object' ? action.patch : {}
    const merged = normalizeMaterial({ ...material, ...patch, id: material.id }, 0)
    Object.assign(material, merged)
    return { text: `更新素材「${material.name}」`, durable: false }
  }
  if (type === 'delete-material') {
    const material = materialOf(state, action.id)
    if (!material) throw new Error('素材不存在')
    state.materials = state.materials.filter(m => m.id !== material.id)
    return { text: `删除素材「${material.name}」`, durable: false }
  }

  throw new Error('不支持的操作')
}

/** 导出成稿到 exports/，返回相对路径。 */
export async function exportDraft(state, draftId) {
  const draft = draftOf(state, draftId)
  if (!draft) throw new Error('稿件不存在')
  if (!String(draft.body).trim()) throw new Error('正文还是空的，没什么可导出的')
  const f = FORMATS[draft.format]
  const metaLines = [
    draft.digest ? `> 摘要：${draft.digest}` : '',
    draft.tags.length ? `> 话题：${draft.tags.map(t => `#${t}`).join(' ')}` : '',
    draft.hook ? `> 钩子：${draft.hook}` : '',
    draft.durationTarget ? `> 目标时长：${draft.durationTarget}s` : '',
    draft.images.length ? `> 配图：${draft.images.map(i => `${i.slot === 'cover' ? '封面' : '插图'} ${i.file || '(待生成)'} — ${i.prompt || i.alt || '无描述'}`).join('；')}` : '',
  ].filter(Boolean)
  const header = [
    `# ${draft.title || '未命名'}`, '',
    `> 格式：${f.label}　导出时间：${now()}`,
    ...metaLines,
    '', '---', '',
  ].join('\n')
  const filename = `${draft.format}-${slugify(draft.title, draft.id)}.md`
  return { filename, content: `${header}\n${draft.body}\n` }
}

// ── http ─────────────────────────────────────────────────
async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new Error('请求内容过大')
    chunks.push(chunk)
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function serveAsset(pathname, res) {
  const [file, contentType] = ASSETS[pathname]
  const bytes = await readFile(file)
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
  res.end(bytes)
}

const projectParam = url => {
  const slug = slugify(url.searchParams.get('project') || '')
  if (!slug) throw new Error('缺少 project 参数')
  return slug
}

// 项目加载失败按语义映射到状态码：未登记 404、文件夹丢失 409（可重新选择位置）。
async function loadForResponse(res, slug) {
  try {
    return await ensureProject(slug)
  } catch (error) {
    if (error?.code === 'PROJECT_UNKNOWN') {
      json(res, 404, { error: error.message, code: 'PROJECT_UNKNOWN' })
      return null
    }
    if (error?.code === 'PROJECT_FOLDER_MISSING') {
      json(res, 409, { error: error.message, code: 'PROJECT_FOLDER_MISSING' })
      return null
    }
    throw error
  }
}

const SUBDIRS = new Set(['images', 'materials', 'exports'])

export async function handleApi(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1')

  if (ASSETS[url.pathname]) {
    if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
    return serveAsset(url.pathname, res)
  }

  /**
   * project.json 变更的长轮询。面板 iframe 被 Chrome 报成 hidden，定时器会被
   * 节流到一分钟一次，DSH 改了文件界面却不动；一个在途请求不是定时器，不受
   * 节流影响，文件一变就返回，延迟从秒级降到毫秒级。
   */
  if (url.pathname === '/api/content/watch') {
    if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
    const slug = slugify(url.searchParams.get('project') || '')
    if (!slug) return json(res, 400, { error: '缺少 project 参数' })
    // 长轮询只读不写：未登记的项目直接 404，文件夹丢失时 revision 计算自然落空，
    // 不能像 bootstrap 那样顺手补建 project.json。
    const { row } = await registryRow(slug).catch(() => ({}))
    if (!row) return json(res, 404, { error: '项目不存在或已从工作台移除' })
    const statePath = join(row.folder, 'project.json')
    const since = String(url.searchParams.get('since') || '')
    const revOf = async () => {
      try { const info = await stat(statePath); return `${info.mtimeMs}:${info.size}` } catch { return '' }
    }
    const current = await revOf()
    if (current !== since) return json(res, 200, { revision: current, changed: true })

    await new Promise(resolve => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        clearInterval(poller)
        clearTimeout(timer)
        resolve()
      }
      // 不用 fs.watch：Windows 上原子改名会报临时文件名，OneDrive 接管的 Documents
      // 目录更是会整个漏报事件。每 1.5 秒 stat 一次 project.json 比对 mtime+size，
      // 最坏 1.5 秒发现变更——轮询在这里比事件可靠得多。
      const poller = setInterval(async () => {
        try { if (await revOf() !== since) finish() } catch {}
      }, 1500)
      poller.unref?.()
      const timer = setTimeout(finish, 25000)
      req.on('close', finish)
    })
    if (res.writableEnded) return undefined
    const after = await revOf()
    return json(res, 200, { revision: after, changed: after !== since })
  }

  if (url.pathname === '/api/content/bootstrap') {
    if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
    const loaded = await loadForResponse(res, projectParam(url))
    if (!loaded) return undefined
    const { folder, state, statePath } = loaded
    const info = await stat(statePath)
    return json(res, 200, {
      folder, state,
      revision: `${info.mtimeMs}:${info.size}`,
      meta: {
        formats: Object.entries(FORMATS).map(([id, f]) => ({ id, label: f.label, titleMax: f.titleMax, fields: f.fields })),
        topicStatuses: TOPIC_STATUS_LABEL,
        draftStatuses: DRAFT_STATUS_LABEL,
      },
    })
  }

  if (url.pathname === '/api/content/alldata') {
    if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
    // 跨项目汇总：所有项目里已发布稿件的数据，外加各项目的复盘结论。
    const rows = []
    const projects = []
    for (const p of await listProjects()) {
      try {
        const { state } = await ensureProject(p.id)
        projects.push({ id: state.project.id, name: state.project.name, insights: state.project.insights || '' })
        for (const d of state.drafts) {
          if (!d.published) continue
          rows.push({
            project: state.project.id, projectName: state.project.name,
            draftId: d.id, title: d.title, format: d.format,
            topic: topicOf(state, d.topicId)?.title || '',
            published: d.published,
          })
        }
      } catch { /* 单个项目坏了不拖垮总览 */ }
    }
    rows.sort((a, b) => b.published.reads - a.published.reads)
    return json(res, 200, { rows, projects })
  }

  if (url.pathname === '/api/content/projects') {
    if (req.method === 'GET') return json(res, 200, { projects: await listProjects() })
    if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
    const payload = await readBody(req)
    // folder 来自宿主目录选择器：用户在系统选择器里明确挑选或新建的位置。
    // 没有这个字段一律拒绝，工作台不替用户猜项目该放在哪。
    try {
      const { summary, adopted } = await createProject({ name: payload.name, folder: payload.folder })
      return json(res, 201, { project: summary, adopted })
    } catch (error) {
      return json(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (url.pathname === '/api/content/projects/relink') {
    if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
    const payload = await readBody(req)
    try {
      const { summary } = await relinkProject({ project: payload.project, folder: payload.folder })
      return json(res, 200, { ok: true, project: summary })
    } catch (error) {
      const status = /不存在|已被移除/.test(error?.message || '') ? 404 : 400
      return json(res, status, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (url.pathname === '/api/content/projects/delete') {
    if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
    const payload = await readBody(req)
    const slug = slugify(payload.project || '')
    if (!slug) return json(res, 400, { error: '缺少 project 参数' })
    try {
      // 只撤销登记：项目文件夹里有用户的大纲、成稿和素材，位置也是用户选的，
      // 一次菜单点击不能动用户的文件。
      const { kept } = await removeProject(slug)
      return json(res, 200, { ok: true, kept })
    } catch (error) {
      if (error?.code === 'PROJECT_UNKNOWN') return json(res, 404, { error: error.message })
      throw error
    }
  }

  if (url.pathname === '/api/content/action') {
    if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
    const action = await readBody(req)
    const slug = slugify(action.project || '')
    if (!slug) return json(res, 400, { error: '缺少 project 参数' })
    const loaded = await loadForResponse(res, slug)
    if (!loaded) return undefined
    const { folder, state } = loaded
    if (action.type === 'export-draft') {
      const { filename, content } = await exportDraft(state, action.id)
      await writeFile(join(folder, 'exports', filename), content, 'utf8')
      const log = { text: `导出「${filename}」到 exports/`, durable: true }
      await saveState(folder, state, log)
      const info = await stat(join(folder, 'project.json'))
      return json(res, 200, { ok: true, state, log: log.text, file: `exports/${filename}`, revision: `${info.mtimeMs}:${info.size}` })
    }
    const log = applyAction(state, action)
    const next = await saveState(folder, state, log)
    // 把保存后的 revision 带回给客户端，否则客户端自己触发的文件变更
    // 会被 watch 当成"外部改动"再拉一次全量，打断正在进行的输入。
    const info = await stat(join(folder, 'project.json'))
    return json(res, 200, { ok: true, state: next, log: log?.text || '', revision: `${info.mtimeMs}:${info.size}` })
  }

  if (url.pathname === '/api/content/files') {
    if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
    const loaded = await loadForResponse(res, projectParam(url))
    if (!loaded) return undefined
    const { folder } = loaded
    const dir = String(url.searchParams.get('dir') || '')
    if (!SUBDIRS.has(dir)) return json(res, 400, { error: 'dir 只能是 images / materials / exports' })
    const target = join(folder, dir)
    const rows = []
    try {
      for (const entry of await readdir(target, { withFileTypes: true })) {
        if (!entry.isFile()) continue
        const info = await stat(join(target, entry.name))
        rows.push({ name: entry.name, path: `${dir}/${entry.name}`, size: info.size, mtime: info.mtimeMs })
      }
    } catch {}
    rows.sort((a, b) => b.mtime - a.mtime)
    return json(res, 200, { files: rows })
  }

  if (url.pathname === '/api/content/file') {
    if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
    const loaded = await loadForResponse(res, projectParam(url))
    if (!loaded) return undefined
    const { folder } = loaded
    // resolve() 在 Windows 产出反斜杠，前缀判断必须带上平台分隔符，
    // 否则要么永远 403，要么放过 "../" 越界路径。
    const target = resolve(folder, String(url.searchParams.get('path') || ''))
    const prefix = folder.endsWith(sep) ? folder : `${folder}${sep}`
    if (target !== folder && !target.startsWith(prefix)) return json(res, 403, { error: 'invalid path' })
    const bytes = await readFile(target)
    const mime = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
      '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
      '.json': 'application/json; charset=utf-8' })[extname(target).toLowerCase()] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
    res.end(bytes)
    return
  }

  return json(res, 404, { error: 'not found' })
}

export function apply(ctx) {
  const routes = [...Object.keys(ASSETS),
    '/api/content/bootstrap', '/api/content/projects', '/api/content/projects/delete', '/api/content/projects/relink',
    '/api/content/action', '/api/content/watch', '/api/content/files', '/api/content/file']
  for (const path of routes) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path,
      handler: (req, res) => handleApi(req, res).catch(error => json(res, 500, { error: error instanceof Error ? error.message : String(error) })),
    }), `dsh-content-workbench: ${path}`)
  }
}
