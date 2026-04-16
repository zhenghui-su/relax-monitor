import FingerprintJS from '@fingerprintjs/fingerprintjs';

const USER_ID_KEY = 'user_behavior_user_id';
const PV_COUNT_KEY = 'user_behavior_pv_count';
const UV_STORAGE_KEY = 'user_behavior_uv';

let cachedUserId: string | null = null;
let userIdPromise: Promise<string> | null = null;

const persistUserId = (userId: string) => {
	cachedUserId = userId;
	localStorage.setItem(USER_ID_KEY, userId);
	return userId;
};

const readStoredUserId = () => {
	if (cachedUserId) {
		return cachedUserId;
	}

	const userId = localStorage.getItem(USER_ID_KEY);
	if (userId) {
		cachedUserId = userId;
	}
	return userId;
};

const createFallbackUserId = () =>
	'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, (char) => {
		const random = (Math.random() * 16) | 0;
		const value = char === 'x' ? random : (random & 0x3) | 0x8;
		return value.toString(16);
	});

// 同步获取用户 ID，优先读取本地缓存。
// 如果在 SDK 初始化之前被调用，则回退到一个本地持久化的随机 ID，避免把 Promise 序列化成空对象。
export const getUserID = (): string => {
	const storedUserId = readStoredUserId();
	if (storedUserId) {
		return storedUserId;
	}

	return persistUserId(createFallbackUserId());
};

// 异步确保用户 ID 已生成并写入本地，用于 SDK 初始化阶段预热。
export const ensureUserID = async (): Promise<string> => {
	const storedUserId = readStoredUserId();
	if (storedUserId) {
		return storedUserId;
	}

	if (!userIdPromise) {
		userIdPromise = (async () => {
			try {
				return persistUserId(await generateFingerprint());
			} catch {
				return persistUserId(createFallbackUserId());
			} finally {
				userIdPromise = null;
			}
		})();
	}

	return userIdPromise;
};

/**
 * @description: 获取用户唯一指纹 ID
 * @return {string} 唯一标识符
 */
const generateFingerprint = async () => {
	const fpPromise = FingerprintJS.load();
	const fp = await fpPromise;
	const result = await fp.get();

	if (result && result.visitorId) {
		return result.visitorId;
	}

	throw new Error('Failed to generate fingerprint');
};

export const incrementPV = (): number => {
	const today = new Date().toISOString().split('T')[0]; // 获取当天的日期​
	const pvData = localStorage.getItem(`${PV_COUNT_KEY}_${today}`);
	const newPV = (pvData ? parseInt(pvData, 10) : 0) + 1;
	localStorage.setItem(`${PV_COUNT_KEY}_${today}`, newPV.toString());
	return newPV;
};

// 检查是否已经记录 UV​
export const isUVRecorded = (): boolean => {
	const today = new Date().toISOString().split('T')[0];
	return localStorage.getItem(UV_STORAGE_KEY) === today;
};

// 设置 UV 记录​
export const setUVRecorded = () => {
	const today = new Date().toISOString().split('T')[0];
	localStorage.setItem(UV_STORAGE_KEY, today);
};
