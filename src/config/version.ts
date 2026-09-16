import versionConfig from '../../public/version.json';

export const APP_VERSION: string = versionConfig.version;
export const APP_MINIMUM_VERSION: string = versionConfig.minimumVersion || versionConfig.version;
export const APP_BUILD: string = versionConfig.build || '202609160900';
export const APP_UPDATED_AT: string = versionConfig.updatedAt || versionConfig.releaseDate || '2026-09-16T07:00:00+07:00';
