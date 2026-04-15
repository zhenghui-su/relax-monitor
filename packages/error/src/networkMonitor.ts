import { NetworkConfig } from './type';
import { sendErrorData } from './sender';

/**
 * 监控网络错误
 * @param reportUrl 上报地址
 * @param projectName 项目名称
 * @param environment 环境
 * @param networkConfig 网络配置项
 */
export const monitorNetworkErrors = (
	reportUrl: string,
	projectName: string,
	environment: string,
	networkConfig?: NetworkConfig,
) => {
	const ignoreList = networkConfig?.ignoreNetworkErrors || [];
	// 1. 劫持 XMLHttpRequest
	const originalXhrOpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function (
		method: string,
		url: string | URL,
		...args: any[]
	) {
		// 关键点：排除上报接口自身的请求，防止死循环
		const urlStr = typeof url === 'string' ? url : String(url);
		if (urlStr.includes(reportUrl)) {
			return originalXhrOpen.apply(this, [method, url, ...args] as any);
		}
		// 关键点：排除用户配置的需要忽略的网络错误地址
		if (ignoreList.some((ignoreUrl) => urlStr.includes(ignoreUrl))) {
			return originalXhrOpen.apply(this, [method, url, ...args] as any);
		}

		// 监听 error 事件
		this.addEventListener('error', () => {
			sendErrorData(
				{
					type: 'Network Error',
					message: `Request Failed: ${method} ${url}`,
					projectName,
					environment,
				},
				reportUrl,
			);
		});
		return originalXhrOpen.apply(this, [method, url, ...args] as any);
	};

	// 2. 劫持 Fetch
	const originalFetch = window.fetch;
	window.fetch = async (input, init) => {
		// 关键点：排除上报接口自身的请求，防止死循环
		const urlStr = input instanceof Request ? input.url : String(input);
		if (urlStr.includes(reportUrl)) {
			return originalFetch(input, init);
		}
		// 关键点：排除用户配置的需要忽略的网络错误地址
		if (ignoreList.some((ignoreUrl) => urlStr.includes(ignoreUrl))) {
			return originalFetch(input, init);
		}

		try {
			const response = await originalFetch(input, init);
			if (!response.ok) {
				sendErrorData(
					{
						type: 'Fetch Error',
						message: `HTTP ${response.status}: ${response.statusText}`,
						url: input instanceof Request ? input.url : input,
						projectName,
						environment,
					},
					reportUrl,
				);
			}
			return response;
		} catch (error) {
			// 网络故障等无法发出请求的情况
			sendErrorData(
				{
					type: 'Fetch Error',
					message: `Fetch Failed: ${input}`,
					projectName,
					environment,
				},
				reportUrl,
			);
			throw error;
		}
	};
};
