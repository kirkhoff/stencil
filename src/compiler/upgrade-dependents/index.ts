import { BuildConfig, BuildContext, Manifest, Bundle } from '../../util/interfaces';
import { CompilerUpgrade, validateManifestCompatibility } from './manifest-compatibility';
import { transformSourceString } from '../transpile/transformers/util';
import upgradeFrom0_0_5 from '../transpile/transformers/JSX_Upgrade_From_0_0_5/upgrade-jsx-props';
import upgradeFromMetadata from '../transpile/transformers/Metadata_Upgrade_From_0_1_0/metadata-upgrade';
import ts from 'typescript';


export async function upgradeDependentComponents(config: BuildConfig, ctx: BuildContext, bundles: Bundle[]) {
  const doUpgrade = createDoUpgrade(config, ctx, bundles);

  return Promise.all(Object.keys(ctx.dependentManifests).map(async collectionName => {
    const manifest = ctx.dependentManifests[collectionName];
    const upgrades = validateManifestCompatibility(config, manifest);

    try {
      await doUpgrade(manifest, upgrades);
    } catch (e) {
      config.logger.error(`error performing compiler upgrade: ${e}`);
    }
  }));
}


function createDoUpgrade(config: BuildConfig, ctx: BuildContext, bundles: Bundle[]) {

  return async (manifest: Manifest, upgrades: CompilerUpgrade[]): Promise<void> => {
    const upgradeTransforms: ts.TransformerFactory<ts.SourceFile>[] = (upgrades.map((upgrade) => {
      switch (upgrade) {
        case CompilerUpgrade.JSX_Upgrade_From_0_0_5:
          config.logger.debug(`JSX_Upgrade_From_0_0_5, manifestCompilerVersion: ${manifest.compiler.version}`);
          return upgradeFrom0_0_5 as ts.TransformerFactory<ts.SourceFile>;

        case CompilerUpgrade.Metadata_Upgrade_From_0_1_0:
          config.logger.debug(`Metadata_Upgrade_From_0_1_0, manifestCompilerVersion: ${manifest.compiler.version}`);
          return () => {
            return upgradeFromMetadata(config, bundles);
          };
      }
      return () => (tsSourceFile: ts.SourceFile) => (tsSourceFile);
    }));

    if (upgradeTransforms.length === 0) {
      return;
    }

    await Promise.all(manifest.modulesFiles.map(async function(moduleFile) {

      return new Promise((resolve, reject) => {
        config.sys.fs.readFile(moduleFile.jsFilePath, 'utf8', (err, source) => {
          if (err) {
            reject(err);
          } else {
            let output = '';

            try {
              output = transformSourceString(moduleFile.jsFilePath, source, upgradeTransforms);
            } catch (e) {
              config.logger.error(`error performing compiler upgrade on ${moduleFile.jsFilePath}: ${e}`);
            }
            ctx.jsFiles[moduleFile.jsFilePath] = output;

            resolve();
          }
        });
      });
    }));
  };
}
