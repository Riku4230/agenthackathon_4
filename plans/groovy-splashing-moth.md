# GCP Terraform デプロイ設計

## 概要

Google Meet会話からUIを自動生成するフルスタックアプリケーションをGCPにデプロイするTerraform構成

## アーキテクチャ図

```
                         +------------------+
                         |   GCP Project    |
                         +--------+---------+
                                  |
        +------------+------------+------------+------------+
        |            |            |            |            |
        v            v            v            v            v
+-------+----+ +-----+------+ +---+----+ +----+---+ +-------+------+
|  Artifact  | |   Secret   | | Cloud  | | Cloud  | |    IAM       |
|  Registry  | |  Manager   | |  Run   | |  Run   | | Service Acc  |
|            | |            | |Frontend| |Backend | |              |
| - frontend | | - GEMINI   | | :3000  | | :3001  | | - run-sa     |
| - backend  | |   API_KEY  | |        | |        | |              |
+------------+ +------------+ +---+----+ +----+---+ +--------------+
                                  |            |
                                  |   WSS/HTTPS|
                                  +------+-----+
                                         |
                                    [ Users ]
```

## 作成するリソース

| リソース | 用途 |
|----------|------|
| `google_project_service` | API有効化 (Cloud Run, Artifact Registry, Secret Manager) |
| `google_artifact_registry_repository` | Dockerイメージ保存 |
| `google_secret_manager_secret` | Gemini APIキー管理 |
| `google_service_account` | Cloud Run用サービスアカウント |
| `google_cloud_run_v2_service` x2 | Frontend/Backend サービス |
| `google_cloud_run_service_iam_member` x2 | 公開アクセス許可 |

## ディレクトリ構成

```
terraform/
├── main.tf              # 全リソース定義
├── variables.tf         # 入力変数
├── outputs.tf           # 出力値 (URLs)
├── versions.tf          # Provider設定
└── terraform.tfvars.example

backend/
└── Dockerfile           # 新規作成

frontend/
└── Dockerfile           # 新規作成
```

## 作成ファイル一覧

### 1. `terraform/versions.tf`
- Terraform >= 1.0
- google provider ~> 5.0
- プロジェクト・リージョン設定

### 2. `terraform/variables.tf`
- `project_id`: GCPプロジェクトID
- `region`: リージョン (default: us-central1)
- `app_name`: アプリ名プレフィックス
- `gemini_api_key`: Gemini APIキー (sensitive)
- `frontend_image_tag` / `backend_image_tag`: イメージタグ

### 3. `terraform/main.tf`
- API有効化 (run, artifactregistry, secretmanager, iam)
- Artifact Registryリポジトリ
- Secret Manager (Gemini API Key)
- Service Account + IAM
- Cloud Run Backend (session_affinity=true, timeout=3600s)
- Cloud Run Frontend
- 公開アクセス許可

### 4. `terraform/outputs.tf`
- frontend_url
- backend_url
- artifact_registry_url

### 5. `backend/Dockerfile`
- Node.js 20 Alpine
- マルチステージビルド
- Port 3001

### 6. `frontend/Dockerfile`
- Node.js 20 Alpine
- マルチステージビルド (standalone output)
- NEXT_PUBLIC_BACKEND_URL をビルド引数で受け取り

### 7. `frontend/next.config.ts` (修正)
- `output: 'standalone'` 追加

## WebSocket対応

Cloud RunでSocket.ioを動作させるため:
- `session_affinity = true`: 同一クライアントを同一インスタンスに接続
- `timeout = 3600s`: WebSocket接続のタイムアウト延長
- `max_instance_count = 2`: スケーリング制限でセッション整合性確保

## デプロイ手順

```bash
# 1. Terraform初期化
cd terraform
terraform init

# 2. バックエンドイメージをビルド・プッシュ
gcloud auth configure-docker us-central1-docker.pkg.dev
docker build -t us-central1-docker.pkg.dev/PROJECT/repo/backend:v1 ../backend
docker push us-central1-docker.pkg.dev/PROJECT/repo/backend:v1

# 3. バックエンドのみデプロイ
terraform apply -target=google_cloud_run_v2_service.backend

# 4. バックエンドURLを取得
BACKEND_URL=$(terraform output -raw backend_url)

# 5. フロントエンドイメージをビルド・プッシュ
docker build --build-arg NEXT_PUBLIC_BACKEND_URL=$BACKEND_URL \
  -t us-central1-docker.pkg.dev/PROJECT/repo/frontend:v1 ../frontend
docker push us-central1-docker.pkg.dev/PROJECT/repo/frontend:v1

# 6. 全体デプロイ
terraform apply
```

## 検証方法

1. `terraform output` でURLを確認
2. Frontend URLにブラウザでアクセス
3. DevToolsでWebSocket接続を確認
4. Chrome拡張機能でGoogle Meetから接続テスト

## 注意事項

- `gemini_api_key` は `TF_VAR_gemini_api_key` 環境変数で渡す
- Frontend URL取得→Backend CORSへの設定が必要（循環参照のため2段階デプロイ）
- 現状インメモリセッションのため、インスタンス再起動でセッション消失
