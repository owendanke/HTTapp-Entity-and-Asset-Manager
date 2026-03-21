/**
 * AssetService.gs
 * ---------------
 * Core logic for asset management (CRUD operations).
 * Delegates all GCS I/O to StorageService and all hash/log updates
 * to HashService, keeping each class focused on a single responsibility.
 *
 * Asset Types (extensible):
 *   - 'tree'  → has image gallery
 *   - 'sign'  → no image gallery
 *
 * Adding a new entity type in the future:
 *   1. Add the type string to CONFIG.ENTITY_TYPES in Code.gs
 *   2. Add a type-specific file list to AssetService.getRequiredFiles()
 *   3. No other files need to change.
 *
 * NOTE (Iteration 1): Stubs use mock data for the asset list.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Asset Type Definitions  (extend here to add new types)
// ─────────────────────────────────────────────────────────────────────────────
const ASSET_FILE_SCHEMA = {
  // Files required by ALL asset types
  common: ['thumbnail.jpg', 'description.md', 'geometry.geojson'],

  // Type-specific additional files
  tree: ['gallery-001.jpg'],   // gallery images; more may be added dynamically
  sign: [],                    // signs have no gallery
};

// ─────────────────────────────────────────────────────────────────────────────
//  AssetService class
// ─────────────────────────────────────────────────────────────────────────────
class AssetService {

  /**
   * Returns the required files for a given asset type.
   * @param {string} assetType - 'tree' | 'sign'
   * @returns {string[]}
   */
  static getRequiredFiles(assetType) {
    const typeFiles = ASSET_FILE_SCHEMA[assetType] || [];
    return [...ASSET_FILE_SCHEMA.common, ...typeFiles];
  }

  /**
   * Parse the object's id field for the user assigned asset id
   * 
   * @param {string} objectId the `id` field returned by the storage Objects resource
   * @param {string} type the type of asset (i.e. tree, sign)
   */
  static getAssetId(objectId, type) {
    /*
    if (!objectId.startsWith(type)) {
      throw new Error("Invalid prefix");
    }
      */
    console.log(`[AssetService][getAssetId] objectId: ${objectId}, type: ${type}`);
    
    // remove everything before the type
    // remove type prefix
    // split with the forward slash and keep the first item

    return objectId.substring(objectId.indexOf(`${type}s/`))
      .replace(`${type}s/`, '')
      .split('/')[0];
  }

  /**
   * Creates a GeoJSON Blob from latitude and longitude strings
   * @param {string} latStr - Latitude as string
   * @param {string} lonStr - Longitude as string
   * @returns {Blob} GeoJSON blob
   */
  static createGeoJSONBlob(latStr, lonStr) {
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error("Invalid latitude or longitude");
    }

    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [lon, lat] // GeoJSON uses [longitude, latitude]
          },
          properties: {}
        }
      ]
    };

    return new Blob(
      [JSON.stringify(geojson)],
      { type: "application/geo+json" }
    );
  }

  /**
   * Lists all assets from GCS (both trees and signs).
   * @returns {Array<Object>} List of asset metadata objects.
   */
  static listAllAssets() {
    console.log('[AssetService.gs][listAllAssets]');
    const allAssets = [];

    for (const type of CONFIG.ENTITY_TYPES) {
      console.log(`[AssetService.gs][listAllAssets] Fetching assets of type: ${type}`);
      const prefix = `${type}s/`;
      const items = StorageService.listObjects(prefix).items;

      if (items && items.length > 0) {
        console.log(`[AssetService.gs][listAllAssets] Parsing ${type} object list into asset metadata records...`);
        items.forEach((object) => {
          allAssets.push(new Entity(
            AssetService.getAssetId(object.id, type),
            type,
            object.name,
            
            base64ToHex(object.md5Hash)
          ));
          console.log(`[AssetService.gs][listAllAssets] added asset: ${object.id}, ${type}, ${object.name}, ${base64ToHex(object.md5Hash)}`);
        });
      }
    }

    console.log(`[AssetService.gs][listAllAssets] LIST COMPLETE — Returning ${allAssets.length} asset(s)`);
    return allAssets;
  }

  /**
   * Uploads a new entity to GCS.
   * Steps:
   *   1. Validate required files are present for the asset type.
   *   2. Upload each file to the appropriate GCS path.
   *   3. Generate and store MD5 hash.
   *   4. Update master-hash.json and changelog.json.
   *
   * @param {Object} assetData - { id, type, name, latitude, longitude, files: { thumbnail, description, gallery[] } }
   * @returns {{ success: boolean, assetId: string, errors: string[] }}
   */
  static uploadAsset(assetData) {
    const { id, type, name, latitude, longitude, files } = assetData;
    const errors = [];

    console.log(`[AssetService.gs][uploadAsset]`);
    console.log(`[AssetService.gs][uploadAsset] ID: ${id}`);
    console.log(`[AssetService.gs][uploadAsset] Type: ${type}`);
    console.log(`[AssetService.gs][uploadAsset] Name: ${name}`);
    console.log(`[AssetService.gs][uploadAsset] Latitude: ${name}`);
    console.log(`[AssetService.gs][uploadAsset] Longitude: ${name}`);

    // Validate type
    if (!CONFIG.ENTITY_TYPES.includes(type)) {
      errors.push(`Unknown asset type: "${type}". Valid types: ${CONFIG.ENTITY_TYPES.join(', ')}`);
      return { success: false, assetId: id, errors };
    }

    const basePath = `${type}s/${id}`;

    // Upload common files
    if (files.thumbnail) {
      // upload thumbnail
      StorageService.uploadFile(`${basePath}/thumbnail.jpg`, files.thumbnail, 'image/jpeg');
    } else {
      errors.push('Missing required file: thumbnail.jpg');
    }

    if (files.description) {
      // upload description
      StorageService.uploadFile(`${basePath}/description.md`, files.description, 'text/markdown');
    } else {
      errors.push('Missing required file: description.md');
    }

    // ── Upload type-specific files ─────────────────────────────────────────
    if (type === 'tree') {
      const galleryFiles = files.gallery || [];
      if (galleryFiles.length === 0) {
        console.log('[AssetService.gs]   → WARNING: Tree asset uploaded with no gallery images');
      }
      galleryFiles.forEach((galleryBlob, index) => {
        const paddedIndex = String(index + 1).padStart(3, '0');
        StorageService.uploadFile(`${basePath}/gallery-${paddedIndex}.jpg`, galleryBlob, 'image/jpeg');
      });
    }

    if (errors.length > 0) {
      console.log(`[AssetService.gs] UPLOAD FAILED with ${errors.length} error(s):`, errors);
      return { success: false, assetId: id, errors };
    }

    // ── Post-upload side effects ───────────────────────────────────────────
    HashService.updateMasterHash(id, type, 'upload');
    HashService.appendChangelog(id, type, name, 'upload');

    console.log(`[AssetService.gs] UPLOAD SUCCESS — Asset ${id} stored at gs://${CONFIG.BUCKET_NAME}/${basePath}/`);
    return { success: true, assetId: id, errors: [] };
  }

  /**
   * Uploads a new entity to GCS.
   * Steps:
   *   1. Validate required files are present for the asset type.
   *   2. Upload each file to the appropriate GCS path.
   *   3. Generate and store MD5 hash.
   *   4. Update master-hash.json and changelog.json.
   *
   * @param {Object} assetData - { id, type, name, files: { thumbnail, description, geometry, gallery[] } }
   * @returns {{ success: boolean, assetId: string, errors: string[] }}
   */
  static uploadAssetGeometry(assetData) {
    const { id, type, name, files } = assetData;
    const errors = [];

    console.log(`[AssetService.gs][uploadAsset]`);
    console.log(`[AssetService.gs][uploadAsset] ID: ${id}`);
    console.log(`[AssetService.gs][uploadAsset] Type: ${type}`);
    console.log(`[AssetService.gs][uploadAsset] Name: ${name}`);

    // Validate type
    if (!CONFIG.ENTITY_TYPES.includes(type)) {
      errors.push(`Unknown asset type: "${type}". Valid types: ${CONFIG.ENTITY_TYPES.join(', ')}`);
      return { success: false, assetId: id, errors };
    }

    const basePath = `${type}s/${id}`;

    // Upload common files
    if (files.thumbnail) {
      // upload thumbnail
      StorageService.uploadFile(`${basePath}/thumbnail.jpg`, files.thumbnail, 'image/jpeg');
    } else {
      errors.push('Missing required file: thumbnail.jpg');
    }

    if (files.description) {
      // upload description
      StorageService.uploadFile(`${basePath}/description.md`, files.description, 'text/markdown');
    } else {
      errors.push('Missing required file: description.md');
    }

    if (files.geometry) {
      // upload geojson
      StorageService.uploadFile(`${basePath}/geometry.geojson`, files.geometry, 'application/json');
    } else {
      errors.push('Missing required file: geometry.geojson');
    }

    // ── Upload type-specific files ─────────────────────────────────────────
    if (type === 'tree') {
      const galleryFiles = files.gallery || [];
      if (galleryFiles.length === 0) {
        console.log('[AssetService.gs]   → WARNING: Tree asset uploaded with no gallery images');
      }
      galleryFiles.forEach((galleryBlob, index) => {
        const paddedIndex = String(index + 1).padStart(3, '0');
        StorageService.uploadFile(`${basePath}/gallery-${paddedIndex}.jpg`, galleryBlob, 'image/jpeg');
      });
    }

    if (errors.length > 0) {
      console.log(`[AssetService.gs] UPLOAD FAILED with ${errors.length} error(s):`, errors);
      return { success: false, assetId: id, errors };
    }

    // ── Post-upload side effects ───────────────────────────────────────────
    HashService.updateMasterHash(id, type, 'upload');
    HashService.appendChangelog(id, type, name, 'upload');

    console.log(`[AssetService.gs] UPLOAD SUCCESS — Asset ${id} stored at gs://${CONFIG.BUCKET_NAME}/${basePath}/`);
    return { success: true, assetId: id, errors: [] };
  }

  /**
   * Deletes an asset and all its files from GCS.
   * @param {string} assetId   - The unique asset ID.
   * @param {string} assetType - 'tree' | 'sign'
   * @param {string} assetName - Human-readable name (for changelog).
   * @returns {{ success: boolean }}
   */
  static deleteAsset(assetId, assetType, assetName) {
    console.log(`[AssetService.gs] DELETE ASSET`);
    console.log(`[AssetService.gs]   → ID   : ${assetId}`);
    console.log(`[AssetService.gs]   → Type : ${assetType}`);
    console.log(`[AssetService.gs]   → Name : ${assetName}`);

    const folderPath = `${assetType}s/${assetId}/`;
    StorageService.deleteFolder(folderPath);

    HashService.updateMasterHash(assetId, assetType, 'delete');
    HashService.appendChangelog(assetId, assetType, assetName, 'delete');

    console.log(`[AssetService.gs] DELETE SUCCESS — Removed all files under gs://${CONFIG.BUCKET_NAME}/${folderPath}`);
    return { success: true };
  }

  /**
   * Edits an existing asset (replaces individual files).
   * Only files provided in the update payload are replaced.
   *
   * @param {string} assetId   - The unique asset ID.
   * @param {string} assetType - 'tree' | 'sign'
   * @param {Object} updates   - { name?, thumbnail?, description?, geometry?, gallery? }
   * @returns {{ success: boolean }}
   */
  static editAsset(assetId, assetType, updates) {
    console.log(`[AssetService.gs] EDIT ASSET`);
    console.log(`[AssetService.gs] ID : ${assetId}`);
    console.log(`[AssetService.gs] Type : ${assetType}`);
    console.log(`[AssetService.gs] Updating fields: ${Object.keys(updates).join(', ')}`);

    const basePath = `${assetType}s/${assetId}`;

    if (updates.thumbnail) {
      StorageService.uploadFile(`${basePath}/thumbnail.jpg`, updates.thumbnail, 'image/jpeg');
    }
    if (updates.description) {
      StorageService.uploadFile(`${basePath}/description.md`, updates.description, 'text/markdown');
    }
    if (updates.geometry) {
      StorageService.uploadFile(`${basePath}/geography.geojson`, updates.geometry, 'application/geo+json');
    }
    if (updates.gallery && assetType === 'tree') {
      updates.gallery.forEach((galleryBlob, index) => {
        const paddedIndex = String(index + 1).padStart(3, '0');
        StorageService.uploadFile(`${basePath}/gallery-${paddedIndex}.jpg`, galleryBlob, 'image/jpeg');
      });
    }

    HashService.updateMasterHash(assetId, assetType, 'edit');
    HashService.appendChangelog(assetId, assetType, updates.name || assetId, 'edit');

    console.log(`[AssetService.gs] EDIT SUCCESS — Asset ${assetId} updated`);
    return { success: true };
  }

  /**
   * Makes a GCS JSON get request to the server and returns the entity's thumbnail
   * 
   * @param {string} entityId - Unique ID for the entity
   * @param {string} type     - A valid entity type ('tree' | 'sign')
   * @returns                 - GCS Object data
   */
  static getThumbnailData(entityId, type) {
    console.log(`[AssetService.gs][getThumbnailData] ${entityId}, ${type}`);
    const blob = StorageService.downloadFile(`${type}s/${entityId}/thumbnail.jpg`);
    const base64 = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType() || 'image/jpeg';

    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Makes a GCS JSON get request to the server and returns the entity's markdown description
   * 
   * @param {string} entityId - Unique ID for the entity
   * @param {string} type     - A valid entity type ('tree' | 'sign')
   * @returns                 - GCS Object data
   */
  static getDescriptionData(entityId, type) {
    console.log(`[AssetService.gs][getDescriptionData] ${entityId}, ${type}`);
    const blob = StorageService.downloadFile(`${type}s/${entityId}/description.md`);
    const mimeType = blob.getContentType() || 'text/markdown';

    return blob.getDataAsString('UTF-8');
  }

  /**
   * Makes a GCS JSON get request to the server and returns the entity's GeoJSON geography
   * 
   * @param {string} entityId - Unique ID for the entity
   * @param {string} type     - A valid entity type ('tree' | 'sign')
   * @returns                 - GCS Object data
   */
  static getGeographyData(entityId, type) {
    console.log(`[AssetService.gs][getGeographyData] ${entityId}, ${type}`);
    const blob = StorageService.downloadFile(`${type}s/${entityId}/geography.geojson`);
    const mimeType = blob.getContentType() || 'application/geo+json';

    const geography = JSON.parse(blob.getDataAsString());

    if (geography.features[0].geometry.type === "Point") {
      return geography.features[0].geometry.coordinates;
    }
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Exposed server functions (called via google.script.run from the client)
// ─────────────────────────────────────────────────────────────────────────────

function serverListAssets() {
  return AssetService.listAllAssets();
}

function serverUploadAsset(assetData) {
  return AssetService.uploadAsset(assetData);
}

function serverDeleteAsset(assetId, assetType, assetName) {
  return AssetService.deleteAsset(assetId, assetType, assetName);
}

function serverEditAsset(entiyId, type, updates) {
  return AssetService.editAsset(entiyId, type, updates);
}

function serverGetThumbnail(entiyId, type) {
  return AssetService.getThumbnailData(entiyId, type);
}

function serverGetDescription(entiyId, type) {
  return AssetService.getDescriptionData(entiyId, type);
}

function serverGetGeography(entiyId, type) {
  return AssetService.getGeographyData(entiyId, type);
}