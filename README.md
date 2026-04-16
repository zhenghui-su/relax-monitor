# @relaxwork/monitor

一个面向前端场景的轻量监控 SDK 集合仓库。

当前仓库采用 `pnpm workspace` 管理多个独立 SDK。目前已经完成：

- `@relaxwork/error-monitor`
- `@relaxwork/behavior-monitor`
- `@relaxwork/performance-monitor`

## 当前进度

| SDK | 包名 | 状态 | 说明 |
| --- | --- | --- | --- |
| Error Monitor | `@relaxwork/error-monitor` | 已完成 | 采集运行时错误、Promise 异常、网络异常、资源加载异常 |
| Behavior Monitor | `@relaxwork/behavior-monitor` | 已完成 | 采集 UV、PV、点击行为、页面停留时长、SPA 路由行为 |
| Performance Monitor | `@relaxwork/performance-monitor` | 已完成 | 采集 FP、FCP、LCP、FID、INP、CLS、Long Task、资源与请求性能 |

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

### `@relaxwork/behavior-monitor`

用户行为监控 SDK，适用于浏览器端项目。

支持能力：

- 自动生成并持久化用户标识
- 自动上报当日 UV
- 自动上报 PV
- 监听带 `data-track-click` 的点击行为
- 上报页面停留时长
- 监听 SPA 路由切换
- 支持 `sendBeacon` / `fetch` 上报

包内详细文档见 [packages/behavior/README.md](/Users/suzhenghui/Desktop/IWantTo/study/@relax/monitor/packages/behavior/README.md)。

### `@relaxwork/performance-monitor`

性能监控 SDK，适用于浏览器端项目。

支持能力：

- 采集 `FP`、`FCP`、`LCP`、`load`
- 采集 `FID`、`INP`、`Long Task`
- 采集 `CLS` 及偏移来源元素
- 采集静态资源加载性能
- 采集 `fetch` / `XMLHttpRequest` 请求性能
- 支持 SPA 路由切换时结算 CLS
- 支持 `sendBeacon` / `fetch` 上报

包内详细文档见 [packages/performance/README.md](/Users/suzhenghui/Desktop/IWantTo/study/@relax/monitor/packages/performance/README.md)。

## 快速开始

安装当前已发布的监控包：

```bash
npm install @relaxwork/error-monitor @relaxwork/behavior-monitor @relaxwork/performance-monitor
```

错误监控基础用法：

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

错误监控忽略指定网络请求示例：

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

行为监控基础用法：

```ts
import { initUserBehaviorMonitor } from '@relaxwork/behavior-monitor';

initUserBehaviorMonitor({
	reportUrl: 'https://your-domain.com/api/behavior-report',
	projectName: 'your-project-name',
});
```

点击埋点示例：

```html
<button data-track-click="add_to_cart">加入购物车</button>
<button data-track-click="play_video">播放视频</button>
```

性能监控基础用法：

```ts
import PerformanceMonitor from '@relaxwork/performance-monitor';

const monitor = new PerformanceMonitor({
	reportUrl: 'https://your-domain.com/api/performance-report',
	log: true,
});

monitor.init();
```

## 仓库结构

```text
.
├── package.json
├── pnpm-workspace.yaml
└── packages
    ├── behavior
    │   ├── src
    │   ├── test
    │   └── README.md
    ├── error
    │   ├── src
    │   ├── test
    │   └── README.md
    └── performance
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

构建行为监控 SDK：

```bash
pnpm behavior:build
```

构建性能监控 SDK：

```bash
pnpm performance:build
```

构建全部 SDK：

```bash
pnpm build
```

进入包目录单独开发：

```bash
cd packages/error
pnpm build
pnpm dev
pnpm demo
```

或进入行为监控包目录：

```bash
cd packages/behavior
pnpm build
pnpm dev
pnpm demo
```

或进入性能监控包目录：

```bash
cd packages/performance
pnpm build
pnpm dev
pnpm demo
```

## 设计目标

- 保持 SDK 体积轻量
- 提供尽可能低侵入的接入方式
- 支持按模块拆分发布
- 支持错误、行为、性能能力按需组合

## License

MIT
