import { BuildConfig, ManifestBundle, CopyTasks, DependentCollection } from './interfaces';
import { dashToPascalCase } from '../util/helpers';
import { normalizePath } from '../compiler/util';


export function validateBuildConfig(config: BuildConfig, setEnvVariables?: boolean) {
  if (!config) {
    throw new Error(`invalid build config`);
  }

  if (config._isValidated) {
    // don't bother if we've already validated this config
    return config;
  }

  if (!config.logger) {
    throw new Error(`config.logger required`);
  }
  if (!config.rootDir) {
    throw new Error('config.rootDir required');
  }
  if (!config.sys) {
    throw new Error('config.sys required');
  }

  validateNamespace(config);

  const path = config.sys.path;

  if (typeof (config as any).global === 'string') {
    // deprecated: 2017-12-12
    config.logger.warn(`stencil config property "global" has been renamed to "globalScript"`);
    config.globalScript = (config as any).global;
  }

  if (typeof config.globalScript === 'string' && !path.isAbsolute(config.globalScript)) {
    config.globalScript = normalizePath(path.join(config.rootDir, config.globalScript));
  }

  if (typeof config.globalStyle === 'string') {
    config.globalStyle = [config.globalStyle];
  }
  if (Array.isArray(config.globalStyle)) {
    config.globalStyle = config.globalStyle.map(globalStyle => {
      return normalizePath(path.join(config.rootDir, globalStyle));
    });
  }

  if (typeof (config as any).src === 'string') {
    // deprecated: 2017-08-14
    config.logger.warn(`stencil config property "src" has been renamed to "srcDir"`);
    config.srcDir = (config as any).src;
  }
  if (typeof config.srcDir !== 'string') {
    config.srcDir = DEFAULT_SRC_DIR;
  }
  if (!path.isAbsolute(config.srcDir)) {
    config.srcDir = normalizePath(path.join(config.rootDir, config.srcDir));
  }

  if (typeof config.wwwDir !== 'string') {
    config.wwwDir = DEFAULT_WWW_DIR;
  }
  if (!path.isAbsolute(config.wwwDir)) {
    config.wwwDir = normalizePath(path.join(config.rootDir, config.wwwDir));
  }

  if (typeof config.buildDir !== 'string') {
    config.buildDir = DEFAULT_BUILD_DIR;
  }
  if (!path.isAbsolute(config.buildDir)) {
    config.buildDir = normalizePath(path.join(config.wwwDir, config.buildDir));
  }

  if (typeof config.distDir !== 'string') {
    config.distDir = DEFAULT_DIST_DIR;
  }
  if (!path.isAbsolute(config.distDir)) {
    config.distDir = normalizePath(path.join(config.rootDir, config.distDir));
  }

  if (typeof config.collectionDir !== 'string') {
    config.collectionDir = DEFAULT_COLLECTION_DIR;
  }
  if (!path.isAbsolute(config.collectionDir)) {
    config.collectionDir = normalizePath(path.join(config.distDir, config.collectionDir));
  }

  if (typeof config.typesDir !== 'string') {
    config.typesDir = DEFAULT_TYPES_DIR;
  }
  if (!path.isAbsolute(config.typesDir)) {
    config.typesDir = normalizePath(path.join(config.distDir, config.typesDir));
  }

  if (typeof config.srcIndexHtml !== 'string') {
    config.srcIndexHtml = normalizePath(path.join(config.srcDir, DEFAULT_INDEX_HTML));
  }
  if (!path.isAbsolute(config.srcIndexHtml)) {
    config.srcIndexHtml = normalizePath(path.join(config.rootDir, config.srcIndexHtml));
  }

  if (typeof config.wwwIndexHtml !== 'string') {
    config.wwwIndexHtml = normalizePath(path.join(config.wwwDir, DEFAULT_INDEX_HTML));
  }
  if (!path.isAbsolute(config.wwwIndexHtml)) {
    config.wwwIndexHtml = normalizePath(path.join(config.rootDir, config.wwwDir));
  }

  if (typeof config.publicPath !== 'string') {
    // CLIENT SIDE ONLY! Do not use this for server-side file read/writes
    // this is a reference to the public static directory from the index.html running from a browser
    // in most cases it's just "build", as in index page would request scripts from `/build/`
    config.publicPath = normalizePath(
      path.relative(config.wwwDir, config.buildDir)
    );
    if (config.publicPath.charAt(0) !== '/') {
      // ensure prefix / by default
      config.publicPath = '/' + config.publicPath;
    }
  }
  if (config.publicPath.charAt(config.publicPath.length - 1) !== '/') {
    // ensure there's a trailing /
    config.publicPath += '/';
  }

  // default devMode false
  config.devMode = !!config.devMode;

  // default watch false
  config.watch = !!config.watch;

  if (typeof config.minifyCss !== 'boolean') {
    // if no config, minify css when it's the prod build
    config.minifyCss = (!config.devMode);
  }
  config.logger.debug(`minifyCss: ${config.minifyCss}`);

  if (typeof config.minifyJs !== 'boolean') {
    // if no config, minify js when it's the prod build
    config.minifyJs = (!config.devMode);
  }
  config.logger.debug(`minifyJs: ${config.minifyJs}`);

  if (typeof config.hashFileNames !== 'boolean' && typeof (config as any).hashFilenames === 'boolean') {
    config.hashFileNames = (config as any).hashFilenames;
    config.logger.warn(`"hashFilenames" was used in the config, did you mean "hashFileNames"? (Has a capital N)`);
  }

  if (typeof config.hashFileNames !== 'boolean') {
    // hashFileNames config was not provided, so let's create the default

    if (config.devMode || config.watch) {
      // dev mode should not hash filenames
      // during watch rebuilds it should not hash filenames
      config.hashFileNames = false;

    } else {
      // prod builds should hash filenames
      config.hashFileNames = true;
    }
  }
  config.logger.debug(`hashFileNames: ${config.hashFileNames}`);

  if (typeof config.hashedFileNameLength !== 'number') {
    config.hashedFileNameLength = DEFAULT_HASHED_FILENAME_LENTH;
  }
  if (config.hashFileNames) {
    if (config.hashedFileNameLength < 4) {
      throw new Error(`config.hashedFileNameLength must be at least 4 characters`);
    }
  }
  config.logger.debug(`hashedFileNameLength: ${config.hashedFileNameLength}`);

  config.generateDistribution = !!config.generateDistribution;

  if (typeof config.generateWWW !== 'boolean') {
    config.generateWWW = true;
  }

  if (config.copy) {
    // merge user copy tasks into the default
    config.copy = Object.assign({}, DEFAULT_COPY_TASKS, config.copy);

  } else if (config.copy === null || (config.copy as any) === false) {
    // manually forcing to skip the copy task
    config.copy = null;

  } else {
    // use the default copy tasks
    config.copy = Object.assign({}, DEFAULT_COPY_TASKS);
  }

  if (!config.watchIgnoredRegex) {
    config.watchIgnoredRegex = DEFAULT_WATCH_IGNORED_REGEX;
  }

  if (typeof config.hydratedCssClass !== 'string') {
    config.hydratedCssClass = DEFAULT_HYDRATED_CSS_CLASS;
  }

  if (typeof config.buildEs5 !== 'boolean') {
    if (config.devMode) {
      // default dev mode only builds es2015
      config.buildEs5 = false;

    } else {
      // default prod mode builds both es2015 and es5
      config.buildEs5 = true;
    }
  }

  if (typeof config.emptyDist !== 'boolean') {
    config.emptyDist = true;
  }

  if (typeof config.emptyWWW !== 'boolean') {
    config.emptyWWW = true;
  }

  if (typeof config.generateDocs !== 'boolean') {
    config.generateDocs = false;
  }

  if (!Array.isArray(config.includeSrc)) {
    config.includeSrc = DEFAULT_INCLUDES.map(include => {
      return config.sys.path.join(config.srcDir, include);
    });
  }

  if (!Array.isArray(config.excludeSrc)) {
    config.excludeSrc = DEFAULT_EXCLUDES.slice();
  }


  config.collections = config.collections || [];
  config.collections = config.collections.map(validateDependentCollection);

  config.bundles = config.bundles || [];

  validateUserBundles(config.bundles);

  // set to true so it doesn't bother going through all this again on rebuilds
  config._isValidated = true;

  config.logger.debug(`validated build config`);

  if (setEnvVariables !== false) {
    setProcessEnvironment(config);
  }

  return config;
}


