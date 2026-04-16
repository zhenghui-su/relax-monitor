import { sendBehaviorData } from '../report';

/**
 * 监听并上报 FCP（First Contentful Paint）性能指标
 * @param reportUrl 上报数据的 URL 地址
 */
export function startFCP(reportUrl: string) {
	const entryHandler = (list: any) => {
		for (const entry of list.getEntries()) {
			if (
				entry.entryType === 'paint' &&
				entry.name === 'first-contentful-paint'
			) {
				observer.disconnect();
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

	const observer = new PerformanceObserver(entryHandler);
	observer.observe({ type: 'paint', buffered: true });
	return () => observer.disconnect();
}
