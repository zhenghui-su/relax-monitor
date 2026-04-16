import { getSelector } from '../util/index';
import { sendBehaviorData } from '../report';

/**
 * 监听并上报 LCP（Largest Contentful Paint）性能指标
 * @param reportUrl  上报数据的 URL 地址
 */
export function startLCP(reportUrl: string) {
	let lcpEntry: PerformanceEntry | undefined;
	let hasReported = false;

	const observer = new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			// 记录最新的 LCP 候选值
			lcpEntry = entry;
		}
	});
	observer.observe({ type: 'largest-contentful-paint', buffered: true });

	const report = () => {
		if (hasReported || !lcpEntry) return;
		hasReported = true;

		const json = lcpEntry.toJSON();
		const reportData = {
			type: 'performance',
			name: lcpEntry.name,
			pageUrl: window.location.href,
			lcpTime: lcpEntry.startTime, // LCP 时间
			elementSelector: getSelector((lcpEntry as any).element), // 获取元素的唯一选择器
			...json,
		};
		sendBehaviorData(reportData, reportUrl);

		// 断开观察，避免后续的 LCP 变化干扰
		observer.disconnect();
	};

	// 停止监听并清理
	const disconnect = () => {
		if (observer) observer.disconnect();
		['click', 'keydown', 'pointerdown'].forEach((type) => {
			window.removeEventListener(type, report, true);
		});
		document.removeEventListener('visibilitychange', onVisibilityChange);
	};

	// 1. 页面隐藏时上报
	const onVisibilityChange = () => {
		if (document.visibilityState === 'hidden') {
			report();
		}
	};
	// 2. 用户交互时上报（因为交互后 LCP 就不再产生/不再准确）
	['click', 'keydown', 'pointerdown'].forEach((type) => {
		window.addEventListener(type, report, { once: true, capture: true });
	});
	document.addEventListener('visibilitychange', onVisibilityChange);

	return disconnect;
}
