import { sendBehaviorData } from './sender';
import { getUserID, incrementPV } from './storage';

// 页面加载时间
let pageLoadTime: number = Date.now();
// 上一个页面的 URL
let lastPageUrl: string = window.location.href;
let lastDwellReportedForLoadTime: number | null = null;

/**
 * 行为采集器，负责监控用户的各种行为并将数据上报到服务器
 * 包括点击事件、页面浏览、停留时长等
 * @param projectName 项目标识
 * @param reportUrl 上传地址
 */
export const trackUserBehavior = (projectName: string, reportUrl: string) => {
	// 1. 点击监控: 通过事件委托监听用户的点击操作
	trackClicks(projectName, reportUrl);

	// 2. MPA(传统界面) PV 监控: 监听页面首次加载
	trackMpaPageViews(projectName, reportUrl);

	// 3. 停留时长监控: 在页面关闭或卸载时计算并上报停留时长
	trackPageStayDuration(projectName, reportUrl);

	// 4. SPA 路由监控: 专门用于处理单页应用的路由变化，监控用户在不同视图之间的导航
	trackSpaRouteChanges(projectName, reportUrl);
};
/**
 * @description: 捕获点击事件，通过 data-track-click 属性简化识别​
 * @param projectName 项目名称
 * @param reportUrl 上报 URL
 * @returns
 */
const trackClicks = (projectName: string, reportUrl: string) => {
	document.addEventListener('click', (event) => {
		const target = event.target as HTMLElement;
		// 如果目标元素带有 data-track-click 属性​
		if (target && target.dataset.trackClick) {
			const react = target.getBoundingClientRect();
			const behaviorData = {
				behavior: 'click',
				userId: getUserID(),
				projectName,
				payload: {
					x: react.left.toFixed(2) || '0', // 点击位置X坐标
					y: react.top.toFixed(2) || '0', // 点击位置Y坐标
					width: react.width.toFixed(2) || '0', // 元素宽度
					height: react.height.toFixed(2) || '0', // 元素高度
					text: target.textContent, // 元素文本内容
				},
				timestamp: new Date().toISOString(),
				element: target.tagName,
				action: target.dataset.trackClick, // 自定义的点击行为​
				pageUrl: window.location.href,
				referrer: lastPageUrl, // 记录点击时的页面来源
			};

			// 发送点击事件数据到服务端​
			sendBehaviorData(behaviorData, reportUrl);
		}
	});
};

/**
 * @description: 上报页面停留时间
 * @param projectName 项目名称
 * @param reportUrl 上报 URL
 * @returns
 */
const reportPageStayDuration = (projectName: string, reportUrl: string) => {
	if (lastDwellReportedForLoadTime === pageLoadTime) return;
	const stayDuration = Date.now() - pageLoadTime;
	if (stayDuration > 0) {
		sendBehaviorData(
			{
				behavior: 'page_stay_duration',
				userId: getUserID(),
				projectName,
				timestamp: new Date().toISOString(),
				pageUrl: lastPageUrl,
				stayDuration,
			},
			reportUrl,
		);
		lastDwellReportedForLoadTime = pageLoadTime;
	}
};
/**
 *  捕获首屏 PV（MPA传统网页）
 * @param projectName 项目名称
 * @param reportUrl 上报 URL
 */
const trackMpaPageViews = (projectName: string, reportUrl: string) => {
	window.addEventListener('load', () => {
		// 获取用户id
		const userId = getUserID();
		// 增加 PV 计数
		const pv = incrementPV();
		// 上报 PV 数据
		sendBehaviorData(
			{
				behavior: 'pv',
				userId,
				projectName,
				pv,
				timestamp: new Date().toISOString(),
				pageUrl: window.location.href,
				referrer: document.referrer || '', // 记录来源
			},
			reportUrl,
		);
	});
};
/**
 * @description: 捕获页面停留时间（关闭/隐藏）
 * @param projectName 项目名称
 * @param reportUrl 上报 URL
 * @returns
 */
const trackPageStayDuration = (projectName: string, reportUrl: string) => {
	// 在 beforeunload 时计算停留时间
	window.addEventListener('beforeunload', () => {
		reportPageStayDuration(projectName, reportUrl);
	});

	window.addEventListener('pagehide', () => {
		reportPageStayDuration(projectName, reportUrl);
	});

	// 在 visibilitychange（切换标签）时计算停留时间
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			reportPageStayDuration(projectName, reportUrl);
		}
	});
};
/**
 * @description: 捕获 SPA 路由行为（路由变化：先上报旧页面停留，再上报新页面 PV）
 * @param projectName 项目名称
 * @param reportUrl 上报 URL
 * @returns
 */
const trackSpaRouteChanges = (projectName: string, reportUrl: string) => {
	const handleRouteChange = () => {
		// 1. 防抖校验：如果 URL 没变（比如 hashchange 和 popstate 同时触发），直接退出
		if (window.location.href === lastPageUrl) return;

		// 2. 结算上一页：上报前一个页面的停留时间
		reportPageStayDuration(projectName, reportUrl);

		// 3. 记录当前 URL 为 referrer (在更新 lastPageUrl 之前！)
		const referrer = lastPageUrl;

		// 4. 更新状态：保存当前 URL，为下一次跳转做准备
		pageLoadTime = Date.now();
		lastPageUrl = window.location.href;

		// 5. 记录新页面：上报 PV
		const userId = getUserID();
		const pv = incrementPV();
		sendBehaviorData(
			{
				behavior: 'pv',
				userId,
				projectName,
				timestamp: new Date().toISOString(),
				pageUrl: window.location.href,
				referrer: referrer, // 这里的 referrer 是跳转前的页面 URL
				pv,
			},
			reportUrl,
		);
	};

	// 1. 监听 Hash 和浏览器后退/前进
	window.addEventListener('hashchange', handleRouteChange);
	window.addEventListener('popstate', handleRouteChange);

	// 2. 劫持 History API (解决 pushState/replaceState 不触发事件的问题)
	const originalPush = history.pushState;
	const originalReplace = history.replaceState;

	// 路由跳转，劫持 pushState
	history.pushState = function (...args: Parameters<typeof history.pushState>) {
		originalPush.apply(this, args);
		handleRouteChange();
	};

	// 路由跳转，劫持 replaceState
	history.replaceState = function (
		...args: Parameters<typeof history.replaceState>
	) {
		originalReplace.apply(this, args);
		handleRouteChange();
	};
};
