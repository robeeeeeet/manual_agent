#!/usr/bin/env node
/**
 * PWAアイコン生成スクリプト
 * SVGからPNGアイコンを生成する
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, '../public');
const SOURCE_PATH = join(PUBLIC_DIR, 'icon-source.png');

const ICONS = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function generateIcons() {
  console.log('🎨 PWAアイコン生成を開始...');

  const sourceBuffer = readFileSync(SOURCE_PATH);

  for (const icon of ICONS) {
    const outputPath = join(PUBLIC_DIR, icon.name);

    await sharp(sourceBuffer)
      .resize(icon.size, icon.size)
      .png()
      .toFile(outputPath);

    console.log(`✅ ${icon.name} (${icon.size}x${icon.size}) を生成しました`);
  }

  console.log('\n🎉 アイコン生成完了！');
}

generateIcons().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
