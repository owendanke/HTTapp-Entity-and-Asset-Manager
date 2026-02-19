/**
 * Global Config
 */
const scriptProperties = PropertiesService.getScriptProperties();

const CONFIG = {
  // Title of the web app
  APP_TITLE: 'HTTapp Entity and Asset Manager',

  // google (firebase) storage bucket URI
  BUCKET_NAME: scriptProperties.getProperty('bucket_name'),

  // get client ID and secret from the project settings
  CLIENT_ID: scriptProperties.getProperty('client_id'),
  CLIENT_SECRET: scriptProperties.getProperty('client_secret'),

  // entity type definitions
  ENTITY_TYPES: ['tree', 'sign'], 

  // google drive id for favicon image
  FAV_ID: '1rqWdiFTWnKK4gjketK7V8L9QeRS1zEyF',
};