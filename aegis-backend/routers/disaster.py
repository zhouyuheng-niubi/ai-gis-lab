"""
AI 灾害识别模拟服务
实际生产中对接 YOLO / SAM 模型推理，此处使用逼真模拟数据
"""
import random
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class DetectionResult(BaseModel):
    label: str
    confidence: float
    bbox: list[float]  # [x1, y1, x2, y2] normalized


# 预设标定资产地理数据及告警关联（绝对坐标映射）
ALERT_TEMPLATES = [
    {
        "type": "flood",
        "level": "red",
        "title": "泸州国际集装箱码头洪峰警告",
        "description": "长江上游特大洪峰抵泸，泸州港核心装卸区处于漫堤风险边缘，需立即转移底层集装箱。",
        "lng": 105.410,
        "lat": 28.880,
    },
    {
        "type": "chemical",
        "level": "orange",
        "title": "云龙机场航空煤油库微量泄漏",
        "description": "云龙机场地下航油储罐区气敏传感器触发预警，已自动封闭阀门，Maintainer边跑道禁入起降航班，建议消防就位。",
        "lng": 105.474,
        "lat": 29.033,
    },
    {
        "type": "flood",
        "level": "yellow",
        "title": "西南医科大附属医院内涝",
        "description": "受强对流极端降雨影响，西南医科大学附属医院（忠山院区）地下停车场及门诊一楼出现轻微积水，正在启动抽水排涝。",
        "lng": 105.4468,
        "lat": 28.8797,
    },
    {
        "type": "fire",
        "level": "orange",
        "title": "国窖广场文物窖池防火特级戒备",
        "description": "泸州老窖旅游区Maintainer边有不明热源极速上升，AI监控判定有火情萌芽，已联动物业切断全区电路保护国宝窖池群。",
        "lng": 105.4535,
        "lat": 28.8847,
    },
    {
        "type": "landslide",
        "level": "orange",
        "title": "古蔺山区边缘地质滑坡",
        "description": "连日暴雨导致靠近古蔺某边缘林区山体滑坡塌方，阻断乡村道路，有次生泥石流风险。",
        "lng": 105.810,
        "lat": 28.030,
    },
]


@router.get("/alerts")
async def get_disaster_alerts():
    """获取实时灾害告警列表"""
    now = datetime.utcnow()
    alerts = []
    for i, tpl in enumerate(ALERT_TEMPLATES):
        alert = {
            "id": f"alert-{str(uuid.uuid4())[:8]}",
            "type": tpl["type"],
            "level": tpl["level"],
            "title": tpl["title"],
            "description": tpl["description"],
            "lng": tpl["lng"], # Remove random jitter to lock onto exact real POI
            "lat": tpl["lat"], # Remove random jitter to lock onto exact real POI
            "confidence": round(random.uniform(0.75, 0.98), 2),
            "timestamp": (now - timedelta(minutes=random.randint(1, 30))).isoformat() + "Z",
        }
        alerts.append(alert)

    # Sort by timestamp descending
    alerts.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"alerts": alerts, "total": len(alerts)}


@router.post("/detect")
async def detect_disaster():
    """
    模拟灾害目标检测
    生产环境：接收图片 → YOLO推理 → 返回bbox
    当前：返回模拟检测结果
    """
    detections = [
        DetectionResult(
            label="fire_smoke",
            confidence=round(random.uniform(0.85, 0.98), 2),
            bbox=[
                round(random.uniform(0.1, 0.4), 3),
                round(random.uniform(0.1, 0.4), 3),
                round(random.uniform(0.5, 0.9), 3),
                round(random.uniform(0.5, 0.9), 3),
            ],
        ),
        DetectionResult(
            label="flood_area",
            confidence=round(random.uniform(0.7, 0.95), 2),
            bbox=[
                round(random.uniform(0.0, 0.3), 3),
                round(random.uniform(0.3, 0.5), 3),
                round(random.uniform(0.4, 0.7), 3),
                round(random.uniform(0.7, 1.0), 3),
            ],
        ),
    ]
    return {"detections": [d.model_dump() for d in detections]}

import math

@router.get("/forecast/hydrology")
async def get_simulated_hydrology(hours: int = 72):
    """
    流体力学伪真实后仿真接口 (Hydrology Simulation)
    基于正弦激荡（降水）和马尔科夫滞后演进（水位）来生成严谨逼真的 72 小时物理演变曲线
    """
    points = []
    base_time = datetime.now()
    
    current_water_level = 42.0 # 长江泸州段警戒线通常在 15米涨幅左右，基准海拔假设42m
    accumulated_runoff = 0.0

    for i in range(hours):
        t = base_time + timedelta(hours=i)
        
        # 1. 降雨量模拟：使用多重正弦波干涉+偏置，模拟出午夜/凌晨易出现极端暴雨的特性
        hour_rad = (t.hour / 24.0) * math.pi * 2
        rain_pulse = max(0, math.sin(hour_rad - 1.5) * 20 + math.sin(hour_rad * 3) * 10 + 5)
        # 加入突发暴雨噪声
        if 8 < i < 18:
            rain_pulse += random.uniform(10, 45)
        elif 30 < i < 40:
            rain_pulse += random.uniform(5, 25)
            
        precipitation = round(max(0, rain_pulse), 1)
        
        # 2. 水位滞后反射模拟：基于当前地表径流(accumulated_runoff)缓慢补给到干流
        # 地表径流吸收降雨
        accumulated_runoff += precipitation * 0.4
        
        # 径流转换为水位的涨幅（存在滞后与缓慢流失）
        water_increase = accumulated_runoff * 0.05
        accumulated_runoff *= 0.85 # 流失到下游
        
        # 水位存在自身的潮汐/震荡回落
        current_water_level += water_increase - 0.25
        # 保底水位
        current_water_level = max(41.5, current_water_level)
        
        points.append({
            "time": t.strftime("%m/%d %H:00"),
            "precipitation": precipitation,
            "waterLevel": round(current_water_level, 2)
        })
        
    return {"forecast": points}
