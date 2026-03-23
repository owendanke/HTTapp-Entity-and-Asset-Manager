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
   * 
   * Object resource documentation: https://docs.cloud.google.com/storage/docs/json_api/v1/objects#resource
   * 
   * @param {string} prefix - e.g. "trees/" or "signs/"
   * @returns {Object} Parsed JSON response body
   */
  static listObjects(prefix) {
    console.log(`[StorageService.gs][listObjects] prefix: ${prefix}`);

    // create HTTP request url 
    const url = `https://storage.googleapis.com/storage/v1/b/${CONFIG.BUCKET_NAME}/o?prefix=${prefix}&delimiter='/'`;


    const service = AuthService._getCloudService();

    if (!service.hasAccess()) {
      console.log('[StorageService.gs][listObjects] No valid OAuth session');
    }

    const token = service.getAccessToken();

    // use UrlFetchApp.fetch to send GET to GCS 
    console.log(`[StorageService.gs][listObjects] GET ${url}`);
    var response = UrlFetchApp.fetch(url, {
      headers: {
        Authorization: 'Bearer ' + token
      },
      'muteHttpExceptions': true
    });

    if (response.getResponseCode() !== 200) {
      const errorText = response.getContentText();
      throw new Error(`list failed: ${response.status} ${errorText}`);
    }
    
    return JSON.parse(response.getContentText());
  }

  /**
   * Uploads a file (Blob) to a GCS object path.
   * This function CANNOT handle byte data like a jpeg.
   * @param {string} objectPath - Full GCS object path, e.g. "trees/tree-id-1/description.md"
   * @param {Blob}   fileBlob   - The file data as a Blob.
   * @param {string} mimeType   - MIME type of the file.
   * @throws {Error} Throws a new Error if the response is not 200
   */
  static uploadFile(objectPath, fileBlob, mimeType) {
    const service = AuthService._getCloudService();
    if (!service.hasAccess()) {
      throw new Error('[StorageService.gs][uploadFile] No valid OAuth session');
    }

    const url = `https://storage.googleapis.com/upload/storage/v1/b/${CONFIG.BUCKET_NAME}/o?uploadType=multipart`;
    const token = service.getAccessToken();

    // Build multipart body: metadata part + media part
    const metadata = JSON.stringify({ name: objectPath, contentType: mimeType });
    const boundary = 'XXX_MULTI-PART_BOUNDARY_XXX';

    const body = Utilities.newBlob(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ).getBytes()
      .concat(fileBlob.getBytes())
      .concat(Utilities.newBlob(`\r\n--${boundary}--`).getBytes());
    
    // use UrlFetchApp.fetch to send GET to GCS 
    console.log(`[StorageService.gs][uploadFile] POST ${url}`);
    var response = UrlFetchApp.fetch(url, {
      method: "POST",
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': `multipart/related; boundary="${boundary}"`
      },
      payload: Utilities.newBlob(body, `multipart/related; boundary="${boundary}"`),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      const errorText = response.getContentText();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    var data = JSON.parse(response.getContentText());

    return { objectPath, success: true, md5Hash: data.md5Hash };
  }

  /**
   * 
   * @param {string} objectPath   - Full GCS object path, e.g. "trees/tree-id-1/thumbnail.jpg"
   * @param {string} base64String - base64 encoded byte data
   * @returns 
   */
  static uploadJpeg(objectPath, base64String) {
    console.log(`[StorageService.gs][uploadJpeg] ${objectPath}`);

    const service = AuthService._getCloudService();
    if (!service.hasAccess()) {
      throw new Error('[StorageService.gs][uploadJpeg] No valid OAuth session');
    }

    const url = `https://storage.googleapis.com/upload/storage/v1/b/${CONFIG.BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;
    const token = service.getAccessToken();

    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'image/jpeg'
      },
      payload: Utilities.base64Decode(base64String),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(`Upload failed: ${response.getResponseCode()} ${response.getContentText()}`);
    }

    var data = JSON.parse(response.getContentText());
    return { objectPath, success: true, md5Hash: data.md5Hash };
  }

  /**
   * Downloads a file from GCS as a Blob.
   * @param {string} objectPath - Full GCS object path.
   * @returns {Blob} The file content.
   * @throws {Error} Throws a new Error if the response is not 200
   */
  static downloadFile(objectPath) {
    console.log(`[StorageService.gs][downloadFile] path: ${objectPath}`);

    // create HTTP request url 
    const url = `https://storage.googleapis.com/storage/v1/b/${CONFIG.BUCKET_NAME}/o/${encodeURIComponent(objectPath)}?alt=media`;

    const service = AuthService._getCloudService();

    if (!service.hasAccess()) {
      console.log('[StorageService.gs][downloadFile] No valid OAuth session');
    }

    const token = service.getAccessToken();

    // use UrlFetchApp.fetch to send GET to GCS 
    console.log(`[StorageService.gs][downloadFile] GET ${url}`);

    var response = UrlFetchApp.fetch(url, {
      headers: {
        Authorization: 'Bearer ' + token
      },
      'muteHttpExceptions': true
    });

    if (response.getResponseCode() !== 200) {
      const errorText = response.getContentText();
      throw new Error(`list failed: ${response.status} ${errorText}`);
    }
    
    return response.getBlob();
  }

  /**
   * Retrieves metadata for a specified GCS object.
   * @param {string} objectPath - Full GCS object path.
   * @returns {Blob} The file content.
   * @throws {Error} Throws a new Error if the response is not 200
   */
  static objectMetadata(objectPath) {
    console.log(`[StorageService.gs][objectMetadata] path: ${objectPath}`);

    // create HTTP request url 
    const url = `https://storage.googleapis.com/storage/v1/b/${CONFIG.BUCKET_NAME}/o/${encodeURIComponent(objectPath)}?alt=json`;

    const service = AuthService._getCloudService();

    if (!service.hasAccess()) {
      console.log('[StorageService.gs][objectMetadata] No valid OAuth session');
    }

    const token = service.getAccessToken();

    // use UrlFetchApp.fetch to send GET to GCS 
    console.log(`[StorageService.gs][objectMetadata] GET ${url}`);

    var response = UrlFetchApp.fetch(url, {
      headers: {
        Authorization: 'Bearer ' + token
      },
      'muteHttpExceptions': true
    });

    if (response.getResponseCode() !== 200) {
      const errorText = response.getContentText();
      throw new Error(`list failed: ${response.status} ${errorText}`);
    }

    return JSON.parse(response.getContentText());
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