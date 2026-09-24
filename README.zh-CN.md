# WorshipDeck

> 本地优先的教堂礼拜演示与舞台调度套件：将礼拜程序单直接转换为即用型演示文稿：生成内嵌字体的离线 PowerPoint (.pptx) 幻灯片、双屏主显与会众屏幕控制台，以及本地 Wi-Fi 智能手机遥控器。

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **翻译说明：** 本文件是 [README.md](README.md) 的参考译文。如存在任何语义分歧或解释冲突，一律以官方英文版（README.md）为准。所有深度技术文档与法律条款均以英文维护。

专为教会崇拜礼拜场景打造，幻灯片布局采用受管数据而非硬编码形式保存，具备类似礼拜程序的教会均可在浏览器中直接灵活定制。

## 解决的核心痛点

手工制作礼拜幻灯片每周耗时 2 到 4 小时，大部分时间浪费在重复录入诗歌歌词上。临时的诗歌更换往往迫使操作员从头重做整份幻灯片，且技术门槛通常仅由极少数技术同工掌握。

WorshipDeck 直接读取活动负责人编写的礼拜程序单（文本粘贴或表单录入），自动排版并生成整齐规范的礼拜幻灯片。

```text
程序单文本  ->  解析礼拜流程  ->  生成幻灯片方案  ->  +->  离线 PowerPoint 演示文稿
                                                    +->  全屏网页幻灯片
                                                    +->  主控控制台 + 会众屏幕
```

诗歌歌词依据编号直接从本地数据库语料库索引。幻灯片布局由管理员在浏览器中通过 SQLite 注册表直接编辑。PowerPoint 文档一旦下载，全场放映无需依赖任何互联网连接，在教堂网络波动时保障崇拜流程顺畅进行。

## 核心特性

- **程序单快速录入：** 直接粘贴文本到网页表单。无法识别的文本将透明展示，绝不静默丢弃。（Webhook 端点接收功能将在后续版本中提供。）
- **诗歌自动分段与副歌循环：** 引用编号的赞美诗自动解析为标题页、歌词节以及每节后自然循环的副歌，版面舒适合于会众齐唱。
- **可编辑幻灯片布局：** 在 SQLite 注册表中通过浏览器画布编辑器管理布局。支持拖拽移动、尺寸调整、字体样式微调，或直接从 PowerPoint 导入布局。可通过演示数据导入体验 38 种示例布局。
- **一套布局驱动四种输出：** 单一数据驱动离线 PPTX、网页全屏演示、会众屏幕和实时预览，保持原生 16:9 宽屏呈现。
- **双屏操作员控制台：** 提供当前与下一页预览、缩略图胶片卷轴、程序列表、快速跳转网格，以及可独立拖曳至第二显示器的会众屏幕无边框窗口。
- **一键黑屏功能 (Blank Screen)：** 瞬间黑屏遮蔽会众屏幕，并可在不丢失播放进度的情况下恢复显示（快捷键 `B`）。
- **多种切换过渡动画：** 无过渡、剪切、淡入淡出、溶解或推入，网页放映与 PowerPoint 表现完全一致。
- **经文即时查阅：** 讲道过程中可实时将圣经经文（KJV）投屏至会众屏幕，读毕一键清除。
- **家事公告与海报轮播：** 集中管理教会通告海报，支持本地上传或从安全白名单 URL 获取。
- **离线字体支持：** 内置 35 种本地打包字体家族，支持 ECMA-376 规范字体嵌入，确保离线在任何 PowerPoint 设备上正常渲染。
- **多角色权限控制：** 独立的管理员与操作员账户，防暴力破解登录频次限制，会话支持即时吊销。
- **动态表单布局与解析配置：** 在管理面板中配置预定义字段及其正则表达式提取规则，自由编排表单分组，无需修改代码。
- **素材库 (Media Library)：** 与任一布局解耦、可跨布局复用的背景图与海报图片池。
- **手动跨设备同步（实验性功能）：** 在同一局域网内的两台 WorshipDeck 实例之间，按操作员发起的请求推送/拉取服事、Song Set 条目、背景图与公告。不上云、不后台自动同步。已在单机验证，跨机器同步仍处于实验阶段。

## 系统要求

- **服务端部署（推荐）：** Linux（在 Ubuntu 测试）、Windows 10/11 或 POSIX 兼容系统，配备 Go 1.24+ 与 Node.js 22.12+。基于 React 19 构建。数据使用内嵌式 SQLite 存储，无需配置独立的数据库服务端。
- **Windows 桌面客户端（实验性）：** Windows 10/11 64 位。
- **macOS：** 暂未正式测试。

## 安装指南

### 自建本地服务端（推荐）

