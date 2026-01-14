#!/bin/bash
# =============================================================================
# Cloud Run バックエンドデプロイスクリプト
#
# 使用方法:
#   ./scripts/deploy-backend.sh         # ビルド & デプロイ
#   ./scripts/deploy-backend.sh build   # ビルドのみ
#   ./scripts/deploy-backend.sh deploy  # デプロイのみ（既存イメージ使用）
# =============================================================================

set -e  # エラー時に停止

# --- 設定 ---
PROJECT_ID="${GCP_PROJECT_ID:-manual-agent-prod}"
REGION="${GCP_REGION:-asia-northeast1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-manual-agent-api}"
IMAGE_NAME="${GCP_REGION:-asia-northeast1}-docker.pkg.dev/${PROJECT_ID}/manual-agent-repo/api"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"

# --- 色付き出力 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# --- 関数 ---
build_image() {
    log_info "Docker イメージをビルド中..."
    log_info "イメージ: ${IMAGE_NAME}:latest"

    cd "${BACKEND_DIR}"

    gcloud builds submit \
        --tag "${IMAGE_NAME}:latest" \
        --quiet

    log_success "ビルド完了!"
}

deploy_service() {
    log_info "Cloud Run にデプロイ中..."
    log_info "サービス: ${SERVICE_NAME}"
    log_info "リージョン: ${REGION}"

    gcloud run deploy "${SERVICE_NAME}" \
        --image "${IMAGE_NAME}:latest" \
        --region "${REGION}" \
        --platform managed \
        --allow-unauthenticated \
        --memory 512Mi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 10 \
        --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,GOOGLE_CSE_API_KEY=GOOGLE_CSE_API_KEY:latest,GOOGLE_CSE_ID=GOOGLE_CSE_ID:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_PUBLISHABLE_KEY=SUPABASE_PUBLISHABLE_KEY:latest,SUPABASE_SECRET_KEY=SUPABASE_SECRET_KEY:latest,VAPID_PUBLIC_KEY=VAPID_PUBLIC_KEY:latest,VAPID_PRIVATE_KEY=VAPID_PRIVATE_KEY:latest,VAPID_SUBJECT=VAPID_SUBJECT:latest,CRON_SECRET_KEY=CRON_SECRET_KEY:latest,GAS_WEBHOOK_URL=GAS_WEBHOOK_URL:latest" \
        --quiet

    # サービス URL を取得
    SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
        --region "${REGION}" \
        --format "value(status.url)")

    log_success "デプロイ完了!"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  サービス URL: ${SERVICE_URL}${NC}"
    echo -e "${GREEN}  ヘルスチェック: ${SERVICE_URL}/health${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

show_usage() {
    echo "使用方法: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  (なし)   ビルド & デプロイを実行"
    echo "  build    ビルドのみ実行"
    echo "  deploy   デプロイのみ実行（既存イメージ使用）"
    echo "  help     このヘルプを表示"
    echo ""
    echo "環境変数:"
    echo "  GCP_PROJECT_ID      GCP プロジェクト ID (default: manual-agent-prod)"
    echo "  GCP_REGION          リージョン (default: asia-northeast1)"
    echo "  CLOUD_RUN_SERVICE   サービス名 (default: manual-agent-api)"
}

# --- メイン ---
main() {
    case "${1:-}" in
        build)
            build_image
            ;;
        deploy)
            deploy_service
            ;;
        help|--help|-h)
            show_usage
            ;;
        "")
            build_image
            echo ""
            deploy_service
            ;;
        *)
            log_error "不明なコマンド: $1"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
