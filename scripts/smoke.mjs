// 冒烟测试：真实 HTTP 打一遍 API 面。手动跑：node scripts/smoke.mjs
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'

process.env.DSH_CONTENT_WORKBENCH_ROOT = await mkdtemp(join(tmpdir(), 'cw-smoke-'))
// 项目文件夹模拟「用户在宿主目录选择器里挑的位置」，与登记簿目录分开。
const projectFolder = await mkdtemp(join(tmpdir(), 'cw-smoke-project-'))
const { handleApi } = await import(`../src/index.js?smoke=${Date.now()}`)

const server = http.createServer((req, res) => handleApi(req, res).catch(e => {
  res.writeHead(500, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: String(e) }))
}))
await new Promise(r => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

let failures = 0
const check = (name, cond) => {
  console.log(`${cond ? '✔' : '✖'} ${name}`)
  if (!cond) failures += 1
}
const api = async (path, options) => {
  const res = await fetch(`${base}${path}`, options)
  const type = res.headers.get('content-type') || ''
  return { status: res.status, body: type.includes('json') ? await res.json() : await res.text(), type }
}
const post = (path, payload) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })

// 静态资源
const html = await api('/api/content/app')
check('GET /app 返回 HTML', html.status === 200 && html.body.includes('创作工作台'))
const css = await api('/api/content/app.css')
check('GET /app.css 返回 CSS', css.status === 200 && css.type.includes('text/css'))
const js = await api('/api/content/app.js')
check('GET /app.js 返回 JS', js.status === 200 && js.body.includes('bootstrap'))

// 建项目：必须带用户选择的文件夹（新规范不允许静默建目录）
const noFolder = await post('/api/content/projects', { name: '没位置的' })
check('POST /projects 缺 folder 返回 400', noFolder.status === 400)
const created = await post('/api/content/projects', { name: '冒烟测试号', folder: projectFolder })
check('POST /projects 创建项目', created.status === 201 && created.body.project.id)
const slug = created.body.project.id
console.log('  project slug =', slug)

// 列表
const list = await api('/api/content/projects')
check('GET /projects 含新项目', list.body.projects.some(p => p.id === slug))

// bootstrap
const boot = await api(`/api/content/bootstrap?project=${slug}`)
check('bootstrap 返回 state/meta/revision', boot.status === 200 && boot.body.state.project.id === slug && boot.body.meta.formats.length === 4)
check('meta 含四种格式', ['wechat', 'xhs', 'video', 'zhihu'].every(f => boot.body.meta.formats.some(x => x.id === f)))

// 建选题
const t1 = await post('/api/content/action', { project: slug, type: 'create-topic', topic: { title: '反向旅游为什么火', angle: '从消费降级切入', formats: ['wechat', 'xhs'] } })
check('create-topic', t1.status === 200 && t1.body.state.topics.length === 1)
const topicId = t1.body.state.topics[0].id

// 建稿 + 写大纲正文
const d1 = await post('/api/content/action', { project: slug, type: 'create-draft', topicId, draft: { format: 'wechat', title: '反向旅游为什么火' } })
const draftId = d1.body.state.drafts[0].id
check('create-draft 关联选题', d1.body.state.drafts[0].topicId === topicId)
await post('/api/content/action', { project: slug, type: 'update-draft', id: draftId, patch: { outline: ['破题', '数据', '观点', '收尾'], body: '# 正文\n\n第一段。', digest: '摘要', images: [{ slot: 'cover', prompt: '山间小县城清晨', file: '', alt: '' }] } })
const booted = await api(`/api/content/bootstrap?project=${slug}`)
check('update-draft 落盘', booted.body.state.drafts[0].outline.length === 4)

// 留版本 + 导出
await post('/api/content/action', { project: slug, type: 'save-version', id: draftId, note: '冒烟' })
const exp = await post('/api/content/action', { project: slug, type: 'export-draft', id: draftId })
check('export-draft 写出 exports/', exp.status === 200 && /^exports\/wechat-/.test(exp.body.file))

// 素材
const m1 = await post('/api/content/action', { project: slug, type: 'add-material', material: { name: '文旅局数据', kind: 'text', content: '县域旅游订单同比 +38%', tags: ['数据'] } })
check('add-material', m1.status === 200 && m1.body.state.materials.length === 1)

// 文件列表
const files = await api(`/api/content/files?project=${slug}&dir=exports`)
check('files?dir=exports 列出导出文件', files.body.files.length === 1)
const badDir = await api(`/api/content/files?project=${slug}&dir=..`)
check('files 拒绝非法目录', badDir.status === 400)

// 文件读取与越界防护
const file = await api(`/api/content/file?project=${slug}&path=${encodeURIComponent(files.body.files[0].path)}`)
check('file 读取导出文件', file.status === 200 && file.body.includes('反向旅游为什么火'))
const escape1 = await api(`/api/content/file?project=${slug}&path=${encodeURIComponent('../project.json')}`)
check('file 拦截 ../ 越界', escape1.status === 403)

// watch：revision 不同应立即返回 changed
const watched = await api(`/api/content/watch?project=${slug}&since=0`)
check('watch 检测变更', watched.body.changed === true)

// 发布回填 + 复盘原料
const pub = await post('/api/content/action', { project: slug, type: 'publish-data', id: draftId, published: { reads: 1234, likes: 56, note: '涨粉 200' } })
check('publish-data 回填并置为已发布', pub.status === 200 && pub.body.state.drafts[0].status === 'published' && pub.body.state.drafts[0].published.reads === 1234)
const boot3 = await api(`/api/content/bootstrap?project=${slug}`)
check('bootstrap 带回 published 与 insights 字段', boot3.body.state.drafts[0].published.reads === 1234 && boot3.body.state.project.insights !== undefined)

// 自定义指令
const meta1 = await post('/api/content/action', { project: slug, type: 'project-meta', customAsks: [{ label: '口语化重写', request: '把正文改得更口语' }, { label: '', request: '没名字的' }] })
check('project-meta 自定义指令清洗落盘', meta1.status === 200 && meta1.body.state.project.customAsks.length === 1)

// 跨项目数据总览
const all = await api('/api/content/alldata')
check('alldata 汇总已发布稿件', all.status === 200 && all.body.rows.length === 1 && all.body.rows[0].published.reads === 1234 && all.body.projects.some(p => p.id === slug))

// 会话绑定
const bind = await post('/api/content/action', { project: slug, type: 'bind-session', sessionId: 'sess-smoke-1' })
check('bind-session 持久化', bind.body.state.project.sessionId === 'sess-smoke-1')
const relist = await api('/api/content/projects')
check('项目列表带回 sessionId', relist.body.projects.find(p => p.id === slug)?.sessionId === 'sess-smoke-1')

// 移除项目：只撤销登记，文件保留
const del = await post('/api/content/projects/delete', { project: slug })
check('projects/delete 成功且返回保留位置', del.status === 200 && del.body.kept === projectFolder)
const kept = await api(`/api/content/file?project=${slug}&path=${encodeURIComponent('project.json')}`)
check('移除后接口不再认这个项目', kept.status === 404)
const { stat } = await import('node:fs/promises')
check('移除后 project.json 仍在磁盘上', !!(await stat(join(projectFolder, 'project.json')).catch(() => null)))

server.close()
console.log(failures ? `\n${failures} 项失败` : '\n全部通过')
process.exit(failures ? 1 : 0)
