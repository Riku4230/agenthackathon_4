# Meet Artifact Generator - 要件定義書 & 設計ドキュメント

## 1. プロジェクト概要

### 1.1 プロジェクト名
**Meet Artifact Generator** (仮称)

### 1.2 プロジェクトの目的
Google Meetでの営業・PM会議中に、会話をリアルタイムで解析し、AIエージェントがプロダクトのモックアップ/UIを自動生成するシステムを構築する。

### 1.3 ターゲットユーザー
- 営業担当者：クライアントとの要件ヒアリング中にリアルタイムでモックアップを提示
- プロダクトマネージャー：ステークホルダーとの会議中に要件を可視化
- デザイナー/エンジニア：打ち合わせ内容を即座にプロトタイプ化

### 1.4 期待される価値
- 会議中のアイデアを即座に可視化
- 認識齟齬の早期発見
- 議事録+成果物が同時に生成される効率化

---

## 2. 機能要件

### 2.1 Chrome拡張機能

| ID | 機能 | 詳細 |
|----|------|------|
| F-EXT-01 | Google Meet検出 | Google Meetページを検出し、UIを表示 |
| F-EXT-02 | エージェント起動ボタン | 「AIエージェントを起動」ボタンを表示 |
| F-EXT-03 | 音声キャプチャ | tabCapture APIでMeetの音声をキャプチャ |
| F-EXT-04 | 別タブ起動 | エージェントUIを新しいタブで開く |
| F-EXT-05 | 音声ストリーミング | キャプチャした音声をバックエンドにWebSocketで送信 |

### 2.2 バックエンド

| ID | 機能 | 詳細 |
|----|------|------|
| F-BE-01 | 音声受信 | Chrome拡張からの音声ストリームを受信 |
| F-BE-02 | Gemini Live API連携 | 音声をGemini Live APIに転送 |
| F-BE-03 | 要件抽出 | 会話から要件・機能を自動抽出 |
| F-BE-04 | コード生成 | 抽出した要件からUIコードを生成 |
| F-BE-05 | リアルタイム配信 | 生成結果をフロントエンドにストリーミング |
| F-BE-06 | 会話履歴管理 | セッション中の会話・生成履歴を保持 |

### 2.3 フロントエンド（エージェントUI）

| ID | 機能 | 詳細 |
|----|------|------|
| F-FE-01 | アーティファクト表示 | 生成されたUIをリアルタイムでプレビュー |
| F-FE-02 | チャット入力 | 追加指示をテキストで入力可能 |
| F-FE-03 | 会話ログ表示 | 文字起こしされた会話を表示 |
| F-FE-04 | コード表示/編集 | 生成されたコードを表示・編集可能 |
| F-FE-05 | エクスポート | 生成物をダウンロード（HTML/React等） |
| F-FE-06 | 履歴管理 | 過去の生成バージョンを保持・復元 |

---

## 3. 非機能要件

### 3.1 パフォーマンス
- 音声からアーティファクト生成まで: 5秒以内（目標）
- 音声認識の遅延: 1秒以内
- 同時接続ユーザー: 初期は10ユーザー程度を想定

### 3.2 セキュリティ
- WebSocket通信はWSS（TLS暗号化）必須
- 音声データはセッション終了後に削除
- 認証: Firebase Authentication または Google OAuth

### 3.3 可用性
- MVP段階では99%以上の可用性は不要
- エラー時のグレースフルデグレード

---

## 4. システムアーキテクチャ

### 4.1 全体構成図

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              User's Browser                              │
│  ┌─────────────────────┐         ┌─────────────────────────────────┐   │
│  │   Google Meet Tab   │         │      Agent UI Tab               │   │
│  │                     │         │  ┌─────────────────────────┐    │   │
│  │  ┌───────────────┐  │         │  │   Artifact Preview      │    │   │
│  │  │Chrome Extension│  │         │  │   (React Component)     │    │   │
│  │  │               │  │         │  └─────────────────────────┘    │   │
│  │  │ [Start Agent] │  │ ──────▶ │  ┌─────────────────────────┐    │   │
│  │  │               │  │ Open    │  │   Conversation Log      │    │   │
│  │  │ tabCapture    │  │         │  └─────────────────────────┘    │   │
│  │  │     │         │  │         │  ┌─────────────────────────┐    │   │
│  │  └─────┼─────────┘  │         │  │   Chat Input            │    │   │
│  └────────┼────────────┘         │  └─────────────────────────┘    │   │
│           │ Audio Stream         │              │                   │   │
└───────────┼──────────────────────┼──────────────┼───────────────────┘
            │                      │              │
            │ WebSocket            │ WebSocket    │ WebSocket
            ▼                      ▼              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Backend Server                                 │
