#!/bin/bash

# ============================================
# Silent Disco Deployment Script
# ============================================
# This script handles the complete deployment
# process including pulling changes, building,
# and running the application.
# ============================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="silentdisco"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker and docker-compose are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log_success "All dependencies are installed."
}

# Create .env file if it doesn't exist
setup_env() {
    log_info "Setting up environment..."
    
    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        if [ -f "$SCRIPT_DIR/.env.example" ]; then
            cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
            log_warning ".env file created from .env.example. Please review and update the values!"
        else
            log_error ".env.example not found!"
            exit 1
        fi
    else
        log_info ".env file already exists."
    fi
}

# Pull latest changes (if git repo)
pull_changes() {
    if [ -d "$SCRIPT_DIR/.git" ]; then
        log_info "Pulling latest changes from git..."
        cd "$SCRIPT_DIR"
        git pull || log_warning "Failed to pull changes. Continuing with local version..."
    fi
}

# Stop existing containers
stop_containers() {
    log_info "Stopping existing containers..."
    cd "$SCRIPT_DIR"
    
    if docker compose version &> /dev/null; then
        docker compose down --remove-orphans 2>/dev/null || true
    else
        docker-compose down --remove-orphans 2>/dev/null || true
    fi
    
    log_success "Containers stopped."
}

# Build and start containers
start_containers() {
    log_info "Building and starting containers..."
    cd "$SCRIPT_DIR"
    
    if docker compose version &> /dev/null; then
        docker compose build --no-cache
        docker compose up -d
    else
        docker-compose build --no-cache
        docker-compose up -d
    fi
    
    log_success "Containers started."
}

# Run database migrations
run_migrations() {
    log_info "Waiting for database to be ready..."
    sleep 5  # Give DB time to initialize
    
    log_info "Running database migrations..."
    cd "$SCRIPT_DIR"
    
    if docker compose version &> /dev/null; then
        docker compose exec -T backend npx prisma migrate deploy || {
            log_warning "Migration failed. Trying to push schema directly..."
            docker compose exec -T backend npx prisma db push --accept-data-loss
        }
    else
        docker-compose exec -T backend npx prisma migrate deploy || {
            log_warning "Migration failed. Trying to push schema directly..."
            docker-compose exec -T backend npx prisma db push --accept-data-loss
        }
    fi
    
    log_success "Database migrations complete."
}

# Show container status
show_status() {
    log_info "Container status:"
    cd "$SCRIPT_DIR"
    
    if docker compose version &> /dev/null; then
        docker compose ps
    else
        docker-compose ps
    fi
    
    echo ""
    log_info "Memory usage:"
    docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep "$PROJECT_NAME" || true
}

# Show access URLs
show_urls() {
    # Load environment variables
    if [ -f "$SCRIPT_DIR/.env" ]; then
        source "$SCRIPT_DIR/.env"
    fi
    
    FRONTEND_PORT=${FRONTEND_PORT:-3846}
    BACKEND_PORT=${BACKEND_PORT:-3847}
    
    echo ""
    log_success "============================================"
    log_success "  Silent Disco is now running!"
    log_success "============================================"
    echo ""
    echo -e "  ${GREEN}Frontend:${NC}  http://localhost:${FRONTEND_PORT}"
    echo -e "  ${GREEN}Backend:${NC}   http://localhost:${BACKEND_PORT}"
    echo -e "  ${GREEN}API:${NC}       http://localhost:${BACKEND_PORT}/api"
    echo ""
    log_info "For mobile app, use your server's IP instead of localhost."
    echo ""
}

# View logs
view_logs() {
    log_info "Viewing logs (Ctrl+C to exit)..."
    cd "$SCRIPT_DIR"
    
    if docker compose version &> /dev/null; then
        docker compose logs -f
    else
        docker-compose logs -f
    fi
}

# Cleanup old images
cleanup() {
    log_info "Cleaning up old Docker images..."
    docker image prune -f
    log_success "Cleanup complete."
}

# Main deployment function
deploy() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  Silent Disco Deployment${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    
    check_dependencies
    setup_env
    pull_changes
    stop_containers
    start_containers
    run_migrations
    cleanup
    show_status
    show_urls
}

# Handle command line arguments
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    stop)
        stop_containers
        log_success "Application stopped."
        ;;
    start)
        start_containers
        run_migrations
        show_status
        show_urls
        ;;
    restart)
        stop_containers
        start_containers
        show_status
        show_urls
        ;;
    status)
        show_status
        show_urls
        ;;
    logs)
        view_logs
        ;;
    cleanup)
        cleanup
        ;;
    rebuild)
        stop_containers
        start_containers
        run_migrations
        show_status
        show_urls
        ;;
    *)
        echo "Usage: $0 {deploy|stop|start|restart|status|logs|cleanup|rebuild}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Full deployment (default)"
        echo "  stop     - Stop all containers"
        echo "  start    - Start containers"
        echo "  restart  - Restart containers"
        echo "  status   - Show container status"
        echo "  logs     - View container logs"
        echo "  cleanup  - Remove unused Docker images"
        echo "  rebuild  - Rebuild and restart containers"
        exit 1
        ;;
esac
