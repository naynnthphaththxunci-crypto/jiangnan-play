import { readFileSync, writeFileSync } from 'node:fs'

const cfg = JSON.parse(readFileSync(new URL('../jiangnan.config.json', import.meta.url), 'utf8'))

const project = {
  description: '江南合成灰盒',
  packOptions: { ignore: [], include: [] },
  setting: {
    urlCheck: false,
    es6: true,
    enhance: true,
    postcss: true,
    minified: true,
    newFeature: true,
    coverView: true,
    nodeModules: false,
    autoAudits: false,
    showShadowRootInWxmlPanel: true,
    scopeDataCheck: false,
    uglifyFileName: false,
    checkInvalidKey: true,
    checkSiteMap: false,
    uploadWithSourceMap: false,
    compileHotReLoad: false,
    useMultiFrameRuntime: true,
    useApiHook: true,
    useApiHostProcess: true,
    babelSetting: { ignore: [], disablePlugins: [], outputPath: '' },
    bundle: false,
    useIsolateContext: true,
    useCompilerModule: false,
    userConfirmedUseCompilerModuleSwitch: false,
    userConfirmedBundleSwitch: false,
    packNpmManually: false,
    packNpmRelationList: [],
    minifyWXSS: true,
    minifyWXML: true,
    localPlugins: false,
    disableUseStrict: false,
    useCompilerPlugins: false,
    condition: false,
    swc: false,
    disableSWC: true,
  },
  compileType: 'game',
  libVersion: cfg.libVersion || '3.5.5',
  appid: cfg.appid,
  projectname: cfg.projectname || '江南合成',
  condition: {},
  simulatorPluginLibVersion: {},
  isGameTourist: false,
}

writeFileSync('dist-wx/project.config.json', JSON.stringify(project, null, 2) + '\n')
writeFileSync(
  'dist-wx/game.json',
  JSON.stringify(
    {
      deviceOrientation: 'portrait',
      showStatusBar: false,
      networkTimeout: {
        request: 10000,
        connectSocket: 10000,
        uploadFile: 10000,
        downloadFile: 10000,
      },
    },
    null,
    2,
  ) + '\n',
)

if (cfg.appid !== 'wx7c2e93b92833b6f4') {
  console.warn('appid is not the expected graybox id:', cfg.appid)
}
console.log('wrote dist-wx/project.config.json and dist-wx/game.json for', cfg.appid)
