import { sendBehaviorData } from '../report';

/**
 * 开始监测 FP（First Paint）性能指标
 * @param reportUrl 上报数据的 URL 地址
 */
export function startFP(reportUrl: string) {
	const entryHandler = (list: PerformanceObserverEntryList) => {
		for (const entry of list.getEntries()) {
			if (entry.name === 'first-paint') {
				observer.disconnect(); // 只需要第一次的 FP 数据，获取后就断开观察
				const json = entry.toJSON();
				const reportData = {
					type: 'performance',
					name: entry.name,
					pageUrl: window.location.href,
					...json,
				};
				sendBehaviorData(reportData, reportUrl);
			}
		}
	};
	// 1. 创建观察者
	const observer = new PerformanceObserver(entryHandler);
	// 2. 观察paint频道, buffered: true确保能拿到SDK初始化前的性能数据
	observer.observe({ type: 'paint', buffered: true });
	// 3. 返回清理函数
	return () => observer.disconnect();
}
