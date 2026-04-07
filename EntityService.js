/**
 * An Entity is made up of a bunch of assets.
 * This class offers methods to build entities from assets and modify assets of an entity
 */

class EntityService {
  /**
   * Get the name of an entity given its asset id
   * @param {string} assetId 
   */
  static getEntityName(assetId) {
    const catalog = HashService.getCatalog();
    const entity = catalog.entities.find(e => e.id === assetId.trim());
    return entity ? entity.name : 'MISSING NAME';
  }

  /**
   * List entites of a specific type
   * @param {string} a valid type ('tree' || 'sign')
   */
  static listEntities(type) {
    const catalog = HashService.getCatalog();
    const entities = catalog.entities
      .filter(e => e.type === type)
      .map(e => new Entity(e.id, e.type, e.name, e.lastModified, ''));

    console.log(`[EntityService.gs][listEntities] Found ${entities.length} entities of type "${type}": ${entities.map(e => e.id).join(', ')}`);
    return entities;
  }

  /**
   * Uploads a new entity and all its asset files to GCS,
   * then updates the catalog.
   *
   * @param {Object} entityData - { id, type, name, latitude, longitude, files: { thumbnail, description, gallery[] } }
   * @returns {{ success: boolean, entityId: string, error: string }}
   */
  static uploadEntity(entityData) {
    const { id, type, name, latitude, longitude, files } = entityData;

    console.log(`[EntityService.gs][uploadEntity] ID: ${id}, Type: ${type}, Name: ${name}`);
    console.log(`[EntityService.gs][uploadEntity] Latitude: ${latitude}, Longitude: ${longitude}`);

    // ── Validate type ──
    if (!CONFIG.ENTITY_TYPES.includes(type)) {
      console.log(`[EntityService.gs][uploadEntity] WARNING: Unknown entity type: "${type}"`);
      return {
        success: false, entityId: id,
        error: `Unknown entity type: "${type}". Valid types: ${CONFIG.ENTITY_TYPES.join(', ')}`
      };
    }

    // ── Validate files ──
    const errors = AssetService.validateEntityFiles(type, files);
    if (errors.length > 0) {
      console.log(`[EntityService.gs][uploadEntity] VALIDATION FAILED with ${errors.length} error(s):\n    ${errors.join('\n    ')}`);
      return { success: false, entityId: id, error: errors.join('\n') };
    }

    const basePath = `${type}s/${id}`;
    HashService.beginSession();

    // ── Upload asset files ──
    try {
      HashService.stageFile(AssetService.uploadTextAsset(basePath, 'description.md', files.description, 'text/markdown'));
      HashService.stageFile(AssetService.uploadGeoJSONAsset(basePath, 'geography.geojson', AssetService.createGeoJSONBlob(id, type, name, latitude, longitude)));
      
      if (type === 'tree') {
        HashService.stageFile(AssetService.uploadJpegAsset(basePath, 'thumbnail.jpg', files.thumbnail));
        AssetService.uploadGalleryAssets(basePath, files.gallery).forEach(r => HashService.stageFile(r));
      }
    } catch (e) {
      HashService.abortSession();
      console.log(`[EntityService.gs][uploadEntity] Error while uploading files: ${e.message}`);
      console.log(`[EntityService.gs][uploadEntity] Stack: ${e.stack}`);
      return { success: false, entityId: id, error: e.message };
    }

    // ── Update catalog ──
    try {
      HashService.commitCatalog({ id, type, name });
    } catch (e) {
      console.log(`[EntityService.gs][uploadEntity] Error while updating catalog: ${e.message}`);
      console.log(`[EntityService.gs][uploadEntity] Stack: ${e.stack}`);
      return { success: false, entityId: id, error: e.message };
    }

    console.log(`[EntityService.gs][uploadEntity] SUCCESS — Entity ${id} stored at gs://${CONFIG.BUCKET_NAME}/${basePath}/`);
    return { success: true, entityId: id, error: null };
  }

