const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {sourceImports, assertDirectImports, assertInstalledIosPods} = require('../check-native-linking.cjs');

test('shared TSX imports cannot rely on another app hoisting a native dependency', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'goviet-native-audit-'));
  try {
    fs.writeFileSync(path.join(dir,'Chat.tsx'),"import AsyncStorage from '@react-native-async-storage/async-storage';\nimport * as Location from 'expo-location';\nimport path from 'node:path';\nconst media = import('expo-image-picker');\nconst audio = require('expo-av');");
    fs.mkdirSync(path.join(dir,'node_modules'));fs.writeFileSync(path.join(dir,'node_modules','unused.js'),"import missing from 'not-app-source';");
    const imports=sourceImports([dir]);
    assert.deepEqual([...imports.keys()].sort(),['@react-native-async-storage/async-storage','expo-av','expo-image-picker','expo-location'].sort());
    const manifest={name:'driver-mobile',dependencies:{'expo-location':'~19.0.8','expo-av':'~16.0.8','expo-image-picker':'~17.0.10'}};
    assert.throws(()=>assertDirectImports(manifest,imports),/async-storage.*not directly declared/);
    manifest.dependencies['@react-native-async-storage/async-storage']='2.2.0';
    assert.doesNotThrow(()=>assertDirectImports(manifest,imports));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('iOS resolver success is insufficient when installed Pods omit AsyncStorage', () => {
  const rn={dependencies:{storage:{platforms:{ios:{podspecPath:'/node_modules/storage/RNCAsyncStorage.podspec'}}}}};
  const expo={modules:[{packageName:'expo-location',pods:[{podName:'ExpoLocation'}]}]};
  // Declaring a Pod in DEPENDENCIES is not proof it was installed in PODS.
  const stale='PODS:\n  - ExpoLocation (19.0.8):\n\nDEPENDENCIES:\n  - RNCAsyncStorage (from `../node_modules/storage`)\n';
  assert.throws(()=>assertInstalledIosPods(stale,rn,expo),/missing RNCAsyncStorage/);
  const installed='PODS:\n  - RNCAsyncStorage (2.2.0):\n  - ExpoLocation (19.0.8):\n\nDEPENDENCIES:\n';
  assert.doesNotThrow(()=>assertInstalledIosPods(installed,rn,expo));
  assert.throws(()=>assertInstalledIosPods('PODS:\n  - RNCAsyncStorage (2.2.0):\n',rn,expo),/missing ExpoLocation/);
});
