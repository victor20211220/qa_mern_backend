module.exports = {
    apps: [
        {
            name: 'qa-backend',
            script: 'dist/server.js',
            env: {
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        }
    ]
};
