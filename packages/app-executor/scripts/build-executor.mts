import { execa } from 'execa';
import * as esbuild from 'esbuild';
import copy from 'esbuild-plugin-copy';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const skipNative = process.argv.includes('--skip-native');

async function build() {
  // Bundle to CJS
  await esbuild.build({
    entryPoints: ['bin/executor.mts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'bin/executor-bundle.cjs',
    format: 'cjs',
    external: ['@ironclad/rivet-core', '@ironclad/rivet-node', '@ironclad/rivet-mcp-shared'],
    plugins: [
      copy({
        resolveFrom: 'cwd',
        assets: {
          from: ['../core/src/model/nodes/config.json'],
          to: ['./'],
        },
      }),
    ],
  });

  // Skip native compilation if flag is set
  if (!skipNative) {
    console.log('Compiling to native binary for darwin...');
    await execa(
      'yarn',
      [
        'pkg',
        '.',
        '--out-path',
        'dist',
        '--no-bytecode',
        '--options',
        'experimental-network-imports',
        '--targets',
        'node18-macos-x64',
      ],
      {
        stdio: 'inherit',
      },
    );
  } else {
    console.log('Skipping native binary compilation...');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
