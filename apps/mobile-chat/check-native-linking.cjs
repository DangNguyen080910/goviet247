const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {builtinModules} = require('node:module');
const {spawnSync} = require('node:child_process');
const ts = require('typescript');
const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
const skip = new Set(['node_modules', 'ios', 'android', '.expo', 'build', 'dist', 'scripts', 'tests', '.git']);
function sourceImports(roots) {
  const imports = new Map();
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      if (skip.has(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {walk(file); continue;}
      if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node) {
        let spec;
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) spec = node.moduleSpecifier.text;
        if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')) spec = node.arguments[0].text;
        if (spec && !spec.startsWith('.') && !spec.startsWith('@/') && !spec.startsWith('node:') && !builtins.has(spec)) {
          const name = spec.startsWith('@') ? spec.split('/').slice(0,2).join('/') : spec.split('/')[0];
          if (!imports.has(name)) imports.set(name, file);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  roots.forEach(walk);
  return imports;
}
function assertDirectImports(manifest, imports) {
  const declared = {...manifest.dependencies, ...manifest.devDependencies};
  for (const [name, file] of imports) assert(declared[name], `${manifest.name}: ${name} is imported by ${file} but is not directly declared in package.json.`);
}
function expectedIosPods(rn, expo) {
  const pods = new Set(expo.modules.flatMap(module => (module.pods || []).map(p => p.podName)));
  for (const dependency of Object.values(rn.dependencies)) {
    const podspec = dependency.platforms?.ios?.podspecPath;
    if (podspec) pods.add(path.basename(podspec, '.podspec'));
  }
  return pods;
}
function assertInstalledIosPods(lockfile, rn, expo) {
  const installedSection = lockfile.split('\nDEPENDENCIES:')[0];
  const installed = new Set(installedSection.split('\n').filter(line => line.startsWith('  - ')).map(line => line.slice(4).split(' (')[0].split('/')[0]));
  for (const pod of expectedIosPods(rn, expo)) {
    assert(installed.has(pod), `iOS native install is missing ${pod}. Re-run pod install; do not publish this build.`);
  }
}

function run({appRoot = process.cwd(), platform = process.argv[2] || process.env.EAS_BUILD_PLATFORM || 'android'} = {}) {
  assert(['android','ios'].includes(platform), 'Expected android or ios.');
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  assertDirectImports(manifest, sourceImports([appRoot, __dirname]));
  const packagePath = require.resolve('expo-modules-autolinking/package.json', {paths:[appRoot]});
  const pkg = require(packagePath), cli = path.resolve(path.dirname(packagePath), pkg.bin['expo-modules-autolinking']);
  const command = args => {
    const result = spawnSync(process.execPath, [cli,...args,'--json'], {cwd:appRoot,encoding:'utf8',maxBuffer:10*1024*1024});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  const rn = command(['react-native-config','--platform',platform]);
  const expoPlatform = platform === 'ios' ? 'apple' : 'android';
  const expo = command(['resolve','--platform',expoPlatform]);
  let checked = 0;
  for (const name of Object.keys(manifest.dependencies)) {
    if (name === 'react-native') continue;
    const dir = path.dirname(require.resolve(`${name}/package.json`, {paths:[appRoot]}));
    const moduleConfig = path.join(dir,'expo-module.config.json');
    if (fs.existsSync(moduleConfig)) {
      const config = JSON.parse(fs.readFileSync(moduleConfig,'utf8'));
      if (config.platforms && !config.platforms.includes(expoPlatform) && !config.platforms.includes(platform)) continue;
      assert(expo.modules.some(m => m.packageName === name), `${name} missing from ${platform} Expo native autolinking.`);
      checked++;
    } else if (fs.readdirSync(dir).some(file => file.endsWith('.podspec'))) {
      assert(rn.dependencies[name]?.platforms?.[platform], `${name} missing from ${platform} React Native autolinking.`);
      checked++;
    }
  }
  // EAS's iOS post-install hook runs AFTER pod install, so inspect the actual
  // installed native manifest as well as what the resolver intends to link.
  if (platform === 'ios' && (process.env.EAS_BUILD === 'true' || process.argv.includes('--check-installed'))) {
    const lockfile = fs.readFileSync(path.join(appRoot,'ios','Podfile.lock'),'utf8');
    assertInstalledIosPods(lockfile, rn, expo);
    console.log(`${manifest.name}: installed iOS Pods verified.`);
  }
  console.log(`${manifest.name}: direct imports and ${checked} native dependencies verified for ${platform}.`);
}
module.exports = {sourceImports, assertDirectImports, assertInstalledIosPods, run};
if (require.main === module) run();
