#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { confirm, input, select, Separator } from '@inquirer/prompts';
import pc from 'picocolors';
import semver from 'semver';
import stringWidth from 'string-width';

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

type RegistryStatus =
	| { kind: 'published'; latestVersion: string }
	| { kind: 'unpublished' }
	| { kind: 'unknown'; reason: string };

type ResolvedRegistryStatus = Exclude<RegistryStatus, { kind: 'unknown' }>;

type ReleaseMode = 'keep' | 'patch' | 'minor' | 'major' | 'custom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');
const lockfileName = 'pnpm-lock.yaml';
const isDryRun = process.argv.includes('--dry-run');

const main = async () => {
	try {
		if (process.argv.includes('--help') || process.argv.includes('-h')) {
			printHelp();
			return;
		}

		printHeader();

		const packages = await getReleasePackages();
		if (packages.length === 0) {
			throw new Error('未找到可发布的包，请检查 packages/*/package.json。');
		}

		const pkg = await promptPackage(packages);
		const detectedRegistryStatus = await detectRegistryStatus(
			pkg.manifest.name,
		);
		const registryStatus = await resolveRegistryStatus(detectedRegistryStatus);
		const nextVersion = await promptVersion(pkg, registryStatus);

		const shouldBuild = await confirm({
			message: '发布前执行 build?',
			default: true,
		});
		const shouldCommit = await confirm({
			message: '自动创建 git commit 和 tag?',
			default: true,
		});
		const shouldPublish = await confirm({
			message: '执行 npm publish?',
			default: true,
		});
		const shouldPush =
			shouldCommit &&
			(await confirm({
				message: '发布后推送 commit 和 tag 到远端?',
				default: false,
			}));

		const npmTag = shouldPublish
			? await input({
					message: 'npm dist-tag',
					default: nextVersion.includes('-') ? 'next' : 'latest',
					validate: (value) =>
						value.trim().length > 0 || 'npm dist-tag 不能为空',
				})
			: '';

		const commitMessage = shouldCommit
			? await input({
					message: 'Commit message',
					default: `chore(release): ${pkg.manifest.name}@${nextVersion}`,
					validate: (value) => value.trim().length > 0 || '提交信息不能为空',
				})
			: '';

		const gitTag = shouldCommit
			? await input({
					message: 'Git tag',
					default: `${pkg.manifest.name
						.replace(/^@/, '')
						.replace(/\//g, '-')}-v${nextVersion}`,
					validate: (value) => value.trim().length > 0 || 'git tag 不能为空',
				})
			: '';

		printSummary({
			pkg,
			registryStatus,
			nextVersion,
			shouldBuild,
			shouldCommit,
			shouldPublish,
			shouldPush,
			npmTag,
			commitMessage,
			gitTag,
		});

		const shouldRun = await confirm({
			message: isDryRun ? '执行 dry-run 预演?' : '确认执行发布流程?',
			default: true,
		});

		if (!shouldRun) {
			logWarn('已取消发布。');
			return;
		}

		await warnIfGitDirty(pkg);
		await updatePackageVersion(pkg, nextVersion);

		if (shouldBuild) {
			await runCommand(
				'pnpm',
				['--filter', pkg.manifest.name, 'build'],
				rootDir,
			);
		}

		if (shouldCommit) {
			await stageReleaseFiles(pkg);
			const hasStagedChanges = await hasCachedDiff();

			if (hasStagedChanges) {
				await runCommand('git', ['commit', '-m', commitMessage], rootDir);
			} else {
				logWarn(
					'没有检测到可提交的暂存变更，将跳过 commit，直接使用当前 HEAD 创建 tag。',
				);
			}

			await runCommand('git', ['tag', gitTag], rootDir);
		}

		if (shouldPublish) {
			await runCommand(
				'npm',
				['publish', '--access', 'public', '--tag', npmTag],
				pkg.dirPath,
			);
		}

		if (shouldPush) {
			await runCommand('git', ['push'], rootDir);
			await runCommand('git', ['push', '--tags'], rootDir);
		}

		logSuccess(isDryRun ? 'dry-run 完成。' : '发布流程完成。');
	} catch (error) {
		if (error instanceof Error && error.name === 'ExitPromptError') {
			console.log(`\n${pc.yellow('已取消操作。')}`);
			return;
		}

		const message = error instanceof Error ? error.message : String(error);
		console.error(`\n${pc.red('发布失败:')} ${message}`);
		process.exitCode = 1;
	}
};

