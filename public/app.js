// 内容创作工作台 —— iframe 内应用
const qs = new URLSearchParams(location.search)
const PROJECT = qs.get('project') || ''
const VIEW = qs.get('view') || ''   // 'alldata' = 跨项目数据总览独立页

let state = null
let revision = ''
let meta = { formats: [], topicStatuses: {}, draftStatuses: {} }
let folder = ''
let dirty = false            // 有未保存的本地编辑
let staleSeen = false
let currentView = 'topic'
let topicFilter = 'all'
let bodyMode = 'edit'        // 稿件正文：edit | preview
let imageFiles = []          // images/ 目录文件清单

const $ = sel => document.querySelector(sel)
const el = (tag, cls, text) => {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

// ── api ────────────────────────────────────────────────
async function request(path, options) {
  const response = await fetch(path, options)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`)
  return result
}
const projectUrl = path => `${path}?project=${encodeURIComponent(PROJECT)}`

async function act(type, payload = {}) {
  const result = await request('/api/content/action', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ project: PROJECT, type, ...payload }),
  })
  if (result.state) { state = result.state; render() }
  if (result.revision) revision = result.revision
  if (result.log) toast(result.log)
  return result
}

function toast(message) {
  const node = $('#toast')
  node.textContent = message
  node.dataset.show = 'true'
  clearTimeout(toast._t)
  toast._t = setTimeout(() => { node.dataset.show = 'false' }, 2600)
}

// ── modal ──────────────────────────────────────────────
function openModal({ title, body, onSubmit, okText = '确定' }) {
  const modal = $('#modal')
  $('#modalTitle').textContent = title
  const box = $('#modalBody')
  box.innerHTML = ''
  if (typeof body === 'string') box.innerHTML = body
  else if (body) box.appendChild(body)
  $('#modalOk').textContent = okText
  modal.hidden = false
  const form = $('#modalForm')
  const close = () => { modal.hidden = true; form.onsubmit = null }
  $('#modalCancel').onclick = close
  modal.onmousedown = e => { if (e.target === modal) close() }
  form.onsubmit = async e => {
    e.preventDefault()
    try {
      // 只有 onSubmit 显式 return true 才保持打开（比如校验失败）。
      // act() 返回的是真值响应对象，不能让它把弹窗卡住——删除按钮曾因此看似没反应。
      const keep = await onSubmit(box)
      if (keep !== true) close()
    } catch (error) { toast(error.message) }
  }
  const first = box.querySelector('input, textarea, select')
  if (first) first.focus()
  return close
}

// ── markdown 迷你渲染（预览用）─────────────────────────
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function inline(s) {
  let out = esc(s)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) => {
    const url = /^https?:\/\//.test(src) ? src : fileUrl(src)
    return `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">`
  })
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  return out
}
function mdRender(src) {
  const lines = String(src || '').split('\n')
  const html = []
  let list = null
  const closeList = () => { if (list) { html.push(`</${list}>`); list = null } }
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) { closeList(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue }
    if (/^\s*>\s?/.test(line)) { closeList(); html.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ''))}</blockquote>`); continue }
    if (/^\s*([-*_])\s*\1\s*\1[\s]*$/.test(line) || /^\s*---+\s*$/.test(line)) { closeList(); html.push('<hr>'); continue }
    const ul = line.match(/^\s*[-*]\s+(.*)$/)
    if (ul) { if (list !== 'ul') { closeList(); html.push('<ul>'); list = 'ul' } html.push(`<li>${inline(ul[1])}</li>`); continue }
    const ol = line.match(/^\s*\d+[.、]\s*(.*)$/)
    if (ol) { if (list !== 'ol') { closeList(); html.push('<ol>'); list = 'ol' } html.push(`<li>${inline(ol[1])}</li>`); continue }
    closeList()
    if (!line.trim()) continue
    html.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  return html.join('\n')
}

function fileUrl(path) {
  return `/api/content/file?project=${encodeURIComponent(PROJECT)}&path=${encodeURIComponent(path)}`
}

// ── 平台发布版复制 ─────────────────────────────────────
// markdown → 纯文本（小红书/视频脚本用；知乎直接吃 markdown 原文）
function mdPlain(src) {
  return String(src || '').split('\n').map(line => {
    const t = line.trim()
    if (!t) return ''
    const h = t.match(/^#{1,3}\s+(.*)$/); if (h) return h[1]
    if (/^>\s?/.test(t)) return t.replace(/^>\s?/, '')
    if (/^([-*_])\s*\1\s*\1\s*$/.test(t) || /^---+$/.test(t)) return ''
    const ul = t.match(/^[-*]\s+(.*)$/); if (ul) return `· ${ul[1]}`
    return t
  }).join('\n')
    .replace(/!\[([^\]]*)\]\([^)\s]+\)/g, '[$1]')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1（$2）')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n').trim()
}

// 公众号编辑器会剥掉 class 和 <style>，只保留内联样式——所以这里全部手写内联。
function wechatHtml(draft) {
  const S = {
    h2: 'font-size:17px;font-weight:600;color:#1a1a1a;margin:30px 0 14px;padding-left:10px;border-left:3px solid #6b5a9e;line-height:1.5',
    p: 'font-size:15px;color:#3f3f3f;line-height:1.85;letter-spacing:.4px;margin:0 0 18px;text-align:justify',
    quote: 'margin:18px 0;padding:14px 16px;background:#f6f4fa;border-radius:8px;font-size:14px;color:#5a5566;line-height:1.8',
  }
  const inlineWx = s => {
    let out = esc(s)
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) => {
      const url = /^https?:\/\//.test(src) ? src : location.origin + fileUrl(src)
      return `<img src="${esc(url)}" alt="${esc(alt)}" style="display:block;max-width:100%;margin:18px auto;border-radius:6px">`
    })
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#6b5a9e;font-weight:600">$1</strong>')
    out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
    return out
  }
  const parts = []
  let inList = false
  const closeList = () => { if (inList) { parts.push('</section>'); inList = false } }
  for (const raw of String(draft.body || '').split('\n')) {
    const line = raw.trim()
    const h = line.match(/^#{1,3}\s+(.*)$/)
    if (h) { closeList(); parts.push(`<section style="${S.h2}">${inlineWx(h[1])}</section>`); continue }
    if (/^>\s?/.test(line)) { closeList(); parts.push(`<section style="${S.quote}">${inlineWx(line.replace(/^>\s?/, ''))}</section>`); continue }
    if (/^([-*_])\s*\1\s*\1\s*$/.test(line) || /^---+$/.test(line)) { closeList(); parts.push('<section style="margin:26px 0;border-top:1px solid #ececec"></section>'); continue }
    const li = line.match(/^(?:[-*]\s+|\d+[.、]\s*)(.*)$/)
    if (li) {
      if (!inList) { parts.push('<section style="margin:0 0 18px;padding-left:4px">'); inList = true }
      parts.push(`<section style="${S.p};margin:0 0 8px">· ${inlineWx(li[1])}</section>`)
      continue
    }
    closeList()
    if (!line) continue
    parts.push(`<section style="${S.p}">${inlineWx(line)}</section>`)
  }
  closeList()
  return parts.join('\n')
}

async function copyRichText(html, plain) {
  try {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    })
    await navigator.clipboard.write([item])
    return true
  } catch {
    // 老内核兜底：contenteditable + 选区复制也能带上富文本
    const div = document.createElement('div')
    div.contentEditable = 'true'
    div.style.cssText = 'position:fixed;left:-9999px;top:0'
    div.innerHTML = html
    document.body.appendChild(div)
    const range = document.createRange(); range.selectNodeContents(div)
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range)
    let ok = false
    try { ok = document.execCommand('copy') } catch {}
    sel.removeAllRanges(); div.remove()
    return ok
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {}
  const ta = document.createElement('textarea')
  ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0'
  document.body.appendChild(ta); ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch {}
  ta.remove()
  return ok
}

async function copyDraftForPlatform(draft) {
  const title = draft.title || ''
  if (draft.format === 'wechat') {
    const ok = await copyRichText(wechatHtml(draft), `${title}\n\n${mdPlain(draft.body)}`)
    toast(ok
      ? '已复制公众号排版——到公众号编辑器正文区 Ctrl+V；标题从上面标题栏复制；图片若没跟过去，在编辑器里重传一下'
      : '复制失败，改用「导出到 exports/」')
    return
  }
  let text = `${title}\n\n${mdPlain(draft.body)}`
  let what = '全文'
  if (draft.format === 'xhs') {
    const tags = (draft.tags || []).map(t => '#' + String(t).replace(/^#/, '')).join(' ')
    text = `${title}\n\n${mdPlain(draft.body)}${tags ? `\n\n${tags}` : ''}`
    what = '小红书版（标题+正文+话题标签）'
  } else if (draft.format === 'zhihu') {
    text = `# ${title}\n\n${draft.body || ''}`
    what = 'Markdown 原文'
  } else if (draft.format === 'video') {
    text = `${title}\n\n${draft.hook ? `【黄金三秒】${draft.hook}\n\n` : ''}${mdPlain(draft.body)}`
    what = '脚本文本'
  }
  const ok = await copyText(text)
  toast(ok ? `已复制${what}——直接粘贴发布` : '复制失败，改用「导出到 exports/」')
}

const fmtLabel = id => meta.formats.find(f => f.id === id)?.label
  || ({ wechat: '公众号图文', xhs: '小红书笔记', video: '短视频脚本', zhihu: '知乎回答' }[id]) || id
