import { sendErrorData } from './sender';

/**
 * 监控 JavaScript 错误
 * @param reportUrl 上报地址
 * @param projectName 项目名称
 * @param environment 环境
 */
export const monitorJavaScriptErrors = (
	reportUrl: string,
	projectName: string,
	environment: string,
) => {
	// 1. 捕获 JS 运行时错误
	const originalOnError = window.onerror;
	window.onerror = (message, source, lineno, colno, error) => {
		const errorInfo = {
			type: 'JavaScript Error',
			message,
			source,
			lineno,
			colno,
			stack: error ? error.stack : null,
			projectName,
			environment,
			timestamp: new Date().toISOString(),
		};
		sendErrorData(errorInfo, reportUrl);
		// 关键点：如果原来有 onerror 处理函数，继续执行它，避免覆盖用户逻辑
		// 这样做是为了不破坏宿主环境（例如用户自己写的或其他 SDK）已有的错误处理逻辑
		if (originalOnError) {
			return originalOnError(message, source, lineno, colno, error);
		}
	};

	// 2. 捕获未处理的 Promise Rejection
	const originalOnUnhandledRejection = window.onunhandledrejection;
	window.onunhandledrejection = (event) => {
		const errorInfo = {
			type: 'Unhandled Promise Rejection',
			message: event.reason?.message || event.reason,
			stack: event.reason?.stack,
			projectName,
			environment,
			timestamp: new Date().toISOString(),
		};
		sendErrorData(errorInfo, reportUrl);

		// 关键点：执行原有的 Promise 错误处理逻辑
		// 这样做是为了不破坏宿主环境（例如用户自己写的或其他 SDK）已有的错误处理逻辑
		if (originalOnUnhandledRejection) {
			return originalOnUnhandledRejection.call(window, event);
		}
	};
};
