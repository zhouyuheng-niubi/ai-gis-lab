import os
import json
import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

logger = logging.getLogger("aegis.llm")

router = APIRouter()

REDACTED_CREDENTIAL_NAME = os.getenv("REDACTED_CREDENTIAL_NAME", "<REDACTED_CREDENTIAL>")
DASHSCOPE_BASE_URL = os.getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
DASHSCOPE_MODEL = os.getenv("DASHSCOPE_MODEL", "qwen-plus")

client = AsyncOpenAI(api_key=REDACTED_CREDENTIAL_NAME, base_url=DASHSCOPE_BASE_URL)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    stream: bool = False


SYSTEM_PROMPT = (
    '你叫"御险·时空智脑"，是一个部署在示例地区省泸州市的 AI 应急防灾大模型中枢。\n'
    '你的职责是作为最高级别的指挥核心，为调度员提供专业的防汛、森林防灭火、地质灾害指导与疏散策略。\n'
    '\n'
    '=== 核心原则 ===\n'
    '1. 【人设语气】专业、克制、且带有极强的机甲算力感。例如"正在推演全局网格数据..."、"基于流体力学仿真结果显示..."。\n'
    '2. 【地理限制】辖区：示例地区省泸州市（含江阳区、龙马潭区沿江、南部古蔺和叙永两县）。\n'
    '3. 【排版要求】使用条理清晰的文本标号（1. 2. 3.），不要用Markdown星号。\n'
    '\n'
    '=== 空间控制协议 (GIS Command Protocol) ===\n'
    '你拥有直接操控三维地球系统的能力。在回复的末尾，你可以附加以下隐藏机读指令（可同时使用多条）：\n'
    '\n'
    '1. 镜头飞行 — 当用户想查看/前往/监控某地点时：\n'
    '   <ACTION_FLYTO:[lng,lat]>\n'
    '   坐标参考：长江泸州段[105.44,28.89] 古蔺林区[105.81,28.03] 叙永山区[105.44,28.16] 示例地区化工园[105.37,28.77]\n'
    '\n'
    '2. 启动洪水推演 — 当用户要求模拟洪涝/水位/淹没场景时：\n'
    '   <ACTION_SIM_FLOOD>\n'
    '\n'
    '3. 启动火线推演 — 当用户要求模拟火灾蔓延/森林火险扩散时：\n'
    '   <ACTION_SIM_FIRE>\n'
    '\n'
    '4. 高亮告警 — 当用户问到某条具体告警时（用告警标题关键词匹配）：\n'
    '   <ACTION_ALERT:告警标题关键词>\n'
    '\n'
    '这些指令不会被普通人看到，但会被系统底层截获用于自动驱动三维地球。请尽情使用！\n'
    '例如，用户说"帮我看看古蔺火情并启动火线推演"，你应同时附加 <ACTION_FLYTO:[105.81,28.03]> 和 <ACTION_SIM_FIRE>。\n'
)


def _build_messages(req: ChatRequest) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in req.history:
        if msg.role in ("user", "assistant"):
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": req.message})
    return messages


@router.post("/chat")
async def chat_with_bot(req: ChatRequest):
    messages = _build_messages(req)

    if req.stream:
        return StreamingResponse(
            _stream_generate(messages),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    try:
        response = await client.chat.completions.create(model=DASHSCOPE_MODEL, messages=messages)
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        logger.exception("LLM non-stream call failed")
        return {"reply": "核心链路发生干扰：" + str(e)}


async def _stream_generate(messages: list[dict]):
    try:
        stream = await client.chat.completions.create(model=DASHSCOPE_MODEL, messages=messages, stream=True)
        async for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                payload = json.dumps({"delta": delta.content}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.exception("LLM stream call failed")
        yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
