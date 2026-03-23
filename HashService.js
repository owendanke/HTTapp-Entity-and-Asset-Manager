// ============================================================
// HashService.js
// Manages catalog.json — tracks all entities and their asset
// file hashes in a Google Cloud Storage bucket.
//
// Typical call sequence during an upload operation:
//   1. HashService.beginSession()              once at the start
//   2. HashService.stageFile(uploadResponse)   once per file
//   3. HashService.commitCatalog(entityMeta)   once at the end
// ============================================================

var HashService = (function () {

  var CATALOG_PATH = CONFIG.CATALOG_PATH;
  var _staged = null;
  var _catalog = null;   // in-memory cache

  // ── Session state ──
  // Accumulates file metadata for the current upload operation.
  // Keyed by objectPath so duplicate calls are idempotent.
  var _staged = null;   // null = no active session


  // ── Private helpers ──

  /**
   * Download and parse catalog.json from GCS.
   * Returns a default structure if the file does not exist yet.
   */
  function _loadCatalog() {
    if (_catalog) return _catalog;   // return cache if already loaded
    try {
      var blob = StorageService.downloadFile(CATALOG_PATH);
      if (!blob) { _catalog = _emptyCatalog(); return _catalog; }
      _catalog = JSON.parse(blob.getDataAsString());
      return _catalog;
    } catch (e) {
      console.log('[HashService] Could not load catalog, starting fresh: ' + e);
      _catalog = _emptyCatalog();
      return _catalog;
    }
  }

  /** Canonical empty catalog structure. */
  function _emptyCatalog() {
    return {
      updated: '',
      entities: [],
      master_md5_hash: '',
      fileCount: 0,
      files: {}
    };
  }

  /**
   * Compute a deterministic master hash from all individual
   * file hashes by sorting the keys and hashing the resulting
   * concatenated string with Apps Script's Utilities.
   */
  function _computeMasterHash(filesMap) {
    var sortedKeys = Object.keys(filesMap).sort();
    var combined = sortedKeys.map(function (k) {
      return k + ':' + filesMap[k];
    }).join('|');

    var bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      combined,
      Utilities.Charset.UTF_8
    );

    // Convert byte array → hex string
    return bytes.map(function (b) {
      var hex = (b & 0xff).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  /**
   * Serialize the catalog object to a Blob and upload it.
   * Returns the StorageService upload response.
   */
  function _uploadCatalog(catalog) {
    var json = JSON.stringify(catalog, null, 4);
    var blob = Utilities.newBlob(json, 'application/json', CATALOG_PATH);
    return StorageService.uploadFile(CATALOG_PATH, blob, 'application/json');
  }


  // ── Public API ──
  return {

    /**
     * beginSession()
     * Call once before starting a batch of file uploads.
     * Clears any leftover state from a previous (possibly failed) session.
     */
    beginSession: function () {
      _staged = {};
      console.log('[HashService] Session started.');
    },

    /**
     * Returns the parsed catalog object.
     * Downloads from GCS once per script execution, then serves from cache.
     */
    getCatalog: function () {
      return _loadCatalog();
    },

    /**
     * stageFile(uploadResponse)
     * Call immediately after each StorageService.uploadFile() succeeds.
     *
     * @param {Object} uploadResponse  The object returned by StorageService.uploadFile():
     *                                 { objectPath, success, md5Hash }
     */
    stageFile: function (uploadResponse) {
      if (_staged === null) {
        throw new Error('[HashService][stageFile] No active session. Call beginSession() first.');
      }
      if (!uploadResponse || !uploadResponse.success) {
        console.log('[HashService][stageFile] stageFile called with a failed upload response — skipping.');
        return;
      }

      var path = uploadResponse.objectPath;
      var hash = uploadResponse.md5Hash;

      if (!path || !hash) {
        throw new Error('[HashService][stageFile] uploadResponse is missing objectPath or md5Hash.');
      }

      _staged[path] = hash;
      console.log('[HashService][stageFile] Staged: ' + path + ' → ' + hash);
    },

    /**
     * commitCatalog(entityMeta)
     * Finalizes the session: merges staged files into catalog.json,
     * upserts the entity record, recomputes counts and master hash,
     * then uploads the updated catalog to GCS.
     *
     * @param {Object} entityMeta  Describes the entity being added/updated:
     *                             { id: string, type: string, name: string }
     *
     * @returns {Object}  The StorageService response from uploading catalog.json.
     */
    commitCatalog: function (entityMeta) {
      if (_staged === null) {
        throw new Error('[HashService][commitCatalog] No active session. Call beginSession() first.');
      }
      if (!entityMeta || !entityMeta.id || !entityMeta.type || !entityMeta.name) {
        throw new Error('[HashService][commitCatalog] entityMeta must include { id, type, name }.');
      }

      try {
        // 1. Load the current catalog from GCS
        var catalog = _loadCatalog();

        // 2. Upsert the entity record
        var existingIndex = catalog.entities.findIndex(function (e) {
          return e.id === entityMeta.id;
        });
        var entityRecord = { id: entityMeta.id, type: entityMeta.type, name: entityMeta.name };

        if (existingIndex >= 0) {
          catalog.entities[existingIndex] = entityRecord;
          console.log('[HashService][commitCatalog] Updated existing entity: ' + entityMeta.id);
        } else {
          catalog.entities.push(entityRecord);
          console.log('[HashService][commitCatalog] Added new entity: ' + entityMeta.id);
        }

        // 3. Merge staged file hashes (adds new entries, overwrites changed ones)
        Object.assign(catalog.files, _staged);

        // 4. Recompute derived fields
        catalog.fileCount     = Object.keys(catalog.files).length;
        catalog.master_md5_hash = _computeMasterHash(catalog.files);
        catalog.updated       = new Date().toISOString();

        // 5. Upload the updated catalog
        var uploadResponse = _uploadCatalog(catalog);
        console.log('[HashService][commitCatalog] Catalog committed. fileCount=' + catalog.fileCount
          + '  masterHash=' + catalog.master_md5_hash);

        // 6. Keep _catalog in sync with the updated catalog so subsequent
        // getCatalog() calls reflect the new state without a re-download
        _catalog = catalog;

        // 7. Clear session state
        _staged = null;
        return uploadResponse;

      } catch (e) {
        // Do NOT clear _staged here — caller may wish to retry
        console.log('[HashService][commitCatalog] commitCatalog failed: ' + e);
        throw e;
      }
    },

    /**
     * abortSession()
     * Discards all staged data without touching the catalog.
     * Call in a catch block if the upload pipeline fails before commitCatalog().
     */
    abortSession: function () {
      _staged = null;
      console.log('[HashService][abortSession] Session aborted');
    },

    /**
     * removeEntity(entityId)
     * Removes an entity record and all of its associated file hashes
     * from the catalog, then re-uploads it.
     *
     * Useful for delete operations. File objects in GCS are NOT deleted
     * here — that is the responsibility of StorageService.
     *
     * @param {string} entityId  The entity id to remove (e.g. "1-18").
     * @returns {Object}  The StorageService response from uploading catalog.json.
     */
    removeEntity: function (entityId) {
      if (!entityId) {
        throw new Error('[HashService] removeEntity requires an entityId.');
      }

      var catalog = _loadCatalog();

      // Remove the entity record
      catalog.entities = catalog.entities.filter(function (e) {
        return e.id !== entityId;
      });

      // Remove all file entries whose path contains the entityId segment
      // e.g. "trees/1-18/thumbnail.jpg" → dropped when entityId is "1-18"
      var pathFragment = '/' + entityId + '/';
      Object.keys(catalog.files).forEach(function (path) {
        if (path.indexOf(pathFragment) !== -1) {
          delete catalog.files[path];
        }
      });

      catalog.fileCount       = Object.keys(catalog.files).length;
      catalog.master_md5_hash = _computeMasterHash(catalog.files);
      catalog.updated         = new Date().toISOString();

      var uploadResponse = _uploadCatalog(catalog);
      console.log('[HashService] Entity removed: ' + entityId
        + '  fileCount=' + catalog.fileCount);
      return uploadResponse;
    }

  };

})();

// Exposed server functions (called via google.script.run from the client)
function serverGetCatalog() {
  return HashService.getCatalog();
}