# AGENTS.md — 龙刃归鞘 (longren-guixiao-demo)

## 验证命令（改动代码后必须运行）

- 类型检查：`npm run typecheck`
- Lint：`npm run lint`（可自动修：`npm run lint:fix`）
- 格式化：`npm run format`（检查：`npm run format:check`）
- 测试：`npm test`（watch：`npm run test:watch`）
- 开发服务器：`npm run dev`（http://127.0.0.1:5173/）

完成任何任务后，依次跑 `npm run lint && npm run typecheck && npm test`，三者全绿方可声明完成。

## 技术栈

- Phaser 3.90 + TypeScript（strict）+ Vite 6
- 测试：vitest（globals 已开，无需 import describe/expect/it）
- Lint：ESLint v10 flat config + typescript-eslint + eslint-config-prettier
- 格式化：Prettier（见 .prettierrc.json）

## 代码风格

- 用 `import type` 导入纯类型
- 未用参数以 `_` 前缀豁免
- 美术/音频全部代码生成（无外部资源目录）
- 战斗系统为纯函数（CombatSystem），敌方继承 CombatActor 抽象基类
