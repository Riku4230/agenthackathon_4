# Meet Artifact Generator

Google Meet会議中の会話をAIがリアルタイムで解析し、UIコンポーネント（React）を自動生成するシステムです。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              ブラウザ                                    │
│  ┌─────────────────────┐         ┌─────────────────────────────────┐   │
│  │   Google Meet タブ   │         │      Agent UI タブ              │   │
│  │                     │         │  (Next.js フロントエンド)        │   │
│  │  Chrome拡張機能     │ ──────▶ │                                 │   │
│  │  [AI Agent起動]     │         │  - アーティファクトプレビュー    │   │
│  │  tabCapture音声取得 │         │  - 会話ログ                      │   │
│  └─────────────────────┘         │  - 要件リスト                    │   │
│           │                      │  - チャット入力                  │   │
│           │ 音声ストリーム        └─────────────────────────────────┘   │
└───────────┼──────────────────────────────────────────────────────────────┘
            │ WebSocket
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     バックエンドサーバー (Node.js)                       │
│                                                                          │
│  - WebSocketサーバー (Socket.io)                                        │
│  - Gemini API連携（要件抽出・コード生成）                               │
│  - セッション管理                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## セットアップ手順

### 必要なもの

- Node.js 18以上
- npm
- Google AI API Key（Gemini）
- Chromeブラウザ

### 1. Google AI API Keyの取得

**Google AI Studio**から無料でAPIキーを取得できます。

#### 手順

1. **Google AI Studioにアクセス**
   - https://aistudio.google.com/app/apikey にアクセス
   - Googleアカウントでログイン

2. **APIキーを作成**
   - 「Create API Key」をクリック
   - 「Create API key in new project」を選択
   - 生成されたAPIキーをコピー

3. **APIキーを保存**
   - キーは一度しか表示されないため、必ずメモしてください
   - ソースコードやGitにはコミットしないでください

#### 料金について

| モデル | 無料枠 | 備考 |
|--------|--------|------|
| Gemini 2.0 Flash | あり | 高速・低コスト |
| Gemini 1.5 Pro | あり | 高性能 |
| Gemini 1.5 Flash | あり | バランス型 |

