#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

type PackageJson = {
	name: string;
	version: string;
	private?: boolean;
};

type ReleasePackage = {
	dirName: string;
	dirPath: string;
	manifestPath: string;
	manifest: PackageJson;
};

type ReleaseType = 'patch' | 'minor' | 'major' | 'custom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');
const isDryRun = process.argv.includes('--dry-run');
const selectedPackageLockfile = 'pnpm-lock.yaml';

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const main = async () => {
	try {
		if (process.argv.includes('--help') || process.argv.includes('-h')) {
			printHelp();
			return;
		}

		printHeader();

		const packages = await getReleasePackages();
		if (packages.length === 0) {
			throw new Error('未找到可发布的包，请先检查 packages/*/package.json。');
		}

		const selectedPackage = await selectPackage(packages);
		const releaseType = await selectReleaseType(selectedPackage.manifest.version);
		const nextVersion = await resolveNextVersion(
			selectedPackage.manifest.version,
			releaseType,
		);

		const runBuild = await askConfirm('发布前执行 build?', true);
		const createCommit = await askConfirm('创建 git commit 和 tag?', true);
		const publishToNpm = await askConfirm('发布到 npm?', true);
		const pushGitRef =
			createCommit && (await askConfirm('发布后推送 commit 和 tag 到远端?', false));
		const npmTag = publishToNpm
			? await askInput(
					'npm dist-tag',
					nextVersion.includes('-') ? 'next' : 'latest',
				)
			: '';

		const defaultCommitMessage = `chore(release): ${selectedPackage.manifest.name}@${nextVersion}`;
		const commitMessage = createCommit
			? await askInput('提交信息', defaultCommitMessage)
			: '';
		const defaultTag = `${selectedPackage.manifest.name
			.replace(/^@/, '')
			.replace(/\//g, '-')}-v${nextVersion}`;
		const gitTag = createCommit ? await askInput('git tag 名称', defaultTag) : '';

		printPlan({
			selectedPackage,
			nextVersion,
			runBuild,
			createCommit,
			publishToNpm,
			pushGitRef,
			npmTag,
			commitMessage,
			gitTag,
		});

		const confirmed = await askConfirm(
			isDryRun ? '执行 dry-run 预演?' : '确认执行发布流程?',
			true,
		);

		if (!confirmed) {
			log('已取消发布。');
			return;
		}

		await warnIfGitDirty(selectedPackage);
		await updatePackageVersion(selectedPackage.manifestPath, nextVersion);

		if (runBuild) {
			await runCommand(
				'pnpm',
				['--filter', selectedPackage.manifest.name, 'build'],
				rootDir,
			);
		}

		if (createCommit) {
			await runCommand(
				'git',
				['add', path.relative(rootDir, selectedPackage.dirPath)],
				rootDir,
			);
			if (existsSync(path.join(rootDir, selectedPackageLockfile))) {
				await runCommand('git', ['add', selectedPackageLockfile], rootDir);
			}
			await runCommand('git', ['commit', '-m', commitMessage], rootDir);
			await runCommand('git', ['tag', gitTag], rootDir);
		}

		if (publishToNpm) {
			await runCommand(
				'npm',
				['publish', '--access', 'public', '--tag', npmTag],
				selectedPackage.dirPath,
			);
		}

		if (pushGitRef) {
			await runCommand('git', ['push'], rootDir);
			await runCommand('git', ['push', '--tags'], rootDir);
		}

		log(isDryRun ? 'dry-run 完成。' : '发布流程完成。');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`\n[release] ${message}`);
		process.exitCode = 1;
	} finally {
		rl.close();
	}
};

const printHeader = () => {
	log('Release CLI');
	log(isDryRun ? '当前模式: dry-run' : '当前模式: real run');
};

const printHelp = () => {
	console.log('用法: pnpm release');
	console.log('可选参数:');
	console.log('  --dry-run   仅输出发布步骤，不真正修改文件或执行命令');
	console.log('  --help      查看帮助');
};

