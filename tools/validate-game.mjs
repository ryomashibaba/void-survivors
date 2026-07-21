import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const defaultRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const root = resolve(process.argv[2] || defaultRoot);
const errors = [];
const warnings = [];
const checks = [];

function pass(message){ checks.push(message); }
function fail(message){ errors.push(message); }
function warn(message){ warnings.push(message); }
function read(path){ return readFileSync(join(root,path),"utf8").replace(/^\uFEFF/,""); }
function allFiles(dir){
  const absolute=join(root,dir);
  if(!existsSync(absolute))return[];
  const out=[];
  for(const entry of readdirSync(absolute)){
    const path=join(absolute,entry);
    if(statSync(path).isDirectory())out.push(...allFiles(relative(root,path)));
    else out.push(relative(root,path).replaceAll("\\","/"));
  }
  return out;
}

const required=["index.html","apply-update.bat","apply-update.ps1","assets/js/abyss-systems.js","assets/css/abyss-systems.css","tools/abyss-smoke-test.mjs"];
for(const path of required){if(existsSync(join(root,path)))pass(`exists: ${path}`);else fail(`missing required file: ${path}`);}

if(existsSync(join(root,"index.html"))){
  const html=read("index.html");
  const refs=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
  for(const ref of refs){
    if(/^(?:https?:|data:|\/)/i.test(ref))fail(`non-relative asset reference: ${ref}`);
    else if(!existsSync(join(root,ref)))fail(`referenced asset does not exist: ${ref}`);
  }
  if(refs.length)pass(`asset references: ${refs.length}`);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  const duplicates=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
  if(duplicates.length)fail(`duplicate HTML ids: ${duplicates.join(", ")}`);else pass(`unique HTML ids: ${ids.length}`);
  const gameIndex=html.indexOf('src="assets/js/game.js"');
  const systemsIndex=html.indexOf('src="assets/js/abyss-systems.js"');
  if(gameIndex<0||systemsIndex<0||gameIndex>systemsIndex)fail("script order must load game.js before abyss-systems.js");else pass("runtime script order");
  if(html.includes('src="assets/js/chroma-rebirth.js"'))fail("retired chroma-rebirth.js is still loaded");else pass("legacy rebirth runtime retired");
  if(!html.includes('href="assets/css/abyss-systems.css"'))fail("abyss-systems.css is not loaded");
}

const scripts=allFiles("assets/js").filter(path=>extname(path)===".js");
for(const script of scripts){
  const result=spawnSync(process.execPath,["--check",join(root,script)],{encoding:"utf8"});
  if(result.status!==0)fail(`JavaScript syntax: ${script}\n${result.stderr||result.stdout}`);
}
if(scripts.length)pass(`JavaScript syntax checked: ${scripts.length} files`);

const smokePath=join(root,"tools/abyss-smoke-test.mjs");
if(existsSync(smokePath)){
  const syntax=spawnSync(process.execPath,["--check",smokePath],{encoding:"utf8"});
  if(syntax.status!==0)fail(`smoke-test syntax\n${syntax.stderr||syntax.stdout}`);
  else {
    const smoke=spawnSync(process.execPath,[smokePath],{encoding:"utf8",timeout:30000});
    if(smoke.status!==0)fail(`integrated runtime smoke test\n${smoke.stderr||smoke.stdout}`);
    else pass(`integrated runtime smoke test: ${(smoke.stdout||"").trim()}`);
  }
}

if(existsSync(join(root,"assets/css/abyss-systems.css"))){
  const css=read("assets/css/abyss-systems.css").replace(/\/\*[\s\S]*?\*\//g,"");
  const opens=(css.match(/\{/g)||[]).length,closes=(css.match(/\}/g)||[]).length;
  if(opens!==closes)fail(`CSS brace mismatch: ${opens} opening / ${closes} closing`);else pass(`CSS brace balance: ${opens}`);
}

if(existsSync(join(root,"assets/js/abyss-systems.js"))){
  const systems=read("assets/js/abyss-systems.js");
  const expectedPowers=[
    "solar_funeral","world_cutter","storm_throne","gravity_coffin","meteor_scripture",
    "razor_constellation","comet_wake","mirror_legion","void_choir","doom_bloom",
    "black_sun","time_execution","leviathan_shell","blood_eclipse","hunter_verdict",
    "prism_web","chaos_oracle","treasure_singularity","overdrive_contract","abyss_banquet"
  ];
  const missingPowers=expectedPowers.filter(id=>!systems.includes(`${id}:`));
  if(missingPowers.length)fail(`missing power definitions: ${missingPowers.join(", ")}`);else pass("20 power definitions");
  const synergyIds=["helios_scripture","frozen_thunder","horizon_blade","kinetic_guillotine","infinite_refraction","eclipse_choir","execution_garden","crimson_carapace","golden_feast","ruin_engine"];
  const missingSynergies=synergyIds.filter(id=>!systems.includes(`${id}:`));
  if(missingSynergies.length)fail(`missing synergy definitions: ${missingSynergies.join(", ")}`);else pass("10 synergy definitions");
  for(const token of ["EVOLUTIONS","STAGE_RULES","CHALLENGES","resultAnalyticsHtml","AbyssMusic","openRewardScreen","powerSlotLimit"]){
    if(!systems.includes(token))fail(`missing integrated system token: ${token}`);
  }
  if(systems.includes('localStorage.removeItem("void_survivors_records")'))fail("save key is deleted");
  if(!systems.includes('const SAVE_KEY = "void_survivors_records"'))fail("save key compatibility missing");else pass("save key compatibility");
  if(/(?:href|src)\s*=\s*["']\//.test(systems))fail("absolute asset path found in systems script");
}

if(existsSync(join(root,"apply-update.ps1"))){
  const ps1=read("apply-update.ps1");
  if(!ps1.includes("tools\\validate-game.mjs"))fail("apply-update.ps1 does not run the full validator");else pass("PowerShell invokes full validator");
  if(!ps1.includes("git apply --check"))fail("apply-update.ps1 lost git apply --check");
  if(!ps1.includes("git diff --check"))fail("apply-update.ps1 lost git diff --check");
}
if(existsSync(join(root,"apply-update.bat"))){
  const bat=read("apply-update.bat").toLowerCase();
  if(!bat.includes("apply-update.ps1"))fail("apply-update.bat does not invoke apply-update.ps1");else pass("batch wrapper invokes PowerShell");
  if(!bat.includes("exit /b"))warn("apply-update.bat does not propagate the PowerShell exit code");
}

for(const message of checks)console.log(`OK   ${message}`);
for(const message of warnings)console.warn(`WARN ${message}`);
if(errors.length){
  for(const message of errors)console.error(`FAIL ${message}`);
  console.error(`\nValidation failed: ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(`\nValidation passed: ${checks.length} checks, ${warnings.length} warning(s).`);