無料枠を超えた場合は従量課金制になります。詳細は[Google AI料金ページ](https://ai.google.dev/pricing)を参照してください。

---

### 2. プロジェクトのセットアップ

#### 依存関係のインストール

```bash
# ルートディレクトリで実行
cd /path/to/agenthackathon_4

# 全プロジェクトの依存関係をインストール
npm run install:all

# または個別にインストール
cd chrome-extension && npm install
cd ../backend && npm install
cd ../frontend && npm install
```

#### 環境変数の設定

**バックエンド (.env)**

```bash
cd backend
cp .env.example .env
```

`.env`ファイルを編集してAPIキーを設定：

```env
GOOGLE_AI_API_KEY=your_api_key_here
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**フロントエンド (.env.local)** ※任意

```bash
cd frontend
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

---

### 3. Chrome拡張機能のビルド

```bash
cd chrome-extension
npm run build
```

`dist/`フォルダにビルドされた拡張機能が出力されます。

---

### 4. Chrome拡張機能のインストール

1. Chromeで `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をONにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `chrome-extension/dist` フォルダを選択

---

## 起動方法

### バックエンドサーバーを起動

```bash
cd backend
npm run dev
```

サーバーが `http://localhost:3001` で起動します。

### フロントエンド（Agent UI）を起動

```bash
cd frontend
npm run dev
```

Agent UIが `http://localhost:3000` で起動します。

---

## 使い方

1. **Google Meetに参加**
   - 通常通りGoogle Meetの会議に参加

2. **AI Agentを起動**
   - Meet画面に表示される「AI Agent」ボタンをクリック
   - 新しいタブでAgent UIが開く

3. **会話を開始**
   - 会議で話した内容がリアルタイムで文字起こしされる
   - AIが会話からUI要件を自動抽出
   - 「Generate UI」ボタンでReactコンポーネントを生成

4. **テキスト入力も可能**
   - チャット欄から直接要件を入力することもできる
   - 例：「ログインフォームを作って」「ダッシュボードのカードUIが欲しい」

---

## プロジェクト構成

```
.
├── chrome-extension/     # Chrome拡張機能
│   ├── dist/             # ビルド出力（これをChromeに読み込む）
│   ├── src/
│   │   ├── background/   # Service Worker（音声キャプチャ）
│   │   ├── content/      # Meetページへの注入スクリプト
│   │   ├── popup/        # 拡張機能ポップアップ
│   │   └── lib/          # WebSocket・音声処理ユーティリティ
│   └── manifest.json
│
├── backend/              # Node.js + Express + Socket.io
│   └── src/
│       ├── gemini/       # Gemini API連携
│       ├── websocket/    # WebSocketハンドラー
│       └── session/      # セッション管理
│
├── frontend/             # Next.js 14 Agent UI
│   └── src/
│       ├── app/          # メインページ
│       ├── components/   # UIコンポーネント
│       └── hooks/        # カスタムフック
│
└── README.md
```

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| Chrome拡張 | Manifest V3, TypeScript, Webpack |
| バックエンド | Node.js, Express, Socket.io, @google/generative-ai |
| フロントエンド | Next.js 14, React, Tailwind CSS |
| AI | Gemini 2.0 Flash |

---

## WebSocket イベント

### クライアント → サーバー

| イベント | 説明 |
|----------|------|
| `session:start` | セッション開始 |
| `audio:stream` | 音声データ送信 |
| `chat:message` | テキストメッセージ送信 |
| `generate:request` | コード生成リクエスト |
| `session:end` | セッション終了 |

### サーバー → クライアント

| イベント | 説明 |
|----------|------|
| `session:connected` | セッション確立 |
| `transcript:update` | 文字起こし結果 |
| `requirement:detected` | UI要件検出 |
| `artifact:stream` | コード生成（ストリーミング） |
| `artifact:update` | コード生成完了 |
| `error` | エラー通知 |

---

## トラブルシューティング

### APIキーエラーが出る

- `.env`ファイルに正しくAPIキーが設定されているか確認
- APIキーに余分な空白や改行が含まれていないか確認
- Google AI Studioでキーが有効になっているか確認

### Chrome拡張が動作しない

- `chrome://extensions/`でエラーが表示されていないか確認
- 拡張機能を一度削除して再読み込み
- `dist/`フォルダを読み込んでいるか確認（`src/`ではない）

### WebSocket接続エラー

- バックエンドサーバーが起動しているか確認
- `http://localhost:3001/health`にアクセスして動作確認
- ファイアウォールやプロキシの設定を確認

---

## 本番デプロイアーキテクチャ（Google Cloud）

本番環境にデプロイする場合のGoogle Cloud推奨アーキテクチャです。

### アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  ユーザー                                        │
│                                                                                  │
│    ┌─────────────────┐                      ┌─────────────────────────┐         │
│    │  Chrome拡張機能  │                      │     ブラウザ            │         │
│    │ (Chrome Web     │                      │  (Agent UI アクセス)    │         │
│    │   Store配布)    │                      │                         │         │
│    └────────┬────────┘                      └───────────┬─────────────┘         │
└─────────────┼────────────────────────────────────────────┼───────────────────────┘
              │                                            │
              │ WebSocket (wss://)                         │ HTTPS
              ▼                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Google Cloud                                        │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Cloud Load Balancing                              │   │
│  │                    (HTTPS + WebSocket ルーティング)                      │   │
│  └─────────────────────────────┬───────────────────────────────────────────┘   │
│                                │                                                │
│         ┌──────────────────────┼──────────────────────┐                        │
│         │                      │                      │                        │
│         ▼                      ▼                      ▼                        │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐              │
│  │   Cloud Run     │   │   Cloud Run     │   │ Firebase App    │              │
│  │   (Backend)     │   │   (Backend)     │   │   Hosting       │              │
│  │                 │   │                 │   │  (Frontend)     │              │
│  │  - Socket.io    │   │  - Socket.io    │   │                 │              │
│  │  - Gemini API   │   │  - Gemini API   │   │  - Next.js SSR  │              │
│  │  - 自動スケール │   │  - 自動スケール │   │  - CDN配信      │              │
│  └────────┬────────┘   └────────┬────────┘   └─────────────────┘              │
│           │                     │                                              │
│           └──────────┬──────────┘                                              │
│                      │                                                          │
│                      ▼                                                          │
│           ┌─────────────────────┐                                              │
│           │  Cloud Memorystore  │                                              │
│           │      (Redis)        │                                              │
│           │                     │                                              │
│           │ - セッション共有     │                                              │
│           │ - Socket.io Adapter │                                              │
│           │ - Pub/Sub同期       │                                              │
│           └─────────────────────┘                                              │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         Secret Manager                                   │   │
│  │                    (APIキー・認証情報の管理)                             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### コンポーネント別デプロイ先

| コンポーネント | デプロイ先 | 理由 |
|---------------|-----------|------|
| **Chrome拡張** | Chrome Web Store | 公式配布チャネル |
| **フロントエンド** | Firebase App Hosting | Next.js最適化、CDN、CI/CD自動化 |
| **バックエンド** | Cloud Run | WebSocket対応、自動スケール、コンテナベース |
| **セッション管理** | Cloud Memorystore (Redis) | 複数インスタンス間のSocket.io同期 |
| **シークレット** | Secret Manager | APIキーの安全な管理 |

---

### Cloud Run（バックエンド）の設定ポイント

#### 1. WebSocket対応設定

```yaml
# Cloud Run サービス設定
spec:
  template:
    metadata:
      annotations:
        # リクエストタイムアウト（最大60分）
        run.googleapis.com/request-timeout: "3600s"
        # セッションアフィニティ有効化
        run.googleapis.com/session-affinity: "true"
    spec:
      # 同時接続数（デフォルト80→1000に増加）
      containerConcurrency: 1000
```

#### 2. Socket.io + Redis Adapter（複数インスタンス対応）

```typescript
// backend/src/index.ts（本番用）
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

#### 3. 必要な追加パッケージ

```bash
npm install @socket.io/redis-adapter redis
```

#### 4. 環境変数（Cloud Run）

```env
GOOGLE_AI_API_KEY=（Secret Managerから参照）
REDIS_URL=redis://10.0.0.3:6379
FRONTEND_URL=https://your-app.web.app
NODE_ENV=production
```

---

### Firebase App Hosting（フロントエンド）のデプロイ

#### 1. Firebase CLIのインストール

```bash
npm install -g firebase-tools
firebase login
```

#### 2. プロジェクト初期化

```bash
cd frontend
firebase init hosting
```

#### 3. apphosting.yaml の設定

```yaml
# frontend/apphosting.yaml
runConfig:
  minInstances: 0
  maxInstances: 10
  concurrency: 80
  cpu: 1
  memoryMiB: 512

env:
  - variable: NEXT_PUBLIC_BACKEND_URL
    value: https://backend-xxxxx-an.a.run.app
```

#### 4. デプロイ

```bash
firebase deploy --only hosting
```

---

### Chrome拡張のWeb Store公開

#### 1. manifest.jsonの本番設定

```json
{
  "manifest_version": 3,
  "name": "Meet Artifact Generator",
  "version": "1.0.0",
  "description": "...",
  "permissions": ["tabCapture", "activeTab", "storage", "tabs"],
  "host_permissions": [
    "https://meet.google.com/*",
    "https://backend-xxxxx-an.a.run.app/*"
  ]
}
```

#### 2. 公開手順

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)にアクセス
2. 開発者登録（初回のみ$5）
3. ZIPファイルをアップロード
4. ストア掲載情報を入力
5. 審査提出（通常1〜3日）

---

### Cloud Memorystore（Redis）のセットアップ

#### 1. インスタンス作成

```bash
gcloud redis instances create meet-artifact-redis \
  --size=1 \
  --region=asia-northeast1 \
  --redis-version=redis_7_0 \
  --network=default
```

#### 2. 接続情報の取得

```bash
gcloud redis instances describe meet-artifact-redis \
  --region=asia-northeast1 \
  --format="get(host,port)"
```

#### 3. VPCコネクタの設定

Cloud RunからMemorystoreに接続するにはVPCコネクタが必要：

```bash
gcloud compute networks vpc-access connectors create meet-artifact-connector \
  --region=asia-northeast1 \
  --network=default \
  --range=10.8.0.0/28
```

---

### Secret Managerでのシークレット管理

#### 1. シークレットの作成

```bash
# APIキーを保存
echo -n "your-gemini-api-key" | \
  gcloud secrets create gemini-api-key --data-file=-

# Cloud Runサービスアカウントにアクセス権付与
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### 2. Cloud Runでの参照

```yaml
spec:
  template:
    spec:
      containers:
        - env:
            - name: GOOGLE_AI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: gemini-api-key
                  key: latest
```

---

### 推定コスト（月額）

| サービス | 構成 | 推定費用 |
|---------|------|---------|
| Cloud Run (Backend) | 1vCPU, 512MB × 2インスタンス | $10〜30 |
| Firebase App Hosting | 基本プラン | $0〜10 |
| Cloud Memorystore | Basic 1GB | $35 |
| Cloud Load Balancing | 基本 | $18 |
| Secret Manager | 少量 | $0.06 |
| Gemini API | 使用量による | $0〜（無料枠内なら$0） |
| **合計** | | **$60〜100/月** |

※ 低トラフィック時。スケールすると増加。

---

### デプロイ用CI/CD（GitHub Actions例）

```yaml
# .github/workflows/deploy.yml
name: Deploy to Google Cloud

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Build and Push
        run: |
          cd backend
          gcloud builds submit --tag gcr.io/$PROJECT_ID/backend

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy backend \
            --image gcr.io/$PROJECT_ID/backend \
            --region asia-northeast1 \
            --allow-unauthenticated

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: your-project-id
```

---

### 本番環境チェックリスト

- [ ] Cloud Runのリクエストタイムアウトを60分に設定
- [ ] セッションアフィニティを有効化
- [ ] Redis Adapterを実装（複数インスタンス対応）
- [ ] Secret ManagerでAPIキーを管理
- [ ] HTTPSを強制（Cloud Load Balancing）
- [ ] CORSの本番URL設定
- [ ] エラー監視（Cloud Error Reporting）
- [ ] ログ収集（Cloud Logging）
- [ ] Chrome拡張のhost_permissionsを本番URLに更新

---

## 参考リンク

### AI・API
- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API ドキュメント](https://ai.google.dev/gemini-api/docs)

### Chrome拡張
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)

### Google Cloud デプロイ
- [Cloud Run WebSocket対応](https://cloud.google.com/run/docs/triggering/websockets)
- [Cloud Run WebSocketチュートリアル](https://cloud.google.com/run/docs/tutorials/websockets)
- [Firebase App Hosting (Next.js)](https://firebase.google.com/docs/hosting/frameworks/nextjs)
- [Cloud Memorystore (Redis)](https://cloud.google.com/memorystore/docs/redis)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)

---

## ライセンス

MIT
