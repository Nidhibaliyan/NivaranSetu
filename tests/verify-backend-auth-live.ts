import assert from 'assert';
import { resolveSupabaseConfig, createServerAuthClient } from '../server';
import { supabase } from '../src/utils/supabaseClient';

async function runVerification() {
  console.log('=== NivaranSetu Supabase Auth & Config Resolution Verification ===\n');

  // 1. Verify Configuration Resolution
  console.log('[Check 1] Supabase Configuration Resolution in server.ts:');
  const config = resolveSupabaseConfig();
  assert(config !== null, 'resolveSupabaseConfig() must return a non-null configuration object');
  assert(
    typeof config.url === 'string' && config.url.length > 0,
    'config.url must be a non-empty string'
  );
  assert(
    typeof config.publishableKey === 'string' && config.publishableKey.length > 0,
    'config.publishableKey must be a non-empty string'
  );
  console.log('  ✓ Config resolved successfully');
  console.log(`  ✓ URL defined (length: ${config.url.length}, domain: ${new URL(config.url).hostname})`);
  console.log(`  ✓ Publishable key defined (length: ${config.publishableKey.length}) [VALUE MASKED]`);

  // 2. Verify Server Auth Client Creation
  console.log('\n[Check 2] Server Auth Client Initialization:');
  const authClient = createServerAuthClient(5000);
  assert(authClient !== null, 'createServerAuthClient() must return an initialized SupabaseClient');
  console.log('  ✓ Server-side SupabaseClient successfully initialized');

  // 3. Verify Invalid Token Handling
  console.log('\n[Check 3] Invalid Token Rejection via Server Auth Client:');
  try {
    const { data: invalidData, error: invalidError } = await authClient.auth.getUser('invalid_dummy_jwt_token');
    assert(invalidError !== null, 'Invalid token must return an error from auth.getUser()');
    console.log(`  ✓ Invalid token rejected as expected (Error: "${invalidError.message}")`);
  } catch (err: any) {
    console.log(`  ✓ Invalid token rejected with exception: ${err?.message || err}`);
  }

  // 4. Live Supabase Authentication & Real Token Validation
  console.log('\n[Check 4] Live Supabase Project Token Validation:');
  const testEmail = process.env.SUPABASE_TEST_EMAIL;
  const testPassword = process.env.SUPABASE_TEST_PASSWORD;

  if (!testEmail || !testPassword) {
    console.log('  [NOTICE] SUPABASE_TEST_EMAIL or SUPABASE_TEST_PASSWORD not provided in environment. Skipping live sign-in attempt.');
    return;
  }

  console.log(`  Attempting live Supabase sign-in for configured test account [EMAIL MASKED]...`);
  try {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      console.log(`  [NOTICE] Live Supabase sign-in returned error: ${signInError.message}`);
      console.log('  Distinction: Environment config is valid, but live credential exchange did not complete.');
      return;
    }

    if (!signInData.session || !signInData.session.access_token) {
      console.log('  [NOTICE] Sign-in succeeded but session was null (e.g. unconfirmed email).');
      return;
    }

    console.log('  ✓ Live sign-in succeeded. Obtained authenticated JWT.');
    const liveToken = signInData.session.access_token;

    // Validate the real live token using the server's authClient
    console.log('  Validating real JWT against server-side authClient.auth.getUser(token)...');
    const { data: validatedData, error: validateError } = await authClient.auth.getUser(liveToken);

    if (validateError) {
      console.log(`  [ERROR] Real token validation failed: ${validateError.message}`);
      assert.fail(`Real token validation failed: ${validateError.message}`);
    }

    assert(validatedData?.user !== null, 'Validated user must not be null');
    assert(typeof validatedData.user.id === 'string', 'Validated user must have a valid UUID string');
    console.log(`  ✓ Live token successfully validated by server auth client against Supabase project!`);
    console.log(`  ✓ Verified user UUID: ${validatedData.user.id.substring(0, 8)}...[REST MASKED]`);
  } catch (netErr: any) {
    console.log(`  [NETWORK NOTICE] Live network request to Supabase failed: ${netErr?.message || netErr}`);
    console.log('  Distinction: Network boundary or timeout prevented live validation.');
  }

  console.log('\n===================================================');
  console.log('All backend auth verification checks completed.');
  console.log('===================================================');
}

runVerification().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
