# Add version to package.json
sed -i s/"\"version\":.*/\"version\": \"${TRAVIS_TAG}\","/ package.json

# Install dependencies
npm run build

# Put NPM access token to .npmrc for publishing
echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > .npmrc

# Publish new version of the app to NPM
npm publish
