# WorshipDeck

> 教会の礼拝プログラムを即座にスライドへ変換するローカルファーストな礼拝プレゼンテーション＆ステージ運用スイート: フォント埋め込み型オフラインPowerPoint (.pptx)、2画面会衆用スクリーンコンソール、ローカルWi-Fiスマホリモコンを完備。

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **翻訳に関する注意事項:** 本ファイルは [README.md](README.md) の便宜的な翻訳です。矛盾や解釈の相違がある場合は、公式の英語版（README.md）が優先されます。詳細な技術文書および法的文書はすべて英語で管理されています。

教会の礼拝向けに設計されていますが、スライドのレイアウトはハードコードではなく設定データとして管理されているため、同様の式順を持つ任意の教会でブラウザから直接柔軟にカスタマイズできます。

## 解決する課題

毎週の礼拝スライドを手作業で準備するには2から4時間かかり、その大半は既に過去に入力した賛美歌の歌詞を再入力する作業に費やされます。直前の曲変更があると最初から作り直さなければならず、設定のノウハウも特定の奉仕者1人に依存しがちです。

WorshipDeck は司会者や企画者が作成したプログラム一覧テキストを読み込み、整然とした礼拝用スライドを自動構築します。

```text
式順テキスト  ->  礼拝構成を解析  ->  スライド計画生成  ->  +->  オフライン PowerPoint (.pptx)
                                                         +->  フルスクリーン Web スライド
                                                         +->  操作者コンソール ＋ 会衆用スクリーン
```

賛美歌は番号照会によりローカルのデータベースから瞬時に引き当てられます。レイアウトの配置は SQLite レジストリによりブラウザ上で直接編集できます。PowerPoint ファイルのダウンロード後はインターネット接続が一切不要です。教会のネットワークに不調が生じた場合でも安全に礼拝を進行できます。

## 主な機能

- **式順テキストの自動取り込み:** Webフォームへの貼り付けに対応。未認識の行は切り捨てずに確認用として透過表示します。（Webhook受信機能は今後のリリースで提供予定です。）
- **賛美歌の節分割とコーラス繰り返し:** 番号で参照された賛美歌は、タイトル・各節・繰り返されるコーラスへと自動分割され、会衆が快適に賛美できるよう最適化されます。
- **編集可能なスライドレイアウト:** ブラウザのキャンバスエディタでSQLite上のレイアウトを管理。配置やスタイルの変更、PowerPointからのインポートに対応。デモシードにより38種類のサンプルレイアウトをお試しいただけます。
- **1つのレイアウトで4つの出力:** 単一のスライドデータが PowerPoint、Webスライド、会衆用スクリーン、リアルタイムプレビューをネイティブ 16:9 ワイド画面で駆動。
- **2画面プレゼンターモード:** 現在・次スライドのプレビュー、フィルムストリップ、式順リスト、任意スライドへの即座ジャンプ、会衆用スクリーン専用ウィンドウを装備。
- **ブラックアウト機能 (Blank Screen):** 会衆用スクリーンを瞬時に暗転させ、スライド位置を保持したまま復帰（ショートカット `B`）。
- **多彩な画面切り替えアニメーション:** カット、フェード、ディゾルブ、プッシュを PowerPoint と Web の双方で同一に再現。
- **聖句の即時呼び出し:** 礼拝の最中でも聖句（KJV）を素早く会衆用スクリーンへ投映し、読み終えたら即座にクリア可能。
- **お知らせフライヤーの管理:** 教会のお知らせフライヤーを管理し、アップロード画像や許可されたURLから表示。
- **フォント管理とオフライン表示:** 41種類のローカル同梱フォントに加え、ECMA-376 規格に沿ったPowerPointフォント埋め込みに対応。
- **管理者・操作者アカウント分離:** 権限分離、総当たりログイン防止のレートリミット、即時失効可能なセッショントークンを完備。
- **動的フォームレイアウトと解析設定:** 管理パネルから事前定義フィールドと正規表現抽出ルールを構成し、コード変更なしでサービスフォームをカスタマイズ。
- **メディアライブラリ:** レイアウトに依存しない、再利用可能な背景・チラシ画像のプール。
- **手動デバイス間同期（実験的機能）:** 同一ローカルネットワーク上の2台のWorshipDeckインスタンス間で、サービス・Song Setエントリ・背景・お知らせをオペレーターの操作時のみ送受信。クラウド不使用、バックグラウンド同期なし。単一ホストで確認済み。複数機器間同期は実験的段階です。

## システム要件

- **サーバー運用（推奨）:** Linux（Ubuntuでテスト済み）、Windows 10/11、またはPOSIX環境（Go 1.24+、Node.js 22.12+、React 19）。データベースには内蔵 SQLite を採用しており、外部サーバーの構築は不要です。
- **Windows デスクトップ版（実験的）:** Windows 10/11 64-bit。
- **macOS:** 公式には未テスト。

## インストール手順

### セルフホストサーバー（推奨）

