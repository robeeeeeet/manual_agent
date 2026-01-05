#!/bin/bash
# =============================================================================
# Cloud Scheduler セットアップスクリプト
#
# メンテナンスリマインド通知を定期実行するためのCloud Schedulerジョブを作成
#
# 使用方法:
#   ./scripts/setup-scheduler.sh              # ジョブ作成
#   ./scripts/setup-scheduler.sh --delete     # ジョブ削除
#   ./scripts/setup-scheduler.sh --status     # ジョブ状態確認
#   ./scripts/setup-scheduler.sh --trigger    # 手動実行（テスト用）
# =============================================================================

set -e

# --- 設定 ---
PROJECT_ID="${GCP_PROJECT_ID:-manual-agent-prod}"
REGION="${GCP_REGION:-asia-northeast1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-manual-agent-api}"
JOB_NAME="${SCHEDULER_JOB_NAME:-maintenance-reminder-hourly}"

# --- 色付き出力 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# --- 関数 ---

get_service_url() {
    gcloud run services describe "${SERVICE_NAME}" \
        --region "${REGION}" \
        --project "${PROJECT_ID}" \
        --format "value(status.url)" 2>/dev/null
}

get_cron_secret() {
    # \r と \n を除去して純粋な秘密値のみを返す
    gcloud secrets versions access latest --secret=CRON_SECRET_KEY --project="${PROJECT_ID}" 2>/dev/null | tr -d '\r\n'
}

create_job() {
    log_info "Cloud Scheduler ジョブを作成中..."

    # Cloud Run サービス URL を取得
    SERVICE_URL=$(get_service_url)
    if [ -z "$SERVICE_URL" ]; then
        log_error "Cloud Run サービス '${SERVICE_NAME}' が見つかりません"
        log_error "先に ./scripts/deploy-backend.sh を実行してください"
        exit 1
    fi

    # CRON_SECRET_KEY を取得
    # gcloud の出力に混入しうる CR(\\r) を除去（\\n はコマンド置換で基本的に落ちる）
    CRON_SECRET=$(get_cron_secret | tr -d '\r')
    if [ -z "$CRON_SECRET" ]; then
        log_error "CRON_SECRET_KEY が Secret Manager に設定されていません"
        log_error "以下のコマンドで設定してください:"
        echo ""
        echo "  # シークレットキーを生成"
        echo "  CRON_KEY=\$(openssl rand -hex 32)"
        echo "  echo \"Generated CRON_SECRET_KEY: \$CRON_KEY\""
        echo ""
        echo "  # Secret Manager に登録"
        echo "  echo -n \"\$CRON_KEY\" | gcloud secrets create CRON_SECRET_KEY --data-file=- --project=${PROJECT_ID}"
        echo ""
        echo "  # または既存のシークレットに新しいバージョンを追加"
        echo "  echo -n \"\$CRON_KEY\" | gcloud secrets versions add CRON_SECRET_KEY --data-file=- --project=${PROJECT_ID}"
        echo ""
        exit 1
    fi

    ENDPOINT="${SERVICE_URL}/api/v1/cron/send-reminders"

    log_info "サービス URL: ${SERVICE_URL}"
    log_info "エンドポイント: ${ENDPOINT}"
    log_info "スケジュール: 毎時0分 (JST)"

    # 既存のジョブがあれば削除
    if gcloud scheduler jobs describe "${JOB_NAME}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
        log_warn "既存のジョブ '${JOB_NAME}' を削除します..."
        gcloud scheduler jobs delete "${JOB_NAME}" \
            --location="${REGION}" \
            --project="${PROJECT_ID}" \
            --quiet
    fi

    # Cloud Scheduler ジョブを作成
    # 毎時0分に実行（JST = UTC+9）
    gcloud scheduler jobs create http "${JOB_NAME}" \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --schedule="0 * * * *" \
        --time-zone="Asia/Tokyo" \
        --uri="${ENDPOINT}" \
        --http-method=POST \
        --headers="Content-Type=application/json,X-Cron-Secret=${CRON_SECRET}" \
        --attempt-deadline="60s" \
        --description="Hourly maintenance reminder notifications"

    log_success "Cloud Scheduler ジョブを作成しました!"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ジョブ名: ${JOB_NAME}${NC}"
    echo -e "${GREEN}  スケジュール: 毎時0分 (Asia/Tokyo)${NC}"
    echo -e "${GREEN}  エンドポイント: ${ENDPOINT}${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "手動実行でテスト: ./scripts/setup-scheduler.sh --trigger"
}

delete_job() {
    log_info "Cloud Scheduler ジョブを削除中..."

    if gcloud scheduler jobs describe "${JOB_NAME}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
        gcloud scheduler jobs delete "${JOB_NAME}" \
            --location="${REGION}" \
            --project="${PROJECT_ID}" \
            --quiet
        log_success "ジョブ '${JOB_NAME}' を削除しました"
    else
        log_warn "ジョブ '${JOB_NAME}' は存在しません"
    fi
}

show_status() {
    log_info "Cloud Scheduler ジョブの状態を確認中..."

    if gcloud scheduler jobs describe "${JOB_NAME}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
        echo ""
        gcloud scheduler jobs describe "${JOB_NAME}" \
            --location="${REGION}" \
            --project="${PROJECT_ID}" \
            --format="yaml(name,schedule,timeZone,state,lastAttemptTime,scheduleTime,httpTarget.uri)"
    else
        log_warn "ジョブ '${JOB_NAME}' は存在しません"
    fi
}

trigger_job() {
    log_info "Cloud Scheduler ジョブを手動実行中..."

    if ! gcloud scheduler jobs describe "${JOB_NAME}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
        log_error "ジョブ '${JOB_NAME}' が存在しません"
        log_error "先に ./scripts/setup-scheduler.sh を実行してください"
        exit 1
    fi

    gcloud scheduler jobs run "${JOB_NAME}" \
        --location="${REGION}" \
        --project="${PROJECT_ID}"

    log_success "ジョブを手動実行しました"
    echo ""
    echo "結果を確認するには: ./scripts/setup-scheduler.sh --status"
}

show_usage() {
    echo "使用方法: $0 [option]"
    echo ""
    echo "Options:"
    echo "  (なし)       Cloud Scheduler ジョブを作成"
    echo "  --delete     ジョブを削除"
    echo "  --status     ジョブの状態を確認"
    echo "  --trigger    ジョブを手動実行（テスト用）"
    echo "  --help       このヘルプを表示"
    echo ""
    echo "環境変数:"
    echo "  GCP_PROJECT_ID       GCP プロジェクト ID (default: manual-agent-prod)"
    echo "  GCP_REGION           リージョン (default: asia-northeast1)"
    echo "  CLOUD_RUN_SERVICE    Cloud Run サービス名 (default: manual-agent-api)"
    echo "  SCHEDULER_JOB_NAME   Scheduler ジョブ名 (default: maintenance-reminder-hourly)"
}

# --- メイン ---
main() {
    case "${1:-}" in
        --delete)
            delete_job
            ;;
        --status)
            show_status
            ;;
        --trigger)
            trigger_job
            ;;
        --help|-h)
            show_usage
            ;;
        "")
            create_job
            ;;
        *)
            log_error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
