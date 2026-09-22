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
- **可视化画布模板编辑器 (WYSIWYG)：** 内置 28 种 SQLite 预设模板，支持拖拽移动、尺寸调整、字体样式微调、增添文本框与图形，随时可一键重置。
- **一套布局驱动四种输出 (16:9 宽屏)：** 单一水合幻灯片数据驱动离线 PPTX、网页全屏演示、第二屏会众投影和实时预览，保持 1:1 像素级统一。
- **双屏操作员控制台：** 提供当前与下一页预览、缩略图胶片卷轴、程序列表，以及可独立拖曳至第二显示器投影的独立无边框窗口。
- **一键黑屏功能 (Blank Screen)：** 瞬间黑屏遮蔽投影仪，并可在不丢失播放进度的情况下恢复显示（快捷键 `B`）。
- **多种切换过渡动画：** 无过渡、剪切、淡入淡出、溶解或推入，网页放映与 PowerPoint 表现完全一致。
- **经文即时查阅：** 讲道过程中可实时将圣经经文（KJV）投屏至投影仪，读毕一键清除。
- **家事公告与海报轮播：** 集中管理教会通告海报，支持本地上传或从安全白名单 URL 获取。
- **自定义字体嵌入：** 导入自定义字体文件，支持自动字重配对与 ECMA-376 规范嵌入，确保离线在任何 PowerPoint 设备上正常渲染。
- **多角色权限控制：** 独立的管理员与操作员账户，防暴力破解登录频次限制，会话支持即时吊销。

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

`npm run setup` 自动生成包含全新密钥的 `.env` 文件，初始化 SQLite 数据库，导入默认模板并生成管理员初始密码。`npm run dev` 启动 Go API (<http://localhost:3000>) 与 React SPA (<http://localhost:5173>)。

---

## 开源许可与品牌商标

- **代码许可：** 基于 [MIT 许可证](LICENSE) 发布。
- **语料库与致谢：** 赞美诗集、圣经译本和第三方组件授权详见 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)。
- **隐私与安全：** 100% 本地优先。会众数据仅保存在您的本地计算机上；零遥测、零外部数据回传（详见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)）。
- **名称与商标声明：** MIT 许可证授予源代码的使用权利，但不授予名称与商标权利。**WorshipDeck**、**Wira Delta Indonesia** 名称及产品图标均为 PT Wira Delta Indonesia 保留资产。
