"""
彩云天气 API 对接路由
文档: https://docs.caiyunapp.com/
当 API Token 不可用时，自动降级为模拟数据
"""
import os
import math
import random
from datetime import datetime, timedelta
import httpx
from fastapi import APIRouter, Query

router = APIRouter()

CAIYUN_BASE = "https://api.caiyunapp.com/v2.6"
CAIYUN_TOKEN = <REDACTED_CREDENTIAL>

SKYCON_DESC = {
    "CLEAR_DAY": "☀️ 晴",
    "CLEAR_NIGHT": "🌙 晴",
    "PARTLY_CLOUDY_DAY": "⛅ 多云",
    "PARTLY_CLOUDY_NIGHT": "☁️ 多云",
    "CLOUDY": "☁️ 阴",
    "LIGHT_RAIN": "🌧️ 小雨",
    "MODERATE_RAIN": "🌧️ 中雨",
    "HEAVY_RAIN": "🌧️ 大雨",
    "STORM_RAIN": "⛈️ 暴雨",
    "LIGHT_SNOW": "🌨️ 小雪",
    "FOG": "🌫️ 雾",
    "WIND": "🌬️ 大风",
}


def _wind_dir(deg: float) -> str:
    dirs = ["北风", "东北风", "东风", "东南风", "南风", "西南风", "西风", "西北风"]
    idx = round(deg / 45) % 8
    return dirs[idx]


def _generate_mock_realtime():
    """生成逼真的模拟实时天气（泸州春季典型气象）"""
    hour = datetime.now().hour
    base_temp = 15 + 5 * math.sin((hour - 6) * math.pi / 12)
    temp = round(base_temp + random.uniform(-1.5, 1.5), 1)

    if random.random() < 0.6:
        skycon = random.choice(["MODERATE_RAIN", "LIGHT_RAIN", "HEAVY_RAIN", "CLOUDY"])
    else:
        skycon = random.choice(["PARTLY_CLOUDY_DAY", "CLOUDY", "CLEAR_DAY"])

    precip = 0
    if "RAIN" in skycon:
        if "HEAVY" in skycon:
            precip = round(random.uniform(12, 28), 1)
        elif "MODERATE" in skycon:
            precip = round(random.uniform(4, 12), 1)
        else:
            precip = round(random.uniform(0.5, 4), 1)

    return {
        "temperature": temp,
        "humidity": round(random.uniform(65, 92), 1),
        "windSpeed": round(random.uniform(2, 15), 1),
        "windDirection": _wind_dir(random.uniform(0, 360)),
        "precipitation": precip,
        "pressure": round(random.uniform(980, 1020), 1),
        "skycon": skycon,
        "description": SKYCON_DESC.get(skycon, skycon),
        "source": "mock",
    }


def _generate_mock_forecast(hours: int = 72):
    """生成72小时逐小时模拟预测"""
    points = []
    now = datetime.now()
    base_water = 42.5
    cumulative_rain = 0

    for i in range(hours):
        t = now + timedelta(hours=i)
        h = t.hour

        base_rain = max(0, 8 * math.sin((h - 3) * math.pi / 8)) + max(
            0, 5 * math.sin((h - 15) * math.pi / 6)
        )
        if 18 <= i <= 30 and random.random() < 0.4:
            base_rain += random.uniform(15, 40)
        rain = max(0, round(base_rain + random.uniform(-3, 5), 1))

        cumulative_rain = cumulative_rain * 0.92 + rain * 0.08
        water = round(base_water + cumulative_rain * 0.6 + math.sin(i * 0.2) * 0.3, 2)

        points.append(
            {
                "time": t.strftime("%m/%d %H:00"),
                "precipitation": rain,
                "waterLevel": water,
            }
        )

    return points


@router.get("/realtime")
async def get_realtime_weather(
    lng: float = Query(..., description="经度"),
    lat: float = Query(..., description="纬度"),
):
    """获取指定坐标的实时天气（优先尝试彩云API，失败时降级为模拟数据）"""
    url = f"{CAIYUN_BASE}/{CAIYUN_TOKEN}/{lng},{lat}/realtime"

    try:
        async with httpx.AsyncClient(timeout=8) as http:
            resp = await http.get(url)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "ok":
            raise ValueError("API returned non-ok status")

        result = data.get("result", {}).get("realtime", {})
        wind = result.get("wind", {})
        precip = result.get("precipitation", {}).get("local", {})
        skycon = result.get("skycon", "CLOUDY")

        return {
            "temperature": result.get("temperature", 0),
            "humidity": round(result.get("humidity", 0) * 100, 1),
            "windSpeed": wind.get("speed", 0),
            "windDirection": _wind_dir(wind.get("direction", 0)),
            "precipitation": precip.get("intensity", 0),
            "pressure": round(result.get("pressure", 0) / 100, 1),
            "skycon": skycon,
            "description": SKYCON_DESC.get(skycon, skycon),
            "source": "caiyun",
        }
    except Exception:
        return _generate_mock_realtime()


@router.get("/forecast")
async def get_forecast(
    lng: float = Query(..., description="经度"),
    lat: float = Query(..., description="纬度"),
):
    """获取72小时逐小时降雨预测（优先尝试彩云API，失败时降级为模拟数据）"""
    url = f"{CAIYUN_BASE}/{CAIYUN_TOKEN}/{lng},{lat}/hourly?hourlysteps=72"

    try:
        async with httpx.AsyncClient(timeout=8) as http:
            resp = await http.get(url)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "ok":
            raise ValueError("API returned non-ok status")

        hourly = data.get("result", {}).get("hourly", {})
        precip_list = hourly.get("precipitation", [])

        points = []
        base_water = 42.5
        for i, item in enumerate(precip_list):
            dt = item.get("datetime", "")
            intensity = item.get("value", 0)
            water_delta = sum(
                p.get("value", 0) * 0.05 for p in precip_list[max(0, i - 6) : i + 1]
            )
            water_level = round(base_water + water_delta, 2)
            points.append(
                {
                    "time": dt,
                    "precipitation": round(intensity, 2),
                    "waterLevel": water_level,
                }
            )

        return {"points": points, "source": "caiyun"}
    except Exception:
        return {"points": _generate_mock_forecast(), "source": "mock"}
