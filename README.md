# @relaxwork/monitor

一个面向前端场景的轻量监控 SDK 集合仓库。

当前仓库采用 `pnpm workspace` 管理多个独立 SDK。现阶段只完成了错误监控模块，后续会继续补充其他监控能力。

## 当前进度

| SDK | 包名 | 状态 | 说明 |
| --- | --- | --- | --- |
| Error Monitor | `@relaxwork/error-monitor` | 已完成 | 采集运行时错误、Promise 异常、网络异常、资源加载异常 |
| Behavior Monitor | `@relaxwork/behavior-monitor` | 规划中 | 采集用户行为埋点、点击、曝光、页面访问等行为数据 |
| Performance Monitor | `@relaxwork/performance-monitor` | 规划中 | 采集首屏、资源加载、导航耗时、Web Vitals 等性能指标 |

## 已完成模块

### `@relaxwork/error-monitor`

错误监控 SDK，适用于浏览器端项目。

支持能力：

- JavaScript 运行时错误捕获
- 未处理的 Promise 拒绝捕获
- `XMLHttpRequest` / `fetch` 网络异常监控
- 图片、脚本等静态资源加载失败监控
- 支持通过 `ignoreNetworkErrors` 忽略指定请求地址
- 错误信息上报
- Vue 3 插件接入
- React Error Boundary 接入

包内详细文档见 [packages/error/README.md](/Users/suzhenghui/Desktop/IWantTo/study/@relax/monitor/packages/error/README.md)。

## 快速开始

安装当前已发布的错误监控包：

```bash
npm install @relaxwork/error-monitor
```

基础用法：

```ts
import { initErrorMonitor } from '@relaxwork/error-monitor';

initErrorMonitor({
	reportUrl: 'https://your-domain.com/api/error-report',
	projectName: 'your-project-name',
	environment: 'production',
	networkConfig: {
		ignoreNetworkErrors: ['/health', '/metrics'],
	},
});
```

忽略指定网络请求示例：

```ts
initErrorMonitor({
	reportUrl: 'https://your-domain.com/api/error-report',
	projectName: 'your-project-name',
	environment: 'production',
	networkConfig: {
		ignoreNetworkErrors: ['/health', '/metrics', '/log/report'],
	},
});
```

## 后续规划

除了当前已完成的错误监控，仓库后续还会继续补充两个监控 SDK：

- `behavior`：用于用户行为埋点，覆盖页面访问、按钮点击、模块曝光、自定义事件等场景。
- `performance`：用于前端性能监控，覆盖页面加载、资源耗时、接口耗时以及关键性能指标采集。

## 仓库结构

```text
.
├── package.json
├── pnpm-workspace.yaml
└── packages
    └── error
        ├── src
        ├── test
        └── README.md
```

## 本地开发

安装依赖：

```bash
pnpm install
```

构建错误监控 SDK：

```bash
pnpm error:build
```

进入包目录单独开发：

```bash
cd packages/error
pnpm build
pnpm dev
pnpm demo
```

## 设计目标

- 保持 SDK 体积轻量
- 提供尽可能低侵入的接入方式
- 支持按模块拆分发布
- 方便后续扩展性能监控、行为监控等能力

## License

MIT