export function validateNamespace(config: BuildConfig) {
  if (typeof config.namespace !== 'string') {
    config.namespace = DEFAULT_NAMESPACE;
  }

  config.namespace = config.namespace.trim();

  const invalidNamespaceChars = config.namespace.replace(/(\w)|(\-)|(\$)/g, '');
  if (invalidNamespaceChars !== '') {
    throw new Error(`Namespace "${config.namespace}" contains invalid characters: ${invalidNamespaceChars}`);
  }
  if (config.namespace.length < 3) {
    throw new Error(`Namespace "${config.namespace}" must be at least 3 characters`);
  }
  if (/^\d+$/.test(config.namespace.charAt(0))) {
    throw new Error(`Namespace "${config.namespace}" cannot have a number for the first character`);
  }
  if (config.namespace.charAt(0) === '-') {
    throw new Error(`Namespace "${config.namespace}" cannot have a dash for the first character`);
  }
  if (config.namespace.charAt(config.namespace.length - 1) === '-') {
    throw new Error(`Namespace "${config.namespace}" cannot have a dash for the last character`);
  }

  // the file system namespace is the one
  // used in filenames and seen in the url
  if (typeof config.fsNamespace !== 'string') {
    config.fsNamespace = config.namespace.toLowerCase();
  }

  if (config.namespace.includes('-')) {
    // convert to PascalCase
    // this is the same namespace that gets put on "window"
    config.namespace = dashToPascalCase(config.namespace);
  }
}


