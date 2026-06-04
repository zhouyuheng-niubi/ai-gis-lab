import asyncio
from openai import AsyncOpenAI
client = AsyncOpenAI(api_key="<REDACTED_CREDENTIAL>", base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")
async def main():
    try:
        response = await client.chat.completions.create(
            model="qwen-plus",
            messages=[{"role": "user", "content": "你好"}]
        )
        print(response.choices[0].message.content)
    except Exception as e:
        print("ERROR:", e)
asyncio.run(main())