const printHeader = () => {
	console.log('');
	console.log(pc.bold(pc.cyan('relax-monitor release')));
	console.log(pc.dim('选择包、确认版本、自动完成构建/提交/发布。'));
	console.log(pc.dim(isDryRun ? 'Mode: dry-run' : 'Mode: real run'));
};

const printHelp = () => {
	console.log('用法: pnpm release');
	console.log('可选参数:');
	console.log('  --dry-run   仅预演流程，不真正改文件或执行发布命令');
	console.log('  --help      查看帮助');
};

const getReleasePackages = async (): Promise<ReleasePackage[]> => {
	const entries = await readdir(packagesDir, { withFileTypes: true });
	const result: ReleasePackage[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const dirPath = path.join(packagesDir, entry.name);
		const manifestPath = path.join(dirPath, 'package.json');
		if (!existsSync(manifestPath)) continue;

		const manifest = JSON.parse(
			await readFile(manifestPath, 'utf8'),
		) as PackageJson;

		if (!manifest.name || !manifest.version || manifest.private) continue;

		result.push({
			dirName: entry.name,
			dirPath,
			manifestPath,
			manifest,
		});
	}

	return result.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
};

const promptPackage = async (packages: ReleasePackage[]) => {
	return select<ReleasePackage>({
		message: '选择要发布的包',
		choices: packages.map((pkg) => ({
			name: pkg.manifest.name,
			description: `当前版本 ${pkg.manifest.version} · packages/${pkg.dirName}`,
			value: pkg,
		})),
	});
};

const detectRegistryStatus = async (
	packageName: string,
): Promise<RegistryStatus> => {
	logInfo(`检查 npm 上的发布状态: ${packageName}`);

	try {
		const output = await captureCommand(
			'npm',
			['view', packageName, 'version', '--json'],
			rootDir,
		);
		const parsed = JSON.parse(output) as string | string[];
		const latestVersion = Array.isArray(parsed) ? parsed.at(-1) : parsed;

		if (typeof latestVersion === 'string' && semver.valid(latestVersion)) {
			logSuccess(`npm 已存在该包，最新版本 ${latestVersion}`);
			return { kind: 'published', latestVersion };
		}

		return { kind: 'unknown', reason: 'npm 返回了无法识别的版本信息' };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (
			message.includes('E404') ||
			message.includes('404 Not Found') ||
			message.includes('is not in this registry')
		) {
			logWarn('npm 上未找到该包，将按首次发布处理。');
			return { kind: 'unpublished' };
		}

		return {
			kind: 'unknown',
			reason: message.trim() || '无法连接 npm registry',
		};
	}
};

const resolveRegistryStatus = async (
	registryStatus: RegistryStatus,
): Promise<ResolvedRegistryStatus> => {
	if (registryStatus.kind !== 'unknown') {
		return registryStatus;
	}

	printPanel('npm 状态无法自动判断', [
		`原因: ${registryStatus.reason}`,
		'你可以手动指定这次是首次发布还是已存在包的常规发布。',
	]);

	const assumed = await select<'published' | 'unpublished'>({
		message: '如何继续?',
		choices: [
			{
				name: '按首次发布处理',
				description: 'npm 上还没有这个包',
				value: 'unpublished',
			},
			{
				name: '按已发布包处理',
				description: 'npm 上已经有这个包了',
				value: 'published',
			},
		],
	});

	if (assumed === 'unpublished') {
		return { kind: 'unpublished' };
	}

	const latestVersion = await input({
		message: '请输入 npm 上当前最新版本',
		validate: (value) =>
			semver.valid(value) ? true : '请输入合法的 semver 版本号，例如 1.2.3',
	});

	return { kind: 'published', latestVersion };
};

