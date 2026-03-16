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
    console.log(`[EntityService.gs][getEntityName] looking for id: ${assetId}`);

    const catalogFile = EntityService.loadCatalog();

    if (catalogFile) {
      // Find the entity by its ID
      const entity = catalogFile.entities.find(entity => entity.id === assetId.trim());

      console.log(`[EntityService.gs][getEntityName] entity name: ${entity.name}`);
      return entity ? entity.name : 'MISSING NAME';
    }

    // entity id name pairs have not been retrieved
    console.log(`[EntityService.gs][getEntityName] entity id name pairs have not been retrieved`);
    return '';
  }

  /**
   * Get the catalog file from GCS
   */
  static getCatalog() {
    console.log(`[EntityService.gs][getCatalog] Fetching ${CONFIG.CATALOG_PATH}`);
    // download the catalog json file
    var blob = StorageService.downloadFile(CONFIG.CATALOG_PATH);
    
    // return the Blob to a JSON object
    var catalogString = blob.getDataAsString();
    PropertiesService.getScriptProperties().setProperty('CATALOG_FILE', catalogString);

    console.log(`[EntityService.gs][getCatalog] ${catalogString}`);
  }

  /**
   * 
   * @returns JSON parsed string
   */
  static loadCatalog() {
    const catalogString = PropertiesService.getScriptProperties().getProperty('CATALOG_FILE');

    if (!catalogString) {
      return null;
    }

    return JSON.parse(catalogString);
  }

  /**
   * List entites of a specific type
   */
  static listEntities(type) {
    console.log(`[EntityService.gs][listEntities] Fetching entities of type: ${type}`);
    var entities = [];
    //const prefixes = StorageService.listObjects(`${type}s/`, '/').prefixes;
    
    // create HTTP request url 
    const url = `https://storage.googleapis.com/storage/v1/b/${CONFIG.BUCKET_NAME}/o?prefix=${type}s/&delimiter=/`;

    const service = AuthService._getCloudService();

    if (!service.hasAccess()) {
      console.log('[EntityService.gs][listEntities] No valid OAuth session');
    }

    const token = service.getAccessToken();

    // use UrlFetchApp.fetch to send GET to GCS 
    console.log(`[EntityService.gs][listEntities] GET ${url}`);
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
    
    const prefixes = JSON.parse(response.getContentText()).prefixes;


    if (prefixes && prefixes.length > 0) {
      prefixes.forEach((object) => {
        var assetId = AssetService.getAssetId(object, type);
        var entityName = EntityService.getEntityName(assetId);
        entities.push(new Entity(
          assetId,
          type,
          entityName,
          '',
          ''
        ));
        console.log(`[EntityService.gs][listEntities] added entity: ${object}`);
      });
    }

    return entities;
  }

  static listAllEntities() {
    console.log('[EntityService.gs][listAllEntities]');
    var allEntities = [];

    for (const type of CONFIG.ENTITY_TYPES) {
      allEntities.push(...EntityService.listEntities(type));
    }

    console.log(`[EntityService.gs][listAllEntities] LIST COMPLETE - Returning ${allEntities.length} entities`);
    return allEntities;
  }

  static uploadEntity() {}
  static deleteEntity() {}
}

//  Exposed server functions (called via google.script.run from the client)

function serverListAllEntities() {
  return EntityService.listAllEntities();
}


function serverGetCatalog() {
  return EntityService.getCatalog();
}