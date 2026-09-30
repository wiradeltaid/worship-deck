# WorshipDeck

> 本地优先的教堂礼拜演示与舞台调度套件：将礼拜程序单直接转换为即用型演示文稿：生成内嵌字体的离线 PowerPoint (.pptx) 幻灯片、双屏主显与会众屏幕控制台，以及本地 Wi-Fi 智能手机遥控器。

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [下载 v0.1.0](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe) | [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [所有版本](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

专为教会崇拜礼拜场景打造，幻灯片布局采用受管数据而非硬编码形式保存，具备类似礼拜程序的教会均可在浏览器中直接灵活定制。

## 解决的核心痛点

手工制作礼拜幻灯片每周耗时数小时，大部分时间浪费在重复录入诗歌歌词上。临时的诗歌更换迫使同工从头重做整份幻灯片。

WorshipDeck 直接读取活动负责人编写的礼拜程序单，自动排版并生成整齐规范的礼拜幻灯片：

```text
程序单文本  ->  解析礼拜流程  ->  生成幻灯片方案  ->  +->  离线 PowerPoint 演示文稿
                                                    +->  主控控制台 + 会众屏幕
```

诗歌歌词依据编号直接从本地数据库语料库索引。幻灯片布局由管理员在浏览器中通过 SQLite 注册表直接编辑。演示文档一旦下载，全场放映无需依赖任何互联网连接。

## 安装指南

### 自建本地服务端（推荐）

自建本地服务器运行是推荐的核心部署模式：

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck && npm install && npm run setup && npm run dev
```

`npm run setup` 自动生成包含密钥的 `.env` 并初始化 SQLite 数据库。`npm run dev` 启动位于 `http://localhost:3000` 的 Go API 与位于 `http://localhost:5173` 的 Vite SPA。生产环境请参见 [docs/deployment.md](docs/deployment.md)。

### Windows 桌面客户端（实验性）

下载单机安装包运行于教会控制台电脑：

- **直接下载：** [WorshipDeck-0.1.0-x64-setup.exe](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe)
- **校验哈希：** [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [所有版本](https://github.com/wiradeltaid/worship-deck/releases)

> **Windows SmartScreen 提示：** 由于当前安装包尚未签名商业 EV 证书，Windows SmartScreen 可能会弹出未知发布者拦截提示。请依次点击 **更多信息** (More info) 和 **仍要运行** (Run anyway) 即可继续。

## 核心特性

- **程序单快速录入：** 直接粘贴文本到网页表单，无法识别的文本将透明展示，绝不静默丢弃。
- **诗歌自动分段：** 引用编号的赞美诗自动解析为标题页、歌词节以及每节后自然循环的副歌。
- **可编辑幻灯片布局：** 在 SQLite 注册表中通过浏览器画布编辑器管理布局，或直接从 PowerPoint 导入。
- **双屏操作员控制台：** 当前与下一页预览、会众屏幕独立无边框窗口、一键黑屏 (`B`) 和局域网手机遥控。
- **原生 16:9 PPTX 导出：** 独立 `.pptx` 文档内嵌字体，无网环境下完全保真放映。
- **经文即时查阅：** 讲道中一键投屏 KJV 经文并在读毕清除。
- **离线字体库：** 内置 41 种离线字体家族，支持导入自定义字体并自动配对。
- **手动跨设备同步（实验性）：** 在同一局域网两台实例间按需双向同步数据，无需云端中转。

## 文档索引

- **[快速入门](docs/getting-started.md)：** 服务端详细部署与桌面版安装向导。
- **[功能与工作流](docs/features.md)：** 完整特性与操作员使用手册。
- **[配置与管理](docs/configuration.md)：** 自定义表单字段、分组与数据库管理。
- **[布局定制](docs/customization.md)：** 画布编辑器排版、PPTX 导入与示例数据。
- **[文本语料库](docs/corpora.md)：** SDAH 与 KJV 语料库规范及自定义歌本。
- **[生产部署](docs/deployment.md)：** 长期守护进程 systemd 与反向代理配置。
- **[项目沿革](docs/history.md)：** 开源背景、数据边界与隐私保证。

## 系统要求

- **服务端（推荐）：** Linux (Ubuntu), Windows 10/11 或 POSIX 系统，Go 1.24+ 与 Node.js 22.12+。基于 React 19 构建，采用内嵌 SQLite。
- **Windows 桌面端（实验性）：** Windows 10/11 64位。

## 许可与商标

- **代码许可：** 基于 [MIT 许可证](LICENSE) 分发。
- **语料与字体致谢：** 第三方字体版权、诗歌与经文版权说明详见 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)。
