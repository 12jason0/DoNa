/** @type {import('i18next-parser').ParserOptions} */
module.exports = {
    locales: ["ko", "en", "ja", "zh"],
    output: "src/i18n/messages/$LOCALE/translation.json",
    input: ["src/**/*.{ts,tsx}"],
    createOldCatalogs: false,
    keySeparator: ".",
    namespaceSeparator: ":",
    defaultValue: "",
    indentation: 2,
};
