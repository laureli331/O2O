'use strict';
// Local, bounded comparison of the exact ZIP API used by Taro's fetchTemplate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function verifyArchive(packageDirectory, fixturePackageDirectory, outputParent) {
  const AdmZip = require(path.resolve(packageDirectory));
  const FixtureZip = require(path.resolve(fixturePackageDirectory));
  const fixture = new FixtureZip();
  fixture.addFile('template/config/中文.json', Buffer.from('{"synthetic":true}'));
  fixture.addFile('template/empty.txt', Buffer.alloc(0));
  const archive = fixture.toBuffer();
  const directory = fs.mkdtempSync(path.join(outputParent, 'archive-compat-'));
  const archivePath = path.join(directory, 'fixture.zip');
  const target = path.join(directory, 'extracted');
  fs.writeFileSync(archivePath, archive);
  // Same constructor and positional extractAllTo arguments as official Taro.
  new AdmZip(archivePath).extractAllTo(target, true);
  const textPath = path.join(target, 'template/config/中文.json');
  assert.equal(fs.readFileSync(textPath, 'utf8'), '{"synthetic":true}');
  assert.equal(fs.readFileSync(path.join(target, 'template/empty.txt')).length, 0);
  fs.writeFileSync(textPath, 'changed');
  new AdmZip(archivePath).extractAllTo(target, false);
  assert.equal(fs.readFileSync(textPath, 'utf8'), 'changed');
  new AdmZip(archivePath).extractAllTo(target, true);
  assert.equal(fs.readFileSync(textPath, 'utf8'), '{"synthetic":true}');

  return { version: require(path.resolve(packageDirectory, 'package.json')).version,
    templateExtractionPassed: true, unicodeAndEmptyFilePassed: true,
    overwritePolicyPassed: true, scope: 'normal-archive-compatibility-only',
    vulnerabilityReproductionPerformed: false,
    fixtureCreatedBy: require(path.resolve(fixturePackageDirectory, 'package.json')).version,
    outputDirectory: directory, cloudChanged: false };
}

module.exports = { verifyArchive };
if (require.main === module) {
  const [target, fixture, parent] = process.argv.slice(2);
  if (!target || !fixture || !parent) throw Error('EXPECTED_PACKAGE_FIXTURE_AND_OUTPUT_PATHS');
  verifyArchive(target, fixture, parent).then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