WorshipDeck をローカルサーバーとして運用するのが推奨される基本モデルです:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` は `.env` ファイルを生成し、SQLiteデータベースを初期化し、生成された `admin` のパスワードを表示します。`npm run dev` は Go API を <http://localhost:3000> で、React SPA を <http://localhost:5173> で起動します。単一オリジンでの本番運用時は `npm run spa:build && npm start` を実行してポート3000を開きます。

実データを入力する前に [`.constitution/project/private-data.md`](.constitution/project/private-data.md) をご一読ください。

### Windows デスクトップインストーラ（実験的）

公式の [GitHub Releases ページ](https://github.com/wiradeltaid/worship-deck/releases) から `WorshipDeck-0.1.0-x64-setup.exe` と `SHA256SUMS` をダウンロードし、インストーラを実行してください。

実行前にダウンロードしたファイルのSHA-256ハッシュ値を `SHA256SUMS` と照合してください。

> **Windows SmartScreen について:** 本インストーラは高額な商用 EV コード署名証明書を未取得のため、警告が表示される場合があります。「詳細情報」をクリックし、「実行」を選択して進めてください。

### 新しい礼拝を作成

**Services -> New** を開きます。式順テキストを貼り付けます:

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

**Baca susunan acara**（または英語環境では **Parse**）をクリックします。役割、時間、賛美歌番号がフォームに自動抽出され、賛美歌の歌詞がローカルデータベースから解決されます。

説教用フライヤーや写真を追加し、礼拝データを保存します。

### スライドの提示・運用

礼拝ページから以下の操作が可能です:

- **PPTXダウンロード:** ネットワーク障害時にも安心なオフライン用PowerPointファイル。
- **プレゼンテーション開始:** 操作者用コンソール。現在・次スライドのプレビューや一覧ジャンプが可能。
- **会衆用スクリーンを開く:** 2画面目へ移動させるための独立したクリーンウィンドウ。矢印キーで連動進行。`B` キーで暗転。

### 追加機能

**聖句の呼び出し:** 会衆用スクリーンにKJVの聖句を直接投映可能。データは `data/en/bible-translation/kjv.json` に収録されています。

**外部取り込み:** Webhookによる式順自動インポートは今後のリリースで提供予定です。

### トラブルシューティング

**`Missing song book corpus`:** `data/song-book/sdah.json` が見つかりません。Gitから復元してください: `git checkout -- data/song-book/sdah.json`、その後 `npm run corpus:verify` を実行します。

**管理者パスワード紛失:** `npm run auth:set-password -- admin` で新しいパスワードを設定します。`npm run auth:unlock -- --list` でログイン制限を解除できます。

**画像が表示されない:** 外部画像はURL安全規則に従う必要があります。サーバーへの直接アップロードは常に安全に表示されます。

## 教会に合わせたカスタマイズ

標準インストールでは、独自の設計が可能なクリーンなレジストリで起動します:

1. **スライドレイアウト:** 管理者としてログインし `/admin/artifacts` を開きます。キャンバスエディタまたはPowerPointインポートで作成可能。`npm run seed:demo` で38種類のサンプルをロードできます。
2. **非公開レジストリ:** 教会のデータをGitの外で管理したい場合は、`data/local/default-registry.json` に配置すると優先的に読み込まれます。このパスはGitで無視されます。[`.constitution/project/private-data.md`](.constitution/project/private-data.md) を参照してください。

## 同梱テキストコーパス

2つの検証済みコーパスが標準で同梱されています:

| ファイル | 内容 | 起動時動作 |
| --- | --- | --- |
| `data/song-book/sdah.json` | セブンスデー・アドベンチスト賛美歌 695曲 | タイトル・歌詞を読み込み |
| `data/en/bible-translation/kjv.json` | 66書 1189章 31102節 KJV聖書 | 起動時にローカル同期 (~130から150ms) |

`npm run corpus:verify` で完全性を確認できます。

著作権および削除申請については [ATTRIBUTIONS.md](ATTRIBUTIONS.md) をご確認ください。

## サーバー運用・デプロイ

Go API と SPA をビルドし、Node 22 が `PATH` に通ったホスト上で `./api`（または `npm start`）を実行します。[`.constitution/project/deployment.md`](.constitution/project/deployment.md) を参照してください。

## プロジェクトの沿革とプライバシー

本プロジェクトは単一教会のプライベートリポジトリから始まりました。メンバーのプライバシー保護のため、公開リポジトリは合成されたサンプルデータ（*Harborlight Adventist Fellowship*）で新規に初期化されています。

貢献を希望される方は事前に [`.constitution/project/private-data.md`](.constitution/project/private-data.md) をご確認ください。

## ライセンスと商標

- **コードライセンス:** [MIT License](LICENSE) の下で公開。
- **賛美歌・聖句・謝辞:** [ATTRIBUTIONS.md](ATTRIBUTIONS.md) に記載。
- **サードパーティフォント:** 41フォントファミリーの著作権情報および SIL OFL 1.1 / Apache 2.0 ライセンス全文は [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES) に記載。
- **プライバシーとセキュリティ:** 100% オフラインファースト。外部送信や解析は一切行われません（[PRIVACY.md](PRIVACY.md)、[SECURITY.md](SECURITY.md) 参照）。
- **名称とアイコン:** MITライセンスはソースコードにのみ適用されます。**WorshipDeck**、**Wira Delta Indonesia** の名称および製品ロゴの商標権は PT Wira Delta Indonesia に帰属します。
