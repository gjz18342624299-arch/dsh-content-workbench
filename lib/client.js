// 自媒体内容创作工作台 —— 客户端入口（已构建的单文件模块）。
// 新工作台协议：通过 desktopWorkbenches.register 注册业务面板，会话的创建、
// 归属登记和最近会话恢复都由宿主完成；项目文件夹来自宿主目录选择器。
window.__ModuleLoader__.load({
  id: 'dsh-content-workbench',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const REPOSITORY = 'https://github.com/gjz18342624299-arch/dsh-content-workbench'

    const css = `
  .cw-root{position:relative;display:flex;flex-direction:column;gap:10px;height:100%;min-height:0;min-width:0;
    font-family:inherit;font-size:13px;line-height:20px;color:inherit;box-sizing:border-box}
  .cw-root button,.cw-root input{font-family:inherit;font-size:12px;line-height:18px;color:inherit;box-sizing:border-box}
  .cw-head{flex:none;display:flex;align-items:center;gap:7px}
  .cw-head-title{flex:none;font-size:12px;font-weight:600;white-space:nowrap}

  .cw-picker{position:relative;min-width:0;flex:1 1 auto}
  .cw-picker-btn{width:100%;height:32px;display:flex;align-items:center;gap:7px;padding:0 9px;
    border:1px solid var(--dsw-alias-border-l2,#dfe1e4);border-radius:8px;
    background:var(--dsw-alias-bg-layer-1,#fff);cursor:pointer;text-align:left}
  .cw-picker-btn:hover{border-color:var(--dsw-alias-label-secondary,#8a8e91)}
  .cw-picker-btn[data-open="true"]{border-color:#6b5a9e;box-shadow:0 0 0 3px rgba(107,90,158,.13)}
  .cw-picker-btn b{min-width:0;flex:1;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cw-picker-btn small{flex:none;color:var(--dsw-alias-label-secondary,#8a8e91);font-size:10px}
  .cw-picker-btn i{flex:none;font-style:normal;font-size:13px;line-height:1;color:var(--dsw-alias-label-secondary,#8a8e91)}
  .cw-menu{position:absolute;z-index:9;left:0;top:36px;width:max(280px,100%);max-height:56vh;overflow:auto;
    padding:5px;border:1px solid var(--dsw-alias-border-l2,#dfe1e4);border-radius:10px;
    background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 10px 30px rgba(20,24,28,.16)}
  .cw-menu-item{width:100%;min-height:44px;display:flex;align-items:center;gap:9px;padding:7px 9px;
    border:0;border-radius:7px;background:transparent;color:inherit;cursor:pointer;text-align:left}
  .cw-menu-item:hover{background:var(--dsw-alias-bg-layer-2,#f1f2f3)}
  .cw-menu-item[data-current="true"]{background:rgba(107,90,158,.11)}
  .cw-menu-item .col{min-width:0;flex:1}
  .cw-menu-item b{display:block;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cw-menu-item small{display:block;margin-top:2px;color:var(--dsw-alias-label-secondary,#8a8e91);font-size:10px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cw-menu-item .tick{flex:none;color:#6b5a9e;font-size:13px}
  .cw-menu-item .warn{flex:none;font-size:12px}
  .cw-row-acts{flex:none;display:flex;gap:2px;opacity:0}
  .cw-menu-item:hover .cw-row-acts,.cw-menu-item:focus-within .cw-row-acts{opacity:1}
  .cw-row-acts span{width:26px;height:26px;display:grid;place-items:center;border-radius:6px;
    color:var(--dsw-alias-label-secondary,#8a8e91);font-size:12px;cursor:pointer}
  .cw-row-acts span:hover{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#17191c)}
  .cw-row-acts span[data-danger="true"]:hover{background:rgba(168,69,60,.12);color:#a8453c}
  .cw-menu-sep{margin:5px 4px;border-top:1px solid var(--dsw-alias-border-l2,#dfe1e4)}
  .cw-menu-empty{padding:14px 10px;color:var(--dsw-alias-label-secondary,#8a8e91);font-size:11px;text-align:center;line-height:1.7}

  .cw-icon-btn{width:30px;height:30px;flex:none;border:1px solid transparent;border-radius:7px;background:transparent;
    color:var(--dsw-alias-label-secondary,#6f7578);font-size:14px;line-height:1;cursor:pointer;padding:0}
  .cw-icon-btn:hover{border-color:var(--dsw-alias-border-l2,#dfe1e4);background:var(--dsw-alias-bg-layer-1,#fff)}
  .cw-icon-btn:disabled{opacity:.5;cursor:default}

  .cw-frame-wrap{flex:1;min-height:0;min-width:0;border:1px solid var(--dsw-alias-border-l2,#dfe1e4);
    border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-base,#fff)}
  .cw-frame{width:100%;height:100%;min-height:0;border:0;display:block;background:var(--dsw-alias-bg-base,#fff)}

  .cw-welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
    padding:24px;text-align:center;color:var(--dsw-alias-label-secondary,#6f7578);font-size:12px;line-height:1.8}
  .cw-welcome strong{color:var(--dsw-alias-label-primary,#17191c);font-size:14px}
  .cw-primary{height:30px;padding:0 14px;border:1px solid #6b5a9e;border-radius:7px;background:#6b5a9e;
    color:#fff;font-weight:600;cursor:pointer}
  .cw-primary:disabled{opacity:.6;cursor:default}

  .cw-ask{position:absolute;inset:-18px;z-index:8;display:grid;place-items:center;background:rgba(0,0,0,.45);padding:24px}
  .cw-ask-card{width:min(430px,100%);padding:16px;border:1px solid var(--dsw-alias-border-l2,#dfe1e4);border-radius:11px;
    background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 12px 40px rgba(20,24,28,.22)}
  .cw-ask-card h3{margin:0 0 5px;font-size:13px}
  .cw-ask-card p{margin:0 0 10px;color:var(--dsw-alias-label-secondary,#6f7578);font-size:11px;line-height:1.7;
    overflow-wrap:anywhere}
  .cw-ask-card input{width:100%;height:32px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2,#dfe1e4);
    border-radius:7px;background:transparent;font-size:12px;outline:0;color:inherit}
  .cw-ask-card input:focus{border-color:#6b5a9e}
  .cw-ask-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:11px}
  .cw-ask-actions button{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2,#dfe1e4);border-radius:7px;
    background:transparent;font-size:11px;cursor:pointer;color:inherit}
  .cw-ask-actions button[data-primary="true"]{border-color:#6b5a9e;background:#6b5a9e;color:#fff;font-weight:600}
  .cw-ask-actions button[data-danger="true"]{border-color:#a8453c;background:#a8453c;color:#fff;font-weight:600}

  .cw-toast{position:absolute;z-index:12;left:50%;bottom:16px;transform:translate(-50%,8px);max-width:92%;
    padding:9px 14px;border:1px solid var(--dsw-alias-border-l2,#dfe1e4);border-radius:8px;
    background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#17191c);font-size:12px;
    box-shadow:0 6px 24px rgba(20,24,28,.16);opacity:0;pointer-events:none;transition:.18s}
  .cw-toast[data-show="true"]{opacity:1;transform:translate(-50%,0)}`

    let bridge = null
    let toastTimer = null

    // ── 面板视图状态（模块级：postMessage 处理器也要读写）─────────────
    let view = { project: null, mode: 'project' }   // mode: project | alldata
    const viewListeners = new Set()
    const setView = next => { view = { ...view, ...next }; viewListeners.forEach(fn => fn()) }
    const subscribeView = fn => { viewListeners.add(fn); return () => viewListeners.delete(fn) }

    let projectsCache = []
    const projectsListeners = new Set()
    const subscribeProjects = fn => { projectsListeners.add(fn); return () => projectsListeners.delete(fn) }

    // 会话 → 项目映射：列表加载时从服务端刷新（事实源是各项目的 project.json，
    // 不是浏览器存储——渲染进程每次启动端口都变，localStorage 重启即丢）。
    let projectIndex = []            // [{id, sessionId}]
    const projectForSession = sessionId => sessionId ? projectIndex.find(p => p.sessionId === sessionId)?.id || null : null

    async function request(path, options) {
      const response = await fetch(path, options)
      const result = await response.json()
      if (!response.ok) {
        const error = new Error(result.error || `HTTP ${response.status}`)
        error.code = result.code
        throw error
      }
      return result
    }
    const projectUrl = (path, slug) => `${path}?project=${encodeURIComponent(slug)}`
    const bootstrap = slug => request(projectUrl('/api/content/bootstrap', slug))

    async function reloadProjects() {
      const result = await request('/api/content/projects')
      projectsCache = result.projects
      projectIndex = result.projects.map(row => ({ id: row.id, sessionId: row.sessionId || '' }))
      projectsListeners.forEach(fn => fn())
      return result.projects
    }

    function fillDraft(sessionId, prompt) {
      const actx = bridge.sessions.scope?.(sessionId)
      const conversation = actx?.get?.('conversation')
      if (!conversation) throw new Error('对话输入不可用')
      const input = conversation.input.for(actx)
      const current = input.state.getSnapshot().draft || ''
      // 保留用户已经输入的内容：开场白/任务上下文追加在后面，发送权在用户手里。
      input.setDraft(current.trim() ? `${current}\n\n${prompt}` : prompt)
    }

    // 开场白预填可能撞上会话还没就绪——保留草稿，稍后自动重试几次。
    let pendingDraft = null
    let draftTimer = null
    function queueDraft(sessionId, text) {
      pendingDraft = { sessionId, text, tries: 0 }
      const attempt = () => {
        if (!pendingDraft) return
        try { fillDraft(pendingDraft.sessionId, pendingDraft.text); pendingDraft = null }
        catch {
          pendingDraft.tries += 1
          if (pendingDraft.tries < 6) draftTimer = setTimeout(attempt, 1500)
          // 重试耗尽也留着 pendingDraft：下个周期还会再试，不静默丢弃。
        }
      }
      clearTimeout(draftTimer)
      attempt()
    }

    /**
     * 新会话的开场白，预填进输入框——是草稿不是已发送消息，用户按回车才生效。
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
     * 项目的创作会话：宿主 ensureSession 负责校验归属、按项目文件夹创建/恢复
     * 工作区与会话、登记归属并把它带到前台。新建会话时把绑定写回 project.json
     * 并预填开场白。
     */
    async function ensureProjectSession(slug, result) {
      const saved = result?.state?.project?.sessionId || ''
      const sessionId = await bridge.workbenches.ensureSession({ folder: result.folder, sessionId: saved || undefined })
      if (sessionId && sessionId !== saved) {
        try {
          // action 端点从请求体而不是 query 读 project。
          await request('/api/content/action', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ project: slug, type: 'bind-session', sessionId }),
          })
          const row = projectIndex.find(p => p.id === slug)
          if (row) row.sessionId = sessionId
          else projectIndex.push({ id: slug, sessionId })
        } catch { /* 绑定写回失败不阻断会话使用，下次打开会重试 */ }
        queueDraft(sessionId, onboarding(result))
      }
      return sessionId
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

    // ── iframe 消息协议（public/app.js 的对应实现）────────────────────
    async function onMessage(event) {
      if (event.origin !== window.location.origin) return
      const data = event.data
      const reply = payload => { try { event.source?.postMessage?.(payload, event.origin) } catch {} }
      if (data?.type === 'dsh-content:ask') {
        // 「交给 DSH」是依赖会话的操作：未绑定时在此引导创建（宿主登记归属），
        // 不阻断面板的其他功能。
        try {
          const result = await bootstrap(data.project)
          const sessionId = await ensureProjectSession(data.project, result)
          fillDraft(sessionId, askPrompt(data, result))
          reply({ type: 'dsh-content:ask-result', ok: true })
        } catch (error) {
          reply({ type: 'dsh-content:ask-result', ok: false, error: error.message })
          setToast(error.message)
        }
        return
      }
      if (data?.type === 'dsh-content:projects-changed') { reloadProjects().catch(() => {}); return }
      // iframe 偶发会以裸 /api/content/app 加载（缺 project 参数）——让它自己问一嘴并带参重载。
      if (data?.type === 'dsh-content:which-project') {
        reply({ type: 'dsh-content:current-project', project: view.mode === 'project' ? view.project || null : null })
        return
      }
      if (data?.type === 'dsh-content:whoami') {
        let ok = false
        let detail = '尚未绑定创作会话——点任意「交给 DSH」按钮会自动创建并绑定'
        try {
          const result = await bootstrap(data.project)
          const saved = result.state?.project?.sessionId
          if (saved) {
            let owned
            try { owned = bridge.workbenches.ownsSession?.(saved) } catch { owned = undefined }
            ok = owned === undefined ? true : !!owned
            detail = ok
              ? `已绑定创作会话 ${String(saved).slice(0, 8)}…　工作目录 ${result.folder}`
              : '这条会话已改绑或失效——点「交给 DSH」会重新创建并绑定'
          }
        } catch { /* 项目暂时不可读时保持默认提示 */ }
        reply({ type: 'dsh-content:bound', ok, detail })
      }
    }

    let toastState = { message: '' }
    const toastListeners = new Set()
    const subscribeToast = fn => { toastListeners.add(fn); return () => toastListeners.delete(fn) }
    function setToast(message) {
      toastState = { message }
      toastListeners.forEach(fn => fn())
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => { toastState = { message: '' }; toastListeners.forEach(fn => fn()) }, 2800)
    }

    // ── 业务面板 ───────────────────────────────────────────
    function BusinessPanel({ service }) {
      const v = React.useSyncExternalStore(subscribeView, () => view)
      const projects = React.useSyncExternalStore(subscribeProjects, () => projectsCache)
      const toastNow = React.useSyncExternalStore(subscribeToast, () => toastState)
      const [menuOpen, setMenuOpen] = React.useState(false)
      const [ask, setAsk] = React.useState(null)          // 新建项目 {value}
      const [rename, setRename] = React.useState(null)    // {id, value}
      const [confirmDel, setConfirmDel] = React.useState(null)  // 项目行
      const [relink, setRelink] = React.useState(null)    // 项目行（文件夹丢失）
      const [busy, setBusy] = React.useState(false)

      React.useEffect(() => {
        reloadProjects()
          .then(() => {
            // 面板可能比会话晚加载：当前会话若已绑定某个项目，立即恢复它的业务映射。
            if (!view.project && view.mode === 'project') {
              const slug = projectForSession(bridge.workbenches.currentSession?.())
              if (slug) setView({ project: slug, mode: 'project' })
            }
          })
          .catch(error => setToast(error.message))
      }, [])

      // 点击菜单外任何处收起菜单（包括 iframe 里的点击——iframe 捕获后窗口 blur）。
      React.useEffect(() => {
        if (!menuOpen) return undefined
        const close = () => setMenuOpen(false)
        document.addEventListener('click', close)
        window.addEventListener('blur', close)
        return () => { document.removeEventListener('click', close); window.removeEventListener('blur', close) }
      }, [menuOpen])

      // 跟着当前会话走：显式打开某个项目绑定的会话时，面板恢复该会话的业务映射。
      React.useEffect(() => {
        const list = bridge.sessions?.list
        if (!list?.subscribe) return undefined
        let last = bridge.workbenches.currentSession?.() || null
        const check = () => {
          const id = bridge.workbenches.currentSession?.() || null
          if (id === last) return
          last = id
          const slug = projectForSession(id)
          if (slug && slug !== view.project) setView({ project: slug, mode: 'project' })
        }
        return list.subscribe(check)
      }, [])

      const current = projects.find(row => row.id === v.project) || null

      const openProject = async slug => {
        try {
          // 业务面板先显示，会话恢复并行进行（规范：面板显示不等待会话就绪）。
          const result = await bootstrap(slug)
          setView({ project: slug, mode: 'project' })
          try {
            await ensureProjectSession(slug, result)
          } catch (error) {
            setToast(`创作会话暂未就绪：${error.message}。项目可正常浏览，点「交给 DSH」会重试。`)
          }
        } catch (error) {
          if (error.code === 'PROJECT_FOLDER_MISSING') {
            const row = projects.find(p => p.id === slug)
            setRelink(row || { id: slug, folder: '' })
            setToast('这个项目的位置不在了，重新选择文件夹后继续使用')
          } else {
            setToast(error.message)
          }
        }
      }

      const submitCreate = async () => {
        const name = String(ask?.value || '').trim()
        if (!name) return
        setAsk(null)
        // 宿主目录选择器：用户挑已有文件夹，或在系统选择器里明确新建一个。
        // 取消时不留下任何目录、项目、工作区、会话或绑定。
        let folder = null
        try { folder = await bridge.uiWorkspace.pickDirectory() } catch (error) { setToast(`打开目录选择器失败：${error.message}`); return }
        if (!folder) return
        setBusy(true)
        try {
          const created = await request('/api/content/projects', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, folder }),
          })
          await reloadProjects()
          await openProject(created.project.id)
          setToast(created.adopted ? '已认领所选文件夹里的现有项目' : `项目已创建：${folder}`)
        } catch (error) { setToast(`创建失败：${error.message}`) }
        finally { setBusy(false) }
      }

      const submitRelink = async () => {
        const row = relink
        if (!row) return
        let folder = null
        try { folder = await bridge.uiWorkspace.pickDirectory() } catch (error) { setToast(`打开目录选择器失败：${error.message}`); return }
        if (!folder) return   // 取消：保持丢失状态，不做任何改动
        setBusy(true)
        try {
          await request('/api/content/projects/relink', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ project: row.id, folder }),
          })
          setRelink(null)
          await reloadProjects()
          await openProject(row.id)
          setToast('已重新指向项目文件夹')
        } catch (error) { setToast(`重新选择失败：${error.message}`) }
        finally { setBusy(false) }
      }

      const headPickerLabel = v.mode === 'alldata'
        ? '全部数据总览'
        : (current ? current.name : (projects.length ? '选择项目…' : '还没有项目'))

      return h('div', { className: 'cw-root' },
        h('div', { className: 'cw-head' },
          h('span', { className: 'cw-head-title' }, '✎ 创作工作台'),
          h('div', { className: 'cw-picker' },
            h('button', {
              className: 'cw-picker-btn', type: 'button', 'data-open': String(menuOpen),
              title: '切换项目', disabled: busy,
              onClick: e => { e.stopPropagation(); setMenuOpen(!menuOpen); if (!menuOpen) reloadProjects().catch(() => {}) },
            },
              h('b', null, headPickerLabel),
              v.mode === 'alldata' ? h('small', null, '跨项目发布数据')
                : (current ? h('small', null, current.missing ? '位置丢失' : `${current.topics} 选题 · ${current.drafts} 稿`) : null),
              h('i', null, menuOpen ? '▴' : '▾')),
            menuOpen ? h('div', { className: 'cw-menu', onClick: e => e.stopPropagation() },
              projects.length
                ? projects.map(row => h('button', {
                    key: row.id, className: 'cw-menu-item', type: 'button',
                    'data-current': String(row.id === v.project && v.mode === 'project'),
                    onClick: () => {
                      setMenuOpen(false)
                      if (row.missing) { setRelink(row); return }
                      openProject(row.id).catch(error => setToast(error.message))
                    },
                  },
                    h('span', { className: 'col' },
                      h('b', null, row.name),
                      h('small', null, row.missing ? `⚠ 项目文件夹不在了：${row.folder}` : row.statusLabel)),
                    !row.missing && h('span', { className: 'cw-row-acts' },
                      h('span', {
                        title: '重命名', role: 'button',
                        onClick: e => { e.stopPropagation(); setMenuOpen(false); setRename({ id: row.id, value: row.name }) },
                      }, '✎'),
                      h('span', {
                        title: '从工作台移除', role: 'button', 'data-danger': 'true',
                        onClick: e => { e.stopPropagation(); setMenuOpen(false); setConfirmDel(row) },
                      }, '🗑')),
                    row.id === v.project && v.mode === 'project' ? h('span', { className: 'tick' }, '✓') : null))
                : h('div', { className: 'cw-menu-empty' }, '还没有项目。', h('br'), '用下面新建一个。'),
              h('div', { className: 'cw-menu-sep' }),
              h('button', {
                className: 'cw-menu-item', type: 'button',
                onClick: () => { setMenuOpen(false); setAsk({ value: '' }) },
              }, h('span', { className: 'col' }, h('b', null, '＋ 新建创作项目'),
                  h('small', null, '一个项目对应一个账号或一个栏目，位置由你挑选'))),
              h('div', { className: 'cw-menu-sep' }),
              h('button', {
                className: 'cw-menu-item', type: 'button', 'data-current': String(v.mode === 'alldata'),
                onClick: () => { setMenuOpen(false); setView({ mode: 'alldata' }) },
              }, h('span', { className: 'col' }, h('b', null, '📊 全部数据总览'),
                  h('small', null, '跨项目汇总所有已发布链接的数据')))) : null),
          h('button', {
            className: 'cw-icon-btn', type: 'button', title: '刷新项目列表', disabled: busy,
            onClick: () => reloadProjects().then(() => setToast('已刷新')).catch(error => setToast(error.message)),
          }, '↻')),

        v.mode === 'alldata'
          ? h('div', { className: 'cw-frame-wrap' }, h('iframe', { key: 'alldata', className: 'cw-frame', title: '全部数据总览', src: '/api/content/app?view=alldata' }))
          : current && !current.missing
            ? h('div', { className: 'cw-frame-wrap' }, h('iframe', { key: current.id, className: 'cw-frame', title: '创作工作台', src: projectUrl('/api/content/app', current.id) }))
            : h('div', { className: 'cw-welcome' },
                h('strong', null, current?.missing ? '这个项目的位置不在了' : (projects.length ? '从上方选择一个项目' : '还没有创作项目')),
                current?.missing
                  ? h(React.Fragment, null,
                      h('div', null, `上次的位置：${current.folder}`, h('br'), '文件夹可能被移动或删除了。重新指向它即可继续，历史内容都在。'),
                      h('button', { className: 'cw-primary', type: 'button', disabled: busy, onClick: () => setRelink(current) }, '重新选择项目文件夹…'))
                  : h(React.Fragment, null,
                      h('div', null, '一个项目 = 一个账号或一个栏目，里面攒选题、稿件和素材。', h('br'), '项目文件夹的位置由你在系统选择器里挑选，工作台不替你猜。'),
                      h('button', { className: 'cw-primary', type: 'button', disabled: busy, onClick: () => setAsk({ value: '' }) }, '＋ 新建创作项目'))),

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
                await reloadProjects()
                setToast('已重命名')
              } catch (error) { setToast(`重命名失败：${error.message}`) }
            },
          },
            h('h3', null, '重命名项目'),
            h('p', null, '只改显示名称，项目文件夹和绑定的创作会话都不动。'),
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
                const result = await request('/api/content/projects/delete', {
                  method: 'POST', headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ project: row.id }),
                })
                if (v.project === row.id) setView({ project: null })
                await reloadProjects()
                setToast(`已从工作台移除，文件原样保留在 ${result.kept}`)
              } catch (error) { setToast(`移除失败：${error.message}`) }
            },
          },
            h('h3', null, `从工作台移除「${confirmDel.name}」？`),
            h('p', null, `这个项目有 ${confirmDel.topics} 个选题、${confirmDel.drafts} 篇稿。`,
              '只移除工作台里的登记，项目文件夹原样保留在磁盘上，之后新建项目时选同一个文件夹即可认领回来。'),
            h('div', { className: 'cw-ask-actions' },
              h('button', { type: 'button', onClick: () => setConfirmDel(null) }, '取消'),
              h('button', { type: 'submit', 'data-danger': 'true' }, '移除')))),

        relink && h('div', { className: 'cw-ask', onMouseDown: e => { if (e.target === e.currentTarget) setRelink(null) } },
          h('form', {
            className: 'cw-ask-card',
            onSubmit: e => { e.preventDefault(); submitRelink() },
          },
            h('h3', null, `重新选择「${relink.name || relink.id}」的文件夹`),
            h('p', null,
              relink.folder ? `上次的位置：${relink.folder}` : '这个项目登记的位置当前不可读。',
              h('br'),
              '文件夹可能被移动、重命名或删除了。在系统选择器里指向它现在的位置即可继续；如果选中的文件夹里已有这个项目的 project.json，会直接认领回来。'),
            h('div', { className: 'cw-ask-actions' },
              h('button', { type: 'button', onClick: () => setRelink(null) }, '取消'),
              h('button', { type: 'submit', 'data-primary': 'true', disabled: busy }, busy ? '处理中…' : '选择文件夹…')))),

        ask && h('div', { className: 'cw-ask', onMouseDown: e => { if (e.target === e.currentTarget) setAsk(null) } },
          h('form', {
            className: 'cw-ask-card',
            onSubmit: e => { e.preventDefault(); submitCreate() },
          },
            h('h3', null, '新建创作项目'),
            h('p', null, '一个项目对应一个账号或一个栏目，比如「职场号日常」「产品种草矩阵」。',
              h('br'), '点「选择文件夹并创建」后，在系统选择器里挑一个已有文件夹，或明确新建一个——项目文件就放那里。'),
            h('input', {
              autoFocus: true, value: ask.value, placeholder: '项目名称，例如「职场成长号」',
              onChange: e => setAsk(prev => ({ ...prev, value: e.target.value })),
              onKeyDown: e => { if (e.key === 'Escape') { e.preventDefault(); setAsk(null) } },
            }),
            h('div', { className: 'cw-ask-actions' },
              h('button', { type: 'button', onClick: () => setAsk(null) }, '取消'),
              h('button', { type: 'submit', 'data-primary': 'true', disabled: busy }, busy ? '创建中…' : '选择文件夹并创建')))),

        h('div', { className: 'cw-toast', 'data-show': String(!!toastNow.message), role: 'status' }, toastNow.message))
    }

    function apply(ctx) {
      bridge = { workbenches: ctx.desktopWorkbenches, sessions: ctx.sessions, uiWorkspace: ctx.uiWorkspace }

      ctx.effect(() => {
        const style = document.createElement('style')
        style.dataset.dshPlugin = 'dsh-content-workbench'
        style.textContent = css
        document.head.appendChild(style)
        return () => style.remove()
      }, 'content-workbench: styles')

      ctx.effect(() => {
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
      }, 'content-workbench: iframe protocol')

      // 注册业务面板：不提供 id（市场身份由仓库地址生成）；返回值是注销函数，
      // 交给 ctx.effect 管理。
      ctx.effect(() => ctx.desktopWorkbenches.register({
        title: '自媒体内容创作工作台',
        repository: REPOSITORY,
        description: '选题看板、平台稿件与素材库管理，把写作任务连同上下文交给 DSH 对话完成。',
        panelTitle: '创作工作台',
        icon: '✎',
        audience: '自媒体创作者',
        layout: { businessSide: 'left', businessWidth: 0.55 },
      }, BusinessPanel), 'content-workbench: register')

      // 会话尚未就绪时没填上的开场白：周期性补试，直到填入或插件卸载。
      ctx.effect(() => {
        const timer = setInterval(() => {
          if (!pendingDraft) return
          try { fillDraft(pendingDraft.sessionId, pendingDraft.text); pendingDraft = null } catch { /* 下个周期再试 */ }
        }, 5000)
        return () => clearInterval(timer)
      }, 'content-workbench: pending draft retry')
    }

    return { apply, inject: ['desktopWorkbenches', 'sessions', 'uiWorkspace'] }
  },
})
