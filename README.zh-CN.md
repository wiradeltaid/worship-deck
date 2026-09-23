# WorshipDeck

> 本地优先的教堂礼拜演示与舞台调度套件：将礼拜程序单直接转换为即用型演示文稿 —— 生成内嵌字体的离线 PowerPoint (.pptx) 幻灯片、双屏主显与会众投影控制台，以及本地 Wi-Fi 智能手机遥控器。

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **翻译说明：** 本文件是 [README.md](README.md) 的参考译文。如存在任何语义分歧或解释冲突，一律以官方英文版（README.md）为准。所有深度技术文档与法律条款均以英文维护。

专为教会崇拜礼拜场景打造，幻灯片模板采用受管数据而非硬编码形式保存，具备类似礼拜程序的教会均可在浏览器中直接灵活定制。

## 解决的核心痛点

手工制作礼拜幻灯片每周耗时 2–4 小时，大部分时间浪费在重复录入诗歌歌词上。临时的诗歌更换往往迫使操作员从头重做整份幻灯片，且技术门槛通常仅由极少数技术同工掌握。

WorshipDeck 直接读取活动负责人编写的礼拜程序单（文本粘贴或聊天机器人发送），自动排版并生成整齐规范的礼拜幻灯片。

```text
程序单文本  →  解析礼拜流程  →  生成幻灯片方案  →  ┬→  离线 PowerPoint 演示文稿
                                                  ├→  全屏网页幻灯片
                                                  └→  主控控制台 + 会众投影
```

诗歌歌词依据编号直接从本地数据库语料库索引。幻灯片布局由管理员在浏览器中通过 SQLite 注册表直接编辑。PowerPoint 文档一旦下载，全场放映无需依赖任何互联网连接 —— 在教堂网络波动时保障崇拜流程顺畅进行。

## 核心特性

- **程序单快速录入：** 直接粘贴文本到网页表单，或通过带密钥认证的 Webhook 端点接收。无法识别的文本将透明展示，绝不静默丢弃。
- **诗歌自动分段与副歌循环：** 引用编号的赞美诗自动解析为标题页、歌词节以及每节后自然循环的副歌，版面舒适合于会众齐唱。
- **可视化画布模板编辑器 (WYSIWYG)：** 内置 38 种 SQLite 预设模板，支持拖拽移动、尺寸调整、字体样式微调、增添文本框与图形，随时可一键重置。
- **一套布局驱动四种输出 (16:9 宽屏)：** 单一水合幻灯片数据驱动离线 PPTX、网页全屏演示、第二屏会众投影和实时预览，保持 1:1 像素级统一。
- **双屏操作员控制台：** 提供当前与下一页预览、缩略图胶片卷轴、程序列表，以及可独立拖曳至第二显示器投影的独立无边框窗口。
- **一键黑屏功能 (Blank Screen)：** 瞬间黑屏遮蔽投影仪，并可在不丢失播放进度的情况下恢复显示（快捷键 `B`）。
- **多种切换过渡动画：** 无过渡、剪切、淡入淡出、溶解或推入，网页放映与 PowerPoint 表现完全一致。
- **经文即时查阅：** 讲道过程中可实时将圣经经文（KJV）投屏至投影仪，读毕一键清除。
- **家事公告与海报轮播：** 集中管理教会通告海报，支持本地上传或从安全白名单 URL 获取。
- **自定义字体嵌入：** 导入自定义字体文件，支持自动字重配对与 ECMA-376 规范嵌入，确保离线在任何 PowerPoint 设备上正常渲染。
- **多角色权限控制：** 独立的管理员与操作员账户，防暴力破解登录频次限制，会话支持即时吊销。
- **可配置的程序单解析与表单布局：** 在管理面板中创建具名解析规则集，并自由编排「新建服事」表单的字段与分组，无需改代码。
- **素材库 (Media Library)：** 与任一模板解耦、可跨模板复用的背景图与海报图片池。
- **手动跨设备同步**（实验性功能——尚未在两台真实设备之间验证）：在同一局域网内的两台 WorshipDeck 实例之间，按操作员发起的请求推送/拉取服事、Song Set 条目、背景图与公告——不上云、不后台自动同步。

