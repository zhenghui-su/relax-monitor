# Relax Performance Monitor SDK

一个轻量级的前端性能监控 SDK，用于采集页面渲染、用户交互、视觉稳定性以及资源与网络请求相关的性能指标。

相关文档：

- 仓库总览见 [README.md](/Users/suzhenghui/Desktop/IWantTo/study/@relax/monitor/README.md)
- 错误监控见 [packages/error/README.md](/Users/suzhenghui/Desktop/IWantTo/study/@relax/monitor/packages/error/README.md)
- 用户行为监控见 [packages/behavior/README.md](/Users/suzhenghui/Desktop/IWantTo/study/@relax/monitor/packages/behavior/README.md)

## 功能特性

- **页面渲染指标**: 采集 `FP`、`FCP`、`LCP`、`load/pageshow`。
- **交互响应指标**: 采集 `FID`、`INP`、`Long Task`。
- **视觉稳定性指标**: 采集 `CLS` 以及导致偏移的元素信息。
- **资源加载性能**: 采集静态资源加载耗时、协议、大小、TTFB 等数据。
- **接口请求性能**: 采集 `fetch` / `XMLHttpRequest` 请求耗时、DNS、TCP、TTFB 等数据。
- **SPA 场景支持**: 路由切换时自动结算并上报 CLS。
- **数据上报**: 优先使用 `navigator.sendBeacon`，不支持时降级为 `fetch + keepalive`。

## 安装

```bash
npm install @relaxwork/performance-monitor
```

## 使用方法

```ts
import PerformanceMonitor from '@relaxwork/performance-monitor';

const monitor = new PerformanceMonitor({
	reportUrl: 'https://your-monitoring-server.com/api/performance-report',
	log: true,
});

monitor.init();
```

默认配置：

- `reportUrl`: `/api/performance`
- `log`: `true`

## 配置项

`new PerformanceMonitor(options)` 支持以下配置：

| 属性名 | 类型 | 说明 |
| --- | --- | --- |
| `reportUrl` | `string` | 性能数据上报地址 |
| `log` | `boolean` | 是否输出调试日志，目前主要用于 CLS 调试 |

## 采集指标说明

### 1. 页面加载与渲染

| 指标 | 说明 |
| --- | --- |
| `FP` | First Paint，首次绘制时间 |
| `FCP` | First Contentful Paint，首次内容绘制时间 |
| `LCP` | Largest Contentful Paint，最大内容绘制时间 |
| `load` | 页面加载完成相关事件耗时 |

LCP 上报时会额外包含：

- `lcpTime`
- `elementSelector`
- `pageUrl`

## 2. 交互响应

| 指标 | 说明 |
| --- | --- |
| `FID` | First Input Delay，首次输入延迟 |
| `INP` | Interaction to Next Paint，交互到下一次绘制的延迟 |
| `Long Task` | 长任务耗时，帮助定位主线程阻塞 |

INP 上报时会包含：

- `inputDelay`
- `processingTime`
- `presentationDelay`
- `interactionId`

Long Task 上报时会包含：

- `duration`
- `attribution`
- `pageUrl`

## 3. 视觉稳定性

SDK 会监听 `layout-shift`，累计 CLS 值，并记录触发布局偏移的 DOM 元素选择器。

CLS 上报时会包含：

- `clsValue`
- `clsEntries`
- `isFinal`
- `pageUrl`

在以下时机会触发最终 CLS 上报：

- 页面隐藏
- 页面关闭
- SPA 路由切换

## 4. 资源与网络

### 静态资源性能

SDK 会采集除 `fetch` / `XMLHttpRequest` / 上报接口自身 / `beacon` 之外的资源加载性能，包括：

- `duration`
- `dns`
- `tcp`
- `redirect`
- `ttfb`
- `protocol`
- `transferSize`
- `resourceSize`

### 接口请求性能

SDK 会采集 `fetch` 和 `XMLHttpRequest` 的请求性能，包括：

- `duration`
- `dns`
- `tcp`
- `ttfb`
- `transferSize`
- `pageUrl`

## 上报数据示例

LCP：

```json
{
	"type": "performance",
	"name": "largest-contentful-paint",
	"pageUrl": "http://localhost:3000/test/index.html",
	"lcpTime": 1240.5,
	"elementSelector": "img.hero-banner",
	"startTime": 1240.5
}
```

INP：

```json
{
	"type": "performance",
	"subType": "interaction",
	"name": "click",
	"duration": 86.4,
	"inputDelay": 22.1,
	"processingTime": 30.2,
	"presentationDelay": 34.1,
	"interactionId": 1234,
	"pageUrl": "http://localhost:3000/test/index.html"
}
```

资源请求：

```json
{
	"name": "http://localhost:3000/api/delay/300",
	"type": "performance",
	"subType": "resource",
	"sourceType": "fetch",
	"duration": 315.7,
	"dns": 0.4,
	"tcp": 1.2,
	"ttfb": 302.5,
	"transferSize": 540,
	"pageUrl": "http://localhost:3000/test/index.html"
}
```

## 本地开发

1. 安装依赖

```bash
pnpm install
```

2. 构建性能监控 SDK

```bash
pnpm --filter @relaxwork/performance-monitor build
```

3. 启动本地测试服务

```bash
pnpm --filter @relaxwork/performance-monitor demo
```

4. 在浏览器中打开 `http://localhost:3000/test/index.html`

测试页位于 [packages/performance/test/index.html](/Users/suzhenghui/Desktop/IWantTo/study/@relax/monitor/packages/performance/test/index.html)，可手动触发：

- 交互事件
- 长任务
- 网络请求
- CLS 布局偏移
- SPA 路由切换

## License

MIT
