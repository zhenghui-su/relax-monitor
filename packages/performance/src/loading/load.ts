import { sendBehaviorData } from '../report';

/**
 * 监听并上报页面加载性能指标（如 load 事件）
 * @param reportUrl 上报数据的 URL 地址
 */
export function startLoad(reportUrl: string) {
	const onPageShow = (event: any) => {
		// 往后推一帧避免抢占主线程
		requestAnimationFrame(() => {
			['load'].forEach((type) => {
				const reportData = {
					type: 'performance',
					subType: type,
					pageUrl: window.location.href,
					// 事件发生时刻
					startTime: event.timeStamp,
					// 记录回调执行延迟
					delay: performance.now() - event.timeStamp,
				};
				sendBehaviorData(reportData, reportUrl);
			});
		});
	};

	window.addEventListener('pageshow', onPageShow, true);

	return () => {
		window.removeEventListener('pageshow', onPageShow, true);
	};
}
