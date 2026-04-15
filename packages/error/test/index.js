/**
 * =========================================================================
 *  SDK 初始化配置
 * =========================================================================
 * 在 UMD 模式下，SDK 会挂载到全局变量 window.relaxworkErrorMonitor 上，
 * (该变量名在 rollup.config.js 的 output.name 中配置)
 */
console.log('正在初始化 SDK (CDN 模式)...', relaxworkErrorMonitor);

const ignoredNetworkUrl = 'http://localhost:9999/not-report';

// 手动初始化全局监控 (捕获 JS/网络/资源错误)
// 注意：如果是 Vue/React 场景，通常由插件或辅助函数自动调用，
// 这里显式调用是为了演示基础功能的独立使用。
relaxworkErrorMonitor.initErrorMonitor({
	reportUrl: 'http://localhost:3000/error-report',
	projectName: 'Test-Playground-Global',
	environment: 'dev',
	networkConfig: {
		ignoreNetworkErrors: [ignoredNetworkUrl],
	},
});

/**
 * =========================================================================
 *  基础错误测试用例
 * =========================================================================
 */

// 1. JS 运行时错误 (ReferenceError)
// 预期：捕获到 'JavaScript Error'，包含堆栈信息
document.getElementById('btn-js').onclick = () => {
	const obj = {};
	console.log(obj.notExist.func()); // 典型空指针错误
};

// 2. Promise 未捕获异常 (Unhandled Rejection)
// 预期：捕获到 'Unhandled Promise Rejection'
document.getElementById('btn-promise').onclick = () => {
	Promise.reject(new Error('这是一个未捕获的 Promise 错误！'));
};

// 3. XHR 请求错误 (Network Error)
// 预期：捕获到 'Network Error'，记录请求方法和 URL
document.getElementById('btn-xhr').onclick = () => {
	const xhr = new XMLHttpRequest();
	xhr.open('GET', 'http://localhost:9999/not-exist'); // 端口不存在导致连接失败
	xhr.send();
};

// 4. Fetch 请求错误 (Fetch Error)
// 预期：捕获到 'Fetch Error'
document.getElementById('btn-fetch').onclick = () => {
	fetch('http://localhost:9999/not-exist'); // 端口不存在
};

// 5. 命中 ignoreNetworkErrors 的网络错误
// 预期：请求会失败，但不会触发 SDK 上报
document.getElementById('btn-ignore-network').onclick = () => {
	fetch(ignoredNetworkUrl).catch(() => {});

	const xhr = new XMLHttpRequest();
	xhr.open('GET', ignoredNetworkUrl);
	xhr.send();
};

// 6. 资源加载错误 (Resource Load Error)
// 预期：捕获到 'Resource Load Error'，且不冒泡到 window.onerror
document.getElementById('btn-resource').onclick = () => {
	const img = document.createElement('img');
	img.src = '/404-image.png'; // 图片资源不存在
	document.body.appendChild(img);
	// 稍后移除 DOM 元素以免影响页面美观
	setTimeout(() => document.body.removeChild(img), 100);
};

/**
 * =========================================================================
 *  框架集成测试用例 (Vue / React)
 * =========================================================================
 */

// 7. Vue 3 组件错误测试
// 原理：通过 app.config.errorHandler 全局捕获
document.getElementById('btn-vue').onclick = () => {
	const vueContainer = document.getElementById('vue-app');
	vueContainer.style.display = 'block';

	// 避免重复创建 Vue 实例
	if (vueContainer.__vue_app__) return;

	const app = Vue.createApp({
		data() {
			return { message: 'Hello Vue 3!' };
		},
		methods: {
			triggerError() {
				throw new Error('这是 Vue 组件内部触发的错误！');
			},
		},
	});

	// 核心：安装监控插件 (一行代码接入)
	app.use(relaxworkErrorMonitor.VueErrorMonitorPlugin, {
		reportUrl: 'http://localhost:3000/error-report',
		projectName: 'Test-Playground-Vue',
		environment: 'dev',
	});

	app.mount('#vue-app');
	vueContainer.__vue_app__ = app;
};

// 8. React 18 组件错误测试
// 原理：通过 Error Boundary 包裹组件树捕获
document.getElementById('btn-react').onclick = () => {
	const reactContainer = document.getElementById('react-app');
	reactContainer.style.display = 'block';

	// 避免重复挂载
	if (reactContainer._isMounted) return;

	// --- 定义一个会崩溃的子组件 ---
	const BuggyComponent = () => {
		const [hasError, setHasError] = React.useState(false);
		if (hasError) {
			throw new Error('这是 React 组件内部触发的错误！');
		}
		return React.createElement(
			'button',
			{ onClick: () => setHasError(true) },
			'在 React 中触发错误',
		);
	};

	// --- 定义根组件 ---
	const App = () => {
		return React.createElement(
			'div',
			null,
			React.createElement('h3', null, 'React 测试区域'),
			React.createElement(BuggyComponent),
		);
	};

	// 核心：创建监控专用的 Error Boundary (自动初始化全局监控)
	const ErrorBoundary = relaxworkErrorMonitor.createReactErrorBoundary(React, {
		reportUrl: 'http://localhost:3000/error-report',
		projectName: 'Test-Playground-React',
		environment: 'dev',
	});

	// 渲染：用 ErrorBoundary 包裹整个 App
	const root = ReactDOM.createRoot(reactContainer);
	root.render(
		React.createElement(
			ErrorBoundary,
			{
				fallback: React.createElement(
					'h3',
					{ style: { color: 'red' } },
					'React 组件崩溃了！已捕获。',
				),
			},
			React.createElement(App),
		),
	);
	reactContainer._isMounted = true;
};
