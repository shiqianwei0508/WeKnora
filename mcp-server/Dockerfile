FROM harbor.gbim.vip/dockerio/python:3.11-slim

WORKDIR /app

# 使用国内 Debian 源与 PyPI 镜像
RUN sed -i "s@http://deb.debian.org@http://mirrors.aliyun.com@g" /etc/apt/sources.list.d/debian.sources && \
    sed -i "s@http://security.debian.org@http://mirrors.aliyun.com@g" /etc/apt/sources.list.d/debian.sources && \
    pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ && \
    pip config set global.trusted-host mirrors.aliyun.com

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN pip install --no-cache-dir -e .

ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=8000
ENV WEKNORA_BASE_URL=http://app:8080/api/v1
# Set MCP_SERVER_AUTH_TOKEN at runtime; HTTP transport refuses to start without it.

EXPOSE 8000

CMD ["weknora-mcp-server", "--transport", "http", "--host", "0.0.0.0", "--port", "8000"]
