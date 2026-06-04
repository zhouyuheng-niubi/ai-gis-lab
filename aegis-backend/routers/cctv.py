"""
RTSP -> HLS relay router.
Uses FFmpeg to transcode LAN RTSP streams into HLS (.m3u8) for browser playback.

Camera RTSP URLs are read from the AEGIS_CCTV_CAMERAS env var (JSON array) when
available; otherwise falls back to built-in defaults.
"""
import os
import json
import subprocess
import signal
import logging
from fastapi import APIRouter

logger = logging.getLogger("aegis.cctv")

router = APIRouter()

_DEFAULT_CAMERAS = [
    {
        "id": "cam-01",
        "name": "户外休息区",
        "rtsp": "rtsp://admin:admin123@10.0.0.1/cam/realmonitor?channel=6&subtype=0",
    },
    {
        "id": "cam-02",
        "name": "机房外",
        "rtsp": "rtsp://admin:admin123@10.0.0.1/cam/realmonitor?channel=8&subtype=0",
    },
    {
        "id": "cam-03",
        "name": "5会议室",
        "rtsp": "rtsp://admin:scylh@258@10.0.0.1:554/Streaming/channels/101",
    },
]


def _load_cameras() -> list[dict]:
    env = os.getenv("AEGIS_CCTV_CAMERAS")
    if env:
        try:
            return json.loads(env)
        except json.JSONDecodeError:
            logger.warning("AEGIS_CCTV_CAMERAS env is not valid JSON, using defaults")
    return _DEFAULT_CAMERAS


CAMERAS = _load_cameras()
HLS_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "hls_output")
ffmpeg_processes: dict[str, subprocess.Popen] = {}


def start_ffmpeg_relay(cam: dict):
    cam_dir = os.path.join(HLS_OUTPUT_DIR, cam["id"])
    os.makedirs(cam_dir, exist_ok=True)

    output_path = os.path.join(cam_dir, "stream.m3u8")

    cmd = [
        "ffmpeg",
        "-rtsp_transport", "tcp",
        "-i", cam["rtsp"],
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-tune", "zerolatency",
        "-g", "30",
        "-sc_threshold", "0",
        "-f", "hls",
        "-hls_time", "2",
        "-hls_list_size", "3",
        "-hls_flags", "delete_segments+append_list",
        "-hls_segment_filename", os.path.join(cam_dir, "seg_%03d.ts"),
        "-an",
        "-s", "640x360",
        "-y",
        output_path,
    ]

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        preexec_fn=os.setsid,
    )
    ffmpeg_processes[cam["id"]] = proc
    logger.info("Started FFmpeg for %s (pid %d)", cam["id"], proc.pid)
    return proc.pid


@router.get("/cameras")
async def list_cameras():
    result = []
    for cam in CAMERAS:
        result.append({
            "id": cam["id"],
            "name": cam["name"],
            "hls_url": f"/api/cctv/hls/{cam['id']}/stream.m3u8",
            "online": cam["id"] in ffmpeg_processes and ffmpeg_processes[cam["id"]].poll() is None,
        })
    return result


@router.post("/start")
async def start_all_streams():
    started = []
    for cam in CAMERAS:
        if cam["id"] in ffmpeg_processes and ffmpeg_processes[cam["id"]].poll() is None:
            started.append({"id": cam["id"], "status": "already_running"})
            continue
        try:
            pid = start_ffmpeg_relay(cam)
            started.append({"id": cam["id"], "name": cam["name"], "status": "started", "pid": pid})
        except Exception as e:
            logger.exception("Failed to start FFmpeg for %s", cam["id"])
            started.append({"id": cam["id"], "status": "error", "error": str(e)})
    return {"streams": started}


@router.post("/stop")
async def stop_all_streams():
    stopped = []
    for cam_id, proc in list(ffmpeg_processes.items()):
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            stopped.append(cam_id)
        except Exception:
            pass
    ffmpeg_processes.clear()
    logger.info("Stopped streams: %s", stopped)
    return {"stopped": stopped}