const getReleasePackages = async (): Promise<ReleasePackage[]> => {
	const entries = await readdir(packagesDir, { withFileTypes: true });
	const packages: ReleasePackage[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const dirPath = path.join(packagesDir, entry.name);
		const manifestPath = path.join(dirPath, 'package.json');
		if (!existsSync(manifestPath)) continue;

		const manifest = JSON.parse(
			await readFile(manifestPath, 'utf8'),
		) as PackageJson;

		if (!manifest.name || !manifest.version || manifest.private) continue;

		packages.push({
			dirName: entry.name,
			dirPath,
			manifestPath,
			manifest,
		});
	}

	return packages.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
};

const selectPackage = async (
	packages: ReleasePackage[],
): Promise<ReleasePackage> => {
	const options = packages.map((item) => ({
		label: `${item.manifest.name} (${item.manifest.version})`,
		value: item,
	}));

	return askChoice('请选择要发布的包', options);
};

const selectReleaseType = async (currentVersion: string): Promise<ReleaseType> => {
	const semver = parseSemver(currentVersion);
	if (!semver) {
		log(`当前版本 ${currentVersion} 不是标准 semver，将直接使用自定义版本。`);
		return 'custom';
	}

	return askChoice('请选择版本升级类型', [
		{
			label: `patch -> ${formatSemver({
				major: semver.major,
				minor: semver.minor,
				patch: semver.patch + 1,
			})}`,
			value: 'patch' as const,
		},
		{
			label: `minor -> ${formatSemver({
				major: semver.major,
				minor: semver.minor + 1,
				patch: 0,
			})}`,
			value: 'minor' as const,
		},
		{
			label: `major -> ${formatSemver({
				major: semver.major + 1,
				minor: 0,
				patch: 0,
			})}`,
			value: 'major' as const,
		},
		{
			label: 'custom',
			value: 'custom' as const,
		},
	]);
};

const resolveNextVersion = async (
	currentVersion: string,
	releaseType: ReleaseType,
): Promise<string> => {
	if (releaseType === 'custom') {
		while (true) {
			const version = await askInput('请输入自定义版本号', currentVersion);
			if (isValidVersion(version)) {
				return version;
			}
			log('版本号格式不合法，请输入类似 1.2.3 或 1.2.3-beta.0。');
		}
	}

	const semver = parseSemver(currentVersion);
	if (!semver) {
		throw new Error(`当前版本 ${currentVersion} 无法自动计算，请使用 custom。`);
	}

	switch (releaseType) {
		case 'patch':
			return formatSemver({
				major: semver.major,
				minor: semver.minor,
				patch: semver.patch + 1,
			});
		case 'minor':
			return formatSemver({
				major: semver.major,
				minor: semver.minor + 1,
				patch: 0,
			});
		case 'major':
			return formatSemver({
				major: semver.major + 1,
				minor: 0,
				patch: 0,
			});
		default:
			throw new Error(`未知版本类型: ${String(releaseType)}`);
	}
};

const parseSemver = (version: string) => {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
	if (!match) return null;

	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
};

const formatSemver = (semver: {
	major: number;
	minor: number;
	patch: number;
}) => `${semver.major}.${semver.minor}.${semver.patch}`;

const isValidVersion = (version: string) =>
	/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?$/.test(version);

