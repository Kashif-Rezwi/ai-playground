module.exports = {
    env: {
        node: true,
        es2022: true,
    },
    parser: '@typescript-eslint/parser',
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier'
    ]
};