## 系统要求

- **桌面客户端：** Windows 10/11 64 位。
- **源码构建：** Go 1.24+ 与 Node.js 22+。数据使用内嵌式 SQLite 存储，无需配置独立的数据库服务端。

## 安装指南

### Windows 桌面安装包（推荐）

从官方 [GitHub Releases 页面](https://github.com/wiradeltaid/worship-deck/releases) 下载 `WorshipDeckSetup.exe` 并运行安装向导。

> **Windows SmartScreen 提示：** 由于当前构建版本尚未签署昂贵的商业 EV 代码签名证书，Windows SmartScreen 可能会弹出提示。点击**“更多信息”**并选择**“仍要运行”**即可顺利安装。

### 源码直接运行

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` 自动生成包含全新密钥的 `.env` 文件，初始化 SQLite 数据库，导入默认模板并生成管理员初始密码。`npm run dev` 启动 Go API (<http://localhost:3000>) 与 React SPA (<http://localhost:5173>)（Vite 会将 `/api` 代理到 Go）。请在 SPA 中以 `admin` 身份登录。若需单一来源部署：执行 `npm run spa:build && npm start`，然后打开 3000 端口。重复运行 `setup` 是安全的——它绝不会覆盖已存在的 `.env` 或数据库。

在录入本教会的数据之前，请先阅读 [`.constitution/project/private-data.md`](.constitution/project/private-data.md)。

### 创建一场服事

打开 **Services → New**，将程序单原文粘贴到纯文本框中。预期的格式如下（示例姓名均为虚构）：

```text
SABBATH, MARCH 14, 2026

BIBLE TALK (09.30-10.50 /80 min)
》welcome remarks: Mrs. Lestari
Song Leader : Ms. Ayu
[  ] Opening song : SDAH #159 The Old Rugged Cross
Memory Verse & Opening Prayer : Mr. Bagas
Closing Prayer : Mr. Damar (1m)

DIVINE SERVICE (10.50- 12.05/ 75 min)
Song Leader : Ms. Kirana
[  ] Opening Song : SDAH #83 O Worship the King
Intercessory Prayer: Mr. Farid (5m)
Sermon : Pr. Andi Hartono "Working Out" (45m)
[  ] Closing Song : SDAH #249 Praise Him! Praise Him!
```

点击 **Parse**（解析）。角色、时间和诗歌编号会被提取到表单中；诗歌会从本地语料库中解析出标题。任何解析器无法识别的内容都会被列出，而不会被丢弃。

如有讲道海报及家庭/青年照片，请一并填写后保存。

### 开始投影

在服事页面中：

- **Download PPTX** —— 离线演示包。无论网络、笔记本电脑还是服务器出现问题，靠的都是这份文件来维持崇拜继续进行。
- **Present** —— 操作员控制台。提供当前与下一页预览、缩略图胶片卷轴、幻灯片列表，以及可跳转至任意页面的 **All slides**。
- **Open projector** —— 一个可拖动到第二屏幕的独立窗口。方向键会同时控制两侧画面。`B` 键可使投影瞬间黑屏并恢复。

### 可选的附加功能

**经文查询。** 主控模式可将 KJV 经文投放到投影仪上。语料位于 `data/en/bible-translation/kjv.json`，每次启动时都会据此文件进行核对。

**聊天机器人接入。** 携带 `x-webhook-secret` 请求头的 `POST /api/webhook` 接受 JSON 格式的程序单，使聊天机器人也能创建或修正一场服事。密钥保存在 `.env` 中；该接口仅凭此密钥保护，绝不依赖会话。

### 故障排查

**`Missing song book corpus`** —— 缺少 `data/song-book/sdah.json`。该文件随仓库一同提供，请从版本控制中还原：`git checkout -- data/song-book/sdah.json`。随后运行 `npm run corpus:verify`，确认两份语料均完整无损。

**账号被锁定** —— 运行 `npm run auth:set-password -- admin`，通过交互式提示设置新密码。`npm run auth:unlock -- --list` 可查看并清除登录尝试限制。

**演示文稿中图片缺失** —— 远程图片必须通过 URL 安全规则校验。直接上传到服务器则始终可行。

## 定制为您自己教会的版本

内置的注册表是一个可实际运行的范例——一份真实的礼拜程序，只是联系方式与支付信息均为占位数据。有两处需要调整：

1. **幻灯片模板。** 以管理员身份登录并打开 `/admin/artifacts`。每个模板都可在画布上编辑；固定不变的幻灯片（奉献、周三祷告会、联系方式）正是填入您自己信息的地方。
2. **本地私有覆盖。** 若您希望将本教会的注册表完全排除在 git 之外，可将其放置于 `data/local/default-registry.json`，应用会改从此处读取初始数据。该路径已被 git 忽略。详见 [`.constitution/project/private-data.md`](.constitution/project/private-data.md)。

## 内置语料库

系统内置了两份默认语料库，因此克隆仓库后无需额外文件、也无需联网，即可在启动时解析诗歌编号与经文引用：

| 文件 | 内容 | 启动时行为 |
| --- | --- | --- |
| `data/song-book/sdah.json` | 基督复临安息日会《圣诗》695首 | 标题与歌词均从该文件重新载入 |
| `data/en/bible-translation/kjv.json` | 66卷、1189章、31102节 KJV 经文 | 每次启动均从内置文件核对（实测约 130–150 毫秒） |

`npm run corpus:verify` 用于确认两份语料库均完整。二者均无生成脚本：其转换来源的原始导出文件已不复存在，因此这些文件本身即为权威来源——应从版本控制中还原，而非重新生成。

请阅读 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)——其中列明了版权持有者、非商业性教会用途声明，以及删除请求的联系方式。每份语料文件内部也各自附带其许可条款原文。

如需适配其他诗歌集，请以相同格式在 `data/song-book/<book-code>.json` 添加您自己的语料。诗歌以 `(book_code, number)` 建立索引，因此新增第二本诗歌集会与内置诗歌集并存，而非将其替换。

## 部署

编译 Go API 与 SPA 后，在 `PATH` 中已安装 Node 22（供 PPTX worker 使用）的主机上运行 `./api`（或 `npm start`）——详见 [`.constitution/project/deployment.md`](.constitution/project/deployment.md)。SQLite 数据库、已上传的图片以及演示文稿缓存都需要持久化的宿主路径；该文件说明了具体是哪些路径。

## 项目历史

本项目最初是为单一教会建立的私有仓库。由于其中包含真实会众姓名、可识别未成年人在内人物的照片、私人消息截图以及可用的支付二维码——这些内容都不应出现在公开仓库中，且一旦被搜索引擎收录便无法撤回，因此该历史记录并未带入本仓库。

因此，本仓库从一个使用虚构示例教会数据的单一初始提交开始。系统之所以采用当前设计，其原因记录在 `.what/` 与 `.how/`（DEC-001）之中。

贡献者须知：请在您的首次提交之前阅读 [`.constitution/project/private-data.md`](.constitution/project/private-data.md)。仓库中存在一项测试，一旦教会真实数据进入受版本控制的文件便会失败——这项测试的存在自有其道理。

## 开源许可与品牌商标

- **代码许可：** 基于 [MIT 许可证](LICENSE) 发布。
- **语料库与致谢：** 赞美诗集、圣经译本和第三方组件授权详见 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)。
- **隐私与安全：** 没有云端后端，零遥测——每一次请求都只停留在您的电脑或教会本地网络内。唯一会与其他主机通信的功能是「手动同步」，而对方主机也只是您自己运行的另一台 WorshipDeck 实例，且只在操作员主动触发时才会连接（详见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)）。
- **名称与商标声明：** MIT 许可证授予源代码的使用权利，但不授予名称与商标权利。**WorshipDeck**、**Wira Delta Indonesia** 名称及产品图标均为 PT Wira Delta Indonesia 保留资产。
