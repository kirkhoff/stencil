import { AppRegistry, BuildConfig, BuildContext, ComponentRegistry, AppRegistryComponents } from '../../util/interfaces';
import { getLoaderFileName, getRegistryJsonWWW } from './app-file-naming';


export function createAppRegistry(config: BuildConfig) {
  // create the shared app registry object
  const appRegistry: AppRegistry = {
    namespace: config.namespace,
    fsNamespace: config.fsNamespace,
    loader: `../${getLoaderFileName(config)}`
  };

  return appRegistry;
}


export function getAppRegistry(config: BuildConfig) {
  const registryJsonFilePath = getRegistryJsonWWW(config);
  let appRegistry: AppRegistry;

  try {
    // open up the app registry json file
    const appRegistryJson = config.sys.fs.readFileSync(registryJsonFilePath, 'utf-8');

    // parse the json into app registry data
    appRegistry = JSON.parse(appRegistryJson);

    config.logger.debug(`parsed app registry: ${registryJsonFilePath}`);

  } catch (e) {
    throw new Error(`Error parsing app registry, ${registryJsonFilePath}: ${e}`);
  }

  return appRegistry;
}


export function serializeComponentRegistry(cmpRegistry: ComponentRegistry) {
  const appRegistryComponents: AppRegistryComponents = {};

  Object.keys(cmpRegistry).sort().forEach(tagName => {
    appRegistryComponents[tagName] = cmpRegistry[tagName].bundleIds;
  });

  return appRegistryComponents;
}


export function writeAppRegistry(config: BuildConfig, ctx: BuildContext, appRegistry: AppRegistry, cmpRegistry: ComponentRegistry) {
  if (!config.generateWWW) {
    // only create a registry for www builds
    return;
  }

  appRegistry.components = serializeComponentRegistry(cmpRegistry);

  const registryJson = JSON.stringify(appRegistry, null, 2);

  // app registry json file is actually different from our last saved version
  if (ctx.appFiles.registryJson === registryJson) {
    return;
  }

  // cache so we can check if it changed on rebuilds
  ctx.appFiles.registryJson = registryJson;

  const appRegistryWWW = getRegistryJsonWWW(config);
  config.logger.debug(`build, app www registry: ${appRegistryWWW}`);
  ctx.filesToWrite[appRegistryWWW] = registryJson;

  ctx.appFileBuildCount++;
}
