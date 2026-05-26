# 🔨 Anvil

> AI Agent Workbench — 为中国开发者优化的本地 AI 编程工作台

**状态**：v0.0.1（hello world 阶段）
**仓库**：private

## 是什么

让用户不需要终端就能使用 Claude Code 的 harness 能力，原生支持任意 LLM Provider（Anthropic / DeepSeek / MiMo / 月之暗面 / 智谱 / 中转站）。

## 为什么做

国内开发者用 `npm install -g @anthropic-ai/claude-code` + DeepSeek 配置，被迫使用 PowerShell/Terminal 才能用上 AI 编程能力。Anvil 把这套体验装进图形界面。

## 技术栈

- Electron 38
- React 19 + Vite 8 + TypeScript 5
- @anthropic-ai/claude-agent-sdk（官方底座）
- Monaco editor / Zustand / electron-store

## 开发

```bash
cd app
npm install
npm run dev
```

首次启动后在 Settings 里填：
- Base URL（例如 `https://token-plan-cn.xiaomimimo.com/anthropic`）
- API Key
- Model（例如 `mimo-v2.5-pro`）

点保存后即可使用。

## 项目结构

```
anvil/
├── .trellis/         开发工作流（多 AI 协作 spec + task）
├── .claude/          Claude Code 子 agent 配置
├── .codex/           Codex skill 配置
├── .gemini/          Gemini CLI 配置
├── app/              Electron 应用代码
│   ├── electron/
│   │   ├── main/         主进程（含 IPC + Settings）
│   │   └── preload/      preload script
│   └── src/              React 渲染进程
└── README.md
```

## License

待定（候选 Apache 2.0）
