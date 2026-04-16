import { trackUserBehavior } from './tracker';
import { ensureUserID, getUserID, isUVRecorded, setUVRecorded } from './storage';
import { sendBehaviorData } from './sender';
import { InitOptions } from './type';

export const initUserBehaviorMonitor = (options: InitOptions) => {
	void bootstrapUserBehaviorMonitor(options);
};

const bootstrapUserBehaviorMonitor = async (options: InitOptions) => {
	const { projectName, reportUrl } = options;
	await ensureUserID();
	const userId = getUserID();

	// UV 逻辑：如果本地未记录，则上报 UV 并标记
	if (!isUVRecorded()) {
		sendBehaviorData(
			{
				behavior: 'uv',
				userId,
				projectName,
				timestamp: new Date().toISOString(),
			},
			reportUrl,
		);
		setUVRecorded();
	}

	// 启动行为追踪
	trackUserBehavior(projectName, reportUrl);
};
