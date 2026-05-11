#!/usr/bin/env bash
# =============================================================================
# Production deploy: tqa.tylerrhinehart.com on homelab k3s
# =============================================================================
# Builds the static SPA into an nginx image, pushes to k3s01 private registry,
# applies kustomize manifests for the app + cloudflared, and waits for rollouts.
#
# Usage: ./scripts/deploy.sh [options]
#
# Options:
#   --skip-build     Skip docker build (use existing image at $TAG)
#   --skip-push      Skip docker push
#   --tag TAG        Image tag (default: latest)
#   --dry-run        Render but don't apply
#   --clean          Delete the horsetraining namespace before deploying
#   -h, --help       Show this help
# =============================================================================

set -euo pipefail

NAMESPACE="horsetraining"
REGISTRY="k3s01.local.tylerrhinehart.com:5000"
IMAGE_REPO="${REGISTRY}/horsetraining/web"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OVERLAY_DIR="$PROJECT_ROOT/k8s/overlays/production"

IMAGE_TAG="latest"
SKIP_BUILD=false
SKIP_PUSH=false
DRY_RUN=false
CLEAN=false

# Colors
RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m' CYAN='\033[0;36m' NC='\033[0m'
log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERR]${NC} $1" >&2; }
log_step()    { echo -e "\n${CYAN}==>${NC} ${GREEN}$1${NC}"; }

show_help() { sed -n '2,17p' "$0"; exit 0; }

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build) SKIP_BUILD=true; shift ;;
    --skip-push)  SKIP_PUSH=true;  shift ;;
    --dry-run)    DRY_RUN=true;    shift ;;
    --clean)      CLEAN=true;      shift ;;
    --tag)        IMAGE_TAG="$2";  shift 2 ;;
    -h|--help)    show_help ;;
    *) log_error "Unknown option: $1"; show_help ;;
  esac
done

IMAGE_REF="${IMAGE_REPO}:${IMAGE_TAG}"

# =============================================================================
# Pre-flight
# =============================================================================
log_step "Pre-flight checks"

for cmd in docker kubectl; do
  command -v "$cmd" >/dev/null 2>&1 || { log_error "$cmd not installed"; exit 1; }
done

kubectl cluster-info >/dev/null 2>&1 || { log_error "kubectl cannot reach cluster"; exit 1; }

CONTEXT=$(kubectl config current-context)
log_info "kubectl context: $CONTEXT"

SECRETS_FILE="$PROJECT_ROOT/deploy/secrets.yaml"

check_secrets() {
  if [ ! -f "$SECRETS_FILE" ]; then
    log_error "Missing $SECRETS_FILE — copy from secrets.example.yaml and fill in real values"
    exit 1
  fi
  if grep -q "CHANGE_ME" "$SECRETS_FILE"; then
    log_error "$SECRETS_FILE still has CHANGE_ME placeholders"
    exit 1
  fi
}

# Source build-time Vite vars from .env.local (or shell). Both must resolve
# before we build, since Vite inlines them into the bundle.
if [ -f "$PROJECT_ROOT/.env.local" ] && [ "$SKIP_BUILD" = false ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env.local"
  set +a
fi

if [ "$SKIP_BUILD" = false ]; then
  : "${VITE_SUPABASE_URL:?VITE_SUPABASE_URL not set (define in .env.local or shell)}"
  : "${VITE_SUPABASE_ANON_KEY:?VITE_SUPABASE_ANON_KEY not set (define in .env.local or shell)}"
fi

if [ "$DRY_RUN" = false ]; then
  check_secrets
fi

log_success "Pre-flight passed"

# =============================================================================
# Clean (optional)
# =============================================================================
if [ "$CLEAN" = true ]; then
  log_step "Cleaning namespace $NAMESPACE"
  if [ "$DRY_RUN" = true ]; then
    log_info "[dry-run] would: kubectl delete namespace $NAMESPACE"
  else
    kubectl delete namespace "$NAMESPACE" --ignore-not-found --timeout=120s
    kubectl wait --for=delete namespace/"$NAMESPACE" --timeout=120s 2>/dev/null || true
  fi
fi

# =============================================================================
# Build + push
# =============================================================================
if [ "$SKIP_BUILD" = false ]; then
  log_step "Build $IMAGE_REF"
  if [ "$DRY_RUN" = true ]; then
    log_info "[dry-run] docker build --platform linux/amd64 -f deploy/Dockerfile -t $IMAGE_REF ."
  else
    docker build \
      --platform linux/amd64 \
      -f "$PROJECT_ROOT/deploy/Dockerfile" \
      --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
      --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
      -t "$IMAGE_REF" \
      "$PROJECT_ROOT"
    log_success "Built $IMAGE_REF"
  fi
fi

if [ "$SKIP_PUSH" = false ]; then
  log_step "Push $IMAGE_REF"
  if [ "$DRY_RUN" = true ]; then
    log_info "[dry-run] docker push $IMAGE_REF"
  else
    docker push "$IMAGE_REF"
    log_success "Pushed $IMAGE_REF"
  fi
fi

# =============================================================================
# App + cloudflared (kustomize)
# =============================================================================
log_step "Apply kustomize overlay"

if [ "$DRY_RUN" = true ]; then
  kubectl kustomize "$OVERLAY_DIR" | head -120
  log_info "[dry-run] (truncated) — would kubectl apply -k $OVERLAY_DIR"
else
  KUSTOMIZATION_FILE="$OVERLAY_DIR/kustomization.yaml"
  if command -v kustomize >/dev/null 2>&1; then
    ( cd "$OVERLAY_DIR" && kustomize edit set image "${IMAGE_REPO}:${IMAGE_TAG}" )
  else
    sed -i.bak "s|newTag:.*|newTag: ${IMAGE_TAG}|" "$KUSTOMIZATION_FILE" && rm -f "${KUSTOMIZATION_FILE}.bak"
    log_info "Pinned image tag to ${IMAGE_TAG} in $KUSTOMIZATION_FILE"
  fi
  # Apply manifests first — namespace.yaml in the base creates the namespace,
  # which must exist before we can apply secrets into it.
  kubectl kustomize "$OVERLAY_DIR" | kubectl apply -f -
  check_secrets
  kubectl apply -f "$SECRETS_FILE"   # idempotent; safe to re-apply
  kubectl rollout restart deployment/web         -n "$NAMESPACE" >/dev/null
  kubectl rollout restart deployment/cloudflared -n "$NAMESPACE" >/dev/null
  kubectl rollout status  deployment/web         -n "$NAMESPACE" --timeout=300s
  kubectl rollout status  deployment/cloudflared -n "$NAMESPACE" --timeout=300s
fi

# =============================================================================
# Summary
# =============================================================================
if [ "$DRY_RUN" = false ]; then
  log_step "Summary"
  echo ""
  echo -e "${CYAN}Pods:${NC}"
  kubectl get pods -n "$NAMESPACE" -o wide
  echo ""
  echo -e "${CYAN}Services:${NC}"
  kubectl get svc -n "$NAMESPACE"
  echo ""
  echo -e "${CYAN}Tunnel status (last 5 lines of cloudflared logs):${NC}"
  kubectl logs -n "$NAMESPACE" deployment/cloudflared --tail=5 2>/dev/null || true
  echo ""
  echo -e "${GREEN}Deployed.${NC} App: https://tqa.tylerrhinehart.com"
fi
