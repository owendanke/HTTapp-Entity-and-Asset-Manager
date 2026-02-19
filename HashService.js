/**
 * HashService.gs
 * --------------
 * Manages the master-hash.json and changelog.json files in GCS.
 * These files track asset integrity and change history.
 *
 * master-hash.json structure:
 *   {
 *     "lastUpdated": "<ISO timestamp>",
 *     "assets": {
 *       "<assetId>": { "type": "tree|sign", "md5": "<hash>", "updatedAt": "<ISO>" }
 *     }
 *   }
 *
 * changelog.json structure:
 *   {
 *     "entries": [
 *       { "timestamp": "<ISO>", "action": "upload|edit|delete", "assetId": "...", "type": "...", "name": "..." }
 *     ]
 *   }
 *
 * NOTE (Iteration 1): All file I/O is stubbed with console.log print statements.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  HashService class
// ─────────────────────────────────────────────────────────────────────────────
class HashService {

  /**
   * Updates the master-hash.json with a new or modified asset entry.
   * On delete, removes the asset's entry from the hash map.
   *
   * @param {string} assetId   - The unique asset ID.
   * @param {string} assetType - 'tree' | 'sign'
   * @param {string} action    - 'upload' | 'edit' | 'delete'
   */
  static updateMasterHash(assetId, assetType, action) {
    const timestamp = new Date().toISOString();
    console.log(`[HashService.gs] UPDATE MASTER HASH`);
    console.log(`[HashService.gs]   → Action   : ${action.toUpperCase()}`);
    console.log(`[HashService.gs]   → Asset ID : ${assetId}`);
    console.log(`[HashService.gs]   → Type     : ${assetType}`);
    console.log(`[HashService.gs]   → Timestamp: ${timestamp}`);

    // In production:
    //   1. Read current master-hash.json via StorageService.readJson('master-hash.json')
    //   2. Modify the 'assets' map based on action
    //   3. Compute new aggregate hash if needed
    //   4. Write back via StorageService.writeJson('master-hash.json', updatedData)

    if (action === 'upload' || action === 'edit') {
      console.log(`[HashService.gs] API CALL (stubbed): Would compute MD5 of all files in ${assetType}s/${assetId}/`);
      console.log(`[HashService.gs] API CALL (stubbed): Would write updated entry to gs://${CONFIG.BUCKET_NAME}/master-hash.json`);
      console.log(`[HashService.gs]   → master-hash.json entry: { "${assetId}": { type: "${assetType}", md5: "<computed>", updatedAt: "${timestamp}" } }`);
    } else if (action === 'delete') {
      console.log(`[HashService.gs] API CALL (stubbed): Would remove entry for "${assetId}" from gs://${CONFIG.BUCKET_NAME}/master-hash.json`);
    }
  }

  /**
   * Appends a new entry to changelog.json.
   *
   * @param {string} assetId   - The unique asset ID.
   * @param {string} assetType - 'tree' | 'sign'
   * @param {string} assetName - Human-readable name.
   * @param {string} action    - 'upload' | 'edit' | 'delete'
   */
  static appendChangelog(assetId, assetType, assetName, action) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      action,
      assetId,
      type:  assetType,
      name:  assetName,
    };

    console.log(`[HashService.gs] APPEND CHANGELOG`);
    console.log(`[HashService.gs] API CALL (stubbed): Would read gs://${CONFIG.BUCKET_NAME}/changelog.json`);
    console.log(`[HashService.gs] API CALL (stubbed): Would append entry: ${JSON.stringify(entry)}`);
    console.log(`[HashService.gs] API CALL (stubbed): Would write updated changelog.json back to GCS`);
  }

  /**
   * Reads and returns the full master-hash.json content.
   * @returns {Object|null}
   */
  static getMasterHash() {
    console.log(`[HashService.gs] GET MASTER HASH`);
    console.log(`[HashService.gs] API CALL (stubbed): GET gs://${CONFIG.BUCKET_NAME}/master-hash.json`);
    return null;
  }

  /**
   * Reads and returns the full changelog.json content.
   * @returns {Object|null}
   */
  static getChangelog() {
    console.log(`[HashService.gs] GET CHANGELOG`);
    console.log(`[HashService.gs] API CALL (stubbed): GET gs://${CONFIG.BUCKET_NAME}/changelog.json`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Exposed server functions
// ─────────────────────────────────────────────────────────────────────────────

function serverGetMasterHash() {
  return HashService.getMasterHash();
}

function serverGetChangelog() {
  return HashService.getChangelog();
}