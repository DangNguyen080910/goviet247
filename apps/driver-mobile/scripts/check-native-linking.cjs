const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const appRoot = path.resolve(__dirname, '..');
const app = require(path.join(appRoot, 'package.json'));
const platform = process.argv[2] || process.env.EAS_BUILD_PLATFORM || 'android';
assert(['android','ios'].includes(platform), 'Expected android or ios.');
const name = '@react-native-async-storage/async-storage';
assert(app.dependencies?.[name], `${name} must be a direct Driver dependency because shared chat imports it.`);
const packagePath = require.resolve('expo-modules-autolinking/package.json', {paths:[appRoot]});
const pkg = require(packagePath);
const cli = path.resolve(path.dirname(packagePath),pkg.bin['expo-modules-autolinking']);
const result = spawnSync(process.execPath,[cli,'react-native-config','--platform',platform,'--json'],{cwd:appRoot,encoding:'utf8'});
if(result.status !== 0) {console.error(result.stderr || result.stdout);process.exit(result.status || 1);}
const config = JSON.parse(result.stdout);
assert(config.dependencies?.[name]?.platforms?.[platform], `AsyncStorage is missing from ${platform} native autolinking; do not release this build.`);
console.log(`Driver native preflight: AsyncStorage linked for ${platform}.`);
