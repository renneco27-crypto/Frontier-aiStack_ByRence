#!/usr/bin/env node
/**
 * CLI Runner for /spatial skill
 * Usage: node inspect.js [target_url_or_path] [output_dir]
 */

const fs = require('fs');
const path = require('path');
const { CDPRunner } = require('C:/Users/yuze2/.gemini/config/plugins/spatial-inspector/engine/cdp-runner');

async function main() {
  const target = process.argv[2] || 'index.html';
  const outDir = process.argv[3] || process.cwd();

  console.log(`[Spatial Inspector] Scanning target: ${target}`);
  const runner = new CDPRunner();

  try {
    const res = await runner.runInspection(target);
    const data = res.spatialData;

    if (!data) {
      console.error('[Error] No spatial data returned from page.');
      process.exit(1);
    }

    const jsonPath = path.join(outDir, 'spatial_anomalies.json');
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');

    const templatePath = 'C:/Users/yuze2/.gemini/config/plugins/spatial-inspector/viewer/template-3d.html';
    const template = fs.readFileSync(templatePath, 'utf8');
    const populated = template.replace('window.__SPATIAL_DATA__ ||', JSON.stringify(data) + ' ||');

    const htmlPath = path.join(outDir, '3d-inspector.html');
    fs.writeFileSync(htmlPath, populated, 'utf8');

    console.log(`\n========================================`);
    console.log(` SPATIAL AUDIT SUMMARY:`);
    console.log(` Total Elements Scanned: ${data.totalElements}`);
    console.log(` Anomalies Found:        ${data.anomaliesCount}`);
    console.log(`========================================`);

    if (data.anomaliesCount === 0) {
      console.log(`✅ No collisions or blocked click targets detected!`);
    } else {
      data.anomalies.forEach((a, i) => {
        const tgt = a.target || `${a.elementA} <-> ${a.elementB}`;
        console.log(` [${a.severity}] #${i+1} ${a.type}: ${tgt}`);
        console.log(`       -> ${a.detail}`);
      });
    }

    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
    console.log(`\n3D Visualizer: ${fileUrl}`);
    console.log(`JSON Ledger:   ${jsonPath}\n`);
  } catch (err) {
    console.error('[Error during inspection]', err);
    process.exit(1);
  }
}

main();
