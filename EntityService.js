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
      .map(e => new Entity(e.id, e.type, e.name, '', ''));

    console.log(`[EntityService.gs][listEntities] Found ${entities.length} entities of type "${type}": ${entities.map(e => e.id).join(', ')}`);
    return entities;
  }

  static uploadEntity() {}
  static deleteEntity() {}
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