const promptVersion = async (
	pkg: ReleasePackage,
	registryStatus: ResolvedRegistryStatus,
): Promise<string> => {
	const localVersion = pkg.manifest.version;
	const localValidVersion = semver.valid(localVersion);

	if (!localValidVersion) {
		return input({
			message: `当前 package.json 版本 ${localVersion} 不是合法 semver，请输入目标版本`,
			default: localVersion,
			validate: (value) =>
				semver.valid(value) ? true : '请输入合法的 semver 版本号',
		});
	}

	if (registryStatus.kind === 'unpublished') {
		printPanel('首次发布', [
			`本地版本: ${localVersion}`,
			'这次会按首次发布处理，不需要依赖 npm 上的已有版本。',
		]);

		const releaseMode = await select<ReleaseMode>({
			message: '选择版本策略',
			choices: [
				{
					name: `使用当前版本 ${localVersion}`,
					value: 'keep',
				},
				new Separator(),
				{
					name: '自定义版本号',
					value: 'custom',
				},
			],
		});

		if (releaseMode === 'keep') {
			return localVersion;
		}

		return input({
			message: '输入首次发布版本号',
			default: localVersion,
			validate: (value) =>
				semver.valid(value) ? true : '请输入合法的 semver 版本号',
		});
	}

	const baseVersion = semver.gte(localVersion, registryStatus.latestVersion)
		? localVersion
		: registryStatus.latestVersion;

	// 本地版本落后于 npm 时，升级基线以 npm 最新版本为准，避免生成重复版本。
	if (baseVersion !== localVersion) {
		printPanel('版本基线已调整', [
			`本地 package.json: ${localVersion}`,
			`npm 最新版本: ${registryStatus.latestVersion}`,
			`后续 patch/minor/major 将以 ${baseVersion} 为基线计算。`,
		]);
	}

	const patchVersion = semver.inc(baseVersion, 'patch');
	const minorVersion = semver.inc(baseVersion, 'minor');
	const majorVersion = semver.inc(baseVersion, 'major');
	const canKeepCurrent = semver.gt(localVersion, registryStatus.latestVersion);

	const releaseMode = await select<ReleaseMode>({
		message: '选择版本策略',
		choices: [
			{
				name: `保持当前版本 ${localVersion}`,
				description: canKeepCurrent
					? '沿用 package.json 中的版本号'
					: `当前版本必须大于 npm 最新版本 ${registryStatus.latestVersion}`,
				value: 'keep',
				disabled: canKeepCurrent ? false : '当前版本不足以发布',
			},
			new Separator(),
			{
				name: `patch -> ${patchVersion}`,
				value: 'patch',
			},
			{
				name: `minor -> ${minorVersion}`,
				value: 'minor',
			},
			{
				name: `major -> ${majorVersion}`,
				value: 'major',
			},
			{
				name: '自定义版本号',
				value: 'custom',
			},
		],
	});

	if (releaseMode === 'keep') {
		return localVersion;
	}

	if (releaseMode === 'custom') {
		return input({
			message: '输入目标版本号',
			default: patchVersion ?? localVersion,
			validate: (value) => {
				if (!semver.valid(value)) {
					return '请输入合法的 semver 版本号';
				}
				if (!semver.gt(value, registryStatus.latestVersion)) {
					return `目标版本必须大于 npm 最新版本 ${registryStatus.latestVersion}`;
				}
				return true;
			},
		});
	}

	const nextVersion = semver.inc(baseVersion, releaseMode);
	if (!nextVersion) {
		throw new Error(`无法根据 ${baseVersion} 计算 ${releaseMode} 版本。`);
	}

	return nextVersion;
};

const warnIfGitDirty = async (pkg: ReleasePackage) => {
	const output = await captureCommand('git', ['status', '--short'], rootDir);
	if (!output.trim()) return;

	printPanel('检测到未提交变更', [
		output.trim(),
		`后续如果选择自动提交，只会 git add ${path.relative(rootDir, pkg.dirPath)} 和 ${lockfileName}。`,
	]);

	const shouldContinue = await confirm({
		message: '继续执行?',
		default: true,
	});

	if (!shouldContinue) {
		throw new Error('用户取消发布。');
	}
};

const updatePackageVersion = async (
	pkg: ReleasePackage,
	nextVersion: string,
) => {
	if (pkg.manifest.version === nextVersion) {
		logInfo(`版本保持不变: ${nextVersion}`);
		return;
	}

	logInfo(`写入版本号: ${pkg.manifest.version} -> ${nextVersion}`);
	if (isDryRun) return;

	const manifest = JSON.parse(
		await readFile(pkg.manifestPath, 'utf8'),
	) as PackageJson;
	manifest.version = nextVersion;
	await writeFile(
		pkg.manifestPath,
		`${JSON.stringify(manifest, null, '\t')}\n`,
		'utf8',
	);
};

