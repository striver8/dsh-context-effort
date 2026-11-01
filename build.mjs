/**
 * 构建脚本：把 src/client/index.js 打成 DSH 客户端插件包。
 *
 * 输出格式必须与官方一致：
 *   window.__ModuleLoader__.load({ id: "<pkg>", factory: (require) => {...} })
 * 唯一 external 是 shell 提供的冻结基线模块表：
 *   react / react-dom / react/jsx-runtime / @deepseek-ai/dsh-client-ui-primitives
 * 其余全部内联（插件自包含，不能同步 require 别的 client*.js）。
 *
 * 用法：node build.mjs
 */

import { build } from 'esbuild'
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const PKG = 'dsh-context-effort'
const ENTRY = resolve(here, 'src/client/index.js')
const OUT = resolve(here, 'lib/client.js')

/** 浏览器侧冻结的基线模块表 —— 只能 require 这些。 */
const PLATFORM_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-ui-primitives',
]

async function ensureEsbuild() {
  try {
    return await import('esbuild')
  } catch {
    throw new Error('esbuild 未找到，请先运行：npm install')
  }
}

const esbuild = await ensureEsbuild()

await mkdir(dirname(OUT), { recursive: true })

const result = await esbuild.build({
  entryPoints: [ENTRY],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  write: false,
  external: PLATFORM_EXTERNALS,
  jsx: 'automatic',
  jsxImportSource: 'react',
  legalComments: 'none',
  charset: 'utf8',
  minify: false,
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
})

const body = result.outputFiles[0].text

// 包成 __ModuleLoader__ 工厂：执行 bundle 只注册 factory，副作用留在闭包里。
const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(PKG)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\t(function (module, exports, require) {
${body
  .split('\n')
  .map((line) => (line.length > 0 ? `\t\t\t${line}` : line))
  .join('\n')}
\t\t})(module, exports, require);
\t\treturn module.exports;
\t}
});
`

await writeFile(OUT, wrapped, 'utf8')

const size = Buffer.byteLength(wrapped, 'utf8')
const text = await readFile(OUT, 'utf8')
const externals = [...new Set([...text.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]))]
  .filter((name) => !name.startsWith('.'))
  .sort()

console.log(`[build] ${PKG} → lib/client.js  (${(size / 1024).toFixed(1)} KiB)`)
console.log(`[build] externals: ${externals.length > 0 ? externals.join(', ') : '(none)'}`)

const illegal = externals.filter((name) => !PLATFORM_EXTERNALS.includes(name))
if (illegal.length > 0) {
  console.error(`[build] ERROR 非基线 external: ${illegal.join(', ')}`)
  process.exitCode = 1
  await rm(OUT, { force: true })
}