const topicById = id => state?.topics.find(t => t.id === id) || null
const draftById = id => state?.drafts.find(d => d.id === id) || null
const selectedTopic = () => topicById(state?.selectedTopicId)
const selectedDraft = () => draftById(state?.selectedDraftId)
const draftsOfTopic = id => state.drafts.filter(d => d.topicId === id)

function setDirty(value) {
  dirty = value
  const sync = $('#syncState')
  sync.dataset.state = value ? 'dirty' : ''
  sync.textContent = value ? '有未保存的编辑' : '已同步'
}

// ── 交给 DSH ───────────────────────────────────────────
function askDSH(mode, extra = {}) {
  parent.postMessage({
    type: 'dsh-content:ask', project: PROJECT, mode,
    topicId: state.selectedTopicId, draftId: state.selectedDraftId, ...extra,
  }, location.origin)
  toast('已把要求和上下文填进右侧对话框，按回车发送给 DSH')
}

function askButton(icon, label, sub, mode, extra) {
  const btn = el('button', 'ask-btn')
  btn.type = 'button'
  btn.innerHTML = `<span class="col">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>`
  btn.addEventListener('click', () => askDSH(mode, extra))
  return btn
}

// ── 左栏：选题 ─────────────────────────────────────────
function renderRail() {
  $('#topicCount').textContent = state.topics.length
  const persona = $('#personaBox')
  persona.innerHTML = ''
  if (state.project.persona) {
    persona.innerHTML = `<b>人设</b> ${esc(state.project.persona)}`
  } else {
    persona.innerHTML = '还没设账号人设，<span class="set">点右上角 ⚙ 补一句</span>，DSH 写稿才有你的味道。'
    persona.querySelector('.set').addEventListener('click', openMetaModal)
  }

  const list = $('#topicList')
  list.innerHTML = ''
  const rows = state.topics.filter(t => topicFilter === 'all' || t.status === topicFilter)
  if (!rows.length) {
    const hint = el('div', 'empty-hint')
    hint.innerHTML = state.topics.length ? '这个状态下没有选题' : '还没有选题。<br>点「＋ 选题」手动建一个，<br>或让 DSH 帮你发散。'
    list.appendChild(hint)
    if (!state.topics.length) {
      const btn = askButton('💡', '让 DSH 发散选题', '先聊聊你想做什么方向', 'brainstorm')
      btn.style.margin = '4px 8px'
      list.appendChild(btn)
    }
    return
  }
  for (const topic of rows) {
    const row = el('button', 'topic-row')
    row.type = 'button'
    row.dataset.current = String(topic.id === state.selectedTopicId)
    const b = el('b', '', topic.title)
    const metaRow = el('span', 'meta')
    const st = el('span', `st ${topic.status}`, meta.topicStatuses[topic.status] || topic.status)
    metaRow.appendChild(st)
    for (const f of topic.formats) metaRow.appendChild(el('span', 'fmt', fmtLabel(f)))
    const n = draftsOfTopic(topic.id).length
    if (n) metaRow.appendChild(el('span', 'fmt', `${n} 稿`))
    row.append(b, metaRow)
    row.addEventListener('click', () => act('select-topic', { id: topic.id }).catch(e => toast(e.message)))
    list.appendChild(row)
  }
}

// ── 选题详情 ───────────────────────────────────────────
function renderTopicView() {
  const view = $('#topicView')
  view.innerHTML = ''
  const topic = selectedTopic()
  if (!topic) {
    view.appendChild(el('div', 'empty-hint', '从左边选一个选题，或新建一个。'))
    return
  }

  const form = el('div', 'editor')
  const head = el('div', 'editor-head')
  head.appendChild(el('b', '', '选题'))
  const grow = el('span', 'grow'); head.appendChild(grow)
  const statusBtn = el('button', 'button small')
  statusBtn.type = 'button'
  const nextStatus = { candidate: 'writing', writing: 'done', done: 'candidate' }[topic.status]
  statusBtn.textContent = `推进到「${meta.topicStatuses[nextStatus]}」`
  statusBtn.addEventListener('click', () => act('topic-status', { id: topic.id, status: nextStatus }).catch(e => toast(e.message)))
  const delBtn = el('button', 'button small danger', '删除')
  delBtn.type = 'button'
  delBtn.addEventListener('click', () => {
    openModal({
      title: `删除选题「${topic.title}」？`,
      body: `<p class="hint">关联的 ${draftsOfTopic(topic.id).length} 篇稿件会保留，只是不再挂在该选题下。</p>`,
      okText: '删除',
      onSubmit: () => act('delete-topic', { id: topic.id }),
    })
  })
  head.append(statusBtn, delBtn)
  form.appendChild(head)

  // 标题
  const titleField = el('div', 'field')
  titleField.appendChild(el('label', '', '选题标题'))
  const titleInput = el('input')
  titleInput.type = 'text'; titleInput.value = topic.title
  titleInput.addEventListener('input', () => setDirty(true))
  titleField.appendChild(titleInput)
  form.appendChild(titleField)

  // 方向
  const angleField = el('div', 'field')
  angleField.appendChild(el('label', '', '切入方向（从哪个角度写、核心观点是什么）'))
  const angleInput = el('textarea')
  angleInput.value = topic.angle; angleInput.rows = 3
  angleInput.addEventListener('input', () => setDirty(true))
  angleField.appendChild(angleInput)
  form.appendChild(angleField)

  // 平台
  const fmtField = el('div', 'field')
  fmtField.appendChild(el('label', '', '目标平台'))
  const checks = el('div', 'checks')
  for (const f of meta.formats) {
    const label = el('label')
    const box = document.createElement('input')
    box.type = 'checkbox'; box.value = f.id
    box.checked = topic.formats.includes(f.id)
    box.addEventListener('change', () => setDirty(true))
    label.append(box, document.createTextNode(f.label))
    checks.appendChild(label)
  }
  fmtField.appendChild(checks)
  form.appendChild(fmtField)

  // 备注
  const notesField = el('div', 'field')
  notesField.appendChild(el('label', '', '备注（灵感来源、参考链接、必须提到的点）'))
  const notesInput = el('textarea')
  notesInput.value = topic.notes; notesInput.rows = 2
  notesInput.addEventListener('input', () => setDirty(true))
  notesField.appendChild(notesInput)
  form.appendChild(notesField)

  // 保存
  const saveBtn = el('button', 'button primary', '保存选题')
  saveBtn.type = 'button'
  saveBtn.addEventListener('click', async () => {
    const formats = [...checks.querySelectorAll('input:checked')].map(c => c.value)
    try {
      await act('update-topic', { id: topic.id, patch: { title: titleInput.value, angle: angleInput.value, notes: notesInput.value, formats } })
      setDirty(false)
    } catch (e) { toast(e.message) }
  })
  form.appendChild(saveBtn)
  view.appendChild(form)

  // 关联稿件
  // 选题级数据：这个选题下已发布稿件的数据卡片（每日流量趋势也在这看）
  const pubDrafts = draftsOfTopic(topic.id).filter(d => d.published)
  if (pubDrafts.length) {
    const card = el('div', 'topic-data-card')
    card.appendChild(el('label', '', '📊 这个选题的发布数据'))
    for (const d of pubDrafts) {
      const line = el('div', 'topic-data-line')
      line.appendChild(el('span', 't', `${d.title || '未命名'} · ${fmtLabel(d.format)}`))
      line.appendChild(el('b', '', `阅读 ${fmtStat(d.published.reads)}`))
      line.appendChild(el('span', '', `赞 ${fmtStat(d.published.likes)}`))
      line.appendChild(el('span', '', `评 ${fmtStat(d.published.comments)}`))
      card.appendChild(line)
      const points = (d.published.daily || []).map(day => ({ label: day.date.slice(5), value: day.reads }))
      if (points.length) card.appendChild(lineChart(points))
    }
    card.appendChild(el('p', 'hint', '每日流量在「稿件 → 发布数据」里回填'))
    view.appendChild(card)
  }

  const sec = el('div')
  sec.style.marginTop = '16px'
  const h3 = el('h3', '', `该选题的稿件（${draftsOfTopic(topic.id).length}）`)
  h3.style.cssText = 'font-size:12px;color:var(--muted);margin:0 0 8px'
  sec.appendChild(h3)
  const newRow = el('div', 'checks')
  newRow.style.marginBottom = '10px'
  for (const f of meta.formats) {
    const btn = el('button', 'chip', `＋ ${f.label}`)
    btn.type = 'button'
    btn.addEventListener('click', async () => {
      try {
        await act('create-draft', { topicId: topic.id, draft: { format: f.id, title: topic.title } })
        switchView('drafts')
      } catch (e) { toast(e.message) }
    })
    newRow.appendChild(btn)
  }
  sec.appendChild(newRow)
  const grid = el('div', 'draft-grid')
  for (const draft of draftsOfTopic(topic.id)) grid.appendChild(draftCard(draft))
  if (!draftsOfTopic(topic.id).length) grid.appendChild(el('div', 'empty-hint', '还没有稿件，点上面按平台建一篇。'))
  sec.appendChild(grid)
  view.appendChild(sec)
}

function draftCard(draft) {
  const card = el('button', 'draft-card')
  card.type = 'button'
  card.dataset.current = String(draft.id === state.selectedDraftId)
  const top = el('span', 'meta')
  top.appendChild(el('span', 'fmt', fmtLabel(draft.format)))
  top.appendChild(el('span', `st ${draft.status}`, meta.draftStatuses[draft.status] || draft.status))
  card.appendChild(top)
  card.appendChild(el('b', '', draft.title || '未命名'))
  const brief = []
  if (draft.outline?.length) brief.push(`大纲 ${draft.outline.length} 节`)
  brief.push(`正文 ${String(draft.body || '').length} 字`)
  if (draft.images?.length) brief.push(`图 ${draft.images.filter(i => i.file).length}/${draft.images.length}`)
  card.appendChild(el('small', '', brief.join(' · ')))
  if (draft.published) {
    card.appendChild(el('small', 'pub-line',
      `阅读 ${draft.published.reads} · 赞 ${draft.published.likes} · 评 ${draft.published.comments} · 转 ${draft.published.shares}`))
  }
  card.addEventListener('click', () => act('select-draft', { id: draft.id }).then(() => switchView('drafts')).catch(e => toast(e.message)))
  return card
}

