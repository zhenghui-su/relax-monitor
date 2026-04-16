import { sendBehaviorData } from '../report';
import { getSelector } from '../util';

export function startFID(reportUrl: string) {
	const entryHandler = (list: PerformanceObserverEntryList) => {
		for (const entry of list.getEntries()) {
			observer.disconnect(); // 只需要第一个输入事件，之后就可以断开观察
			const json = entry.toJSON();
			const inputDelay = (entry as any).processingStart - entry.startTime;
			const reportData = {
				type: 'performance',
				subType: ' first-input',
				name: entry.name,
				inputDelay,
				duration: entry.duration,
				startTime: entry.startTime,
				pageUrl: window.location.href,
				elementSelector: getSelector((entry as any).target),
				...json,
			};
			sendBehaviorData(reportData, reportUrl);
		}
	};
	const observer = new PerformanceObserver(entryHandler);
	observer.observe({ type: 'first-input', buffered: true });

	return () => observer.disconnect();
}
