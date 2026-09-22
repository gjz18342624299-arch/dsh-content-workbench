window.__ModuleLoader__.load({ id: 'dsh-content-workbench', factory: (require) => {
  const module = { exports: {} }
  const React = require('react')
  const h = React.createElement
  const STORE_KEY = 'dsh.content-workbench.v1'

  const css = `
  .cw-btn{width:100%;height:32px;display:flex;align-items:center;gap:8px;padding:0 9px;border:0;border-radius:8px;
    background:transparent;color:var(--dsw-alias-label-primary,#17191c);font-size:12px;cursor:pointer;text-align:left}
  .cw-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#f1f2f3)}
  .cw-btn[data-open="true"]{background:var(--dsw-alias-interactive-bg-hover,#eef1f0);font-weight:600}
  .cw-btn i{width:16px;flex:none;font-style:normal;text-align:center}
  .cw-btn span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  /* 浮层在整壳之上，面板必须自己刷一层不透明的底：某些主题下
     --dsw-alias-bg-base 是半透明的，空状态会把底下的对话透出来。 */
  .cw-panel{position:absolute;top:0;bottom:0;left:var(--cw-left,0px);display:flex;flex-direction:column;min-width:480px;
    background-color:#fff;border-right:1px solid var(--dsw-alias-border-l1,#dfe1e4);
    box-shadow:0 0 24px rgba(20,24,28,.10);z-index:30;
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",sans-serif}
  /* !important：面板关键布局已内联（防样式表丢失塌缩），暗色覆盖要压过内联白底。 */
  @media (prefers-color-scheme:dark){ .cw-panel{background-color:#1d2022 !important} }
  .cw-head{height:48px;flex:none;display:flex;align-items:center;gap:7px;padding:0 10px;
    border-bottom:1px solid var(--dsw-alias-border-l1,#dfe1e4);background-color:#fafaf8}
  @media (prefers-color-scheme:dark){ .cw-head{background-color:#25292b} }
  /* 面板盖住了标题栏，窗口得留个拖拽把手——但整行都可拖会让里面的控件难点，
     Electron 拖拽区里的原生 select 弹层更是直接不可靠。只有标题和空白处可拖。 */
  .cw-head strong{font-size:12px;font-weight:600;-webkit-app-region:drag;padding:6px 2px}
  .cw-spacer{margin-left:auto;align-self:stretch;-webkit-app-region:drag}

  .cw-picker{position:relative;min-width:0;flex:1 1 auto;max-width:320px}
  .cw-picker-btn{width:100%;height:34px;display:flex;align-items:center;gap:7px;padding:0 9px;
    border:1px solid var(--dsw-alias-border-l1,#dfe1e4);border-radius:9px;
    background:var(--dsw-alias-bg-base,#fff);cursor:pointer;text-align:left}
  .cw-picker-btn:hover{border-color:var(--dsw-alias-label-secondary,#8a8e91)}
  .cw-picker-btn[data-open="true"]{border-color:#6b5a9e;box-shadow:0 0 0 3px rgba(107,90,158,.13)}
  .cw-picker-btn b{min-width:0;flex:1;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cw-picker-btn small{flex:none;color:var(--dsw-alias-label-secondary,#8a8e91);font-size:10px}
  .cw-picker-btn i{flex:none;font-style:normal;width:20px;height:20px;margin-right:-2px;
    display:flex;align-items:center;justify-content:center;border-radius:5px;
    color:var(--dsw-alias-label-secondary,#8a8e91);font-size:13px;line-height:1}
  .cw-picker-btn:hover i{background:var(--dsw-alias-interactive-bg-hover,#eef1f0);
    color:var(--dsw-alias-label-primary,#17191c)}
  .cw-menu{position:absolute;z-index:9;left:0;top:38px;width:max(300px,100%);max-height:60vh;overflow:auto;
    padding:5px;border:1px solid var(--dsw-alias-border-l1,#dfe1e4);border-radius:11px;
    background-color:#fff;box-shadow:0 10px 34px rgba(20,24,28,.2)}
  @media (prefers-color-scheme:dark){ .cw-menu{background-color:#1d2022} }
  .cw-menu-item{width:100%;min-height:46px;display:flex;align-items:center;gap:9px;padding:7px 9px;
    border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;text-align:left}
  .cw-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover,#f1f2f3)}
  .cw-menu-item[data-current="true"]{background:rgba(107,90,158,.11)}
  .cw-menu-item .col{min-width:0;flex:1}
  .cw-menu-item b{display:block;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cw-menu-item small{display:block;margin-top:2px;color:var(--dsw-alias-label-secondary,#8a8e91);font-size:10px}
  .cw-menu-item .tick{flex:none;color:#6b5a9e;font-size:13px}
  .cw-row-acts{flex:none;display:flex;gap:2px;opacity:0}
  .cw-menu-item:hover .cw-row-acts,.cw-menu-item:focus-within .cw-row-acts{opacity:1}
  .cw-row-acts span{width:26px;height:26px;display:grid;place-items:center;border-radius:6px;
    color:var(--dsw-alias-label-secondary,#8a8e91);font-size:12px;cursor:pointer}
  .cw-row-acts span:hover{background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#17191c)}
  .cw-row-acts span[data-danger="true"]:hover{background:rgba(168,69,60,.12);color:#a8453c}
  .cw-menu-sep{margin:5px 4px;border-top:1px solid var(--dsw-alias-border-l1,#dfe1e4)}
  .cw-menu-empty{padding:14px 10px;color:var(--dsw-alias-label-secondary,#8a8e91);font-size:11px;text-align:center;line-height:1.7}

  .cw-icon{width:32px;height:32px;flex:none;border:1px solid transparent;border-radius:8px;background:transparent;
    color:var(--dsw-alias-label-secondary,#6f7578);font-size:14px;line-height:1;cursor:pointer}
  .cw-icon:hover{border-color:var(--dsw-alias-border-l1,#dfe1e4);background:var(--dsw-alias-bg-base,#fff)}
  .cw-frame{flex:1;width:100%;min-height:0;border:0;background:var(--dsw-alias-bg-base,#fff)}
  .cw-empty{flex:1;display:grid;place-items:center;padding:24px;text-align:center;
    color:var(--dsw-alias-label-secondary,#6f7578);font-size:12px;line-height:1.8}
  .cw-grip{position:absolute;top:0;bottom:0;right:-4px;width:9px;cursor:col-resize;z-index:6;
    -webkit-app-region:no-drag;touch-action:none}
  .cw-grip:hover,.cw-grip[data-drag="true"]{background:var(--dsw-alias-accent,#6b5a9e);opacity:.35}
  .cw-ask{position:absolute;inset:0;z-index:8;display:grid;place-items:center;background:rgba(0,0,0,.45);padding:24px}
  .cw-ask-card{width:min(420px,100%);padding:16px;border:1px solid var(--dsw-alias-border-l1,#dfe1e4);border-radius:11px;
    background-color:#fff}
  @media (prefers-color-scheme:dark){ .cw-ask-card{background-color:#1d2022} }
  .cw-ask-card h3{margin:0 0 5px;font-size:13px}
  .cw-ask-card p{margin:0 0 10px;color:var(--dsw-alias-label-secondary,#6f7578);font-size:11px;line-height:1.6}
  .cw-ask-card input{width:100%;height:32px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1,#dfe1e4);
    border-radius:7px;background:transparent;font-size:12px;outline:0;color:inherit}
  .cw-ask-card input:focus{border-color:var(--dsw-alias-accent,#6b5a9e)}
  .cw-ask-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:11px}
  .cw-ask-actions button{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1,#dfe1e4);border-radius:7px;
    background:transparent;font-size:11px;cursor:pointer;color:inherit}
  .cw-ask-actions button[data-primary="true"]{border-color:#6b5a9e;background:#6b5a9e;color:#fff;font-weight:600}
  .cw-toast{position:fixed;z-index:60;left:50%;bottom:22px;transform:translate(-50%,10px);max-width:70vw;
    padding:9px 14px;border:1px solid var(--dsw-alias-border-l1,#dfe1e4);border-radius:8px;
    background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#17191c);font-size:12px;
    box-shadow:0 6px 24px rgba(20,24,28,.16);opacity:0;pointer-events:none;transition:.18s}
  .cw-toast[data-show="true"]{opacity:1;transform:translate(-50%,0)}`

  let bridge = null
  let toastTimer = null
  const listeners = new Set()
  let openState = { open: false, project: null, mode: 'project' }

  function toast(message) {
    let node = document.querySelector('.cw-toast')
    if (!node) { node = document.createElement('div'); node.className = 'cw-toast'; document.body.appendChild(node) }
    node.textContent = message
    node.dataset.show = 'true'
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { node.dataset.show = 'false' }, 2600)
  }

  const readStore = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {} } catch { return {} } }
  const writeStore = next => { try { localStorage.setItem(STORE_KEY, JSON.stringify(next)) } catch {} }
  const emit = () => listeners.forEach(fn => fn())
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }
  function setOpen(next) { openState = { ...openState, ...next }; writeStore({ ...readStore(), ...openState }); emit() }

  async function request(path, options) {
    const response = await fetch(path, options)
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`)
    return result
  }
  const projectUrl = (path, slug) => `${path}?project=${encodeURIComponent(slug)}`
  const bootstrap = slug => request(projectUrl('/api/content/bootstrap', slug))

  // ── 绑定会话：cwd = 项目文件夹，DSH 的修改才会落对地方 ──
  async function createSession(folder) {
    if (!bridge?.sessions?.create) throw new Error('DSH 会话服务不可用')
    try {
      const view = await bridge.workspaces?.create?.({ path: folder })
      const workspaceId = view?.workspaceId || view?.id
      if (workspaceId) return await bridge.sessions.create({ workspaceId })
    } catch {}
    return bridge.sessions.create({ cwd: folder })
  }

  /**
   * 清掉本插件为已删除项目建过的 DSH 工作区。工作区的寿命比它指的文件夹长，
   * 不清的话侧边栏会为每个被删项目留一行，看起来像删除没生效。
   * 只碰本插件数据根目录下的路径。
   */
  async function sweepWorkspaces(root, liveIds) {
    if (!root || !bridge?.workspaces?.delete) return 0
    const items = bridge.workspaces.list?.getSnapshot?.()?.items
    if (!Array.isArray(items)) return 0
    const prefix = root.endsWith('/') ? root : `${root}/`
    const live = new Set(liveIds)
    let removed = 0
    for (const ws of items) {
      const path = ws?.path
      if (typeof path !== 'string' || !path.startsWith(prefix)) continue
      if (live.has(path.slice(prefix.length))) continue
      try { await bridge.workspaces.delete(ws.workspaceId ?? ws.id); removed += 1 } catch {}
    }
    return removed
  }

  function fillDraft(sessionId, prompt) {
    const actx = bridge.sessions.scope?.(sessionId)
    const conversation = actx?.get?.('conversation')
    if (!conversation) throw new Error('对话输入不可用')
    const input = conversation.input.for(actx)
    const current = input.state.getSnapshot().draft || ''
    input.setDraft(current.trim() ? `${current}\n\n${prompt}` : prompt)
  }

  /**
   * 新会话的开场白，预填进输入框——是草稿不是已发送消息，用户按回车才生效。
   * 这一步曾经看不见：面板显示「已绑定会话」而对话还是空的，项目挂在那里
   * DSH 却对它一无所知。第一行现在写明这段话在等什么。
   */
  const onboarding = result => [
    '（按回车发送这段话，DSH 才会读到这个项目）',
    '',
    '你已绑定到「自媒体内容创作工作台」。',
    `项目：${result.state.project.name}　项目文件夹：${result.folder}`,
    '先读 CONTEXT.md——它写明了 project.json 的结构、四种平台格式的写作要求、以及分工。',
    '分工：你负责机械劳动（发散选题、写大纲、写正文、按平台改写、起标题、写配图提示词、整理素材、导出成品）；定稿和发不发由我决定。',
    '改完 project.json 界面会自动刷新。',
    '',
    '先帮我看看这个项目现在有什么，然后针对「' + (result.state.topics[0]?.title || '我最想做的方向') + '」发散 5 个选题角度。',
  ].join('\n')

  /**
   * 会话属于哪个项目。面板曾经只记一个全局「当前项目」，和对话没有关联：
   * 开第二个项目（即第二个对话）再回到第一个对话时，工作台还停在第二个
   * 项目的选题上。数据没丢，但看起来像第一个项目被重置了。
   */
  let projectIndex = []            // [{id, sessionId}]，列表加载时刷新
  function projectForSession(sessionId) {
    if (!sessionId) return null
    return projectIndex.find(p => p.sessionId === sessionId)?.id || null
  }

  // 每个项目绑定了哪个 DSH 会话，工作台据此显示状态。
  const boundSessions = new Map()
  async function ensureSession(slug, result) {
    // 绑定关系读 project.json，不读 localStorage：渲染进程由 127.0.0.1 提供，
    // 每次启动端口都变，浏览器存储每次重启都是全新的空源——上一次绑定的会话
    // 会因此成孤儿，同一项目每次重开 DSH 都再开一个全新对话。
    const saved = result.state?.project?.sessionId || null
    let sessionId = saved
    if (sessionId) {
      // 期间可能被删了；找不到就退回到新会话。
      try { await bridge.sessions.open?.(sessionId) } catch { sessionId = null }
    }
    if (!sessionId) {
      sessionId = await createSession(result.folder)
      await bridge.sessions.open?.(sessionId)
    }
    boundSessions.set(slug, { sessionId, folder: result.folder })
    if (sessionId !== saved) {
      try {
        // action 端点从请求体而不是 query 读 project。
        await request('/api/content/action', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ project: slug, type: 'bind-session', sessionId }),
        })
        const row = projectIndex.find(p => p.id === slug)
        if (row) row.sessionId = sessionId
        else projectIndex.push({ id: slug, sessionId })
      } catch {}
      try { fillDraft(sessionId, onboarding(result)) } catch {}
    }
    return sessionId
  }

  async function openProject(slug) {
    const result = await bootstrap(slug)
    await ensureSession(slug, result)
    setOpen({ open: true, project: slug, mode: 'project' })
    return result
  }

  /** 组装对话需要的上下文，让 DSH 能针对当前选中的选题/稿件干活。 */
  function askPrompt(detail, result) {
    const state = result.state
    const p = state.project || {}
    const topic = detail?.topicId ? state.topics.find(t => t.id === detail.topicId) : state.topics.find(t => t.id === state.selectedTopicId)
    const draft = detail?.draftId ? state.drafts.find(d => d.id === detail.draftId) : state.drafts.find(d => d.id === state.selectedDraftId)
    const asks = {
      brainstorm: '基于这个项目的人设和已有选题，发散 5-8 个新选题。每个给标题、切入方向、建议平台。发散完直接写进 project.json 的 topics 数组（status 用 candidate），界面会自动出现在左侧选题栏；同时在对话里列一遍并说明各自的路子。我看不顺眼的会在工作台里自己删，不用等我确认。',
      review: '复盘一下：读 project.json 里所有已发布稿件的 published 数据（阅读/点赞/评论/转发）。先按平台分开算各平台的总阅读和篇均阅读——各平台量级不同，别跨平台直接比总数；再在每个平台内部，结合选题角度、标题路子、开头方式找规律——哪类内容表现好、哪类不行，尽量说具体。然后把结论（两三句、可执行的）更新到 project.insights，最后用大白话告诉我：每个平台接下来该多做什么、少做什么。',
      outline: '为当前选中的选题写大纲：先读一遍相关素材，把大纲写进该选题新稿件的 outline 数组（用 create-draft 建稿或更新已有稿件），写完告诉我你的思路。不要急着写正文。',
      write: '基于当前选中稿件的大纲写正文。动笔前先读 materials 里的素材，能用上的观点数据优先用。写完把 body 更新进 project.json，状态推进到 writing。',
      adapt: '把当前稿件改写成目标平台的版本：新建一篇对应 format 的稿件（topicId 保持一致），按 CONTEXT.md 里那个平台的要求重写，不要只是删减。',
      titles: '为当前稿件起 5 个候选标题，说明各自的路子（悬念/干货/情绪/争议……），我选定后你更新 title。',
      polish: '通读当前稿件正文，改掉 AI 腔和啰嗦的地方，保持我的人设语气。改之前先把当前版本存进 versions（大改留档）。',
      illustrate: '通读当前稿件，规划配图：封面一张 + 文内 2-4 张。每张写清 slot、prompt（画面描述，要能直接拿去生图）、alt。有能力生成就直接生成到 images/ 文件夹并把 file 填上。',
      organize: '整理素材库：给 materials 里每条素材补 tags，把相关的归并说明，告诉我哪些选题能用上哪些素材。只动 materials，不动别的。',
      export: '把当前稿件导出到 exports/（用 export-draft），导出后状态推进到 ready。',
      free: '结合当前项目的上下文回答我下面的问题。',
    }
    const lines = [
      `项目：${p.name || ''}`,
      p.persona ? `人设语气：${p.persona}` : '人设语气：（未设置——可以提醒我在工作台左侧补一句）',
      p.audience ? `目标读者：${p.audience}` : '',
      p.bannedWords ? `禁用词：${p.bannedWords}` : '',
      `项目文件夹：${result.folder || ''}`,
      `现状：${state.topics.length} 个选题 / ${state.drafts.length} 篇稿 / ${state.materials.length} 条素材`,
    ].filter(Boolean)

    if (topic) {
      lines.push('', `当前选题：${topic.title}（${topic.id}）`,
        topic.angle ? `切入方向：${topic.angle}` : '',
        topic.formats?.length ? `目标平台：${topic.formats.join('、')}` : '',
        topic.notes ? `备注：${topic.notes}` : '')
    }
    if (draft) {
      lines.push('', `当前稿件：${draft.title || '未命名'}（${draft.id}）　格式 ${draft.format}　状态 ${draft.status}`)
      if (draft.outline?.length) lines.push(`大纲：${draft.outline.map((o, i) => `${i + 1}.${o}`).join('；')}`)
      if (String(draft.body).trim()) lines.push(`正文已有 ${String(draft.body).length} 字（全文在 project.json 里，可直接读）`)
      else lines.push('正文还没写')
      if (draft.images?.length) lines.push(`配图 ${draft.images.length} 张（${draft.images.filter(i => i.file).length} 张已有文件）`)
    }
    if (detail?.materials) {
      lines.push('', '--- 相关素材 ---')
      for (const m of state.materials.slice(0, 30)) lines.push(`  - [${m.kind}] ${m.name}：${String(m.content).slice(0, 120)}`)
      lines.push('--- 素材结束 ---')
    }
    if (detail?.payload) lines.push('', '--- 待处理内容 ---', String(detail.payload).slice(0, 6000), '--- 内容结束 ---')
    return [...lines, '', asks[detail?.mode] || asks.free, detail?.request ? `我的要求：${detail.request}` : ''].filter(Boolean).join('\n')
  }

  // ── components ───────────────────────────────────────────
  function SidebarButton(props) {
    const [open, setOpenLocal] = React.useState(openState.open)
    React.useEffect(() => subscribe(() => setOpenLocal(openState.open)), [])
    return h('button', {
      className: 'cw-btn', type: 'button', 'data-open': String(open),
      title: '自媒体内容创作工作台',
      onClick: () => setOpen({ open: !openState.open }),
    }, h('i', null, '✎'), props.wide === false ? null : h('span', null, '创作工作台'))
  }

  function Panel() {
    const [state, setState] = React.useState(openState)
    const [projects, setProjects] = React.useState([])
    const [width, setWidth] = React.useState(() => readStore().width || Math.max(760, Math.min(1240, Math.round(window.innerWidth * 0.62))))
    const [left, setLeft] = React.useState(0)
    // window.prompt() 在 Electron 里没有实现——调用直接返回，什么都不显示，
    // 新建按钮曾经就这样无声地死路一条。改成面板内询问。
    const [ask, setAsk] = React.useState(null)
    const [menuOpen, setMenuOpen] = React.useState(false)
    const [rename, setRename] = React.useState(null)
    const [confirmDel, setConfirmDel] = React.useState(null)

    React.useEffect(() => subscribe(() => setState({ ...openState })), [])

    // 浮层盖住整个壳，对话会被压在面板底下而不是旁边。面板打开时把中列
    // 往右推一个面板宽，关上时还原。
    React.useEffect(() => {
      const overlay = document.querySelector('[data-shell-overlay]')
      const frame = overlay?.parentElement
      const centre = frame?.children?.[1]
      if (!(centre instanceof HTMLElement)) return undefined
      const previous = { pad: centre.style.paddingLeft, transition: centre.style.transition }
      const apply = () => {
        centre.style.transition = 'padding-left var(--ds-transition-duration-slow, .2s) ease'
        centre.style.paddingLeft = state.open ? `${Math.max(0, left + width - (frame.children[0]?.getBoundingClientRect().width || 0))}px` : ''
      }
      apply()
      return () => { centre.style.paddingLeft = previous.pad; centre.style.transition = previous.transition }
    }, [state.open, width, left])
    React.useEffect(() => {
      // 浮层 inset:0 盖满整个应用窗口——包括侧边栏和窗口红绿灯。偏移量按真实
      // 侧边栏列宽算：从 DOM 结构找（[data-shell-overlay] 的父是框架，其第一个
      // grid 子是侧边栏列），而不是猜 nav/aside——某些窗口宽度下猜错会让面板
      // 直接贴到窗口左上角。
      const measure = () => {
        const overlay = document.querySelector('[data-shell-overlay]')
        const frame = overlay?.parentElement
        const column = frame?.firstElementChild
        if (!frame || !column || column === overlay) return setLeft(0)
        const gap = Math.round(column.getBoundingClientRect().right - frame.getBoundingClientRect().left)
        setLeft(gap > 0 && gap < 520 ? gap : 0)
      }
      measure()
      window.addEventListener('resize', measure)
      const timer = setInterval(measure, 800)
      return () => { window.removeEventListener('resize', measure); clearInterval(timer) }
    }, [])

    const reload = React.useCallback(() => {
      request('/api/content/projects')
        .then(r => {
          setProjects(r.projects)
          projectIndex = r.projects.map(row => ({ id: row.id, sessionId: row.sessionId || '' }))
          return sweepWorkspaces(r.root, r.projects.map(row => row.id))
        })
        .catch(e => toast(e.message))
    }, [])
    React.useEffect(() => { if (state.open) reload() }, [state.open, reload])

    // 点击任何地方都收起菜单，包括工作台 iframe 里的点击。
    React.useEffect(() => {
      if (!menuOpen) return undefined
      const close = () => setMenuOpen(false)
      document.addEventListener('click', close)
      window.addEventListener('blur', close)
      return () => { document.removeEventListener('click', close); window.removeEventListener('blur', close) }
    }, [menuOpen])

    const current = projects.find(row => row.id === state.project) || null

    React.useEffect(() => {
      const onMessage = async event => {
        if (event.origin !== window.location.origin) return
        const data = event.data
        if (data?.type === 'dsh-content:ask') {
          try {
            const result = await bootstrap(data.project)
            const sessionId = await ensureSession(data.project, result)
            fillDraft(sessionId, askPrompt(data, result))
            event.source?.postMessage?.({ type: 'dsh-content:ask-result', ok: true }, event.origin)
          } catch (error) {
            event.source?.postMessage?.({ type: 'dsh-content:ask-result', ok: false, error: error.message }, event.origin)
            toast(error.message)
          }
        }
        if (data?.type === 'dsh-content:projects-changed') reload()
        // iframe 偶发会以裸 /api/content/app 加载（缺 project 参数）——原因未完全查明，
        // 与其赌它不发生，不如让它自己问一嘴并带参重载。
        if (data?.type === 'dsh-content:which-project') {
          event.source?.postMessage?.({ type: 'dsh-content:current-project', project: openState.project || null }, event.origin)
        }
        if (data?.type === 'dsh-content:whoami') {
          let bound = boundSessions.get(data.project)
          // 重启后内存映射是空的，但 sessionId 持久化在 project.json 里——
          // 以服务端为准，否则会把已绑定的项目误报成「尚未绑定会话」。
          if (!bound) {
            try {
              const result = await bootstrap(data.project)
              const saved = result.state?.project?.sessionId
              if (saved) {
                bound = { sessionId: saved, folder: result.folder }
                boundSessions.set(data.project, bound)
              }
            } catch {}
          }
          event.source?.postMessage?.({
            type: 'dsh-content:bound',
            ok: !!bound,
            detail: bound
              ? `已绑定会话 ${String(bound.sessionId).slice(0, 8)}… · 工作目录 ${bound.folder}`
                + '　（右侧输入框里的开场白要按回车发出去，DSH 才会读这个项目）'
              : '尚未绑定会话——从上方项目下拉里重新选一次即可',
          }, event.origin)
        }
      }
      window.addEventListener('message', onMessage)
      return () => window.removeEventListener('message', onMessage)
    }, [reload])

    // 用指针捕获而不是 document 监听：挂在 document 上的 mousemove/mouseup
    // 在指针移出窗口后还活着，面板会被窗口外的滚动手势拖着改宽、永不松手。
    // 钳制对着面板的右边缘算，不是对宽度算——旧的 innerWidth-380 上限会把
    // 对话挤到 100px 宽，而且再也拖不回来。
    const MIN_W = 480
    const MIN_CONVERSATION = 420
    const clampWidth = px => {
      const max = Math.max(MIN_W, window.innerWidth - left - MIN_CONVERSATION)
      return Math.round(Math.max(MIN_W, Math.min(max, px)))
    }
    const startResize = event => {
      event.preventDefault()
      event.stopPropagation()
      const grip = event.currentTarget
      grip.dataset.drag = 'true'
      try { grip.setPointerCapture(event.pointerId) } catch {}
      let latest = width
      const move = e => { latest = clampWidth(e.clientX - left); setWidth(latest) }
      const finish = () => {
        grip.dataset.drag = 'false'
        try { grip.releasePointerCapture(event.pointerId) } catch {}
        grip.removeEventListener('pointermove', move)
        grip.removeEventListener('pointerup', finish)
        grip.removeEventListener('pointercancel', finish)
        writeStore({ ...readStore(), width: latest })
      }
      grip.addEventListener('pointermove', move)
      grip.addEventListener('pointerup', finish)
      grip.addEventListener('pointercancel', finish)
    }
    // 窗口缩小后面板绝不能比新视口还宽。
    React.useEffect(() => {
      const onResize = () => setWidth(w => clampWidth(w))
      window.addEventListener('resize', onResize)
      onResize()
      return () => window.removeEventListener('resize', onResize)
    }, [left])

    if (!state.open) return null

    const submitCreate = async () => {
      const name = String(ask?.value || '').trim()
      if (!name) return
      setAsk(null)
      try {
        const result = await request('/api/content/projects', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        reload()
        await openProject(result.project.id)
        toast('项目已创建')
      } catch (error) { toast(`创建失败：${error.message}`) }
    }

    // 关键布局内联：样式表若因 HMR 重载/注入失败丢失，面板也不会塌成一条
    // （症状：iframe 退回 300x150 默认尺寸、背景透明、内容挤在左上角）。
    // 头部同样内联——"顶端 UI 消失"就是样式表丢失时头部裸奔的样子。
    const headStyle = {
      height: '48px', flex: 'none', display: 'flex', alignItems: 'center', gap: '7px',
      padding: '0 10px', borderBottom: '1px solid var(--dsw-alias-border-l1, #dfe1e4)',
      background: '#fafaf8', position: 'relative',
    }
    const pickerBtnStyle = {
      width: '100%', height: '34px', display: 'flex', alignItems: 'center', gap: '7px',
      padding: '0 9px', border: '1px solid var(--dsw-alias-border-l1, #dfe1e4)',
      borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '12px',
    }
    const iconBtnStyle = {
      width: '32px', height: '32px', flex: 'none', border: '1px solid transparent',
      borderRadius: '8px', background: 'transparent', fontSize: '15px', cursor: 'pointer',
      color: 'inherit', padding: 0,
    }
    const menuStyle = {
      position: 'absolute', zIndex: 40, left: 0, top: '38px', width: 'max(300px, 100%)',
      maxHeight: '60vh', overflow: 'auto', background: '#fff', padding: '4px',
      border: '1px solid var(--dsw-alias-border-l1, #dfe1e4)', borderRadius: '10px',
      boxShadow: '0 10px 30px rgba(20,24,28,.14)',
    }
    const menuItemStyle = {
      width: '100%', minHeight: '46px', display: 'flex', alignItems: 'center', gap: '9px',
      padding: '7px 9px', border: 0, borderRadius: '7px', background: 'transparent',
      cursor: 'pointer', textAlign: 'left', fontSize: '12px', color: 'inherit',
    }
    const sepStyle = { height: '1px', background: 'var(--dsw-alias-border-l1, #e2e4e9)', margin: '4px 2px' }
    const numericWidth = Number(width)
    const safeWidth = Number.isFinite(numericWidth) && numericWidth >= 380 ? Math.round(numericWidth) : 900
    const safeLeft = Number.isFinite(+left) && +left >= 0 ? Math.round(+left) : 0
    return h('section', { className: 'cw-panel', style: {
      position: 'absolute', top: 0, bottom: 0, left: `${safeLeft}px`,
      width: `${safeWidth}px`, minWidth: '480px', maxWidth: 'calc(100vw - 320px)',
      display: 'flex', flexDirection: 'column', zIndex: 30,
      background: '#fff', borderRight: '1px solid var(--dsw-alias-border-l1, #dfe1e4)',
      boxShadow: '0 0 24px rgba(20,24,28,.10)',
    } },
      h('header', { className: 'cw-head', style: headStyle },
        h('strong', { style: { fontSize: '12px', fontWeight: 600, padding: '6px 2px', flex: 'none' } }, '创作工作台'),
        // 真正的下拉而不是 26px 的原生 <select>：整行都是点击目标，新建项目
        // 也收在同一个菜单里，不用再找小图标。
        h('div', { className: 'cw-picker', style: { position: 'relative', minWidth: 0, flex: '1 1 auto', maxWidth: '320px' } },
          h('button', {
            className: 'cw-picker-btn', type: 'button', 'data-open': String(menuOpen),
            style: pickerBtnStyle,
            title: '切换项目',
            onClick: e => { e.stopPropagation(); setMenuOpen(!menuOpen); if (!menuOpen) reload() },
          },
            h('b', { style: { minWidth: 0, flex: 1, fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' } },
              state.mode === 'alldata' ? '全部数据总览' : (current ? current.name : (projects.length ? '选择项目…' : '还没有项目'))),
            state.mode === 'alldata' ? h('small', { style: { flex: 'none', fontSize: '10px', color: '#66707a' } }, '跨项目发布数据')
              : (current ? h('small', { style: { flex: 'none', fontSize: '10px', color: '#66707a' } }, `${current.topics} 选题 · ${current.drafts} 稿`) : null),
            h('i', { style: { fontStyle: 'normal', flex: 'none' } }, menuOpen ? '▴' : '▾')),
          menuOpen ? h('div', { className: 'cw-menu', style: menuStyle, onClick: e => e.stopPropagation() },
            projects.length
              ? projects.map(row => h('button', {
                  key: row.id, className: 'cw-menu-item', type: 'button', style: menuItemStyle,
                  'data-current': String(row.id === state.project),
                  onClick: () => {
                    setMenuOpen(false)
                    openProject(row.id).catch(err => toast(err.message))
                  },
                },
                  h('span', { className: 'col', style: { minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '1px' } },
                    h('b', null, row.name),
                    h('small', null, row.statusLabel)),
                  h('span', { className: 'cw-row-acts' },
                    h('span', {
                      title: '重命名', role: 'button',
                      onClick: e => { e.stopPropagation(); setMenuOpen(false); setRename({ id: row.id, value: row.name }) },
                    }, '✎'),
                    h('span', {
                      title: '删除项目', role: 'button', 'data-danger': 'true',
                      onClick: e => { e.stopPropagation(); setMenuOpen(false); setConfirmDel(row) },
                    }, '🗑')),
                  row.id === state.project ? h('span', { className: 'tick' }, '✓') : null))
              : h('div', { className: 'cw-menu-empty', style: { padding: '18px 12px', fontSize: '12px', color: '#66707a' } }, '还没有项目。', h('br'), '用下面新建一个。'),
            h('div', { className: 'cw-menu-sep', style: sepStyle }),
            h('button', {
              className: 'cw-menu-item', type: 'button', style: menuItemStyle,
              onClick: () => { setMenuOpen(false); setAsk({ value: '' }) },
            }, h('span', { className: 'col' }, h('b', null, '＋ 新建创作项目'),
                h('small', null, '一个项目对应一个账号或一个栏目'))),
            h('div', { className: 'cw-menu-sep', style: sepStyle }),
            h('button', {
              className: 'cw-menu-item', type: 'button', style: menuItemStyle, 'data-current': String(state.mode === 'alldata'),
              onClick: () => { setMenuOpen(false); setOpen({ open: true, mode: 'alldata' }) },
            }, h('span', { className: 'col' }, h('b', null, '📊 全部数据总览'),
                h('small', null, '跨项目汇总所有已发布链接的数据')))) : null),
        h('button', { className: 'cw-icon', type: 'button', style: iconBtnStyle, title: '刷新项目列表', onClick: reload }, '↻'),
        h('span', { className: 'cw-spacer', style: { marginLeft: 'auto', alignSelf: 'stretch' } }),
        h('button', { className: 'cw-icon', type: 'button', style: iconBtnStyle, title: '关闭', onClick: () => setOpen({ open: false }) }, '×')),
      state.mode === 'alldata'
        ? h('iframe', { key: 'alldata', className: 'cw-frame', title: '全部数据总览',
            style: { flex: '1 1 auto', width: '100%', minHeight: 0, border: 0, display: 'block', background: '#fff' },
            src: '/api/content/app?view=alldata' })
        : state.project
          ? h('iframe', { key: state.project, className: 'cw-frame', title: '创作工作台',
              style: { flex: '1 1 auto', width: '100%', minHeight: 0, border: 0, display: 'block', background: '#fff' },
              src: projectUrl('/api/content/app', state.project) })
          : h('div', { className: 'cw-empty' }, '还没有打开项目。',
              h('br'), '点上方 ＋ 新建一个创作项目开始。'),

      rename && h('div', { className: 'cw-ask', onMouseDown: e => { if (e.target === e.currentTarget) setRename(null) } },
        h('form', {
          className: 'cw-ask-card',
          onSubmit: async e => {
            e.preventDefault()
            const name = String(rename.value || '').trim()
            const id = rename.id
            setRename(null)
            if (!name) return
            try {
              await request('/api/content/action', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ project: id, type: 'rename-project', name }),
              })
              reload()
              toast('已重命名')
            } catch (error) { toast(`重命名失败：${error.message}`) }
          },
        },
          h('h3', null, '重命名项目'),
          h('p', null, '只改显示名称，项目文件夹和绑定的 DSH 会话都不动。'),
          h('input', {
            autoFocus: true, value: rename.value, placeholder: '项目名称',
            onChange: e => setRename(prev => ({ ...prev, value: e.target.value })),
            onKeyDown: e => { if (e.key === 'Escape') { e.preventDefault(); setRename(null) } },
          }),
          h('div', { className: 'cw-ask-actions' },
            h('button', { type: 'button', onClick: () => setRename(null) }, '取消'),
            h('button', { type: 'submit', 'data-primary': 'true' }, '保存')))),

      confirmDel && h('div', { className: 'cw-ask', onMouseDown: e => { if (e.target === e.currentTarget) setConfirmDel(null) } },
        h('form', {
          className: 'cw-ask-card',
          onSubmit: async e => {
            e.preventDefault()
            const row = confirmDel
            setConfirmDel(null)
            try {
              await request('/api/content/projects/delete', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ project: row.id }),
              })
              if (state.project === row.id) setOpen({ project: null })
              reload()
              toast('项目已移入回收站')
            } catch (error) { toast(`删除失败：${error.message}`) }
          },
        },
          h('h3', null, `删除「${confirmDel.name}」？`),
          h('p', null, `这个项目有 ${confirmDel.topics} 个选题、${confirmDel.drafts} 篇稿。不会真的删掉文件——`,
            '整个文件夹会移到数据目录下的 .trash/ 里，需要时可以手动找回。'),
          h('div', { className: 'cw-ask-actions' },
            h('button', { type: 'button', onClick: () => setConfirmDel(null) }, '取消'),
            h('button', { type: 'submit', 'data-primary': 'true', style: { background: '#a8453c', borderColor: '#a8453c' } }, '删除')))),

      ask && h('div', { className: 'cw-ask', onMouseDown: e => { if (e.target === e.currentTarget) setAsk(null) } },
        h('form', {
          className: 'cw-ask-card',
          onSubmit: e => { e.preventDefault(); submitCreate() },
        },
          h('h3', null, '新建创作项目'),
          h('p', null, '一个项目对应一个账号或一个栏目，比如「职场号日常」「产品种草矩阵」。项目里攒选题、稿件和素材。'),
          h('input', {
            autoFocus: true, value: ask.value, placeholder: '项目名称，例如「职场成长号」',
            onChange: e => setAsk(prev => ({ ...prev, value: e.target.value })),
            onKeyDown: e => { if (e.key === 'Escape') { e.preventDefault(); setAsk(null) } },
          }),
          h('div', { className: 'cw-ask-actions' },
            h('button', { type: 'button', onClick: () => setAsk(null) }, '取消'),
            h('button', { type: 'submit', 'data-primary': 'true' }, '创建')))),
      h('div', { className: 'cw-grip', onPointerDown: startResize, title: '拖动调整宽度',
        style: { position: 'absolute', top: 0, bottom: 0, right: '-4px', width: '9px', cursor: 'col-resize', zIndex: 31 } }))
  }

  const inject = ['slots', 'sessions', 'conversation', 'workspaces', 'layout']
  function apply(ctx) {
    bridge = { sessions: ctx.sessions, conversation: ctx.conversation, workspaces: ctx.workspaces }

    Object.assign(openState, { project: readStore().project || null, open: false, mode: 'project' })

    // 起始项目跟着你所在的对话走，而不是上次恰好打开的那个。要在列表加载完
    // 之后跑，因为映射关系来自服务端。
    request('/api/content/projects')
      .then(r => {
        projectIndex = r.projects.map(row => ({ id: row.id, sessionId: row.sessionId || '' }))
        const slug = projectForSession(ctx.sessions?.list?.getSnapshot?.()?.current)
        if (slug && slug !== openState.project) setOpen({ project: slug })
      })
      .catch(() => {})

    // 跟着对话走。
    //
    // 活动会话在 sessions.list → current。sessions.selection 看着像同一个东西
    // 而且更好找，但壳切换时它会变 null——监听它等于监听「没有对话」，面板会
    // 闪空而不是跟随。
    //
    // 只在会话确实映射到项目时切换，停在无关对话里时面板保持不动。
    ctx.effect(() => {
      const list = ctx.sessions?.list
      if (!list?.getSnapshot) return () => {}
      const read = () => list.getSnapshot()?.current || null
      let last = read()
      const check = () => {
        const id = read()
        if (id === last) return
        last = id
        const slug = projectForSession(id)
        if (slug && slug !== openState.project) setOpen({ project: slug })
      }
      if (typeof list.subscribe === 'function') return list.subscribe(check)
      const timer = setInterval(check, 600)
      return () => clearInterval(timer)
    }, 'dsh-content-workbench: follow the active conversation')

    ctx.effect(() => {
      const style = document.createElement('style')
      style.dataset.dshPlugin = 'dsh-content-workbench'
      style.textContent = css
      document.head.appendChild(style)
      return () => { style.remove(); document.querySelector('.cw-toast')?.remove() }
    }, 'content-workbench: styles')

    // 贡献到侧边栏而不是替换它——和任何侧边栏共存。
    ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
      name: 'sidebar.footer.action', id: 'content-workbench-open', order: 16, label: '创作工作台',
    }, SidebarButton), 'content-workbench: sidebar button')

    ctx.slots.inject('shell.overlay', () => ctx.slots.register({
      name: 'shell.overlay', id: 'content-workbench-panel', order: 5,
    }, Panel), 'content-workbench: workbench panel')
  }

  module.exports = { inject, apply }
  return module.exports
} })
