// forge.config.js
const path = require('node:path');

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    asar: true,
    prune: true,
    // Use your current .ico fallback; upgrade to a multi-size icon.ico when ready
    icon: path.resolve(__dirname, 'assets', 'favicon.ico'),
    appBundleId: 'com.electron.notes',
    win32metadata: {
      CompanyName: 'Your Company',
      FileDescription: 'Gooey Notes',
      ProductName: 'Gooey Notes',
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // Unsigned build: do NOT set certificateFile/certificatePassword
        setupIcon: path.resolve(__dirname, 'assets', 'favicon.ico'),
        setupExe: 'Gooey-Notes-Setup.exe',
        exe: 'Gooey Notes.exe',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
  ],
};