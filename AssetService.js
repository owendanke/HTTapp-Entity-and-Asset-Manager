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
   * Replaces an individual asset file for an entity.
   * Returns the upload response for HashService staging.
   *
   * @param {string} basePath - e.g. 'trees/1-18'
   * @param {string} filename - e.g. 'thumbnail.jpg'
   * @param {*}      fileData - data URL string or blob
   * @param {string} mimeType
   */
  static replaceAsset(basePath, filename, fileData, mimeType) {
    console.log(`[AssetService.gs][replaceAsset] ${basePath}/${filename}`);
    if (mimeType === 'image/jpeg') {
      return StorageService.uploadJpeg(`${basePath}/${filename}`, fileData);
    }
    return StorageService.uploadFile(`${basePath}/${filename}`, Utilities.newBlob(fileData, mimeType), mimeType);
  }

  /**
   * Moves all asset files of an entity from one ID path to another.
   * Used when an entity's ID is changed.
   *
   * @param {string} oldBasePath - e.g. 'trees/1-18'
   * @param {string} newBasePath - e.g. 'trees/1-19'
   */
  static moveAssets(oldBasePath, newBasePath) {
    console.log(`[AssetService.gs][moveAssets] ${oldBasePath} → ${newBasePath}`);
    const files = StorageService.listFiles(oldBasePath);
    files.forEach(objectPath => {
      const filename = objectPath.replace(oldBasePath + '/', '');
      const blob = StorageService.downloadFile(objectPath);
      const mimeType = blob.getContentType();
      StorageService.uploadFile(`${newBasePath}/${filename}`, blob, mimeType);
      StorageService.deleteFile(objectPath);
    });
  }

  /**
   * Uploads a single text-based asset file (markdown, geojson).
   * Returns the upload response for HashService staging.
   */
  static uploadTextAsset(basePath, filename, content, mimeType) {
    console.log(`[AssetService.gs][uploadTextAsset] Uploading ${basePath}/${filename}`);
    return StorageService.uploadFile(`${basePath}/${filename}`, Utilities.newBlob(content, mimeType), mimeType );
  }

  static uploadGeoJSONAsset(basePath, filename, geoJSONBlob) {
    console.log(`[AssetService.gs][uploadGeoJSONAsset] Uploading ${basePath}/${filename}`);
    return StorageService.uploadFile(`${basePath}/${filename}`, geoJSONBlob, 'application/geo+json');
  }

  /**
   * Uploads a single JPEG asset file.
   * Returns the upload response for HashService staging.
   */
  static uploadJpegAsset(basePath, filename, dataUrl) {
    console.log(`[AssetService.gs][uploadJpegAsset] Uploading ${basePath}/${filename}`);
    return StorageService.uploadJpeg(`${basePath}/${filename}`, base64FromDataUrl(dataUrl));
  }

  /**
   * Uploads all gallery images for an entity.
   * Returns an array of upload responses for HashService staging.
   */
  static uploadGalleryAssets(basePath, galleryImages) {
    console.log(`[AssetService.gs][uploadGalleryAssets] Uploading ${galleryImages.length} gallery image(s) to ${basePath}`);
    return galleryImages.map((dataUrl, index) => {
      const paddedIndex = String(index + 1).padStart(3, '0');
      return AssetService.uploadJpegAsset(basePath, `gallery-${paddedIndex}.jpg`, dataUrl);
    });
  }

  /**
   * Creates a GeoJSON blob for a point entity.
   * @param {string} latStr - Latitude as string
   * @param {string} lonStr - Longitude as string
   * @returns {Blob} GeoJSON blob
   */
  static createGeoJSONBlob(id, type, name, latStr, lonStr) {
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error('Invalid latitude or longitude');
    }

    const geojson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { id, type, name }
      }]
    };

    console.log(`[AssetService.gs][createGeoJSONBlob] lat: ${lat}, lon: ${lon}`);
    return Utilities.newBlob(JSON.stringify(geojson), 'application/geo+json');
  }

  /**
   * Validates required files are present for a given entity type.
   * Returns an array of error strings — empty if valid.
   */
  static validateEntityFiles(type, files) {
    const errors = [];
    if (!files.description) {
      errors.push('Missing required file: description.md');
    }
    if (type === 'tree') {
      if (!files.thumbnail) {
        errors.push('Missing required file: thumbnail.jpg');
      }
      if (!files.gallery || files.gallery.length === 0) {
        errors.push('Missing gallery image(s)');
      }
    }
    return errors;
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
   * @param {string} entityId   - The unique asset ID.
   * @param {string} entityType - 'tree' | 'sign'
   * @param {string} assetName  - Human-readable name (for changelog).
   * @returns {{ success: boolean }}
   */
  static deleteAsset(entityId, entityType, assetName) {
    console.log(`[AssetService.gs] DELETE ASSET`);
    console.log(`[AssetService.gs]   → ID   : ${entityId}`);
    console.log(`[AssetService.gs]   → Type : ${entityType}`);
    console.log(`[AssetService.gs]   → Name : ${assetName}`);

    const folderPath = `${entityType}s/${entityId}/`;
    StorageService.deleteFolder(folderPath);

    HashService.updateMasterHash(entityId, entityType, 'delete');
    HashService.appendChangelog(entityId, entityType, assetName, 'delete');

    console.log(`[AssetService.gs] DELETE SUCCESS — Removed all files under gs://${CONFIG.BUCKET_NAME}/${folderPath}`);
    return { success: true };
  }

  /**
   * Edits assets of an existing entity (replaces individual files).
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
   * Makes two GCS requests to get every existing gallery image from an entity.
   * First is a list to learn what images exist and the second retrieves the data.
   * 
   * @param {string} entityId - Unique ID for the entity
   * @param {string} type     - A valid entity type ('tree' | 'sign')
   * @returns                 - List of image/jpeg dataURLs
   */
  static getGalleryData(entityId, type) {
    console.log(`[AssetService.gs][getGalleryData] ${entityId}, ${type}`);

    // first request
    const prefix = `${type}s/${entityId}`;
    const response = StorageService.listObjects(prefix);
    const galleryNames = response.items
      .filter(item => item.name && item.name.includes('/gallery-'))   // filter items to item names
      .sort((a, b) => a.name.localeCompare(b.name))                   // sort to show order
      .map(item => item.name);                                        // replace every item entry with its name

    console.log(`[AssetService.gs][getGalleryData] Found ${galleryNames.length} gallery image(s)`);

    // second request
    const galleryDataURLs = [];
    for (const name of galleryNames) {
      try {
        var blob = StorageService.downloadFile(name);

        if (!blob) {
          console.log(`[AssetService.gs][getGalleryData] WARNING: null blob for ${name}`);
          continue;
        }
        
        var base64 = Utilities.base64Encode(blob.getBytes());
        var mimeType = blob.getContentType() || 'image/jpeg';

        galleryDataURLs.push(`data:${mimeType};base64,${base64}`);
      } catch (error) {
        console.log(`[AssetService.gs][getGalleryData] Encountered error while downloading ${name}`);
        console.log(`[AssetService.gs][getGalleryData] ${error.message}`);

        continue;
      }
    }

    console.log(`[AssetService.gs][getGalleryData] Returning ${galleryDataURLs.length} image(s)`);
    return galleryDataURLs;
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

function serverGetThumbnail(entiyId, type) {
  return AssetService.getThumbnailData(entiyId, type);
}

function serverGetGallery(entityId, type) {
  return AssetService.getGalleryData(entityId, type);
}

function serverGetDescription(entiyId, type) {
  return AssetService.getDescriptionData(entiyId, type);
}

function serverGetGeography(entiyId, type) {
  return AssetService.getGeographyData(entiyId, type);
}