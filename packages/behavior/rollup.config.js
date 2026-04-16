import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
	input: 'src/index.ts', // 入口文件
	output: [
		{
			file: 'dist/index.cjs.js',
			format: 'cjs',
			sourcemap: true,
		},
		{
			file: 'dist/index.esm.js',
			format: 'es',
			sourcemap: true,
		},
		{
			file: 'dist/index.umd.js',
			format: 'umd',
			name: 'relaxworkBehaviorMonitor', // <script> 引入时的全局变量名',
			sourcemap: true,
			plugins: [terser()], // UMD 格式进行压缩体积
		},
	],
	plugins: [
		typescript({
			tsconfig: './tsconfig.json',
			declaration: true,
			declarationDir: 'dist',
		}),
		nodeResolve(), // 解析 node_modules 中的依赖
	],
};
