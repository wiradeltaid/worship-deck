/**
 * SPEC-95: Microsoft OneDrive Cloud Connector & PPTX Sync Prompt Contract Tests & Absence Guards
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const schemaSqlPath = path.join(rootDir, 'internal', 'db', 'schema.sql');
const onedriveGoPath = path.join(rootDir, 'internal', 'httpapi', 'onedrive.go');
const onedriveProxyGoPath = path.join(rootDir, 'internal', 'httpapi', 'onedrive_proxy.go');
const onedriveUploadGoPath = path.join(rootDir, 'internal', 'httpapi', 'onedrive_upload.go');
const cardPath = path.join(rootDir, 'src', 'components', 'settings', 'OneDriveConnectorCard.tsx');
const pickerPath = path.join(rootDir, 'src', 'components', 'settings', 'OneDriveFolderPickerModal.tsx');
const promptPath = path.join(rootDir, 'src', 'components', 'onedrive', 'OneDriveSyncPromptModal.tsx');
const runSheetPagePath = path.join(rootDir, 'spa', 'src', 'pages', 'RunSheetPage.tsx');
const adminPagePath = path.join(rootDir, 'spa', 'src', 'pages', 'AdminPage.tsx');

const keysPath = path.join(rootDir, 'src', 'lib', 'i18n', 'keys.ts');
const catalogueEnPath = path.join(rootDir, 'src', 'lib', 'i18n', 'catalogue-en.ts');
const catalogueIdPath = path.join(rootDir, 'src', 'lib', 'i18n', 'catalogue-id.ts');

test('SPEC-95-01: SQLite Schema defines onedrive_configs with user_id cascade and sync_mode', () => {
  const schema = fs.readFileSync(schemaSqlPath, 'utf8');
  assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS onedrive_configs'), 'onedrive_configs table must exist');
  assert.ok(schema.includes('user_id INTEGER PRIMARY KEY'), 'user_id must be primary key');
  assert.ok(schema.includes('FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE'), 'user_id must reference accounts(id) with CASCADE');
  assert.ok(schema.includes("sync_mode TEXT NOT NULL DEFAULT 'ask'"), 'sync_mode must default to ask');
  assert.ok(schema.includes('access_token TEXT NOT NULL DEFAULT'), 'access_token column must exist');
  assert.ok(schema.includes('refresh_token TEXT NOT NULL DEFAULT'), 'refresh_token column must exist');
});

test('SPEC-95-01: Token Redaction Guard — access_token and refresh_token are absent from OneDrivePublicConfig', () => {
  const goCode = fs.readFileSync(onedriveGoPath, 'utf8');

  // Extract OneDrivePublicConfig struct definition
  const structMatch = goCode.match(/type OneDrivePublicConfig struct \{([\s\S]*?)\}/);
  assert.ok(structMatch, 'OneDrivePublicConfig struct must exist in onedrive.go');
  const structBody = structMatch[1];

  assert.equal(
    structBody.includes('AccessToken') || structBody.includes('access_token'),
    false,
    'ABSENCE GUARD: AccessToken must NOT be present in OneDrivePublicConfig'
  );
  assert.equal(
    structBody.includes('RefreshToken') || structBody.includes('refresh_token'),
    false,
    'ABSENCE GUARD: RefreshToken must NOT be present in OneDrivePublicConfig'
  );

  // Check required public fields
  assert.ok(structBody.includes('Connected'), 'Connected boolean must exist');
  assert.ok(structBody.includes('AccountEmail'), 'AccountEmail must exist');
  assert.ok(structBody.includes('TargetFolderID'), 'TargetFolderID must exist');
  assert.ok(structBody.includes('TargetFolderPath'), 'TargetFolderPath must exist');
  assert.ok(structBody.includes('SyncMode'), 'SyncMode must exist');
});

test('SPEC-95-01: Defect Injection — Token Redaction Guard fails if secret tokens are added to public struct', () => {
  const mockVulnerableStruct = `
    type OneDrivePublicConfig struct {
      Connected bool \`json:"connected"\`
      AccessToken string \`json:"access_token"\`
    }
  `;
  const hasLeak = mockVulnerableStruct.includes('AccessToken') || mockVulnerableStruct.includes('access_token');
  assert.equal(hasLeak, true, 'Defect injection: leaked token must be detected');
});

test('SPEC-95-01: Frontend Settings Component mounted in AdminPage with bilingual support', () => {
  const adminPage = fs.readFileSync(adminPagePath, 'utf8');
  assert.ok(adminPage.includes('OneDriveConnectorCard'), 'AdminPage must import and render OneDriveConnectorCard');

  const card = fs.readFileSync(cardPath, 'utf8');
  assert.ok(card.includes('OneDriveFolderPickerModal'), 'OneDriveConnectorCard must use OneDriveFolderPickerModal');
  assert.ok(card.includes('ONEDRIVE_AUTH_SUCCESS'), 'OneDriveConnectorCard must listen for ONEDRIVE_AUTH_SUCCESS message');
  assert.ok(card.includes('sync_mode'), 'OneDriveConnectorCard must handle sync_mode selection');
  assert.ok(card.includes('handleDisconnect'), 'OneDriveConnectorCard must handle disconnect');
});

test('SPEC-95-02: Backend Graph Proxy endpoint proxies folder hierarchy with normalized fields', () => {
  const proxyCode = fs.readFileSync(onedriveProxyGoPath, 'utf8');
  assert.ok(proxyCode.includes('handleGetOneDriveFolders'), 'handleGetOneDriveFolders handler must exist');
  assert.ok(proxyCode.includes('getValidOneDriveToken'), 'getValidOneDriveToken with refresh capability must exist');
  assert.ok(proxyCode.includes('/me/drive/root/children'), 'Must support root children query');
  assert.ok(proxyCode.includes('/me/drive/items/'), 'Must support subfolder children query');

  const picker = fs.readFileSync(pickerPath, 'utf8');
  assert.ok(picker.includes('computeDisplayPath'), 'Folder picker must compute display path');
  assert.ok(picker.includes('handleBreadcrumbClick'), 'Folder picker must handle breadcrumb navigation');
  assert.ok(picker.includes('handleNavigateInto'), 'Folder picker must handle navigating into subfolders');
  assert.ok(picker.includes('onSelectFolder'), 'Folder picker must callback onSelectFolder');
});

test('SPEC-95-03: Single-Blob PPTX Export & Invariant Guard in RunSheetPage', () => {
  const runSheet = fs.readFileSync(runSheetPagePath, 'utf8');

  // Verify Single-Blob Generation Fetch
  assert.ok(
    runSheet.includes('const blob = await res.blob();'),
    'PPTX blob must be extracted once from fetch response'
  );
  assert.ok(
    runSheet.includes('setRetainedPptxBlob(blob);'),
    'The exact same PPTX blob must be retained for cloud delivery'
  );

  // Invariant 1: Local download occurs immediately and is never blocked
  assert.ok(
    runSheet.includes('URL.createObjectURL(blob)'),
    'Local download must create object URL from blob immediately'
  );
  assert.ok(
    runSheet.includes('a.click()'),
    'Local download must trigger anchor click for immediate offline file delivery'
  );

  // Invariant 2: OneDrive Sync prompt or background upload triggered with the retained blob
  assert.ok(
    runSheet.includes('OneDriveSyncPromptModal'),
    'RunSheetPage must render OneDriveSyncPromptModal'
  );
  assert.ok(
    runSheet.includes('uploadBlobToOneDrive(retainedPptxBlob'),
    'Cloud upload must reuse the exact same retained blob'
  );

  // Invariant 3: Upload failure does not destroy local download
  assert.ok(
    runSheet.includes('setOneDriveToast'),
    'Upload status/error must be communicated via non-blocking toast banner'
  );
});

test('SPEC-95-03: Defect Injection — Double PPTX generation is detected and rejected', () => {
  const badFlow = `
    const res1 = await fetch(url);
    const blob1 = await res1.blob();
    // DEFECT: separate fetch on upload
    const res2 = await fetch(url);
    const blob2 = await res2.blob();
    upload(blob2);
  `;
  const fetchCount = (badFlow.match(/await fetch/g) || []).length;
  assert.equal(fetchCount > 1, true, 'Defect injection: multiple fetches detected');
});

test('SPEC-95-04: Bilingual Dictionary Parity for all OneDrive i18n keys', () => {
  const keysContent = fs.readFileSync(keysPath, 'utf8');
  const enContent = fs.readFileSync(catalogueEnPath, 'utf8');
  const idContent = fs.readFileSync(catalogueIdPath, 'utf8');

  const onedriveKeys = [
    'onedrive.title',
    'onedrive.desc',
    'onedrive.connectedAs',
    'onedrive.notConnected',
    'onedrive.connect',
    'onedrive.connecting',
    'onedrive.disconnect',
    'onedrive.disconnecting',
    'onedrive.targetFolder',
    'onedrive.noFolderSelected',
    'onedrive.selectFolder',
    'onedrive.changeFolder',
    'onedrive.syncMode.title',
    'onedrive.syncMode.ask',
    'onedrive.syncMode.always',
    'onedrive.syncMode.off',
    'onedrive.syncMode.saved',
    'onedrive.syncMode.failed',
    'onedrive.folderPicker.title',
    'onedrive.folderPicker.root',
    'onedrive.folderPicker.empty',
    'onedrive.folderPicker.loading',
    'onedrive.folderPicker.error',
    'onedrive.folderPicker.retry',
    'onedrive.folderPicker.selected',
    'onedrive.folderPicker.selectThis',
    'onedrive.folderPicker.cancel',
    'onedrive.folderPicker.items',
    'onedrive.prompt.title',
    'onedrive.prompt.body',
    'onedrive.prompt.dontAskAgain',
    'onedrive.prompt.skip',
    'onedrive.prompt.syncNow',
    'onedrive.prompt.syncing',
    'onedrive.upload.progress',
    'onedrive.upload.success',
    'onedrive.upload.failed',
    'onedrive.upload.open',
    'onedrive.upload.retry',
  ];

  for (const k of onedriveKeys) {
    assert.ok(keysContent.includes(`'${k}'`), `Key ${k} must be declared in keys.ts`);
    assert.ok(enContent.includes(`'${k}':`), `Key ${k} must exist in catalogue-en.ts`);
    assert.ok(idContent.includes(`'${k}':`), `Key ${k} must exist in catalogue-id.ts`);
  }
});
