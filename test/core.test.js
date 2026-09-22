import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  slugify, migrate, normalizeTopic, normalizeDraft,
  applyAction, exportDraft, ensureProject,
  FORMATS, TOPIC_STATUSES, DRAFT_STATUSES,
} from '../src/index.js'

function freshState() {
  return migrate({ project: { name: '测试号' } }, '/tmp/demo', 'demo')
}

test('slugify 保留中文、清理特殊字符、限制长度', () => {
  assert.equal(slugify('职场成长号'), '职场成长号')
  assert.equal(slugify('My Account! 2026'), 'my-account-2026')
  assert.equal(slugify('   '), '')
  assert.equal(slugify('', 'fallback'), 'fallback')
  assert.ok(slugify('x'.repeat(200)).length <= 64)
})

test('normalizeTopic 兜底默认值', () => {
  const topic = normalizeTopic({}, 0)
  assert.equal(topic.status, 'candidate')
  assert.deepEqual(topic.formats, [])
  assert.ok(topic.id.startsWith('topic-'))
  assert.ok(topic.title)
})

test('normalizeTopic 过滤未知平台', () => {
  const topic = normalizeTopic({ formats: ['wechat', 'tiktok', 'xhs'] }, 0)
  assert.deepEqual(topic.formats, ['wechat', 'xhs'])
})

test('normalizeDraft 兜底默认值并保留版本', () => {
  const draft = normalizeDraft({ format: 'xhs', versions: [{ title: 'a', body: 'b' }] }, 0)
  assert.equal(draft.format, 'xhs')
  assert.equal(draft.status, 'outline')
  assert.equal(draft.versions.length, 1)
  assert.equal(normalizeDraft({ format: 'nope' }, 0).format, 'wechat')
})

test('migrate 把孤儿稿件的 topicId 置空', () => {
  const state = migrate({
    project: { name: 'x' },
    topics: [],
    drafts: [{ title: '孤儿稿', topicId: 'topic-gone' }],
  }, '/tmp/x', 'x')
  assert.equal(state.drafts[0].topicId, '')
})

test('create-topic 追加并选中', () => {
  const state = freshState()
  const log = applyAction(state, { type: 'create-topic', topic: { title: '新选题', formats: ['wechat'] } })
  assert.equal(state.topics.length, 1)
  assert.equal(state.selectedTopicId, state.topics[0].id)
  assert.match(log.text, /新增选题/)
})

test('topic-status 只接受合法状态', () => {
  const state = freshState()
  applyAction(state, { type: 'create-topic', topic: { title: 'A' } })
  const id = state.topics[0].id
  applyAction(state, { type: 'topic-status', id, status: 'writing' })
  assert.equal(state.topics[0].status, 'writing')
  assert.throws(() => applyAction(state, { type: 'topic-status', id, status: 'published' }), /状态不合法/)
})

test('delete-topic 解除稿件关联但不删稿', () => {
  const state = freshState()
  applyAction(state, { type: 'create-topic', topic: { title: 'A' } })
  const topicId = state.topics[0].id
  applyAction(state, { type: 'create-draft', topicId, draft: { format: 'wechat', title: '稿' } })
  applyAction(state, { type: 'delete-topic', id: topicId })
  assert.equal(state.topics.length, 0)
  assert.equal(state.drafts.length, 1)
  assert.equal(state.drafts[0].topicId, '')
})

test('create-draft 拒绝不存在的选题', () => {
  const state = freshState()
  assert.throws(() => applyAction(state, { type: 'create-draft', topicId: 'topic-ghost', draft: { format: 'wechat' } }), /选题不存在/)
})

test('restore-version 先给当前留档再回滚', () => {
  const state = freshState()
  applyAction(state, { type: 'create-draft', draft: { format: 'wechat', title: '稿' } })
  const id = state.drafts[0].id
  applyAction(state, { type: 'update-draft', id, patch: { body: '第一版正文' } })
  applyAction(state, { type: 'save-version', id, note: '初稿' })
  applyAction(state, { type: 'update-draft', id, patch: { body: '第二版正文' } })
  const verId = state.drafts[0].versions[0].id
  applyAction(state, { type: 'restore-version', id, versionId: verId })
  const draft = state.drafts[0]
  assert.equal(draft.body, '第一版正文')
  assert.equal(draft.versions.length, 2)
  assert.equal(draft.versions[1].note, '回滚前自动留档')
})

test('exportDraft 拒绝空正文', async () => {
  const state = freshState()
  applyAction(state, { type: 'create-draft', draft: { format: 'xhs', title: '空的' } })
  await assert.rejects(() => exportDraft(state, state.drafts[0].id), /正文还是空的/)
})

