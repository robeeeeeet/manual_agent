#!/bin/bash
# ==============================================================================
# Workload Identity Federation Setup Script
# GitHub Actions から Google Cloud に安全に認証するための設定
# ==============================================================================

set -e

# 色付き出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 設定値（必要に応じて変更）
PROJECT_ID="${GCP_PROJECT_ID:-manual-agent-prod}"
REGION="asia-northeast1"
SERVICE_ACCOUNT_NAME="github-actions"
POOL_NAME="github-pool"
PROVIDER_NAME="github-provider"

# GitHub リポジトリ情報（環境変数または手動設定）
GITHUB_ORG="${GITHUB_ORG:-}"
GITHUB_REPO="${GITHUB_REPO:-manual_agent}"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Workload Identity Federation Setup${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# GitHub リポジトリ情報の確認
if [ -z "$GITHUB_ORG" ]; then
    echo -e "${YELLOW}GitHub Organization/Username を入力してください:${NC}"
    read -r GITHUB_ORG
fi

echo ""
echo -e "${GREEN}設定値:${NC}"
echo "  GCP Project ID: $PROJECT_ID"
echo "  GitHub Org/User: $GITHUB_ORG"
echo "  GitHub Repo: $GITHUB_REPO"
echo ""

# 確認
echo -e "${YELLOW}この設定で続行しますか？ (y/N)${NC}"
read -r CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "キャンセルしました"
    exit 0
fi

echo ""
echo -e "${BLUE}[1/6] プロジェクトを設定...${NC}"
gcloud config set project "$PROJECT_ID"

echo ""
echo -e "${BLUE}[2/6] サービスアカウントを作成...${NC}"
if gcloud iam service-accounts describe "${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" &>/dev/null; then
    echo -e "${YELLOW}サービスアカウントは既に存在します${NC}"
else
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="GitHub Actions Service Account" \
        --description="Service account for GitHub Actions CI/CD"
    echo -e "${GREEN}サービスアカウントを作成しました${NC}"
    echo "GCP への反映を待機中（5秒）..."
    sleep 5
fi

echo ""
echo -e "${BLUE}[3/6] サービスアカウントに権限を付与...${NC}"
SA_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Cloud Run Admin
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/run.admin" \
    --condition=None --quiet

# Artifact Registry Writer
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/artifactregistry.writer" \
    --condition=None --quiet

# Service Account User (Cloud Run のサービスアカウントとして動作するため)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/iam.serviceAccountUser" \
    --condition=None --quiet

echo -e "${GREEN}権限を付与しました${NC}"

echo ""
echo -e "${BLUE}[4/6] Workload Identity Pool を作成...${NC}"
if gcloud iam workload-identity-pools describe "$POOL_NAME" --location="global" &>/dev/null; then
    echo -e "${YELLOW}Workload Identity Pool は既に存在します${NC}"
else
    gcloud iam workload-identity-pools create "$POOL_NAME" \
        --location="global" \
        --display-name="GitHub Actions Pool" \
        --description="Workload Identity Pool for GitHub Actions"
    echo -e "${GREEN}Workload Identity Pool を作成しました${NC}"
fi

echo ""
echo -e "${BLUE}[5/6] OIDC Provider を作成...${NC}"
if gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
    --location="global" \
    --workload-identity-pool="$POOL_NAME" &>/dev/null; then
    echo -e "${YELLOW}OIDC Provider は既に存在します${NC}"
else
    gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
        --location="global" \
        --workload-identity-pool="$POOL_NAME" \
        --display-name="GitHub Provider" \
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
        --attribute-condition="assertion.repository_owner=='${GITHUB_ORG}'" \
        --issuer-uri="https://token.actions.githubusercontent.com"
    echo -e "${GREEN}OIDC Provider を作成しました${NC}"
fi

echo ""
echo -e "${BLUE}[6/6] サービスアカウントにバインディングを追加...${NC}"

# プロジェクト番号を取得
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}" \
    --condition=None --quiet

echo -e "${GREEN}バインディングを追加しました${NC}"

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}セットアップ完了！${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${BLUE}GitHub Secrets に以下を設定してください:${NC}"
echo ""
echo -e "${YELLOW}GCP_WORKLOAD_IDENTITY_PROVIDER:${NC}"
echo "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/providers/${PROVIDER_NAME}"
echo ""
echo -e "${YELLOW}GCP_SERVICE_ACCOUNT:${NC}"
echo "$SA_EMAIL"
echo ""
echo -e "${BLUE}設定場所:${NC}"
echo "https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/settings/secrets/actions"
echo ""
