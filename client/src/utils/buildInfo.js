export const CLIENT_BUILD_ID =
    typeof __APP_BUILD_ID__ !== 'undefined' && String(__APP_BUILD_ID__).trim()
        ? String(__APP_BUILD_ID__).trim()
        : 'dev-local';
