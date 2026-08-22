const target = process.argv[2];

function missing(names) {
  return names.filter(name => !process.env[name]?.trim());
}

function fail(message) {
  console.error(`Signing configuration error: ${message}`);
  process.exit(1);
}

if (target === 'mac') {
  const certificateVariables = ['CSC_LINK', 'CSC_KEY_PASSWORD'];
  const certificateMissing = missing(certificateVariables);
  if (certificateMissing.length) {
    fail(`missing ${certificateMissing.join(', ')}`);
  }

  const apiKeyVariables = ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'];
  const appleIdVariables = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
  const hasApiKeyCredentials = missing(apiKeyVariables).length === 0;
  const hasAppleIdCredentials = missing(appleIdVariables).length === 0;
  if (!hasApiKeyCredentials && !hasAppleIdCredentials) {
    fail(`provide either ${apiKeyVariables.join(', ')} or ${appleIdVariables.join(', ')}`);
  }
} else if (target === 'win') {
  const windowsVariables = ['WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD'];
  const windowsMissing = missing(windowsVariables);
  if (windowsMissing.length) {
    fail(`missing ${windowsMissing.join(', ')}`);
  }
} else {
  fail('expected target "mac" or "win"');
}

console.log(`Signing credentials are configured for ${target}. Secret values were not printed.`);
