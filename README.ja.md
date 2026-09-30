# WorshipDeck

> 教会の礼拝プログラムを即座にスライドへ変換するローカルファーストな礼拝プレゼンテーション＆ステージ運用スイート: フォント埋め込み型オフラインPowerPoint (.pptx)、2画面会衆用スクリーンコンソール、ローカルWi-Fiスマホリモコンを完備。

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [ダウンロード v0.1.0](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe) | [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [すべてのリリース](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

教会の礼拝向けに設計されていますが、スライドのレイアウトはデータとして管理されているため、同様の式順を持つ任意の教会でブラウザから直接柔軟にカスタマイズできます。

## 解決する課題

毎週の礼拝スライドを手作業で準備するには何時間もかかり、その大半は既に過去に入力した歌詞の再入力に費やされます。直前の曲変更があると最初から作り直さなければなりません。

WorshipDeck はプログラム一覧テキストを読み込み、整然とした礼拝用スライドを自動構築します:

```text
式順テキスト  ->  礼拝構成を解析  ->  スライド計画生成  ->  +->  オフライン PowerPoint (.pptx)
                                                         +->  操作者コンソール ＋ 会衆用スクリーン
```

賛美歌は番号照会によりローカルのデータベースから瞬時に引き当てられます。レイアウトの配置は SQLite レジストリによりブラウザ上で直接編集できます。ファイル取得後はインターネット接続が一切不要です。

## インストール手順

### セルフホストサーバー（推奨）

WorshipDeck をローカルサーバーとして運用するのが推奨される基本モデルです:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck && npm install && npm run setup && npm run dev
```

`npm run setup` により安全なシークレットを含む `.env` が生成され SQLite が初期化されます。`npm run dev` で Go API (`http://localhost:3000`) と Vite SPA (`http://localhost:5173`) が起動します。本番運用については [docs/deployment.md](docs/deployment.md) をご覧ください。

### Windows デスクトップ版（実験的）

教会の操作用PC1台で運用するための単体セットアップウィザード:

- **直接ダウンロード:** [WorshipDeck-0.1.0-x64-setup.exe](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe)
- **整合性ハッシュ:** [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [すべてのリリース](https://github.com/wiradeltaid/worship-deck/releases)

> **Windows SmartScreen の注意:** 本ビルドには商用 EV 証明書によるコード署名がまだ適用されていないため、警告が表示される場合があります。「詳細情報」(More info) をクリックし「実行」(Run anyway) を選択してください。

## 主な機能

- **式順テキストの自動取り込み:** Webフォーム貼り付けに対応。未認識行は切り捨てずに確認用として透過表示。
- **賛美歌の自動展開:** 番号参照された賛美歌はタイトル、各節、繰り返されるコーラスへ自動展開。
- **編集可能なスライドレイアウト:** ブラウザのキャンバスエディタでSQLite上のレイアウトを管理、またはPowerPointからインポート。
- **2画面プレゼンターモード:** 現在・次スライドのプレビュー、会衆用スクリーン専用ウィンドウ、暗転機能 (`B`)、スマホリモコン。
- **16:9 PowerPoint エクスポート:** フォント埋め込み型 `.pptx` で完全オフライン投映を実現。
- **聖句の即時呼び出し:** 礼拝の最中でも聖句（KJV）を素早く会衆用スクリーンへ投映可能。
- **オフラインフォント管理:** 41種類のローカル同梱フォントに加え、カスタムフォントのインポートに対応。
- **手動デバイス間同期（実験的）:** 同一LAN上の2台のWorshipDeck間でデータをオンデマンド送受信。

## ドキュメント一覧

- **[Getting Started](docs/getting-started.md):** サーバーセットアップおよびデスクトップ版インストール詳細。
- **[Features and Workflows](docs/features.md):** 全機能の詳細とオペレーター操作ガイド。
- **[Configuration and Administration](docs/configuration.md):** フォーム項目・グループ設定とSQLite管理。
- **[Customization and Slide Layouts](docs/customization.md):** キャンバス編集、PPTXインポート、デモデータ。
- **[Shipped Corpora](docs/corpora.md):** 同梱SDAHおよびKJVコーパス仕様と追加歌集。
- **[Production Deployment](docs/deployment.md):** systemdサービス登録およびリバースプロキシ構成。
- **[Project History](docs/history.md):** 開発の経緯、公開リポジトリの境界とプライバシー保証。

## システム要件

- **サーバー（推奨）:** Linux (Ubuntu), Windows 10/11, またはPOSIX環境（Go 1.24+, Node.js 22.12+, React 19）。内蔵 SQLite 採用。
- **Windows デスクトップ版（実験的）:** Windows 10/11 64-bit。

## ライセンスと商標

- **コードライセンス:** [MIT License](LICENSE) のもとで配布。
- **コーパスおよびフォント帰属:** 第三者フォント、賛美歌、聖書コーパスの著作権情報は [ATTRIBUTIONS.md](ATTRIBUTIONS.md) をご参照ください。