export function setProcessEnvironment(config: BuildConfig) {
  process.env.NODE_ENV = config.devMode ? 'development' : 'production';
}


export function validateDependentCollection(userInput: any) {
  if (!userInput || Array.isArray(userInput) || typeof userInput === 'number' || typeof userInput === 'boolean') {
    throw new Error(`invalid collection: ${userInput}`);
  }

  let collection: DependentCollection;

  if (typeof userInput === 'string') {
    collection = {
      name: userInput
    };

  } else {
    collection = userInput;
  }

  if (!collection.name || typeof collection.name !== 'string' || collection.name.trim() === '') {
    throw new Error(`missing collection name`);
  }

  collection.name = collection.name.trim();
  collection.includeBundledOnly = !!collection.includeBundledOnly;

  return collection;
}


export function validateUserBundles(manifestBundles: ManifestBundle[]) {
  if (!manifestBundles) {
    throw new Error(`Invalid bundles`);
  }

  // normalize bundle component tags
  // sort by tag name and ensure they're lower case
  manifestBundles.forEach(b => {
    if (!Array.isArray(b.components)) {
      throw new Error(`manifest missing bundle components array, instead received: ${b.components}`);
    }

    b.components = b.components.filter(c => typeof c === 'string' && c.trim().length);

    if (!b.components.length) {
      throw new Error(`No valid bundle components found within stencil config`);
    }

    b.components = b.components.map(tag => validateComponentTag(tag)).sort();
  });

  manifestBundles = manifestBundles.sort((a, b) => {
    if (a.components && a.components.length && b.components && b.components.length) {
      if (a.components[0].toLowerCase() < b.components[0].toLowerCase()) return -1;
      if (a.components[0].toLowerCase() > b.components[0].toLowerCase()) return 1;
    }
    return 0;
  });
}


export function validateComponentTag(tag: string) {
  if (typeof tag !== 'string') {
    throw new Error(`Tag "${tag}" must be a string type`);
  }

  tag = tag.trim().toLowerCase();

  if (tag.length === 0) {
    throw new Error(`Received empty tag value`);
  }

  if (tag.indexOf(' ') > -1) {
    throw new Error(`"${tag}" tag cannot contain a space`);
  }

  if (tag.indexOf(',') > -1) {
    throw new Error(`"${tag}" tag cannot be use for multiple tags`);
  }

  let invalidChars = tag.replace(/\w|-/g, '');
  if (invalidChars !== '') {
    throw new Error(`"${tag}" tag contains invalid characters: ${invalidChars}`);
  }

  if (tag.indexOf('-') === -1) {
    throw new Error(`"${tag}" tag must contain a dash (-) to work as a valid web component`);
  }

  if (tag.indexOf('--') > -1) {
    throw new Error(`"${tag}" tag cannot contain multiple dashes (--) next to each other`);
  }

  if (tag.indexOf('-') === 0) {
    throw new Error(`"${tag}" tag cannot start with a dash (-)`);
  }

  if (tag.lastIndexOf('-') === tag.length - 1) {
    throw new Error(`"${tag}" tag cannot end with a dash (-)`);
  }

  return tag;
}


const DEFAULT_SRC_DIR = 'src';
const DEFAULT_WWW_DIR = 'www';
const DEFAULT_BUILD_DIR = 'build';
const DEFAULT_INDEX_HTML = 'index.html';
const DEFAULT_DIST_DIR = 'dist';
const DEFAULT_COLLECTION_DIR = 'collection';
const DEFAULT_TYPES_DIR = 'types';
const DEFAULT_NAMESPACE = 'App';
const DEFAULT_HASHED_FILENAME_LENTH = 8;
const DEFAULT_INCLUDES = ['**/*.ts', '**/*.tsx'];
const DEFAULT_EXCLUDES = ['**/test/**', '**/*.spec.*'];
const DEFAULT_WATCH_IGNORED_REGEX = /(\.(jpg|jpeg|png|gif|woff|woff2|ttf|eot)|(?:^|[\\\/])(\.(?!\.)[^\\\/]+)$)$/i;
const DEFAULT_HYDRATED_CSS_CLASS = 'hydrated';

const DEFAULT_COPY_TASKS: CopyTasks = {
  assets: { src: 'assets', warn: false },
  manifestJson: { src: 'manifest.json', warn: false }
};
