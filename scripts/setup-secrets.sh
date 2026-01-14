#!/bin/bash
# =============================================================================
# Secret Manager シークレット登録スクリプト
#
# 使用方法:
#   ./scripts/setup-secrets.sh          # .env から読み込んで登録
#   ./scripts/setup-secrets.sh --delete # シークレットを削除
#   ./scripts/setup-secrets.sh --list   # シークレット一覧を表示
# =============================================================================

set -e  # エラー時に停止

# --- 設定 ---
PROJECT_ID="${GCP_PROJECT_ID:-manual-agent-prod}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

# 登録するシークレット名のリスト
SECRETS=(
    "GEMINI_API_KEY"
    "GOOGLE_CSE_API_KEY"
    "GOOGLE_CSE_ID"
    "SUPABASE_URL"
    "SUPABASE_PUBLISHABLE_KEY"
    "SUPABASE_SECRET_KEY"
    "GAS_WEBHOOK_URL"
)

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

# .env ファイルから値を読み込む
load_env_value() {
    local key="$1"
    if [[ -f "${ENV_FILE}" ]]; then
        grep "^${key}=" "${ENV_FILE}" | cut -d '=' -f2- | tr -d '"' | tr -d "'"
    fi
}

# シークレットを作成または更新
create_or_update_secret() {
    local name="$1"
    local value="$2"

    if [[ -z "${value}" ]]; then
        log_warn "${name}: 値が空のためスキップ"
        return
    fi

    # シークレットが存在するか確認
    if gcloud secrets describe "${name}" --project="${PROJECT_ID}" &>/dev/null; then
        # 存在する場合は新しいバージョンを追加
        log_info "${name}: 新しいバージョンを追加中..."
        echo -n "${value}" | gcloud secrets versions add "${name}" \
            --project="${PROJECT_ID}" \
            --data-file=-
    else
        # 存在しない場合は新規作成
        log_info "${name}: シークレットを作成中..."
        echo -n "${value}" | gcloud secrets create "${name}" \
            --project="${PROJECT_ID}" \
            --data-file=-
    fi
    log_success "${name}: 完了"
}

# シークレット一覧を表示
list_secrets() {
    log_info "Secret Manager のシークレット一覧:"
    echo ""
    gcloud secrets list --project="${PROJECT_ID}" --format="table(name,createTime)"
}

# シークレットを削除
delete_secrets() {
    log_warn "以下のシークレットを削除します:"
    for name in "${SECRETS[@]}"; do
        echo "  - ${name}"
    done
    echo ""
    read -p "本当に削除しますか? (y/N): " confirm

    if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
        log_info "キャンセルしました"
        exit 0
    fi

    for name in "${SECRETS[@]}"; do
        if gcloud secrets describe "${name}" --project="${PROJECT_ID}" &>/dev/null; then
            log_info "${name}: 削除中..."
            gcloud secrets delete "${name}" --project="${PROJECT_ID}" --quiet
            log_success "${name}: 削除完了"
        else
            log_warn "${name}: 存在しないためスキップ"
        fi
    done
}

# メインの登録処理
register_secrets() {
    if [[ ! -f "${ENV_FILE}" ]]; then
        log_error ".env ファイルが見つかりません: ${ENV_FILE}"
        exit 1
    fi

    log_info ".env ファイルからシークレットを登録します"
    log_info "プロジェクト: ${PROJECT_ID}"
    echo ""

    for name in "${SECRETS[@]}"; do
        value=$(load_env_value "${name}")
        create_or_update_secret "${name}" "${value}"
    done

    echo ""
    log_success "すべてのシークレットを登録しました!"
}

show_usage() {
    echo "使用方法: $0 [option]"
    echo ""
    echo "Options:"
    echo "  (なし)     .env から読み込んでシークレットを登録/更新"
    echo "  --list     シークレット一覧を表示"
    echo "  --delete   シークレットを削除"
    echo "  --help     このヘルプを表示"
    echo ""
    echo "環境変数:"
    echo "  GCP_PROJECT_ID  GCP プロジェクト ID (default: manual-agent-prod)"
}

# --- メイン ---
main() {
    case "${1:-}" in
        --list)
            list_secrets
            ;;
        --delete)
            delete_secrets
            ;;
        --help|-h|help)
            show_usage
            ;;
        "")
            register_secrets
            ;;
        *)
            log_error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
