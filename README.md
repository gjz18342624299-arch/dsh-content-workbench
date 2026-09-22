# 自媒体内容创作工作台

DSH (DeepSeek Harness) 插件。**左侧固定选题、方向、目标平台；右侧和 DSH 对话提要求；结合素材库自动产出公众号图文、小红书笔记、短视频脚本、知乎回答——图文并茂。**

## 它做什么

- **选题看板** — 选题带切入方向、目标平台、状态流转（候选 → 写作中 → 已完成），一个选题产多平台稿
- **四种平台格式** — 公众号图文（标题 64 字 + 摘要 + 封面）、小红书笔记（20 字标题 + emoji + 话题标签 + 3:4 封面）、短视频脚本（前 3 秒钩子 + 分镜 + 时长）、知乎回答，各有写作约束，UI 和给 DSH 的规则同源
- **对话式创作** — 「交给 DSH」把当前选题/稿件的完整上下文填进右侧对话框：发散选题、生成大纲、写正文、平台改写、起标题、降 AI 味、配图建议、整理素材
- **素材库** — 文本/链接/文件三类素材，DSH 动笔前先读素材，不编数据
- **图文并茂** — 每篇稿有封面 + 文内插图位：DSH 写画面描述（生图提示词），能生成图就直接生成进 `images/`，界面即时预览
- **版本留档** — 大改前留版本，可回滚；DSH 大改也必须先留档（CONTEXT.md 里写死）
- **人设一致性** — 项目级人设语气、目标读者、禁用词，写进 CONTEXT.md，DSH 每次动笔前必读

## 安装

需要 Node ≥ 20 和 DSH Desktop。

- **工作台市场**：上架后在 DSH Desktop 的工作台市场搜索安装（推荐）。
- **源码安装**：`git clone` 本仓库后，在 DSH profile（`%APPDATA%\dsh-desktop\harness\profiles\web`）的 `package.json` 里把 `dsh-content-workbench` 声明为指向本地目录的 `link:` 依赖，加入 `dsh.profile.bundles`，并在 `node_modules` 里建指向项目目录的 junction，重启 DSH。开发模式改代码即时生效。

> **⚠ 注意**：手工编辑 profile 的 `package.json` 时必须保持**无 BOM 的 UTF-8**。
> Windows PowerShell 5.1 的 `Set-Content -Encoding utf8` 会写入 BOM（EF BB BF），
> DSH 启动维护读取它时 JSON.parse 直接失败，触发 **Safe Mode**，表现为「所有工作台消失」。
> 正确写法：`[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding $false))`。

重启 DSH，侧边栏底部出现 **✎ 创作工作台**。

## 使用

1. 点侧边栏「创作工作台」→ ＋ 新建项目（一个项目 = 一个账号或栏目）
2. 第一次打开会绑定一个 DSH 会话，输入框里有一段预填的开场白，**按回车发出去**，DSH 才会读这个项目
3. 左边建选题（或点「让 DSH 发散选题」），选题详情里按平台建稿
4. 稿件编辑器里写大纲、写正文、配封面图；右侧「交给 DSH」一键派活
5. 就绪后「导出到 exports/」拿到成品 markdown

项目文件在 `~/Documents/DSH 内容创作/<项目名>/`（可用 `DSH_CONTENT_WORKBENCH_ROOT` 改）：

```
project.json    唯一事实源（选题/稿件/素材/版本），DSH 直接改、界面自动刷新
CONTEXT.md      给 DSH 的协作说明，每次保存自动重写
images/         图片文件，稿件 images[].file 引用相对路径
materials/      文件类素材
exports/        导出的成品
```

## 开发

```bash
npm run check     # 语法检查 + 单测
```

## 许可

MIT