// ── 稿件 ───────────────────────────────────────────────
function renderDraftsView() {
  const view = $('#draftsView')
  view.innerHTML = ''
  const grid = el('div', 'draft-grid')
  for (const draft of state.drafts) grid.appendChild(draftCard(draft))
  if (!state.drafts.length) {
    view.appendChild(el('div', 'empty-hint', '还没有稿件。先在「选题详情」里按平台建一篇，或让 DSH 从选题生成大纲。'))
    return
  }
  view.appendChild(grid)
  const draft = selectedDraft()
  if (draft) view.appendChild(draftEditor(draft))
}

function draftEditor(draft) {
  const spec = meta.formats.find(f => f.id === draft.format) || {}
  const box = el('div', 'editor')

  const head = el('div', 'editor-head')
  head.appendChild(el('b', '', `${fmtLabel(draft.format)}稿`))
  head.appendChild(el('span', `st ${draft.status}`, meta.draftStatuses[draft.status] || draft.status))
  const grow = el('span', 'grow'); head.appendChild(grow)
  const topic = topicById(draft.topicId)
  if (topic) head.appendChild(el('span', 'fmt', `选题：${topic.title}`))
  // 状态推进
  const order = ['outline', 'writing', 'review', 'ready']
  const next = order[Math.min(order.indexOf(draft.status) + 1, order.length - 1)]
  if (draft.status !== 'ready') {
    const adv = el('button', 'button small', `推进到「${meta.draftStatuses[next]}」`)
    adv.type = 'button'
    adv.addEventListener('click', () => act('draft-status', { id: draft.id, status: next }).catch(e => toast(e.message)))
    head.appendChild(adv)
  }
  const exportBtn = el('button', 'button small', '导出到 exports/')
  exportBtn.type = 'button'
  exportBtn.addEventListener('click', async () => {
    try {
      const r = await act('export-draft', { id: draft.id })
      toast(`已导出 ${r.file}`)
    } catch (e) { toast(e.message) }
  })
  const delBtn = el('button', 'button small danger', '删除')
  delBtn.type = 'button'
  delBtn.addEventListener('click', () => {
    openModal({
      title: `删除稿件「${draft.title || '未命名'}」？`,
      body: '<p class="hint">版本记录会一起删掉，不可恢复。</p>',
      okText: '删除',
      onSubmit: () => act('delete-draft', { id: draft.id }),
    })
  })
  const copyBtn = el('button', 'button small primary', draft.format === 'wechat' ? '复制公众号排版' : '复制发布版')
  copyBtn.type = 'button'
  copyBtn.title = '按平台格式复制，直接粘贴到发布后台'
  copyBtn.addEventListener('click', () => { copyDraftForPlatform(draft).catch(e => toast(e.message)) })
  head.append(copyBtn, exportBtn, delBtn)
  box.appendChild(head)

  // 标题（带字数上限提示）
  const titleField = el('div', 'field')
  const titleLabel = el('label', '', '标题')
  const count = el('span', 'count')
  const updateCount = () => {
    count.textContent = `${[...titleInput.value].length}${spec.titleMax ? ` / ${spec.titleMax}` : ''}`
    count.dataset.over = String(Boolean(spec.titleMax && [...titleInput.value].length > spec.titleMax))
  }
  titleLabel.appendChild(count)
  titleField.appendChild(titleLabel)
  const titleInput = el('input')
  titleInput.type = 'text'; titleInput.value = draft.title
  titleInput.addEventListener('input', () => { setDirty(true); updateCount() })
  titleField.appendChild(titleInput)
  box.appendChild(titleField)
  updateCount()

  // 格式专属字段
  const extras = {}
  if (spec.fields?.includes('digest')) {
    extras.digest = textareaRow(box, '摘要（分享卡片文案，≤120 字）', draft.digest, 2)
  }
  if (spec.fields?.includes('tags')) {
    extras.tags = inputRow(box, '话题标签（空格分隔，不带 #）', draft.tags.join(' '))
  }
  if (spec.fields?.includes('hook')) {
    extras.hook = textareaRow(box, '前 3 秒钩子台词', draft.hook, 2)
    extras.durationTarget = inputRow(box, '目标时长（秒）', draft.durationTarget ?? '')
  }

  // 大纲
  const outlineField = el('div', 'field')
  outlineField.appendChild(el('label', '', '大纲'))
  const outlineList = el('ul', 'outline-list')
  const outlineValues = [...(draft.outline || [])]
  const renderOutline = () => {
    outlineList.innerHTML = ''
    outlineValues.forEach((item, i) => {
      const li = el('li')
      li.appendChild(el('span', 'no', `${i + 1}.`))
      const input = el('input')
      input.type = 'text'; input.value = item
      input.addEventListener('input', () => { outlineValues[i] = input.value; setDirty(true) })
      const rm = el('button', '', '×')
      rm.type = 'button'; rm.title = '删除这一节'
      rm.addEventListener('click', () => { outlineValues.splice(i, 1); setDirty(true); renderOutline() })
      li.append(input, rm)
      outlineList.appendChild(li)
    })
  }
  renderOutline()
  outlineField.appendChild(outlineList)
  const addOutline = el('button', 'button small subtle', '＋ 加一节')
  addOutline.type = 'button'
  addOutline.addEventListener('click', () => { outlineValues.push(''); setDirty(true); renderOutline() })
  outlineField.appendChild(addOutline)
  box.appendChild(outlineField)

  // 正文：编辑 / 预览
  const bodyField = el('div', 'field')
  const bodyTools = el('div', 'body-tools')
  bodyTools.appendChild(el('label', '', '正文（markdown）'))
  const seg = el('span', 'seg')
  const editTab = el('button', bodyMode === 'edit' ? 'active' : '', '编辑')
  const prevTab = el('button', bodyMode === 'preview' ? 'active' : '', '预览')
  editTab.type = 'button'; prevTab.type = 'button'
  seg.append(editTab, prevTab)
  bodyTools.appendChild(seg)
  const imgCount = el('span', 'hint', '')
  bodyTools.appendChild(imgCount)
  bodyField.appendChild(bodyTools)
  const bodyInput = el('textarea', 'body')
  bodyInput.value = draft.body
  bodyInput.addEventListener('input', () => setDirty(true))
  const preview = el('div', 'preview')
  const showBodyMode = mode => {
    bodyMode = mode
    editTab.className = mode === 'edit' ? 'active' : ''
    prevTab.className = mode === 'preview' ? 'active' : ''
    bodyInput.style.display = mode === 'edit' ? '' : 'none'
    preview.style.display = mode === 'preview' ? '' : 'none'
    if (mode === 'preview') preview.innerHTML = mdRender(bodyInput.value) || '<span class="hint">正文还是空的</span>'
  }
  editTab.addEventListener('click', () => showBodyMode('edit'))
  prevTab.addEventListener('click', () => showBodyMode('preview'))
  bodyField.append(bodyInput, preview)
  box.appendChild(bodyField)
  showBodyMode(bodyMode)

  // 配图
  const imgField = el('div', 'field')
  const imgLabel = el('label', '', `配图（${(draft.images || []).filter(i => i.file).length}/${(draft.images || []).length} 张已有文件）`)
  imgField.appendChild(imgLabel)
  const imgList = el('div', 'image-list')
  const imageValues = (draft.images || []).map(i => ({ ...i }))
  const renderImages = () => {
    imgList.innerHTML = ''
    imageValues.forEach((img, i) => {
      const card = el('div', 'image-card')
      const thumb = el('div', 'thumb')
      if (img.file) {
        const image = el('img')
        image.src = fileUrl(img.file); image.alt = img.alt || img.prompt || ''
        thumb.appendChild(image)
      } else {
        thumb.textContent = '待配图'
      }
      card.appendChild(thumb)
      const slotSel = document.createElement('select')
      slotSel.innerHTML = '<option value="cover">封面</option><option value="inline">文内插图</option>'
      slotSel.value = img.slot
      slotSel.addEventListener('change', () => { imageValues[i].slot = slotSel.value; setDirty(true) })
      card.appendChild(slotSel)
      const prompt = document.createElement('textarea')
      prompt.placeholder = '画面描述 / 生图提示词'
      prompt.value = img.prompt
      prompt.addEventListener('input', () => { imageValues[i].prompt = prompt.value; setDirty(true) })
      card.appendChild(prompt)
      const fileSel = document.createElement('select')
      fileSel.innerHTML = '<option value="">（未选图片文件）</option>' + imageFiles.map(f => `<option value="${esc(f.path)}">${esc(f.name)}</option>`).join('')
      fileSel.value = img.file || ''
      fileSel.addEventListener('change', () => { imageValues[i].file = fileSel.value; setDirty(true); renderImages() })
      card.appendChild(fileSel)
      const alt = document.createElement('input')
      alt.type = 'text'; alt.placeholder = 'alt 说明（可选）'; alt.value = img.alt
      alt.addEventListener('input', () => { imageValues[i].alt = alt.value; setDirty(true) })
      card.appendChild(alt)
      const row = el('div', 'row')
      const rm = el('button', 'button small danger', '移除')
      rm.type = 'button'
      rm.addEventListener('click', () => { imageValues.splice(i, 1); setDirty(true); renderImages() })
      row.appendChild(rm)
      card.appendChild(row)
      imgList.appendChild(card)
    })
  }
  renderImages()
  imgField.appendChild(imgList)
  const addImg = el('button', 'button small subtle', '＋ 加一个配图位')
  addImg.type = 'button'
  addImg.addEventListener('click', async () => {
    await refreshImageFiles()
    imageValues.push({ id: `img-${Date.now().toString(36)}`, slot: imageValues.some(i => i.slot === 'cover') ? 'inline' : 'cover', prompt: '', file: '', alt: '' })
    setDirty(true)
    renderImages()
  })
  imgField.appendChild(addImg)
  box.appendChild(imgField)

  // 保存
  const saveBtn = el('button', 'button primary', '保存稿件')
  saveBtn.type = 'button'
  saveBtn.addEventListener('click', async () => {
    const patch = {
      title: titleInput.value,
      outline: outlineValues.map(s => s.trim()).filter(Boolean),
      body: bodyInput.value,
      images: imageValues,
    }
    if (extras.digest) patch.digest = extras.digest.value
    if (extras.tags) patch.tags = extras.tags.value.split(/[\s,，#]+/).filter(Boolean)
    if (extras.hook) patch.hook = extras.hook.value
    if (extras.durationTarget) patch.durationTarget = Number(extras.durationTarget.value) || null
    try {
      await act('update-draft', { id: draft.id, patch })
      setDirty(false)
    } catch (e) { toast(e.message) }
  })
  box.appendChild(saveBtn)

  // 发布与数据：发布后回填，是「复盘」的原料。数字留空按 0 记。
  const pubField = el('div', 'field publish-box')
  pubField.appendChild(el('label', '', draft.published
    ? `发布数据（已于 ${(draft.published.at || '').slice(0, 10)} 发布）`
    : '发布数据（发布后回填，攒几篇就能让 DSH 复盘规律）'))
  const pub = draft.published || {}
  const pubGrid = el('div', 'publish-grid')
  const pubInputs = {}
  for (const [key, label] of [['reads', '阅读量'], ['likes', '点赞'], ['comments', '评论'], ['shares', '转发']]) {
    const wrap = el('span', 'publish-stat')
    wrap.appendChild(el('em', '', label))
    const input = document.createElement('input')
    input.type = 'number'; input.min = '0'; input.placeholder = '0'
    input.value = pub[key] ?? ''
    pubInputs[key] = input
    wrap.appendChild(input)
    pubGrid.appendChild(wrap)
  }
  pubField.appendChild(pubGrid)
  const urlInput = document.createElement('input')
  urlInput.type = 'text'; urlInput.placeholder = '发布链接（可选）'; urlInput.value = pub.url || ''
  const noteInput = document.createElement('input')
  noteInput.type = 'text'; noteInput.placeholder = '备注，比如「被限流」「涨粉 200」（可选）'; noteInput.value = pub.note || ''

  // 每日流量：发布后按天记阅读/点赞，选题卡片和数据面板都会用它画趋势
  const dailyRows = (pub.daily || []).map(r => ({ ...r }))
  const dailyBox = el('div', 'daily-box')
  dailyBox.appendChild(el('label', '', '每日流量（发布后按天记，自动画出趋势图）'))
  const dailyList = el('div', 'daily-list')
  const dailyChart = el('div', 'daily-chart')
  const renderDailyChart = () => {
    dailyChart.innerHTML = ''
    const points = dailyRows.filter(r => r.date).map(r => ({ label: String(r.date).slice(5), value: +r.reads || 0 }))
    points.sort((a, b) => (a.label < b.label ? -1 : 1))
    if (points.length) dailyChart.appendChild(lineChart(points))
  }
  const renderDailyRows = () => {
    dailyList.innerHTML = ''
    dailyRows.forEach((row, i) => {
      const r = el('div', 'daily-row')
      const date = document.createElement('input')
      date.type = 'date'; date.value = row.date || ''
      date.addEventListener('input', () => { dailyRows[i].date = date.value; renderDailyChart() })
      const reads = document.createElement('input')
      reads.type = 'number'; reads.min = '0'; reads.placeholder = '阅读'; reads.value = row.reads ?? ''
      reads.addEventListener('input', () => { dailyRows[i].reads = reads.value; renderDailyChart() })
      const likes = document.createElement('input')
      likes.type = 'number'; likes.min = '0'; likes.placeholder = '点赞'; likes.value = row.likes ?? ''
      likes.addEventListener('input', () => { dailyRows[i].likes = likes.value })
      const rm = el('button', 'button small danger', '×')
      rm.type = 'button'
      rm.addEventListener('click', () => { dailyRows.splice(i, 1); renderDailyRows(); renderDailyChart() })
      r.append(date, reads, likes, rm)
      dailyList.appendChild(r)
    })
  }
  renderDailyRows(); renderDailyChart()
  const addDay = el('button', 'button small subtle', '＋ 加一天')
  addDay.type = 'button'
  addDay.addEventListener('click', () => {
    if (dailyRows.length >= 60) { toast('最多记 60 天'); return }
    dailyRows.push({ date: '', reads: '', likes: '' })
    renderDailyRows()
  })
  dailyBox.append(dailyList, dailyChart, addDay)
  pubField.appendChild(dailyBox)

  const pubRow = el('div', 'row')
  pubRow.style.marginTop = '8px'
  const savePub = el('button', 'button small primary', draft.published ? '更新数据' : '标记为已发布')
  savePub.type = 'button'
  savePub.addEventListener('click', async () => {
    try {
      await act('publish-data', {
        id: draft.id,
        published: {
          at: pub.at || undefined, url: urlInput.value,
          reads: pubInputs.reads.value, likes: pubInputs.likes.value,
          comments: pubInputs.comments.value, shares: pubInputs.shares.value,
          note: noteInput.value,
          daily: dailyRows.filter(r => r.date),
        },
      })
    } catch (e) { toast(e.message) }
  })
  pubRow.appendChild(savePub)
  if (draft.published) {
    const unpub = el('button', 'button small subtle', '取消发布标记')
    unpub.type = 'button'
    unpub.addEventListener('click', () => act('publish-data', { id: draft.id, published: null }).catch(e => toast(e.message)))
    pubRow.appendChild(unpub)
  }
  pubField.append(urlInput, noteInput, pubRow)
  box.appendChild(pubField)

  // 版本
  const verField = el('div', 'field')
  verField.style.marginTop = '14px'
  verField.appendChild(el('label', '', `历史版本（${draft.versions?.length || 0}）`))
  const verList = el('div', 'version-list')
  for (const v of [...(draft.versions || [])].reverse()) {
    const row = el('div', 'version-row')
    row.appendChild(el('b', '', v.at.replace('T', ' ').slice(0, 19)))
    row.appendChild(el('span', '', `${v.note || '留档'} · ${(v.body || '').length} 字`))
    const restore = el('button', 'button small subtle', '回滚到这版')
    restore.type = 'button'
    restore.addEventListener('click', () => {
      openModal({
        title: '回滚到这个版本？',
        body: `<p class="hint">当前正文会自动留一版「回滚前自动留档」，不会丢。</p>`,
        okText: '回滚',
        onSubmit: () => act('restore-version', { id: draft.id, versionId: v.id }),
      })
    })
    row.appendChild(restore)
    verList.appendChild(row)
  }
  verField.appendChild(verList)
  const saveVer = el('button', 'button small subtle', '＋ 把当前正文留存一版')
  saveVer.type = 'button'
  saveVer.addEventListener('click', () => {
    openModal({
      title: '留存当前版本',
      body: '<div class="field"><label>版本备注</label><input type="text" name="note" placeholder="例如：DSH 大改前的原稿"></div>',
      okText: '留存',
      onSubmit: box2 => act('save-version', { id: draft.id, note: box2.querySelector('[name=note]').value }),
    })
  })
  verField.appendChild(saveVer)
  box.appendChild(verField)

  return box
}

function textareaRow(parent, label, value, rows = 2) {
  const field = el('div', 'field')
  field.appendChild(el('label', '', label))
  const input = el('textarea')
  input.rows = rows; input.value = value || ''
  input.addEventListener('input', () => setDirty(true))
  field.appendChild(input)
  parent.appendChild(field)
  return input
}
function inputRow(parent, label, value) {
  const field = el('div', 'field')
  field.appendChild(el('label', '', label))
  const input = el('input')
  input.type = 'text'; input.value = value ?? ''
  input.addEventListener('input', () => setDirty(true))
  field.appendChild(input)
  parent.appendChild(field)
  return input
}

async function refreshImageFiles() {
  try {
    const r = await request(projectUrl('/api/content/files') + '&dir=images')
    imageFiles = r.files
  } catch {}
}

// ── 素材 ───────────────────────────────────────────────
function renderMaterialsView() {
  const view = $('#materialsView')
  view.innerHTML = ''
  const bar = el('div')
  bar.style.marginBottom = '10px'
  const addBtn = el('button', 'button primary small', '＋ 添加素材')
  addBtn.type = 'button'
  addBtn.addEventListener('click', openMaterialModal)
  bar.appendChild(addBtn)
  const hint = el('span', 'hint', '　也可以直接把文件丢进项目文件夹的 materials/ 目录，或让 DSH 帮你整理')
  bar.appendChild(hint)
  view.appendChild(bar)

  const grid = el('div', 'material-grid')
  for (const m of state.materials) {
    const card = el('div', 'material-card')
    const head = el('div')
    head.appendChild(el('span', 'kind', { text: '文本', link: '链接', image: '图片', file: '文件' }[m.kind] || m.kind))
    head.appendChild(el('b', '', m.name))
    card.appendChild(head)
    card.appendChild(el('p', '', m.kind === 'file' ? `📎 ${m.content}` : m.content.slice(0, 200)))
    if (m.tags?.length) card.appendChild(el('small', 'hint', m.tags.map(t => `#${t}`).join(' ')))
    const foot = el('div', 'foot')
    const del = el('button', 'button small danger', '删除')
    del.type = 'button'
    del.addEventListener('click', () => act('delete-material', { id: m.id }).catch(e => toast(e.message)))
    foot.appendChild(del)
    card.appendChild(foot)
    grid.appendChild(card)
  }
  if (!state.materials.length) grid.appendChild(el('div', 'empty-hint', '还没有素材。加几条灵感、数据、链接，DSH 写稿时会先读它们。'))
  view.appendChild(grid)
}

function openMaterialModal() {
  openModal({
    title: '添加素材',
    body: `
      <div class="field"><label>名称</label><input type="text" name="name" placeholder="例如：三季度留存数据"></div>
      <div class="field"><label>类型</label><select name="kind">
        <option value="text">文本</option><option value="link">链接</option>
        <option value="image">图片</option><option value="file">文件</option>
      </select></div>
      <div class="field"><label>内容（文本/链接直接填；文件先丢进 materials/ 再填相对路径）</label><textarea name="content" rows="5"></textarea></div>
      <div class="field"><label>标签（空格分隔）</label><input type="text" name="tags"></div>`,
    okText: '添加',
    onSubmit: box => {
      const val = name => box.querySelector(`[name=${name}]`).value.trim()
      if (!val('name')) throw new Error('名称不能为空')
      return act('add-material', {
        material: { name: val('name'), kind: box.querySelector('[name=kind]').value, content: val('content'), tags: val('tags').split(/\s+/).filter(Boolean) },
      })
    },
  })
}

// ── 记录 ───────────────────────────────────────────────
function renderLogView() {
  const view = $('#logView')
  view.innerHTML = ''
  if (!state.activity.length) {
    view.appendChild(el('div', 'empty-hint', '还没有记录'))
    return
  }
  for (const entry of state.activity) {
    const row = el('div', 'log-row')
    row.appendChild(el('time', '', String(entry.at).replace('T', ' ').slice(0, 19)))
    row.appendChild(el('span', '', entry.text))
    view.appendChild(row)
  }
}

// ── 右栏：交给 DSH ─────────────────────────────────────
function renderInspector() {
  const box = $('#inspector')
  box.innerHTML = ''
  box.appendChild(el('h3', '', '交给 DSH'))

  if (currentView === 'topic') {
    box.appendChild(askButton('💡', '发散选题', '基于人设和已有选题出新角度', 'brainstorm'))
    if (selectedTopic()) {
      box.appendChild(askButton('📝', '生成大纲', '为当前选题建稿并写大纲', 'outline'))
      box.appendChild(askButton('🔍', '查证选题', '查这个方向的公开信息和热点', 'free', { request: '帮我查证当前选题方向的公开信息：最近有没有相关热点、数据、争议点？给出来源。' }))
    }
    const publishedCount = state.drafts.filter(d => d.published).length
    if (publishedCount) {
      box.appendChild(askButton('📊', '复盘数据', `${publishedCount} 篇已发布稿件，找出什么内容表现好`, 'review'))
    }
  }
  if (currentView === 'drafts') {
    if (selectedDraft()) {
      box.appendChild(askButton('✍️', '写正文', '按大纲写，先读素材', 'write'))
      box.appendChild(askButton('🔀', '改写其他平台', '新建目标平台的改写稿', 'adapt'))
      box.appendChild(askButton('🏷', '起标题', '5 个候选，说明路子', 'titles'))
      box.appendChild(askButton('🧹', '润色降 AI 味', '保持人设，去掉八股', 'polish'))
      box.appendChild(askButton('🖼', '配图建议', '规划封面和文内图，写生图提示词', 'illustrate'))
    } else {
      box.appendChild(el('div', 'hint', '选中一篇稿件后，这里会出现写正文、改写、起标题等动作。'))
    }
  }
  if (currentView === 'materials') {
    box.appendChild(askButton('🗂', '整理素材', '补标签、归并、指出哪些选题能用', 'organize', { materials: true }))
  }

  // 用户在项目设置里自定义的指令——工作台的"私人定制"区
  const customAsks = state.project.customAsks || []
  if (customAsks.length) {
    box.appendChild(el('h3', '', '我的指令'))
    for (const a of customAsks) box.appendChild(askButton('', a.label, '', 'free', { request: a.request }))
  }

  box.appendChild(el('h3', '', '自由提问'))
  const free = el('div', 'free-ask')
  const ta = document.createElement('textarea')
  ta.placeholder = '带着当前选题/稿件的上下文问 DSH，例如：这个标题会不会太平了？'
  const send = el('button', 'button primary small', '填到对话框')
  send.type = 'button'
  send.addEventListener('click', () => {
    if (!ta.value.trim()) return
    askDSH('free', { request: ta.value.trim() })
    ta.value = ''
  })
  free.append(ta, send)
  box.appendChild(free)

  const topic = selectedTopic()
  const draft = selectedDraft()
  if (topic || draft) {
    box.appendChild(el('h3', '', '当前上下文'))
    const ctx = el('div', 'ctx-box')
    const parts = []
    if (topic) parts.push(`<b>选题</b> ${esc(topic.title)}`)
    if (draft) parts.push(`<b>稿件</b> ${esc(draft.title || '未命名')}（${fmtLabel(draft.format)}）`)
    ctx.innerHTML = parts.join('<br>')
    box.appendChild(ctx)
  }

  const note = el('h3', '', '用法')
  box.appendChild(note)
  const usage = el('div', 'ctx-box', '')
  usage.innerHTML = '点上面的按钮，要求和上下文会填进<b>右侧 DSH 对话框</b>，按回车发出。DSH 直接改 project.json，这里几秒后自动刷新。'
  box.appendChild(usage)
}

// ── 数据面板 ───────────────────────────────────────────
const fmtStat = n => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : String(n))

// 演示模式：还没回填过发布数据时，可以先看看"有数据时长什么样"。纯前端预览，不写盘。
let demoMode = false
const DEMO_DRAFTS = [
  { id: 'demo-1', title: '3 个让 AI 写出人话的提示词技巧', format: 'xhs', published: { at: '2026-04-15 21:40', url: '', reads: 31000, likes: 2400, comments: 310, shares: 890, note: '', daily: [
    { date: '2026-04-15', reads: 3200, likes: 210 }, { date: '2026-04-16', reads: 8600, likes: 640 },
    { date: '2026-04-17', reads: 9400, likes: 720 }, { date: '2026-04-18', reads: 5100, likes: 430 },
    { date: '2026-04-19', reads: 2700, likes: 240 }, { date: '2026-04-20', reads: 2000, likes: 160 },
  ] } },
  { id: 'demo-2', title: '老板花 3 万买的 AI 课，到底值不值', format: 'wechat', published: { at: '2026-05-06 20:12', url: '', reads: 23600, likes: 892, comments: 156, shares: 431, note: '', daily: [
    { date: '2026-05-06', reads: 5100, likes: 160 }, { date: '2026-05-07', reads: 8900, likes: 330 },
    { date: '2026-05-08', reads: 6200, likes: 250 }, { date: '2026-05-09', reads: 3400, likes: 152 },
  ] } },
  { id: 'demo-3', title: '中小企业上 AI，先别急着买课', format: 'zhihu', published: { at: '2026-04-20 09:05', url: '', reads: 15200, likes: 640, comments: 88, shares: 120, note: '', daily: [] } },
  { id: 'demo-4', title: '用 AI 做竞品分析：一个下午顶一周', format: 'xhs', published: { at: '2026-03-30 13:15', url: '', reads: 12300, likes: 950, comments: 142, shares: 265, note: '', daily: [] } },
  { id: 'demo-5', title: '我把公司周报交给了 AI，省下一下午', format: 'wechat', published: { at: '2026-04-28 12:30', url: '', reads: 8400, likes: 260, comments: 47, shares: 98, note: '', daily: [
    { date: '2026-04-28', reads: 2100, likes: 60 }, { date: '2026-04-29', reads: 3500, likes: 110 },
    { date: '2026-04-30', reads: 2800, likes: 90 },
  ] } },
  { id: 'demo-6', title: 'AI 客服上岗一个月，我们裁掉了什么', format: 'wechat', published: { at: '2026-04-08 19:22', url: '', reads: 5600, likes: 180, comments: 65, shares: 74, note: '', daily: [] } },
]
const DEMO_ALLDATA = {
  rows: [
    { project: 'demo-ai', projectName: 'AI 咨询', draftId: 'a1', title: '3 个让 AI 写出人话的提示词技巧', format: 'xhs', topic: '', published: { at: '2026-04-15 21:40', url: '', reads: 31000, likes: 2400, comments: 310, shares: 890, note: '', daily: [
      { date: '2026-04-15', reads: 3200, likes: 210 }, { date: '2026-04-16', reads: 8600, likes: 640 },
      { date: '2026-04-17', reads: 9400, likes: 720 }, { date: '2026-04-18', reads: 5100, likes: 430 },
      { date: '2026-04-19', reads: 2700, likes: 240 }, { date: '2026-04-20', reads: 2000, likes: 160 },
    ] } },
    { project: 'demo-ai', projectName: 'AI 咨询', draftId: 'a2', title: '老板花 3 万买的 AI 课，到底值不值', format: 'wechat', topic: '', published: { at: '2026-05-06 20:12', url: '', reads: 23600, likes: 892, comments: 156, shares: 431, note: '', daily: [
      { date: '2026-05-06', reads: 5100, likes: 160 }, { date: '2026-05-07', reads: 8900, likes: 330 },
      { date: '2026-05-08', reads: 6200, likes: 250 }, { date: '2026-05-09', reads: 3400, likes: 152 },
    ] } },
    { project: 'demo-zc', projectName: '职场成长号', draftId: 'b1', title: '30 岁转行前，先算清这三笔账', format: 'wechat', topic: '', published: { at: '2026-04-22 08:50', url: '', reads: 18900, likes: 720, comments: 203, shares: 512, note: '', daily: [
      { date: '2026-04-22', reads: 4600, likes: 170 }, { date: '2026-04-23', reads: 7300, likes: 290 },
      { date: '2026-04-24', reads: 4300, likes: 160 }, { date: '2026-04-25', reads: 2700, likes: 100 },
    ] } },
    { project: 'demo-ai', projectName: 'AI 咨询', draftId: 'a3', title: '中小企业上 AI，先别急着买课', format: 'zhihu', topic: '', published: { at: '2026-04-20 09:05', url: '', reads: 15200, likes: 640, comments: 88, shares: 120, note: '', daily: [] } },
    { project: 'demo-zc', projectName: '职场成长号', draftId: 'b2', title: '述职报告这么写，老板主动加薪', format: 'xhs', topic: '', published: { at: '2026-04-10 19:05', url: '', reads: 9600, likes: 810, comments: 96, shares: 188, note: '', daily: [] } },
    { project: 'demo-dp', projectName: '小店日记', draftId: 'c1', title: '开店第 90 天：账本公开', format: 'xhs', topic: '', published: { at: '2026-05-02 14:20', url: '', reads: 7300, likes: 520, comments: 130, shares: 96, note: '', daily: [] } },
    { project: 'demo-zc', projectName: '职场成长号', draftId: 'b3', title: '别再用"忙"回答"最近怎么样"', format: 'wechat', topic: '', published: { at: '2026-03-28 21:30', url: '', reads: 4100, likes: 190, comments: 54, shares: 77, note: '', daily: [] } },
  ],
  projects: [
    { id: 'demo-ai', name: 'AI 咨询', insights: '带具体数字和价格的标题明显跑得动；小红书"技巧清单"类比"观点"类数据好 3 倍。' },
    { id: 'demo-zc', name: '职场成长号', insights: '晚上 8-9 点发布阅读最高；争议性结尾带动评论。' },
    { id: 'demo-dp', name: '小店日记', insights: '' },
  ],
}

function demoBanner(reload) {
  const banner = el('div', 'demo-banner')
  banner.appendChild(el('span', '', '这是演示数据，方便你预览效果——不是你真实的发布数据。'))
  const back = el('button', 'button small primary', '返回真实数据')
  back.type = 'button'
  back.addEventListener('click', () => { demoMode = false; reload() })
  banner.appendChild(back)
  return banner
}

function demoButton(reload) {
  const btn = el('button', 'button small', '👀 先看看演示效果')
  btn.type = 'button'
  btn.title = '用示例数据预览数据面板，不会写入你的项目'
  btn.addEventListener('click', () => { demoMode = true; reload() })
  return btn
}

// ── 图表（手写 SVG，无第三方依赖）───────────────────────
const PALETTE = ['#6b5a9e', '#3f7d5b', '#a97a2f', '#4a6fa5', '#a8453c', '#8a6fa8', '#5a8a9e', '#b0695a']

function svgEl(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

/** 环形图 + 图例：items = [{label, value}]，按原始下标配色，值为 0 的项跳过。 */
function donutChart(items, centerLabel) {
  const total = items.reduce((a, i) => a + i.value, 0)
  const size = 150, R = 62, C = 2 * Math.PI * R, c = size / 2
  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, class: 'donut' })
  if (!total) {
    svg.appendChild(svgEl('circle', { cx: c, cy: c, r: R, fill: 'none', stroke: 'var(--line)', 'stroke-width': 26 }))
  } else {
    let offset = 0
    items.forEach((item, i) => {
      if (!item.value) return
      const frac = item.value / total
      const circle = svgEl('circle', {
        cx: c, cy: c, r: R, fill: 'none',
        stroke: PALETTE[i % PALETTE.length], 'stroke-width': 26,
        'stroke-dasharray': `${frac * C} ${C}`, 'stroke-dashoffset': -offset * C,
        transform: `rotate(-90 ${c} ${c})`,
      })
      circle.appendChild(svgEl('title', {}))
      circle.lastChild.textContent = `${item.label}：${fmtStat(item.value)}（${Math.round(frac * 100)}%）`
      svg.appendChild(circle)
      offset += frac
    })
  }
  const text = svgEl('text', { x: c, y: c - 2, 'text-anchor': 'middle', class: 'donut-total' })
  text.textContent = fmtStat(total)
  const sub = svgEl('text', { x: c, y: c + 16, 'text-anchor': 'middle', class: 'donut-sub' })
  sub.textContent = centerLabel
  svg.append(text, sub)

  const body = el('div', 'chart-body')
  body.appendChild(svg)
  if (total) {
    const legend = el('div', 'legend')
    items.forEach((item, i) => {
      if (!item.value) return
      const row = el('div', 'legend-row')
      const dot = el('span', 'legend-dot')
      dot.style.background = PALETTE[i % PALETTE.length]
      const name = el('span', '', item.label)
      name.title = item.label
      row.append(dot, name, el('b', '', `${fmtStat(item.value)} · ${Math.round(item.value / total * 100)}%`))
      legend.appendChild(row)
    })
    body.appendChild(legend)
  }
  return body
}

