// 打包与校验（发布流程）：npm run pack:check
// 依次执行：现有测试（语法 + 单测 + 冒烟）→ 安装契约检查 → npm pack → 包内容校验。
// 产出 ../dist/<name>-<version>.tgz，打印 JSON 结果（含 SHA-256）。
// 发布时把该 tgz 以固定附件名 dsh-content-workbench.tgz 上传到正式 GitHub Release。
import {readFile,stat} from 'node:fs/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const requiredFiles=['package.json','src/index.js','lib/client.js','public/index.html','public/app.js','public/app.css','cordis.patch.yml','README.md','LICENSE'];
// 1) 现有测试
for(const f of ['src/index.js','lib/client.js','public/app.js']){const r=spawnSync(process.execPath,['--check',join(root,f)],{encoding:'utf8'});assert.equal(r.status,0,'syntax '+f+': '+r.stderr);}
const unit=spawnSync(process.execPath,['--test','--test-isolation=none'],{cwd:root,encoding:'utf8'});assert.equal(unit.status,0,'unit tests failed:\n'+(unit.stdout||'')+unit.stderr);
const smoke=spawnSync(process.execPath,['scripts/smoke.mjs'],{cwd:root,encoding:'utf8'});assert.equal(smoke.status,0,'smoke failed:\n'+(smoke.stdout||'')+smoke.stderr);
// 2) 安装契约
assert.equal(pkg.dsh?.bundle?.patch,'./cordis.patch.yml','dsh.bundle.patch required');
assert.ok(pkg.dsh?.client?.inject?.includes('dsh-desktop-workbenches'),'client.inject must include dsh-desktop-workbenches');
assert.ok(pkg.exports?.['./client'],'exports["./client"] required');
assert.ok(String(pkg.repository?.url||'').includes('github.com/gjz18342624299-arch/dsh-content-workbench'),'repository must point back to this repo');
assert.equal(pkg.license,'MIT','MIT license required');
// 3) 打包
const output=resolve(root,'../dist');await mkdir(output,{recursive:true});
const npmArgs=['pack','--ignore-scripts','--json','--pack-destination',output];
const exec=process.env.npm_execpath;
const packed=exec&&exec.endsWith('.js')
  ?spawnSync(process.execPath,[exec,...npmArgs],{cwd:root,encoding:'utf8'})
  :spawnSync(process.platform==='win32'?'npm.cmd':'npm',npmArgs,{cwd:root,encoding:'utf8',shell:process.platform==='win32'});
if(packed.status!==0)throw Error(String(packed.stderr||packed.stdout));
const [info]=JSON.parse(packed.stdout);const files=new Set(info.files.map(f=>f.path));
for(const f of requiredFiles)assert.ok(files.has(f),'missing '+f);
for(const f of files)assert.ok(!/(^|\/)(test|scripts|docs|node_modules|\.git|work|outputs|dist|\.env)(\/|$)/i.test(f),'development file in package: '+f);
for(const f of files){if(!/\.(?:js|mjs|cjs|json|ya?ml|md|html|css)$/.test(f))continue;const text=await readFile(join(root,f),'utf8');assert.ok(!/[A-Z]:[\\/](?:Users|Cpan|DSH)[\\/]/i.test(text),'personal absolute path in '+f);}
const tgz=join(output,info.filename);const bytes=(await stat(tgz)).size;assert.ok(bytes<=8*1024*1024,'market package exceeds 8 MiB');
const sha256=createHash('sha256').update(await readFile(tgz)).digest('hex').toUpperCase();
const report={name:pkg.name,version:pkg.version,file:tgz,bytes,fileCount:files.size,sha256,requiredEntrypoints:true,privateFilesExcluded:true,installContract:true,testsPassed:true};
console.log(JSON.stringify(report,null,2));
await writeFile(join(output,'pack-report.json'),JSON.stringify(report,null,2)+'\n');
