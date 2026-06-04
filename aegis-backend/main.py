import logging
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from routers import weather, disaster, simulation, llm, cctv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

app = FastAPI(
    title="御险·时空智脑 API",
    description="Aegis-Geo Spatiotemporal AI Emergency Backend",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])
app.include_router(disaster.router, prefix="/api/disaster", tags=["Disaster"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["Simulation"])
app.include_router(llm.router, prefix="/api/llm", tags=["LLM Assistant"])
app.include_router(cctv.router, prefix="/api/cctv", tags=["CCTV Surveillance"])

# Mount HLS output directory for streaming segments
hls_output_dir = os.path.join(os.path.dirname(__file__), "hls_output")
os.makedirs(hls_output_dir, exist_ok=True)
app.mount("/api/cctv/hls", StaticFiles(directory=hls_output_dir), name="hls_streams")


@app.get("/api/health")
async def health():
    return {"status": "online", "platform": "御险·时空智脑"}

# Serve frontend static files
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "aegis-geo-platform", "dist")

if os.path.isdir(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    app.mount("/cesium", StaticFiles(directory=os.path.join(frontend_dist, "cesium")), name="cesium")
    app.mount("/videos", StaticFiles(directory=os.path.join(frontend_dist, "videos")), name="videos")
    
    # Catch-all for SPA React Routing
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/")
    async def index_fallback():
        return {"message": "API is running. Please 'npm run build' the frontend so the static dist folder is mounted here."}