│                         (Node.js / Python)                              │
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐    │
│  │ Audio Stream │   │ Conversation │   │    Code Generation       │    │
│  │   Handler    │──▶│   Manager    │──▶│       Engine             │    │
│  └──────────────┘   └──────────────┘   └──────────────────────────┘    │
│         │                   │                      │                    │
│         ▼                   ▼                      ▼                    │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                    Gemini Live API                            │      │
│  │  - Real-time audio transcription                              │      │
│  │  - Requirement extraction (Function Calling)                  │      │
│  │  - UI/Code generation                                         │      │
│  └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 技術スタック（確定）

| レイヤー | 技術 | 選定理由 |
|----------|------|----------|
| Chrome拡張 | Manifest V3, TypeScript | 最新仕様、型安全 |
| フロントエンド | Next.js 14+ (App Router), React, Tailwind CSS | Reactエコシステム活用、アーティファクト出力と親和性 |
| バックエンド | **Node.js + Express** | フロントと言語統一、WebSocket扱いやすい |
| AI | Gemini Live API (gemini-2.5-flash-native-audio) | 音声→要件抽出を一括処理 |
| リアルタイム通信 | WebSocket (Socket.io) | 低遅延双方向通信、再接続処理が楽 |
| 認証 | **なし（MVP）** | ローカル/デモ用途で認証不要 |
| 出力形式 | **React** | コンポーネント化しやすい、再利用性高い |
| ホスティング | ローカル開発 → Cloud Run / Vercel | MVP後にデプロイ検討 |

### 4.3 データフロー

```
1. [Chrome拡張] Google Meet検出 → 起動ボタン表示
2. [Chrome拡張] ユーザーがボタンクリック → 別タブでAgent UI起動
3. [Chrome拡張] tabCapture開始 → 音声ストリーム取得
4. [Chrome拡張] 音声データをWebSocketでバックエンドに送信
5. [バックエンド] 音声をGemini Live APIに転送
6. [Gemini] リアルタイム文字起こし + 要件抽出（Function Calling）
7. [バックエンド] 要件が検出されたらコード生成をトリガー
8. [Gemini] UIコード生成（React/HTML）
9. [バックエンド] 生成コードをAgent UIにWebSocket送信
10. [Agent UI] アーティファクトをリアルタイムでプレビュー表示
```

---

## 5. 詳細設計

### 5.1 Chrome拡張機能

**ディレクトリ構造:**
```
chrome-extension/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.ts    # バックグラウンド処理
│   ├── content/
│   │   └── meet-detector.ts     # Google Meet検出 & UI注入
│   ├── popup/
│   │   └── popup.tsx            # ポップアップUI（設定等）
│   └── lib/
│       ├── audio-capture.ts     # tabCapture処理
│       └── websocket-client.ts  # WebSocket通信
├── public/
│   └── icons/
└── package.json
```

**manifest.json（主要部分）:**
```json
{
  "manifest_version": 3,
  "name": "Meet Artifact Generator",
  "permissions": [
    "tabCapture",
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "https://meet.google.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["https://meet.google.com/*"],
    "js": ["content.js"]
  }]
}
```

### 5.2 バックエンド

**ディレクトリ構造:**
```
backend/
├── src/
│   ├── index.ts                 # エントリーポイント
│   ├── websocket/
│   │   ├── audio-handler.ts     # 音声ストリーム処理
│   │   └── client-handler.ts    # クライアント接続管理
│   ├── gemini/
│   │   ├── live-api-client.ts   # Gemini Live API連携
│   │   ├── function-tools.ts    # Function Calling定義
│   │   └── code-generator.ts    # コード生成ロジック
│   ├── session/
│   │   └── session-manager.ts   # セッション管理
│   └── types/
│       └── index.ts
├── package.json
└── .env
```

**Gemini Function Calling定義（要件抽出用）:**
```typescript
const tools = [
  {
    name: "extract_ui_requirement",
    description: "会話から検出されたUI要件を記録する",
    parameters: {
      type: "object",
      properties: {
        component_type: {
          type: "string",
          enum: ["button", "form", "list", "card", "modal", "navigation", "dashboard", "table"],
          description: "UIコンポーネントの種類"
        },
        description: {
          type: "string",
          description: "要件の詳細説明"
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "優先度"
        },
        context: {
          type: "string",
          description: "会話の文脈"
        }
      },
      required: ["component_type", "description"]
    }
  },
  {
    name: "generate_ui_code",
    description: "蓄積した要件からUIコードを生成する",
    parameters: {
      type: "object",
      properties: {
        requirements: {
          type: "array",
          items: { type: "string" },
          description: "生成に含める要件のリスト"
        },
        framework: {
          type: "string",
          enum: ["react", "html", "vue"],
          description: "出力フレームワーク"
        }
      }
    }
  }
];
```

### 5.3 フロントエンド（Agent UI）

