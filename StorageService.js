/**
 * StorageService.gs
 * -----------------
 * Abstracts all Google Cloud Storage (GCS) interactions.
 * Follows a single-responsibility pattern so swapping storage backends
 * only requires changes in this file.
 *
 * NOTE (Iteration 1): All GCS API calls are stubbed with console.log
 * print statements as instructed by the tech lead.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  StorageService class
// ─────────────────────────────────────────────────────────────────────────────
class StorageService {

  /**
   * Lists all objects under a given GCS prefix.
   * @param {string} prefix - e.g. "trees/" or "signs/"
   * @returns {Array<Object>} List of object metadata stubs.
   */
  static listObjects(prefix) {
    const url = `https://storage.googleapis.com/storage/v1/b/${CONFIG.BUCKET_NAME}/o?prefix=${prefix}`;
    console.log(`[StorageService.gs] LIST OBJECTS`);
    console.log(`[StorageService.gs] API CALL (stubbed): GET ${url}`);
    console.log(`[StorageService.gs]   → Would return JSON list of objects under gs://${CONFIG.BUCKET_NAME}/${prefix}`);
    return [];
  }

  /**
   * Uploads a file (Blob) to a GCS object path.
   * @param {string} objectPath - Full GCS object path, e.g. "trees/tree-id-1/thumbnail.jpg"
   * @param {Blob}   fileBlob   - The file data as a Blob.
   * @param {string} mimeType   - MIME type of the file.
   */
  static uploadFile(objectPath, fileBlob, mimeType) {
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${CONFIG.BUCKET_NAME}/o?uploadType=multipart`;
    console.log(`[StorageService.gs] UPLOAD FILE`);
    console.log(`[StorageService.gs] API CALL (stubbed): POST ${url}`);
    console.log(`[StorageService.gs]   → Object path : gs://${CONFIG.BUCKET_NAME}/${objectPath}`);
    console.log(`[StorageService.gs]   → MIME type   : ${mimeType}`);
    console.log(`[StorageService.gs]   → Would upload blob and return object metadata including md5Hash`);
    return { objectPath, success: true, md5Hash: '<stub-md5-hash>' };
  }

  /**
   * Downloads a file from GCS as a Blob.
   * @param {string} objectPath - Full GCS object path.
   * @returns {Blob} The file content.
   */
  static downloadFile(objectPath) {
    const url = `https://storage.googleapis.com/storage/v1/b/${CONFIG.BUCKET_NAME}/o/${encodeURIComponent(objectPath)}?alt=media`;
    console.log(`[StorageService.gs] DOWNLOAD FILE`);
    console.log(`[StorageService.gs] API CALL (stubbed): GET ${url}`);
    console.log(`[StorageService.gs]   → Would return Blob for gs://${CONFIG.BUCKET_NAME}/${objectPath}`);
    return null;
  }

  /**
   * Deletes a single GCS object.
   * @param {string} objectPath - Full GCS object path.
   */
  static deleteFile(objectPath) {
    const url = `https://storage.googleapis.com/storage/v1/b/${CONFIG.BUCKET_NAME}/o/${encodeURIComponent(objectPath)}`;
    console.log(`[StorageService.gs] DELETE FILE`);
    console.log(`[StorageService.gs] API CALL (stubbed): DELETE ${url}`);
    console.log(`[StorageService.gs]   → Would permanently delete gs://${CONFIG.BUCKET_NAME}/${objectPath}`);
    return { success: true };
  }

  /**
   * Deletes all objects under a given prefix (used when removing an entire asset folder).
   * @param {string} prefix - e.g. "trees/tree-id-1/"
   */
  static deleteFolder(prefix) {
    console.log(`[StorageService.gs] DELETE FOLDER`);
    console.log(`[StorageService.gs] API CALL (stubbed): LIST then batch DELETE all objects under gs://${CONFIG.BUCKET_NAME}/${prefix}`);
    console.log(`[StorageService.gs]   → Would delete every file inside the folder`);
    return { success: true };
  }

  /**
   * Reads and parses a JSON file from GCS.
   * @param {string} objectPath - e.g. "master-hash.json"
   * @returns {Object|null}
   */
  static readJson(objectPath) {
    console.log(`[StorageService.gs] READ JSON`);
    console.log(`[StorageService.gs] API CALL (stubbed): GET gs://${CONFIG.BUCKET_NAME}/${objectPath}`);
    console.log(`[StorageService.gs]   → Would parse and return JSON contents`);
    return null;
  }

  /**
   * Writes a JSON object to a GCS file, overwriting any existing content.
   * @param {string} objectPath - e.g. "master-hash.json"
   * @param {Object} data       - The data to serialize and write.
   */
  static writeJson(objectPath, data) {
    console.log(`[StorageService.gs] WRITE JSON`);
    console.log(`[StorageService.gs] API CALL (stubbed): PUT gs://${CONFIG.BUCKET_NAME}/${objectPath}`);
    console.log(`[StorageService.gs]   → Would overwrite file with: ${JSON.stringify(data).substring(0, 120)}...`);
    return { success: true };
  }

  /**
   * Generates a signed URL for temporary public read access to an object.
   * @param {string} objectPath
   * @param {number} expiresInSeconds
   * @returns {string} Signed URL.
   */
  static getSignedUrl(objectPath, expiresInSeconds = 3600) {
    console.log(`[StorageService.gs] GET SIGNED URL`);
    console.log(`[StorageService.gs] API CALL (stubbed): POST https://storage.googleapis.com/v1/b/${CONFIG.BUCKET_NAME}/o/${encodeURIComponent(objectPath)}:signBlob`);
    console.log(`[StorageService.gs]   → Would return a signed URL expiring in ${expiresInSeconds}s`);
    return `https://storage.googleapis.com/${CONFIG.BUCKET_NAME}/${objectPath}?stub-signed-url`;
  }
}