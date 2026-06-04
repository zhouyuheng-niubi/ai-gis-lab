#!/bin/bash
#============================================
#  御险·时空智脑  停止脚本
#============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.aegis_pids"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   御险·时空智脑  服务停止中...                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# 停止后端 PID（如果 PID 文件存在）
if [ -f "$PID_FILE" ]; then
  BACKEND_PID=$(cat "$PID_FILE")
  echo "[1/3] 停止后端进程 (PID: $BACKEND_PID)..."
  kill $BACKEND_PID 2>/dev/null
  rm -f "$PID_FILE"
else
  echo "[1/3] 未找到后端 PID 文件，尝试端口清理..."
fi

# 强制清理端口
echo "[2/3] 清理 5173 / 8000 端口..."
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:8000 | xargs kill -9 2>/dev/null

# 清理 FFmpeg RTSP 转码进程
echo "[3/3] 清理 RTSP 转码进程..."
pkill -f "ffmpeg.*rtsp://" 2>/dev/null
rm -rf "$SCRIPT_DIR/aegis-backend/hls_output" 2>/dev/null

echo ""
echo "✅ 所有服务已关闭。"
echo ""
