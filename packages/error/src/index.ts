import { monitorJavaScriptErrors } from './errorHandler';
import { monitorNetworkErrors } from './networkMonitor';
import { monitorResourceErrors } from './resourceMonitor';
import { sendErrorData } from './sender';
import { ErrorMonitorConfig } from './type';
import { formatErrorMessage } from './utils';

/** 初始化错误监控 */
export const initErrorMonitor = (config: ErrorMonitorConfig) => {
	const { reportUrl, projectName, environment, networkConfig } = config;

	// 启动三大监控模块
	monitorJavaScriptErrors(reportUrl, projectName, environment);
	monitorNetworkErrors(reportUrl, projectName, environment, networkConfig);
	monitorResourceErrors(reportUrl, projectName, environment);
};

// Vue 3 插件：统一接入框架错误 + 自动初始化全局监控
export const VueErrorMonitorPlugin = {
	install(
		app: any,
		options: { reportUrl: string; projectName: string; environment: string },
	) {
		if (!options || !options.reportUrl) return;

		// 开启 JS/Promise/网络/资源监控
		initErrorMonitor(options);

		const original = app.config.errorHandler;
		// vue提供的捕获组件内错误的事件
		app.config.errorHandler = (
			err: unknown,
			instance?: unknown,
			info?: unknown,
		) => {
			sendErrorData(
				{
					message: formatErrorMessage(err),
					stack: (err as any)?.stack || null,
					projectName: options.projectName,
					environment: options.environment,
					errorType: 'Vue Error',
					timestamp: new Date().toISOString(),
					userAgent: navigator.userAgent,
					info,
				},
				options.reportUrl,
			);

			if (typeof original === 'function') {
				try {
					(original as any)(err, instance, info);
				} catch {}
			}
		};
	},
};

// React 错误边界：捕获子树渲染错误并上报
export const createReactErrorBoundary = (
	React: any,
	config: { reportUrl: string; projectName: string; environment: string },
) => {
	// 确保在创建边界组件时启动全局监控（JS/网络/资源）
	if (config && config.reportUrl) {
		initErrorMonitor(config);
	}

	return class ErrorMonitorBoundary extends React.Component {
		constructor(props: any) {
			super(props);
			this.state = { hasError: false };
		}
		static getDerivedStateFromError() {
			return { hasError: true };
		}
		componentDidCatch(error: any, info: any) {
			sendErrorData(
				{
					message: formatErrorMessage(error),
					stack: error?.stack || null,
					projectName: config.projectName,
					environment: config.environment,
					errorType: 'React Error',
					timestamp: new Date().toISOString(),
					userAgent: navigator.userAgent,
					componentStack: info?.componentStack || null,
				},
				config.reportUrl,
			);
		}
		render() {
			if ((this.state as any).hasError)
				return (this.props as any).fallback || null;
			return (this.props as any).children;
		}
	};
};
