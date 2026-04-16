# Relax Behavior Monitor SDK

一个轻量级的前端用户行为监控 SDK，用于采集页面访问、点击行为、页面停留时长以及 SPA 路由切换等行为数据。

## 功能特性

- **UV 统计**: 初始化时自动记录当日 UV，仅当天首次进入时上报一次。
- **PV 统计**: 自动记录页面访问次数，支持传统多页应用和单页应用路由切换。
- **点击行为采集**: 通过 `data-track-click` 属性自动采集点击事件。
- **页面停留时长**: 在页面隐藏、关闭、卸载或路由切换时上报停留时间。
- **SPA 路由监控**: 监听 `hashchange`、`popstate`，并劫持 `history.pushState` / `history.replaceState`。
- **用户标识生成**: 优先使用 `FingerprintJS` 生成稳定用户标识，失败时回退到本地随机 ID。
- **数据上报**: 优先使用 `navigator.sendBeacon`，不支持时降级为 `fetch`。

## 安装

```bash
npm install @relaxwork/behavior-monitor
```

## 使用方法

在应用入口文件中初始化 SDK：

```ts
import { initUserBehaviorMonitor } from '@relaxwork/behavior-monitor';

initUserBehaviorMonitor({
	reportUrl: 'https://your-monitoring-server.com/api/behavior-report',
	projectName: 'my-awesome-project',
});
```

初始化后，SDK 会自动完成：

- 生成并缓存用户唯一标识
- 上报当日 UV
- 上报首屏 PV
- 监听页面点击行为
- 监听页面停留时长
- 监听 SPA 路由切换

## 点击埋点示例

只有带 `data-track-click` 属性的元素才会被自动采集点击行为：

```html
<button data-track-click="add_to_cart">加入购物车</button>
<button data-track-click="play_video">播放视频</button>
```

点击后会自动上报一条 `behavior: 'click'` 的数据，包含：

- 元素标签名
- 点击元素文本
- 元素位置信息和尺寸
- 当前页面 URL
- 来源页面 URL
- `data-track-click` 中定义的动作名

## 采集行为说明

| 行为类型     | `behavior` 值        | 触发时机                           | 说明                     |
| ------------ | -------------------- | ---------------------------------- | ------------------------ |
| UV           | `uv`                 | 当天首次初始化 SDK 时              | 每个用户每天只会上报一次 |
| PV           | `pv`                 | 首屏加载、SPA 路由切换时           | 记录页面浏览次数         |
| 点击         | `click`              | 点击带 `data-track-click` 的元素时 | 自动采集点击行为         |
| 页面停留时长 | `page_stay_duration` | 页面隐藏、关闭、卸载、路由切换前   | 统计上一页面停留时间     |

## SPA 路由示例

SDK 会自动监听以下路由变化：

- `hashchange`
- `popstate`
- `history.pushState`
- `history.replaceState`

例如：

```ts
history.pushState({}, '', '/product/1001');
```

当路由变化时，SDK 会先上报上一页的 `page_stay_duration`，再上报新页面的 `pv`。

## 配置项

`initUserBehaviorMonitor` 接收以下配置：

| 属性名        | 类型     | 说明                           |
| ------------- | -------- | ------------------------------ |
| `reportUrl`   | `string` | **必填**。行为数据上报接口地址 |
| `projectName` | `string` | **必填**。项目名称或项目标识   |

## 上报数据示例

点击行为：

```json
{
	"behavior": "click",
	"userId": "7c2d9b0d1c3a4f56",
	"projectName": "monitor-demo-v1",
	"payload": {
		"x": "120.00",
		"y": "248.00",
		"width": "96.00",
		"height": "36.00",
		"text": "加入购物车"
	},
	"timestamp": "2026-04-16T08:00:00.000Z",
	"element": "BUTTON",
	"action": "add_to_cart",
	"pageUrl": "http://localhost:3000/",
	"referrer": "http://localhost:3000/"
}
```

页面浏览：

```json
{
	"behavior": "pv",
	"userId": "7c2d9b0d1c3a4f56",
	"projectName": "monitor-demo-v1",
	"pv": 3,
	"timestamp": "2026-04-16T08:00:00.000Z",
	"pageUrl": "http://localhost:3000/product/1001",
	"referrer": "http://localhost:3000/"
}
```

## 本地开发

1. 安装依赖

```bash
pnpm install
```

2. 构建行为监控 SDK

```bash
pnpm --filter @relaxwork/behavior-monitor build
```

3. 启动本地测试服务

```bash
pnpm --filter @relaxwork/behavior-monitor demo
```

4. 在浏览器中打开 `http://localhost:3000/index.html`

包内测试页位于 [packages/behavior/test/index.html](/Users/suzhenghui/Desktop/IWantTo/study/@relax/monitor/packages/behavior/test/index.html)。

## License

MIT
