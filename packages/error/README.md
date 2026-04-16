# Relax Error Monitor SDK

一个轻量级的前端错误监控 SDK，可以捕获 JavaScript 错误、Promise 异常、网络请求错误以及资源加载错误。

相关文档：

- 仓库总览见 [README.md](/Users/suzhenghui/Desktop/IWantTo/study/@relax/monitor/README.md)
- 用户行为监控见 [packages/behavior/README.md](/Users/suzhenghui/Desktop/IWantTo/study/@relax/monitor/packages/behavior/README.md)
- 性能监控见 [packages/performance/README.md](/Users/suzhenghui/Desktop/IWantTo/study/@relax/monitor/packages/performance/README.md)

## 功能特性

- **JavaScript 错误监控**: 捕获未捕获的 JavaScript 错误 (`window.onerror`)。
- **Promise 异常监控**: 捕获未处理的 Promise 拒绝 (`window.onunhandledrejection`)。
- **网络错误监控**:
  - 拦截并监控 `XMLHttpRequest` 错误。
  - 拦截并监控 `fetch` API 错误。
- **资源加载错误监控**: 捕获资源（如图片 `<img>` 和脚本 `<script>`）加载失败的错误。
- **数据上报**: 优先使用 `navigator.sendBeacon` 进行可靠的数据上报，如果不支持则降级使用 `fetch`。

## 安装

```bash
npm install @relaxwork/error-monitor
```

## 使用方法

在你的应用入口文件（例如 `main.js` 或 `App.tsx`）中初始化 SDK。

```javascript
import { initErrorMonitor } from '@relaxwork/error-monitor';

initErrorMonitor({
	reportUrl: 'https://your-monitoring-server.com/api/report', // 你的错误上报接口地址
	projectName: 'my-awesome-project', // 项目名称
	environment: 'production', // 当前环境，如 'development', 'staging', 'production' 等
	networkConfig: {
		ignoreNetworkErrors: [], // 需要忽略的网络错误地址
	},
});
```

## 忽略特定网络请求示例

如果你的项目中存在不需要上报的请求，例如健康检查、埋点上报、轮询接口，可以通过 `networkConfig.ignoreNetworkErrors` 配置忽略地址片段。

```javascript
import { initErrorMonitor } from '@relaxwork/error-monitor';

initErrorMonitor({
	reportUrl: 'http://localhost:3000/error-report',
	projectName: 'my-awesome-project',
	environment: 'development',
	networkConfig: {
		ignoreNetworkErrors: [
			'/health',
			'/metrics',
			'http://localhost:9999/not-report',
		],
	},
});
```

例如下面这类请求地址命中忽略规则后，即使请求失败，也不会触发网络错误上报：

```javascript
fetch('http://localhost:9999/not-report');

const xhr = new XMLHttpRequest();
xhr.open('GET', 'http://localhost:9999/not-report');
xhr.send();
```

## 框架插件使用

vue框架

```js
import { createApp } from 'vue';
import { VueErrorMonitorPlugin } from '@relaxwork/error-monitor';

const app = createApp(App);
// 一行代码，同时开启全局监控和 Vue 错误捕获
app.use(VueErrorMonitorPlugin, {
	reportUrl: 'http://localhost:3000/error-report',
	projectName: 'MyVueProject',
	environment: 'production',
});
app.mount('#app');
```

react框架

```js
import React from 'react';
import ReactDOM from 'react-dom';
import { createReactErrorBoundary } from '@relaxwork/error-monitor';

// 1. 创建错误边界组件
const ErrorBoundary = createReactErrorBoundary(React, {
	reportUrl: 'http://localhost:3000/error-report',
	projectName: 'MyReactProject',
	environment: 'production',
});

// 2. 包裹根组件，即可捕获整个应用树的渲染错误
ReactDOM.render(
	<ErrorBoundary fallback={<h1>Something went wrong.</h1>}>
		<App />
	</ErrorBoundary>,
	document.getElementById('root'),
);
```

## 配置项

`initErrorMonitor` 函数接受一个配置对象，包含以下属性：

| 属性名          | 类型     | 说明                                                          |
| --------------- | -------- | ------------------------------------------------------------- |
| `reportUrl`     | `string` | **必填**。错误数据将通过 POST 请求发送到的 URL 地址。         |
| `projectName`   | `string` | **必填**。用于标识错误来源的项目名称。                        |
| `environment`   | `string` | **必填**。当前运行环境（例如 'production', 'development'）。  |
| `networkConfig` | `object` | **选填**。可选项为`ignoreNetworkErrors`即要忽略的网络错误地址 |

## 本地开发

1. **克隆仓库**

   ```bash
   git clone https://github.com/zhenghui-su/relax-monitor.git
   cd packages/error
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **运行开发服务器**

   ```bash
   npm run dev
   ```

4. **构建生产版本**

   ```bash
   npm run build
   ```

5. **运行演示 Demo**
   启动本地服务器以测试 SDK 功能。
   ```bash
   npm run demo
   ```
   然后在浏览器中打开 `http://localhost:3000`（或控制台显示的端口）查看演示。

## 许可证

MIT
