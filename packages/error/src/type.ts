/** 网络错误监控额外配置项 */
export interface NetworkConfig {
	/** 需要忽略的网络错误地址 */
	ignoreNetworkErrors?: string[];
}

/** 错误监控配置项 */
export interface ErrorMonitorConfig {
	/** 上传接口地址 */
	reportUrl: string;
	/** 项目标识 */
	projectName: string;
	/** 环境 dev/prod */
	environment: string;
	/** 额外配置 */
	networkConfig?: NetworkConfig;
}