/** 横向条形图：items = [{label, value, hint?}]，调用方先排好序。 */
function barChart(items) {
  const max = Math.max(...items.map(i => i.value), 1)
  const wrap = el('div', 'bars')
  items.forEach((item, i) => {
    const row = el('div', 'bar-row')
    row.title = item.hint || item.label
    const label = el('span', 'bar-label', item.label)
    const track = el('div', 'bar-track')
    const fill = el('div', 'bar-fill')
    fill.style.width = `${Math.max((item.value / max) * 100, item.value ? 3 : 0)}%`
    fill.style.background = PALETTE[i % PALETTE.length]
    track.appendChild(fill)
    row.append(label, track, el('span', 'bar-val', fmtStat(item.value)))
    wrap.appendChild(row)
  })
  return wrap
}

function chartCard(label, node) {
  const card = el('div', 'chart-card')
  card.appendChild(el('label', '', label))
  card.appendChild(node)
  return card
}

/** 折线图：points = [{label, value}]，调用方按时间顺序给。 */
function lineChart(points) {
  const W = 560, H = 130, PAD_X = 14, PAD_TOP = 18, PAD_BOTTOM = 22
  const max = Math.max(...points.map(p => p.value), 1)
  const n = points.length
  const xs = i => (n > 1 ? PAD_X + (i / (n - 1)) * (W - PAD_X * 2) : W / 2)
  const ys = v => H - PAD_BOTTOM - (v / max) * (H - PAD_TOP - PAD_BOTTOM)
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'linechart', preserveAspectRatio: 'none' })
  svg.appendChild(svgEl('line', { x1: PAD_X, y1: H - PAD_BOTTOM, x2: W - PAD_X, y2: H - PAD_BOTTOM, class: 'lc-axis' }))
  if (n) {
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`).join(' ')
    svg.appendChild(svgEl('path', { d, class: 'lc-line' }))
    points.forEach((p, i) => {
      const dot = svgEl('circle', { cx: xs(i), cy: ys(p.value), r: 3.5, class: 'lc-dot' })
      const t = svgEl('title', {})
      t.textContent = `${p.label}：${fmtStat(p.value)}`
      dot.appendChild(t)
      svg.appendChild(dot)
    })
  }
  const first = svgEl('text', { x: PAD_X, y: H - 6, class: 'lc-label' })
  first.textContent = points[0]?.label || ''
  const last = svgEl('text', { x: W - PAD_X, y: H - 6, 'text-anchor': 'end', class: 'lc-label' })
  last.textContent = points[n - 1]?.label || ''
  const peakIdx = points.findIndex(p => p.value === max)
  if (peakIdx >= 0) {
    const peak = svgEl('text', { x: xs(peakIdx), y: ys(max) - 5, 'text-anchor': 'middle', class: 'lc-peak' })
    peak.textContent = fmtStat(max)
    svg.appendChild(peak)
  }
  svg.append(first, last)
  return svg
}

/** 把若干已发布稿件的每日流量聚合成按天的总阅读趋势。 */
function trendPoints(publishedList) {
  const byDate = new Map()
  for (const d of publishedList) {
    for (const day of d.published.daily || []) {
      byDate.set(day.date, (byDate.get(day.date) || 0) + (day.reads || 0))
    }
  }
  return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, reads]) => ({ label: date.slice(5), value: reads }))
}

/** 分平台聚合：list 里每项要有 format 和 published，按总阅读降序返回各平台数据。 */
function platformBreakdown(list) {
  const byFormat = new Map()
  for (const d of list) {
    const key = d.format || 'unknown'
    if (!byFormat.has(key)) byFormat.set(key, { format: key, count: 0, reads: 0, likes: 0, comments: 0, shares: 0 })
    const agg = byFormat.get(key)
    agg.count += 1
    for (const k of ['reads', 'likes', 'comments', 'shares']) agg[k] += d.published[k] || 0
  }
  return [...byFormat.values()]
    .map(agg => ({ ...agg, avg: agg.count ? Math.round(agg.reads / agg.count) : 0 }))
    .sort((a, b) => b.reads - a.reads)
}

/** 分平台数据表：每个平台一行，阅读/篇均/互动分开列。 */
function platformTable(rows) {
  const table = el('div', 'data-table')
  const head = el('div', 'data-row platform head')
  for (const t of ['平台', '篇数', '总阅读', '篇均阅读', '赞', '评', '转']) head.appendChild(el('span', '', t))
  table.appendChild(head)
  for (const row of rows) {
    const r = el('div', 'data-row platform')
    r.appendChild(el('span', 't', fmtLabel(row.format)))
    r.appendChild(el('span', 'n', `${row.count} 篇`))
    r.appendChild(el('span', 'n', fmtStat(row.reads)))
    r.appendChild(el('span', 'n', fmtStat(row.avg)))
    r.appendChild(el('span', 'n', fmtStat(row.likes)))
    r.appendChild(el('span', 'n', fmtStat(row.comments)))
    r.appendChild(el('span', 'n', fmtStat(row.shares)))
    table.appendChild(r)
  }
  return table
}

function renderDataView() {
  const view = $('#dataView')
  view.innerHTML = ''
  const published = (demoMode ? DEMO_DRAFTS : state.drafts).filter(d => d.published)
  if (!published.length) {
    const hint = el('div', 'empty-hint',
      '还没有发布数据。稿件发布后，在稿件编辑器底部的「发布数据」里回填阅读量，这里就能看整体表现了。')
    hint.appendChild(document.createElement('br'))
    hint.appendChild(demoButton(render))
    view.appendChild(hint)
    return
  }
  if (demoMode) view.appendChild(demoBanner(render))

  // 每日总阅读趋势（有每日流量记录才出现）
  const trend = trendPoints(published)
  if (trend.length) view.appendChild(chartCard('每日总阅读趋势', lineChart(trend)))
  // 汇总卡片
  const sum = key => published.reduce((a, d) => a + (d.published[key] || 0), 0)
  const totalReads = sum('reads')
  const cards = el('div', 'data-cards')
  for (const [label, value] of [
    ['已发布', `${published.length} 篇`],
    ['总阅读', fmtStat(totalReads)],
    ['篇均阅读', fmtStat(Math.round(totalReads / published.length))],
    ['总点赞', fmtStat(sum('likes'))],
    ['总评论', fmtStat(sum('comments'))],
    ['总转发', fmtStat(sum('shares'))],
  ]) {
    const card = el('div', 'data-card')
    card.appendChild(el('b', '', String(value)))
    card.appendChild(el('span', '', label))
    cards.appendChild(card)
  }
  view.appendChild(cards)

  // 分平台数据：各平台量级不同，阅读量分开看才有可比性
  view.appendChild(chartCard('分平台数据（按总阅读排序）', platformTable(platformBreakdown(published))))

  // 图表：各平台阅读占比（环形）+ 阅读量 TOP 稿件（横条）
  const byFormat = new Map()
  for (const d of published) byFormat.set(d.format, (byFormat.get(d.format) || 0) + d.published.reads)
  const charts = el('div', 'chart-row')
  charts.appendChild(chartCard('各平台阅读占比', donutChart(
    [...byFormat.entries()].map(([f, v]) => ({ label: fmtLabel(f), value: v })), '总阅读')))
  charts.appendChild(chartCard('阅读量 TOP 稿件', barChart(
    [...published].sort((a, b) => b.published.reads - a.published.reads).slice(0, 8)
      .map(d => ({ label: d.title || '未命名', value: d.published.reads, hint: fmtLabel(d.format) })))))
  view.appendChild(charts)

  // 复盘入口 + 结论
  if (!demoMode) {
    const reviewRow = el('div', 'row')
    const reviewBtn = el('button', 'button primary', '让 DSH 复盘这些数据')
    reviewBtn.type = 'button'
    reviewBtn.addEventListener('click', () => askDSH('review'))
    reviewRow.appendChild(reviewBtn)
    view.appendChild(reviewRow)
  }
  if (state.project.insights) {
    const card = el('div', 'insights-card')
    card.appendChild(el('label', '', 'DSH 的复盘结论（它之后发散选题、写正文前都会先读这段）'))
    card.appendChild(el('p', '', state.project.insights))
    view.appendChild(card)
  }

  // 明细表，按阅读排序；点行跳到稿件
  const table = el('div', 'data-table')
  const head = el('div', 'data-row head')
  for (const t of ['标题', '平台', '阅读', '赞', '评', '转', '发布于']) head.appendChild(el('span', '', t))
  table.appendChild(head)
  for (const d of [...published].sort((a, b) => b.published.reads - a.published.reads)) {
    const row = el('button', 'data-row')
    row.type = 'button'
    row.appendChild(el('span', 't', d.title || '未命名'))
    row.appendChild(el('span', '', fmtLabel(d.format)))
    row.appendChild(el('span', 'n', fmtStat(d.published.reads)))
    row.appendChild(el('span', 'n', fmtStat(d.published.likes)))
    row.appendChild(el('span', 'n', fmtStat(d.published.comments)))
    row.appendChild(el('span', 'n', fmtStat(d.published.shares)))
    row.appendChild(el('span', '', (d.published.at || '').slice(0, 10)))
    row.addEventListener('click', () => {
      if (demoMode) { toast('演示数据——返回真实数据后可跳到对应稿件'); return }
      act('select-draft', { id: d.id }).then(() => switchView('drafts')).catch(e => toast(e.message))
    })
    table.appendChild(row)
  }
  view.appendChild(table)
}

// ── 项目设置 ───────────────────────────────────────────
function openMetaModal() {
  const wrap = document.createElement('div')
  wrap.innerHTML = `
    <div class="field"><label>账号人设与语气</label><textarea name="persona" rows="2" placeholder="例如：30 岁职场博主，说话直接带调侃">${esc(state.project.persona)}</textarea></div>
    <div class="field"><label>目标读者</label><input type="text" name="audience" placeholder="例如：25-35 岁一线城市打工人" value="${esc(state.project.audience)}"></div>
    <div class="field"><label>禁用词（逗号分隔）</label><input type="text" name="bannedWords" placeholder="例如：最，第一，国家级" value="${esc(state.project.bannedWords)}"></div>`

  // 自定义指令编辑器：每条 = 按钮名 + 发给 DSH 的话，出现在右栏「我的指令」
  const askRows = (state.project.customAsks || []).map(a => ({ ...a }))
  const askField = el('div', 'field')
  askField.appendChild(el('label', '', '自定义指令（显示在右栏「我的指令」，点一下就把要求填进对话框）'))
  const askList = el('div', 'ask-edit-list')
  const renderAskRows = () => {
    askList.innerHTML = ''
    askRows.forEach((row, i) => {
      const r = el('div', 'ask-edit-row')
      const label = document.createElement('input')
      label.type = 'text'; label.placeholder = '按钮名，如：口语化重写'; label.value = row.label
      label.addEventListener('input', () => { askRows[i].label = label.value })
      const req = document.createElement('input')
      req.type = 'text'; req.placeholder = '发给 DSH 的要求，如：把当前正文重写得更口语，别改动观点'; req.value = row.request
      req.addEventListener('input', () => { askRows[i].request = req.value })
      const rm = el('button', 'button small danger', '×')
      rm.type = 'button'
      rm.addEventListener('click', () => { askRows.splice(i, 1); renderAskRows() })
      r.append(label, req, rm)
      askList.appendChild(r)
    })
  }
  renderAskRows()
  const addAsk = el('button', 'button small subtle', '＋ 加一条指令')
  addAsk.type = 'button'
  addAsk.addEventListener('click', () => {
    if (askRows.length >= 10) { toast('最多 10 条自定义指令'); return }
    askRows.push({ label: '', request: '' })
    renderAskRows()
  })
  askField.append(askList, addAsk)
  wrap.appendChild(askField)
  wrap.appendChild(el('p', 'hint', '人设/读者/禁用词会写进 CONTEXT.md，DSH 每次动笔前都会读。自定义指令随点随用。'))

  openModal({
    title: '项目设置',
    body: wrap,
    okText: '保存',
    onSubmit: () => act('project-meta', {
      persona: wrap.querySelector('[name=persona]').value,
      audience: wrap.querySelector('[name=audience]').value,
      bannedWords: wrap.querySelector('[name=bannedWords]').value,
      customAsks: askRows.filter(r => r.label.trim() && r.request.trim()),
    }),
  })
}

// ── 视图切换 ───────────────────────────────────────────
let lastView = 'topic'   // 进入数据面板前的视图，返回时还原

function switchView(name) {
  if (name !== 'data') lastView = name
  currentView = name
  // 数据是整个号的面板，不属于任何选题：铺满工作区，选题栏/右栏/页签都藏起来
  document.body.classList.toggle('datamode', name === 'data')
  $('#dataBtn').textContent = name === 'data' ? '← 返回' : '📊 数据'
  document.querySelectorAll('.stage-nav .tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === name))
  for (const [view, elId] of Object.entries({ topic: 'topicView', drafts: 'draftsView', materials: 'materialsView', data: 'dataView', log: 'logView' })) {
    document.getElementById(elId).hidden = view !== name
  }
  render()
}

// ── 渲染总入口 ─────────────────────────────────────────
function render() {
  if (!state) return
  $('#projectName').textContent = state.project.name
  $('#draftCount').textContent = state.drafts.length
  $('#materialCount').textContent = state.materials.length
  renderRail()
  if (currentView === 'topic') renderTopicView()
  if (currentView === 'drafts') renderDraftsView()
  if (currentView === 'materials') renderMaterialsView()
  if (currentView === 'data') renderDataView()
  if (currentView === 'log') renderLogView()
  renderInspector()
}

// ── 同步 ───────────────────────────────────────────────
async function bootstrap() {
  const result = await request(projectUrl('/api/content/bootstrap'))
  state = result.state
  revision = result.revision
  meta = result.meta
  folder = result.folder
  document.title = `${state.project.name} · 创作工作台`
  setDirty(false)
  render()
}

async function watchLoop() {
  for (;;) {
    try {
      const result = await request(`${projectUrl('/api/content/watch')}&since=${encodeURIComponent(revision)}`)
      if (result.revision) revision = result.revision
      if (result.changed) {
        if (dirty) {
          if (!staleSeen) { staleSeen = true; $('#staleBanner').hidden = false }
        } else {
          await bootstrap()
        }
      }
    } catch {
      await new Promise(r => setTimeout(r, 3000))
    }
  }
}

function whoami() {
  parent.postMessage({ type: 'dsh-content:whoami', project: PROJECT }, location.origin)
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin) return
  if (event.data?.type === 'dsh-content:bound') {
    const bind = $('#bindState')
    bind.textContent = event.data.detail
    bind.dataset.ok = String(event.data.ok)
  }
})

// ── 全部数据总览（?view=alldata，跨项目独立页）────────────
async function bootAllData() {
  document.body.classList.add('alldata')
  $('#projectName').textContent = '全部项目数据总览'
  document.title = '数据总览 · 创作工作台'
  $('#syncState').textContent = ''
  $('#bindState').textContent = ''
  $('#metaBtn').style.display = 'none'
  $('#dataBtn').style.display = 'none'
  document.querySelector('.stage-nav').style.display = 'none'
  for (const id of ['topicView', 'draftsView', 'materialsView', 'logView']) document.getElementById(id).hidden = true
  $('#dataView').hidden = false
  const load = async () => renderAllData(await request('/api/content/alldata'))
  await load()
  $('#app').setAttribute('aria-busy', 'false')
  // 各项目随时可能有新回填，8 秒自动重拉一次
  setInterval(() => { load().catch(() => {}) }, 8000)
}

let lastAllData = { rows: [], projects: [] }

function renderAllData(data) {
  if (!demoMode) lastAllData = data
  const src = demoMode ? DEMO_ALLDATA : lastAllData
  const rows = [...(src.rows || [])].sort((a, b) => b.published.reads - a.published.reads)
  const projects = src.projects || []
  const view = $('#dataView')
  view.innerHTML = ''
  if (!rows.length) {
    const hint = el('div', 'empty-hint', '所有项目都还没有发布数据。稿件发布后在各项目的稿件里回填阅读量，这里会自动汇总。')
    hint.appendChild(document.createElement('br'))
    hint.appendChild(demoButton(() => renderAllData(lastAllData)))
    view.appendChild(hint)
    return
  }
  if (demoMode) view.appendChild(demoBanner(() => renderAllData(lastAllData)))

  // 每日总阅读趋势（汇总所有项目的每日流量记录）
  const allTrend = trendPoints(rows.map(r => ({ published: r.published })))
  if (allTrend.length) view.appendChild(chartCard('每日总阅读趋势（全部项目）', lineChart(allTrend)))
  const sum = key => rows.reduce((a, r) => a + (r.published[key] || 0), 0)
  const totalReads = sum('reads')
  const cards = el('div', 'data-cards')
  for (const [label, value] of [
    ['已发布链接', `${rows.length} 篇`],
    ['覆盖项目', `${new Set(rows.map(r => r.project)).size} 个`],
    ['总阅读', fmtStat(totalReads)],
    ['篇均阅读', fmtStat(Math.round(totalReads / rows.length))],
    ['总点赞', fmtStat(sum('likes'))],
    ['总评论', fmtStat(sum('comments'))],
    ['总转发', fmtStat(sum('shares'))],
  ]) {
    const card = el('div', 'data-card')
    card.appendChild(el('b', '', String(value)))
    card.appendChild(el('span', '', label))
    cards.appendChild(card)
  }
  view.appendChild(cards)

  // 分平台数据：跨项目汇总，但平台之间分开算
  view.appendChild(chartCard('分平台数据（全部项目）', platformTable(platformBreakdown(rows))))

  // 图表：各项目阅读占比（环形）+ 阅读量 TOP 链接（横条）
  const byProject = new Map()
  for (const r of rows) byProject.set(r.projectName, (byProject.get(r.projectName) || 0) + r.published.reads)
  const charts = el('div', 'chart-row')
  charts.appendChild(chartCard('各项目阅读占比', donutChart(
    [...byProject.entries()].map(([p, v]) => ({ label: p, value: v })), '总阅读')))
  charts.appendChild(chartCard('阅读量 TOP 链接', barChart(
    rows.slice(0, 8).map(r => ({ label: r.title || '未命名', value: r.published.reads, hint: `${r.projectName} · ${fmtLabel(r.format)}` })))))
  view.appendChild(charts)

  for (const p of (projects || []).filter(p => p.insights)) {
    const card = el('div', 'insights-card')
    card.appendChild(el('label', '', `${p.name} · 复盘结论`))
    card.appendChild(el('p', '', p.insights))
    view.appendChild(card)
  }
  const table = el('div', 'data-table')
  const head = el('div', 'data-row head wide')
  for (const t of ['标题', '项目', '平台', '阅读', '赞', '评', '转', '发布于', '链接']) head.appendChild(el('span', '', t))
  table.appendChild(head)
  for (const r of rows) {
    const row = el('div', 'data-row wide')
    row.appendChild(el('span', 't', r.title || '未命名'))
    row.appendChild(el('span', '', r.projectName))
    row.appendChild(el('span', '', fmtLabel(r.format)))
    row.appendChild(el('span', 'n', fmtStat(r.published.reads)))
    row.appendChild(el('span', 'n', fmtStat(r.published.likes)))
    row.appendChild(el('span', 'n', fmtStat(r.published.comments)))
    row.appendChild(el('span', 'n', fmtStat(r.published.shares)))
    row.appendChild(el('span', '', (r.published.at || '').slice(0, 10)))
    const linkCell = el('span', '')
    if (r.published.url) {
      const a = document.createElement('a')
      a.href = r.published.url; a.target = '_blank'; a.rel = 'noreferrer'; a.textContent = '打开'
      linkCell.appendChild(a)
    } else linkCell.textContent = '—'
    row.appendChild(linkCell)
    table.appendChild(row)
  }
  view.appendChild(table)
}

// ── 启动 ───────────────────────────────────────────────
async function boot() {
  if (VIEW === 'alldata') return bootAllData()
  if (!PROJECT) {
    // 自愈：iframe 偶发会以裸 /api/content/app 加载。问父面板当前项目是哪个，
    // 拿到就带参重载；拿不到（面板里确实没选项目）才显示提示。
    window.addEventListener('message', event => {
      if (event.origin !== location.origin) return
      if (event.data?.type === 'dsh-content:current-project' && event.data.project) {
        location.replace(`/api/content/app?project=${encodeURIComponent(event.data.project)}`)
      }
    })
    try { parent.postMessage({ type: 'dsh-content:which-project' }, location.origin) } catch {}
    document.body.innerHTML = '<div class="empty-hint" style="padding-top:80px">正在向面板要项目参数…<br><br><span style="color:var(--muted)">如果一直停在这里，请在面板上方下拉里重新选一次项目。</span></div>'
    return
  }
  document.querySelectorAll('.stage-nav .tab').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view))
  })
  $('#topicFilters').addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]')
    if (!btn) return
    topicFilter = btn.dataset.filter
    document.querySelectorAll('#topicFilters .chip').forEach(c => c.classList.toggle('active', c === btn))
    renderRail()
  })
  $('#newTopic').addEventListener('click', () => {
    openModal({
      title: '新建选题',
      body: `
        <div class="field"><label>选题标题</label><input type="text" name="title" placeholder="例如：为什么年轻人开始反向旅游"></div>
        <div class="field"><label>切入方向（可选）</label><textarea name="angle" rows="2"></textarea></div>`,
      okText: '创建',
      onSubmit: box => {
        const title = box.querySelector('[name=title]').value.trim()
        if (!title) throw new Error('标题不能为空')
        return act('create-topic', { topic: { title, angle: box.querySelector('[name=angle]').value.trim() } })
      },
    })
  })
  $('#metaBtn').addEventListener('click', openMetaModal)
  $('#dataBtn').addEventListener('click', () => switchView(currentView === 'data' ? (lastView || 'topic') : 'data'))
  $('#staleReload').addEventListener('click', async () => { $('#staleBanner').hidden = true; staleSeen = false; await bootstrap() })
  $('#staleDismiss').addEventListener('click', () => { $('#staleBanner').hidden = true })

  // 配图点击放大：缩略图和预览里的图都能点开看
  const lightbox = $('#lightbox')
  lightbox.addEventListener('click', () => { lightbox.hidden = true })
  document.addEventListener('click', e => {
    const img = e.target.closest('.thumb img, .preview img')
    if (!img || !img.src) return
    $('#lightboxImg').src = img.src
    lightbox.hidden = false
  })

  await bootstrap()
  $('#app').setAttribute('aria-busy', 'false')
  refreshImageFiles().then(() => { if (currentView === 'drafts') render() })
  whoami()
  watchLoop()
}
boot().catch(error => {
  document.body.innerHTML = `<div class="empty-hint" style="padding-top:80px">打开失败：${esc(error.message)}</div>`
})
