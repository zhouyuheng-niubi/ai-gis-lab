#!/bin/bash
#============================================
#  御险·时空智脑  启动脚本 (LAN Mode)
#  前端：Vite (0.0.0.0:5173)
#  后端：FastAPI (0.0.0.0:8000)
#============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.aegis_pids"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   御险·时空智脑  Aegis Geo Platform  v1.0    ║"
echo "║   启动模式: 局域网开发 (LAN Development)     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# 清理残留进程
echo "[1/4] 清理本地端口残留进程..."
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:8000 | xargs kill -9 2>/dev/null
sleep 1

# 获取局域网 IP
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "未知")
echo "[2/4] 本机局域网 IP: $LAN_IP"

# 启动 FastAPI 后端
echo "[3/4] 启动 FastAPI 后端服务 (0.0.0.0:8000)..."
cd "$SCRIPT_DIR/aegis-backend"
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "      后端 PID: $BACKEND_PID"

# 等后端就绪
sleep 2

# 启动 Vite 前端
echo "[4/4] 启动 Vite 前端 (0.0.0.0:5173)..."
cd "$SCRIPT_DIR/aegis-geo-platform"

echo ""
echo "════════════════════════════════════════════════"
echo "  ✅ 系统已启动！可通过以下地址访问："
echo ""
echo "  本机访问:    http://localhost:5173"
echo "  局域网访问:  http://$LAN_IP:5173"
echo ""
echo "  后端 API:    http://$LAN_IP:8000/docs"
echo "════════════════════════════════════════════════"
echo "  按 Ctrl+C 停止所有服务"
echo "════════════════════════════════════════════════"
echo ""

# 保存 PID 以供 stop 脚本使用
echo "$BACKEND_PID" > "$PID_FILE"

# 前台运行前端（Ctrl+C 可终止）
npm run dev

# 前端退出后自动清理后端
echo ""
echo "[清理] 停止后端服务 (PID: $BACKEND_PID)..."
kill $BACKEND_PID 2>/dev/null
rm -f "$PID_FILE"
echo "[完成] 所有服务已关闭。"