const stageReleaseFiles = async (pkg: ReleasePackage) => {
	await runCommand(
		'git',
		['add', path.relative(rootDir, pkg.dirPath)],
		rootDir,
	);

	if (existsSync(path.join(rootDir, lockfileName))) {
		await runCommand('git', ['add', lockfileName], rootDir);
	}
};

const hasCachedDiff = async () => {
	if (isDryRun) return true;

	const result = await runCommandAllowFailure(
		'git',
		['diff', '--cached', '--quiet'],
		rootDir,
	);

	return result.exitCode === 1;
};

const printSummary = (summary: {
	pkg: ReleasePackage;
	registryStatus: ResolvedRegistryStatus;
	nextVersion: string;
	shouldBuild: boolean;
	shouldCommit: boolean;
	shouldPublish: boolean;
	shouldPush: boolean;
	npmTag: string;
	commitMessage: string;
	gitTag: string;
}) => {
	const publishState =
		summary.registryStatus.kind === 'published'
			? `已发布，npm 最新 ${summary.registryStatus.latestVersion}`
			: summary.registryStatus.kind === 'unpublished'
				? '首次发布'
				: 'npm 状态未知';

	const rows = [
		`包名: ${summary.pkg.manifest.name}`,
		`路径: packages/${summary.pkg.dirName}`,
		`本地版本: ${summary.pkg.manifest.version}`,
		`目标版本: ${summary.nextVersion}`,
		`npm 状态: ${publishState}`,
		`build: ${renderBool(summary.shouldBuild)}`,
		`commit/tag: ${renderBool(summary.shouldCommit)}`,
		`npm publish: ${renderBool(summary.shouldPublish)}`,
		`git push: ${renderBool(summary.shouldPush)}`,
	];

	if (summary.shouldPublish) {
		rows.push(`npm tag: ${summary.npmTag}`);
	}

	if (summary.shouldCommit) {
		rows.push(`commit: ${summary.commitMessage}`);
		rows.push(`tag: ${summary.gitTag}`);
	}

	printPanel('发布计划', rows);
};

const renderBool = (value: boolean) => (value ? pc.green('yes') : pc.dim('no'));

const printPanel = (title: string, lines: string[]) => {
	const cleanLines = lines.flatMap((line) => line.split('\n'));
	const width = Math.max(
		stringWidth(title),
		...cleanLines.map((line) => stringWidth(line)),
	);
	const top = `┌─ ${title} ${'─'.repeat(Math.max(0, width - stringWidth(title)))}─┐`;
	const bottom = `└${'─'.repeat(width + 4)}┘`;

	console.log('');
	console.log(pc.cyan(top));
	for (const line of cleanLines) {
		const padding = ' '.repeat(width - stringWidth(line));
		console.log(pc.cyan(`│ ${line}${padding} │`));
	}
	console.log(pc.cyan(bottom));
};

const runCommand = async (command: string, args: string[], cwd: string) => {
	const rendered = `${command} ${args.join(' ')}`;
	logInfo(`$ ${rendered}`);

	if (isDryRun) return;

	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: 'inherit',
			shell: false,
		});

		child.on('close', (code: number | null) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`命令执行失败: ${rendered}`));
		});
	});
};

const runCommandAllowFailure = async (
	command: string,
	args: string[],
	cwd: string,
) => {
	return new Promise<{ exitCode: number }>((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: 'ignore',
			shell: false,
		});

		child.on('close', (code: number | null) => {
			resolve({ exitCode: code ?? 1 });
		});
		child.on('error', reject);
	});
};

const captureCommand = async (command: string, args: string[], cwd: string) => {
	return new Promise<string>((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: false,
		});

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk: Buffer | string) => {
			stdout += String(chunk);
		});

		child.stderr.on('data', (chunk: Buffer | string) => {
			stderr += String(chunk);
		});

		child.on('close', (code: number | null) => {
			if (code === 0) {
				resolve(stdout.trim());
				return;
			}
			reject(new Error((stderr || stdout).trim() || `命令失败: ${command}`));
		});
	});
};

const logInfo = (message: string) => {
	console.log(`${pc.dim('•')} ${message}`);
};

const logWarn = (message: string) => {
	console.log(`${pc.yellow('!')} ${message}`);
};

const logSuccess = (message: string) => {
	console.log(`${pc.green('✔')} ${message}`);
};

void main();