自建本地服务器运行是推荐的核心部署模式：

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` 生成含新密钥的 `.env` 文件，初始化 SQLite 数据库，并输出自动生成的 `admin` 密码。`npm run dev` 启动 Go API 服务（端口 3000）与 React SPA 前端（端口 5173）。在前端页面以 `admin` 身份登录。单端口生产服务请执行 `npm run spa:build && npm start` 并访问端口 3000。

录入教会真实数据前，请务必阅读 [`.constitution/project/private-data.md`](.constitution/project/private-data.md)。

### Windows 桌面安装包（实验性）

从官方 [GitHub Releases 页面](https://github.com/wiradeltaid/worship-deck/releases) 下载 `WorshipDeck-0.1.0-x64-setup.exe` 与 `SHA256SUMS` 并运行安装向导。

运行前请核对安装包的 SHA-256 哈希值与 `SHA256SUMS` 中的记录一致。

> **Windows SmartScreen 提示：** 由于当前构建版本尚未签署昂贵的商业 EV 代码签名证书，Windows SmartScreen 可能会弹出提示。点击**“更多信息”**并选择**“仍要运行”**即可顺利安装。

### 创建新的礼拜

进入 **Services -> New**。将礼拜程序单粘贴至文本框：

```text
SABBATH, MARCH 14, 2026

BIBLE TALK (09.30-10.50 / 80 min)
>> welcome remarks: Mrs. Lestari
Song Leader : Ms. Ayu
[  ] Opening song : SDAH #159 The Old Rugged Cross
Memory Verse & Opening Prayer : Mr. Bagas
Closing Prayer : Mr. Damar (1m)

DIVINE SERVICE (10.50-12.05 / 75 min)
Song Leader : Ms. Kirana
[  ] Opening Song : SDAH #83 O Worship the King
Intercessory Prayer: Mr. Farid (5m)
Sermon : Pr. Andi Hartono "Working Out" (45m)
[  ] Closing Song : SDAH #249 Praise Him! Praise Him!
```

点击 **Baca susunan acara**（英文界面为 **Parse**）。角色分工、预计时长和诗歌编号将自动提取至表单中，歌词直接从本地语料库获取。未识别行将列出以供核对。

补充讲道海报与照片后保存。

### 现场放映

在服事详情页：

- **下载 PPTX：** 离线 PowerPoint 演示文稿，在网络或设备出现异常时提供可靠保障。
- **主控放映：** 操作员控制台，提供当前与下一页预览、缩略图胶片卷轴与快捷跳转。
- **打开会众屏幕：** 用于拖曳至第二显示器投影的独立无边框窗口。按 `B` 键可黑屏。

### 附加功能

**经文即时查阅：** 可直接将会众屏幕投映 KJV 经文。语料文件位于 `data/en/bible-translation/kjv.json`。

**聊天机器人接入：** 自动化 Webhook 程序单录入功能将在后续版本中推出。

### 故障排查

**`Missing song book corpus`：** 语料库 `data/song-book/sdah.json` 缺失。请通过 Git 检出恢复：`git checkout -- data/song-book/sdah.json`，然后运行 `npm run corpus:verify`。

**管理员密码重置：** 运行 `npm run auth:set-password -- admin` 重设密码。运行 `npm run auth:unlock -- --list` 可查看并解除登录频次锁定。

**图片无法显示：** 外部图片必须符合 URL 安全规则。直接上传至本地服务器始终安全可靠。

## 契合您的教会

标准安装从一个干净的注册表开始，方便您自行设计：

1. **幻灯片布局：** 以管理员身份登录并打开 `/admin/artifacts`。可通过画布编辑器创建布局或从 PowerPoint 导入。可通过 `npm run seed:demo` 载入 38 种示例布局。
2. **私有配置重载：** 若希望将教会数据与 Git 完全隔离，请将其放置于 `data/local/default-registry.json`，系统将优先读取该文件。此路径已被 Git 忽略。详见 [`.constitution/project/private-data.md`](.constitution/project/private-data.md)。

## 内置文本语料库

系统内置两个经过校验的标准语料库：

| 文件 | 内容 | 启动时行为 |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 首安息日会赞美诗 | 从文件直接加载标题与歌词 |
| `data/en/bible-translation/kjv.json` | 66 卷书、1189 章、31102 节 KJV 圣经 | 启动时本地比对校验（约 130 到 150 毫秒） |

运行 `npm run corpus:verify` 可检验语料完整性。

版权及内容移除申请请参见 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)。

## 服务端部署

编译 Go API 与 SPA 前端，在安装有 Node 22 环境的服务器上运行 `./api`（或 `npm start`）。详见 [`.constitution/project/deployment.md`](.constitution/project/deployment.md)。

## 项目沿革与隐私保护

本项目始于为单个地方教会开发的私有代码库。为保护会众隐私，公开代码库以合成示例数据（*Harborlight Adventist Fellowship*）从头初始化。

参与贡献前，请务必仔细阅读 [`.constitution/project/private-data.md`](.constitution/project/private-data.md)。

## 许可与商标

- **代码许可：** 基于 [MIT 许可证](LICENSE) 发布。
- **诗歌语料与鸣谢：** 教会诗歌本、圣经译本及第三方库鸣谢详见 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)。
- **第三方字体声明：** 35 种字体家族的版权信息及 SIL OFL 1.1 与 Apache 2.0 完整许可证文本收录于 [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES)。
- **隐私与安全：** 100% 本地优先。数据完全保留在您的本地设备上；零遥测、零数据统计（详见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)）。
- **名称与图标声明：** MIT 许可证仅涵盖源代码。**WorshipDeck**、**Wira Delta Indonesia** 名称及产品图标商标权归 PT Wira Delta Indonesia 独家所有。
