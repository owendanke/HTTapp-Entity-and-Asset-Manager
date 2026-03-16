/**
 * Entity record that tracks data and assets
 * @param {string} id
 * @param {string} type
 * @param {string} name
 * @param {string} dateUploaded
 * @param {string} md5Hash
 */
class Entity {
    constructor(id, type, name, dateUploaded, md5Hash) {
        this.id = id;
        this.type = type;
        this.name = name;
        this.dateUploaded = dateUploaded;
        this.md5Hash - md5Hash;
    }
}