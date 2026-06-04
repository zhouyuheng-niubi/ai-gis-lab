"""
灾害推演引擎服务
洪水淹没推演、火线蔓延模拟
"""
import math
import random
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class FloodRequest(BaseModel):
    bbox: list[float]  # [min_lng, min_lat, max_lng, max_lat]
    rainfall_intensity: float = 30.0  # mm/h
    duration_hours: int = 24
    time_steps: int = 12


class FireRequest(BaseModel):
    origin_lng: float
    origin_lat: float
    wind_speed: float = 8.0  # m/s
    wind_direction: float = 225.0  # degrees (from south-west)
    duration_hours: int = 12
    time_steps: int = 8


@router.post("/flood")
async def simulate_flood(req: FloodRequest):
    """
    模拟洪水淹没推演
    返回每个时间步的淹没多边形 GeoJSON 序列
    
    生产环境：使用 PINN/降阶模型 + DEM 高程栅格计算真实水面。
    当前：基于几何扩展模拟。
    """
    center_lng = (req.bbox[0] + req.bbox[2]) / 2
    center_lat = (req.bbox[1] + req.bbox[3]) / 2
    max_radius_lng = (req.bbox[2] - req.bbox[0]) / 2
    max_radius_lat = (req.bbox[3] - req.bbox[1]) / 2

    time_series = []
    for step in range(req.time_steps):
        t = step / max(req.time_steps - 1, 1)
        # Non-linear growth curve (slow start, rapid mid, plateau end)
        growth = 1 - math.exp(-3 * t)

        # Generate irregular flood polygon
        radius_lng = max_radius_lng * growth * random.uniform(0.85, 1.0)
        radius_lat = max_radius_lat * growth * random.uniform(0.85, 1.0)
        
        n_points = 24
        polygon = []
        for i in range(n_points):
            angle = 2 * math.pi * i / n_points
            # Add irregularity
            r_factor = 1.0 + random.uniform(-0.15, 0.15)
            lng = center_lng + radius_lng * math.cos(angle) * r_factor
            lat = center_lat + radius_lat * math.sin(angle) * r_factor
            polygon.append([round(lng, 6), round(lat, 6)])
        polygon.append(polygon[0])  # close ring

        water_level = 1520 + growth * req.rainfall_intensity * 0.3
        hours = round(t * req.duration_hours, 1)
        area_km2 = round(
            math.pi * radius_lng * 111 * radius_lat * 111 * growth ** 2, 2
        )

        time_series.append({
            "step": step,
            "time_label": f"T+{hours}h",
            "water_level_m": round(water_level, 2),
            "area_km2": area_km2,
            "affected_population": int(area_km2 * random.uniform(800, 2500)),
            "polygon": {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [polygon],
                },
                "properties": {
                    "water_level": round(water_level, 2),
                    "step": step,
                },
            },
        })

    return {
        "simulation_type": "flood",
        "center": [center_lng, center_lat],
        "duration_hours": req.duration_hours,
        "time_steps": req.time_steps,
        "series": time_series,
    }


@router.post("/fire")
async def simulate_fire(req: FireRequest):
    """
    模拟火线蔓延推演
    返回时间序列火线/烧灼区域多边形
    """
    wind_rad = math.radians(req.wind_direction)
    # Downwind direction vector
    dx = math.sin(wind_rad)
    dy = math.cos(wind_rad)

    time_series = []
    for step in range(req.time_steps):
        t = step / max(req.time_steps - 1, 1)
        growth = 1 - math.exp(-2.5 * t)

        # Fire spread is elongated in wind direction
        spread_downwind = growth * 0.02 * (1 + req.wind_speed * 0.1)
        spread_crosswind = growth * 0.008

        n_points = 20
        polygon = []
        for i in range(n_points):
            angle = 2 * math.pi * i / n_points
            # Elongate in wind direction
            r_downwind = spread_downwind * (0.6 + 0.4 * max(0, math.cos(angle)))
            r_cross = spread_crosswind
            r = math.sqrt(
                (r_downwind * math.cos(angle)) ** 2
                + (r_cross * math.sin(angle)) ** 2
            )
            r *= random.uniform(0.9, 1.1)
            
            # Offset center downwind over time
            shift = growth * spread_downwind * 0.5
            cx = req.origin_lng + shift * dx
            cy = req.origin_lat + shift * dy
            
            lng = cx + r * math.cos(angle)
            lat = cy + r * math.sin(angle)
            polygon.append([round(lng, 6), round(lat, 6)])
        polygon.append(polygon[0])

        hours = round(t * req.duration_hours, 1)
        area = round(math.pi * spread_downwind * spread_crosswind * 111 * 111, 2)

        time_series.append({
            "step": step,
            "time_label": f"T+{hours}h",
            "area_km2": area,
            "fireline_length_km": round(area * 0.8 + random.uniform(0.1, 0.5), 2),
            "polygon": {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [polygon],
                },
            },
        })

    return {
        "simulation_type": "fire",
        "origin": [req.origin_lng, req.origin_lat],
        "wind": {"speed": req.wind_speed, "direction": req.wind_direction},
        "series": time_series,
    }
