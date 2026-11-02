// Patches the generated AndroidManifest.xml:
//  - adds the VIBRATE permission (navigator.vibrate haptics do nothing without it)
//  - locks the app to portrait (the layout is designed for a tall phone screen)
// Safe to run more than once.
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'android/app/src/main/AndroidManifest.xml';
let xml = readFileSync(file, 'utf8');

if (!xml.includes('android.permission.VIBRATE')) {
  xml = xml.replace(
    '</manifest>',
    '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>'
  );
}
if (!xml.includes('android:screenOrientation')) {
  xml = xml.replace(
    'android:launchMode="singleTask"',
    'android:launchMode="singleTask"\n            android:screenOrientation="portrait"'
  );
}
writeFileSync(file, xml);
console.log('AndroidManifest.xml patched');