**ディレクトリ構造:**
```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx             # メインページ
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ArtifactPreview/
│   │   │   ├── index.tsx        # プレビューコンテナ
│   │   │   └── CodeRenderer.tsx # コード実行・表示
│   │   ├── ConversationLog/
│   │   │   └── index.tsx        # 会話ログ表示
│   │   ├── ChatInput/
│   │   │   └── index.tsx        # チャット入力
│   │   └── RequirementList/
│   │       └── index.tsx        # 抽出された要件一覧
│   ├── hooks/
│   │   ├── useWebSocket.ts      # WebSocket接続
│   │   └── useArtifact.ts       # アーティファクト状態管理
│   └── lib/
│       └── websocket.ts
├── package.json
└── tailwind.config.js
```

**主要コンポーネント:**
```tsx
// ArtifactPreview/index.tsx
interface ArtifactPreviewProps {
  code: string;
  framework: 'react' | 'html';
  isStreaming: boolean;
}

// ConversationLog/index.tsx
interface Message {
  id: string;
  speaker: 'user' | 'participant' | 'system';
  text: string;
  timestamp: Date;
  extractedRequirements?: Requirement[];
}

// RequirementList/index.tsx
interface Requirement {
  id: string;
  componentType: string;
  description: string;
  status: 'pending' | 'generating' | 'completed';
}
```

---

## 6. 実装計画

### Phase 1: 基盤構築（MVP）
1. **Chrome拡張の基本構造**
   - manifest.json作成
   - Google Meet検出スクリプト
   - 起動ボタンUI

2. **バックエンド基盤**
   - WebSocketサーバー構築
   - Gemini API接続テスト

3. **フロントエンド基盤**
   - Next.jsプロジェクト作成
   - 基本レイアウト実装

### Phase 2: 音声処理パイプライン
4. **音声キャプチャ実装**
   - tabCapture API実装
   - 音声データのエンコード

5. **Gemini Live API連携**
   - WebSocket接続
   - 音声ストリーミング
   - 文字起こし受信

### Phase 3: AI機能
6. **要件抽出機能**
   - Function Calling実装
   - 要件の構造化

7. **コード生成機能**
   - プロンプト最適化
   - ストリーミング生成

### Phase 4: 統合 & UI
8. **エンドツーエンド結合**
   - 全コンポーネント統合
   - アーティファクトプレビュー

9. **UI/UX改善**
   - デザイン調整
   - エラーハンドリング

### Phase 5: 仕上げ
10. **テスト & デバッグ**
11. **ドキュメント作成**
12. **デプロイ**

---

## 7. API仕様

### 7.1 WebSocket Events（クライアント → サーバー）

| Event | Payload | 説明 |
|-------|---------|------|
| `audio:stream` | `{ data: ArrayBuffer, timestamp: number }` | 音声データ送信 |
| `chat:message` | `{ text: string }` | チャットメッセージ送信 |
| `session:start` | `{ meetingId?: string }` | セッション開始 |
| `session:end` | `{}` | セッション終了 |

### 7.2 WebSocket Events（サーバー → クライアント）

| Event | Payload | 説明 |
|-------|---------|------|
| `transcript:update` | `{ text: string, isFinal: boolean }` | 文字起こし結果 |
| `requirement:detected` | `{ requirement: Requirement }` | 要件検出 |
| `artifact:update` | `{ code: string, isComplete: boolean }` | コード生成結果 |
| `error` | `{ message: string, code: string }` | エラー通知 |

---

## 8. 検証方法

### 8.1 単体テスト
- Chrome拡張: Jest + Chrome Extension Testing
- バックエンド: Jest / Pytest
- フロントエンド: Jest + React Testing Library

### 8.2 E2Eテスト
1. Chrome拡張をインストール
2. Google Meetを開始（テスト用）
3. エージェント起動ボタンをクリック
4. テスト音声を再生
5. 要件が抽出されることを確認
6. アーティファクトが生成されることを確認

### 8.3 手動テスト
- 実際のGoogle Meetで動作確認
- 様々な会話パターンでの要件抽出精度確認
- 生成コードの品質確認

---

## 9. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| tabCapture APIの制限 | 高 | ユーザーへの明確な説明、代替手段の検討 |
| Gemini APIの遅延 | 中 | バッファリング、プログレス表示 |
| 要件抽出の精度 | 中 | プロンプトチューニング、ユーザー補正機能 |
| 生成コードの品質 | 中 | テンプレート活用、Few-shot例の追加 |

---

## 10. 参考リンク

- [Gemini Live API Overview](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api)
- [Gemini Live API - Google AI for Developers](https://ai.google.dev/gemini-api/docs/live)
- [Chrome Extension Recording (GitHub)](https://github.com/prokopsimek/chrome-extension-recording)
- [How to build a Chrome recording extension](https://www.recall.ai/blog/how-to-build-a-chrome-recording-extension)
