#!/bin/bash
echo "==========================================="
echo " 御险·时空智脑 (Production Mode) 启动脚本 "
echo "==========================================="

# Kill any existing processes on port 8000
echo "[1/3] 清理遗留端口..."
lsof -ti:8000 | xargs kill -9 2>/dev/null

echo "[2/3] 检查 Python 环境依赖..."
cd aegis-backend
source venv/bin/activate
pip install -r requirements.txt > /dev/null 2>&1

echo "[3/3] 启动高速 Gunicorn/Uvicorn 并发服务器..."
echo "访问地址: http://localhost:8000"
echo "API 地址: http://localhost:8000/docs"
echo "-------------------------------------------"
# Use multiple workers for production
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