test('exportDraft 产出带元信息的 markdown', async () => {
  const state = freshState()
  applyAction(state, { type: 'create-draft', draft: { format: 'xhs', title: '春天护肤清单' } })
  const id = state.drafts[0].id
  applyAction(state, { type: 'update-draft', id, patch: { body: '正文内容', tags: ['护肤', '春天'], images: [{ slot: 'cover', prompt: '粉色书桌俯拍', file: 'images/cover.png' }] } })
  const { filename, content } = await exportDraft(state, id)
  assert.equal(filename, 'xhs-春天护肤清单.md')
  assert.match(content, /# 春天护肤清单/)
  assert.match(content, /#护肤/)
  assert.match(content, /封面 images\/cover\.png/)
  assert.match(content, /正文内容/)
})

test('ensureProject 建出目录结构与 CONTEXT.md', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cw-'))
  process.env.DSH_CONTENT_WORKBENCH_ROOT = dir
  try {
    const { ensureProject: scoped } = await import(`../src/index.js?${Date.now()}`)
    const { folder, state } = await scoped('demo', { name: '演示' })
    const context = await readFile(join(folder, 'CONTEXT.md'), 'utf8')
    assert.match(context, /内容创作工作台上下文/)
    assert.match(context, /公众号图文/)
    assert.equal(state.project.id, 'demo')
  } finally {
    delete process.env.DSH_CONTENT_WORKBENCH_ROOT
  }
})

test('格式定义齐全', () => {
  for (const id of ['wechat', 'xhs', 'video', 'zhihu']) {
    assert.ok(FORMATS[id], id)
    assert.ok(FORMATS[id].label && FORMATS[id].spec.length, id)
  }
  assert.deepEqual(TOPIC_STATUSES, ['candidate', 'writing', 'done'])
  assert.deepEqual(DRAFT_STATUSES, ['outline', 'writing', 'review', 'ready', 'published'])
})

test('publish-data 回填数据并自动推进到已发布', () => {
  const state = freshState()
  applyAction(state, { type: 'create-draft', draft: { format: 'wechat', title: '稿' } })
  const id = state.drafts[0].id
  applyAction(state, { type: 'draft-status', id, status: 'ready' })
  const log = applyAction(state, { type: 'publish-data', id, published: { reads: '1234', likes: 56, note: '涨粉 200' } })
  const draft = state.drafts[0]
  assert.equal(draft.status, 'published')
  assert.equal(draft.published.reads, 1234)
  assert.equal(draft.published.likes, 56)
  assert.equal(draft.published.comments, 0)
  assert.equal(draft.published.note, '涨粉 200')
  assert.ok(draft.published.at)
  assert.equal(log.durable, true)
})

test('publish-data 清空数据退回就绪', () => {
  const state = freshState()
  applyAction(state, { type: 'create-draft', draft: { format: 'wechat', title: '稿' } })
  const id = state.drafts[0].id
  applyAction(state, { type: 'publish-data', id, published: { reads: 10 } })
  assert.equal(state.drafts[0].status, 'published')
  applyAction(state, { type: 'publish-data', id, published: null })
  assert.equal(state.drafts[0].status, 'ready')
  assert.equal(state.drafts[0].published, null)
})

test('publish-data 每日流量：非法日期丢弃、按日期排序', () => {
  const state = freshState()
  applyAction(state, { type: 'create-draft', draft: { format: 'wechat', title: '稿' } })
  const id = state.drafts[0].id
  applyAction(state, {
    type: 'publish-data', id,
    published: {
      reads: 1200,
      daily: [{ date: '2026-05-02', reads: 400, likes: 9 }, { date: 'bad', reads: 5 }, { date: '2026-05-01', reads: 800 }],
    },
  })
  const daily = state.drafts[0].published.daily
  assert.equal(daily.length, 2)
  assert.equal(daily[0].date, '2026-05-01')
  assert.equal(daily[0].reads, 800)
  assert.equal(daily[1].likes, 9)
})

test('migrate 保留 published 与 insights，丢掉 published 里的杂字段', () => {
  const state = migrate({
    project: { name: 'x', insights: '数字类标题表现最好' },
    drafts: [{ title: '稿', published: { reads: 100, likes: 5, hack: 'x' } }],
  }, '/tmp/x', 'x')
  assert.equal(state.project.insights, '数字类标题表现最好')
  assert.equal(state.drafts[0].published.reads, 100)
  assert.equal(state.drafts[0].published.hack, undefined)
})

test('update-draft 保存正文变化时自动留档，重复保存不刷版本', () => {
  const state = freshState()
  applyAction(state, { type: 'create-draft', draft: { format: 'wechat', title: '稿' } })
  const id = state.drafts[0].id
  applyAction(state, { type: 'update-draft', id, patch: { body: '第一版' } })
  assert.equal(state.drafts[0].versions.length, 0) // 旧正文是空的，没有可留档的东西
  applyAction(state, { type: 'update-draft', id, patch: { body: '第二版' } })
  assert.equal(state.drafts[0].versions.length, 1)
  assert.equal(state.drafts[0].versions[0].body, '第一版')
  assert.equal(state.drafts[0].versions[0].note, '保存前自动留档')
  applyAction(state, { type: 'update-draft', id, patch: { title: '只改标题' } })
  assert.equal(state.drafts[0].versions.length, 1) // 正文没变，不留档
})

test('project-meta 清洗自定义指令', () => {
  const state = freshState()
  applyAction(state, {
    type: 'project-meta',
    customAsks: [
      { label: '口语化重写', request: '把正文改得更口语' },
      { label: '缺内容的', request: '' },
      { label: '', request: '缺名字的' },
    ],
  })
  assert.equal(state.project.customAsks.length, 1)
  assert.equal(state.project.customAsks[0].label, '口语化重写')
  assert.ok(state.project.customAsks[0].id)
  const again = migrate({ project: { name: 'x', customAsks: state.project.customAsks } }, '/tmp/x', 'x')
  assert.equal(again.project.customAsks.length, 1)
})