const updatePackageVersion = async (
	manifestPath: string,
	nextVersion: string,
) => {
	log(`写入版本号 -> ${nextVersion}`);
	if (isDryRun) return;

	const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PackageJson;
	manifest.version = nextVersion;
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`, 'utf8');
};

const warnIfGitDirty = async (selectedPackage: ReleasePackage) => {
	const output = await captureCommand('git', ['status', '--short'], rootDir);
	if (!output.trim()) return;

	log('检测到当前工作区存在未提交变更:');
	console.log(output.trim());
	log(
		`将继续发布 ${selectedPackage.manifest.name}，并且如果需要 commit，只会 git add ${path.relative(rootDir, selectedPackage.dirPath)} 和 pnpm-lock.yaml。`,
	);

	const shouldContinue = await askConfirm('继续执行?', true);
	if (!shouldContinue) {
		throw new Error('用户取消发布。');
	}
};

const printPlan = (plan: {
	selectedPackage: ReleasePackage;
	nextVersion: string;
	runBuild: boolean;
	createCommit: boolean;
	publishToNpm: boolean;
	pushGitRef: boolean;
	npmTag: string;
	commitMessage: string;
	gitTag: string;
}) => {
	console.log('\n发布计划');
	console.log(`- 包名: ${plan.selectedPackage.manifest.name}`);
	console.log(`- 路径: ${path.relative(rootDir, plan.selectedPackage.dirPath)}`);
	console.log(`- 当前版本: ${plan.selectedPackage.manifest.version}`);
	console.log(`- 目标版本: ${plan.nextVersion}`);
	console.log(`- 执行 build: ${plan.runBuild ? 'yes' : 'no'}`);
	console.log(`- 创建 commit/tag: ${plan.createCommit ? 'yes' : 'no'}`);
	console.log(`- 发布 npm: ${plan.publishToNpm ? 'yes' : 'no'}`);
	console.log(`- 推送远端: ${plan.pushGitRef ? 'yes' : 'no'}`);
	if (plan.publishToNpm) {
		console.log(`- npm tag: ${plan.npmTag}`);
	}
	if (plan.createCommit) {
		console.log(`- commit: ${plan.commitMessage}`);
		console.log(`- tag: ${plan.gitTag}`);
	}
	console.log('');
};

const askChoice = async <T>(
	title: string,
	options: Array<{ label: string; value: T }>,
): Promise<T> => {
	console.log(`\n${title}`);
	options.forEach((option, index) => {
		console.log(`${index + 1}. ${option.label}`);
	});

	while (true) {
		const answer = await askInput('请输入序号');
		const index = Number(answer);
		if (Number.isInteger(index) && index >= 1 && index <= options.length) {
			return options[index - 1].value;
		}
		log('输入无效，请重新输入。');
	}
};

const askInput = async (label: string, defaultValue = ''): Promise<string> => {
	const suffix = defaultValue ? ` (${defaultValue})` : '';
	const answer = (await rl.question(`${label}${suffix}: `)).trim();
	return answer || defaultValue;
};

const askConfirm = async (
	label: string,
	defaultValue: boolean,
): Promise<boolean> => {
	const suffix = defaultValue ? 'Y/n' : 'y/N';

	while (true) {
		const answer = (await rl.question(`${label} [${suffix}]: `))
			.trim()
			.toLowerCase();

		if (!answer) return defaultValue;
		if (['y', 'yes'].includes(answer)) return true;
		if (['n', 'no'].includes(answer)) return false;
		log('请输入 y 或 n。');
	}
};

const runCommand = async (
	command: string,
	args: string[],
	cwd: string,
) => {
	const renderedCommand = [command, ...args].join(' ');
	log(`$ ${renderedCommand}`);

	if (isDryRun) return;

	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: 'inherit',
			shell: false,
		});

		child.on('close', (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`命令执行失败: ${renderedCommand}`));
		});
	});
};

const captureCommand = async (
	command: string,
	args: string[],
	cwd: string,
) => {
	return new Promise<string>((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: false,
		});

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk) => {
			stdout += String(chunk);
		});

		child.stderr.on('data', (chunk) => {
			stderr += String(chunk);
		});

		child.on('close', (code) => {
			if (code === 0) {
				resolve(stdout);
				return;
			}
			reject(new Error(stderr || `命令执行失败: ${command}`));
		});
	});
};

const log = (message: string) => {
	console.log(`[release] ${message}`);
};

void main();