  /**
   * Edits an existing entity — replaces only the files present in the
   * updates payload, optionally renames the entity and/or changes its ID.
   *
   * @param {string} entityId   - The current entity ID.
   * @param {string} entityType - 'tree' | 'sign'
   * @param {Object} updates    - { newId?, name?, thumbnail?, description?, geometry?, gallery? }
   * @returns {{ success: boolean }}
   */
  static editEntity(entityId, entityType, updates) {
    console.log(`[EntityService.gs][editEntity] ID: ${entityId} Type: ${entityType}`);
    console.log(`[EntityService.gs][editEntity] Updating fields: ${Object.keys(updates).join(', ')}`);

    try {
      const basePath    = `${entityType}s/${entityId}`;
      const newId       = updates.newId || entityId;
      const newBasePath = `${entityType}s/${newId}`;

      HashService.beginSession();

      // ── Replace provided asset files ──
      if (updates.thumbnail) {
        HashService.stageFile(AssetService.replaceAsset(basePath, 'thumbnail.jpg', updates.thumbnail, 'image/jpeg'));
      }

      if (updates.description) {
        HashService.stageFile(AssetService.replaceAsset(basePath, 'description.md', updates.description, 'text/markdown'));
      }

      if (updates.latitude && updates.longitude) {
        HashService.stageFile(AssetService.uploadGeoJSONAsset(basePath, 'geography.geojson', AssetService.createGeoJSONBlob(entityId, entityType, updates.name || entityId, updates.latitude, updates.longitude)
        ));
      }
      else if (updates.geometry) {
        // fallback for future entity types that upload a geometry file directly
        HashService.stageFile(AssetService.replaceAsset(basePath, 'geography.geojson', updates.geometry, 'application/geo+json'));
      }

      if (updates.gallery && entityType === 'tree') {
        updates.gallery.forEach((galleryData, index) => {
          const paddedIndex = String(index + 1).padStart(3, '0');
          HashService.stageFile(AssetService.replaceAsset(basePath, `gallery-${paddedIndex}.jpg`, galleryData, 'image/jpeg'));
        });
      }

      // ── Move all assets to new path if ID changed ──
      if (newId !== entityId) {
        AssetService.moveAssets(basePath, newBasePath);
      }

      // ── Update catalog ──
      const entityName = updates.name || entityId;
      HashService.commitCatalog({ id: newId, type: entityType, name: entityName });

      console.log(`[EntityService.gs][editEntity] SUCCESS — Entity ${entityId} updated`);
      return { success: true };

    } catch (e) {
      HashService.abortSession();
      console.log(`[EntityService.gs][editEntity] ERROR: ${e.message}`);
      console.log(`[EntityService.gs][editEntity] Stack: ${e.stack}`);
      return { success: false, error: e.message };
    }
  }

  /**
   * Deletes an entity record and all its associated asset files from GCS,
   * then updates the catalog.
   *
   * @param {string} entityId   - The entity ID to delete.
   * @param {string} entityType - 'tree' | 'sign'
   * @param {string} entityName - Used for logging only.
   * @returns {{ success: boolean, error: string }}
   */
  static deleteEntity(entityId, entityType, entityName) {
    console.log(`[EntityService.gs][deleteEntity] ID: ${entityId}, Type: ${entityType}, Name: ${entityName}`);

    try {
      const basePath = `${entityType}s/${entityId}`;

      // ── Delete all asset files under the entity path ──
      const files = StorageService.listFiles(basePath);
      console.log(`[EntityService.gs][deleteEntity] Found ${files.length} file(s) to delete under ${basePath}`);

      files.forEach(objectPath => {
        StorageService.deleteFile(objectPath);
        console.log(`[EntityService.gs][deleteEntity] Deleted: ${objectPath}`);
      });

      // ── Remove entity from catalog ──
      HashService.removeEntity(entityId);

      console.log(`[EntityService.gs][deleteEntity] SUCCESS — Entity ${entityId} deleted`);
      return { success: true, error: null };

    } catch (e) {
      console.log(`[EntityService.gs][deleteEntity] ERROR: ${e.message}`);
      console.log(`[EntityService.gs][deleteEntity] Stack: ${e.stack}`);
      return { success: false, error: e.message };
    }
  }
}

// Exposed server functions (called via google.script.run from the client)
function serverListEntities(type) {
  return EntityService.listEntities(type);
}

function serverListAllEntities() {
  var entities = [];
  for (const type of CONFIG.ENTITY_TYPES){ 
    entities.push(...EntityService.listEntities(type));
  }
  return entities;
}

function serverUploadEntity(entityData) {
  return EntityService.uploadEntity(entityData);
}

function serverEditEntity(entityId, entityType, updates) {
  return EntityService.editEntity(entityId, entityType, updates);
}

function serverDeleteEntity(entityId, entityType, entityName) {
  return EntityService.deleteEntity(entityId, entityType, entityName);
}