/**
 * Cloudflare Worker: handles submissions from v-trade-form.liquid
 *
 * Flow:
 *  1. Receive multipart/form-data from the storefront form.
 *  2. For each uploaded file, request a staged upload target from Shopify,
 *     upload the file there, then register it with fileCreate.
 *  3. Create a "trade_application" metaobject entry with the form fields
 *     and the resulting file GIDs.
 *  4. (Optional) send a notification email.
 *
 * Requires a custom app / Admin API access token with scopes:
 *   write_files, write_metaobjects
 *
 * Set these as Worker secrets:
 *   SHOPIFY_STORE_DOMAIN   e.g. viburnum-home.myshopify.com
 *   SHOPIFY_ADMIN_TOKEN    Admin API access token
 *   ALLOWED_ORIGIN         e.g. https://viburnumhome.com
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return corsResponse(env, new Response(null, { status: 204 }));
    }

    if (request.method !== 'POST') {
      return corsResponse(env, new Response('Method not allowed', { status: 405 }));
    }

    try {
      const formData = await request.formData();

      const fields = {
        company_name: formData.get('company_name'),
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        position: formData.get('position') || '',
        email: formData.get('email'),
        phone: formData.get('phone'),
        social_link: formData.get('social_link') || '',
        cv_link: formData.get('cv_link') || '',
        projects_per_year: formData.get('projects_per_year'),
        can_share_photos: formData.get('can_share_photos'),
      };

      const resaleTaxFile = formData.get('resale_tax_id');
      const portfolioFile = formData.get('portfolio');

      const resaleTaxGid = resaleTaxFile && resaleTaxFile.size
        ? await uploadFileToShopify(env, resaleTaxFile)
        : null;

      const portfolioGid = portfolioFile && portfolioFile.size
        ? await uploadFileToShopify(env, portfolioFile)
        : null;

      await createTradeApplicationMetaobject(env, fields, resaleTaxGid, portfolioGid);

      return corsResponse(
        env,
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    } catch (err) {
      return corsResponse(
        env,
        new Response(JSON.stringify({ ok: false, error: String(err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
  },
};

function corsResponse(env, response) {
  response.headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

async function shopifyGraphQL(env, query, variables) {
  const res = await fetch(
    `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function uploadFileToShopify(env, file) {
  // Step 1: ask Shopify for a staged upload target
  const stagedData = await shopifyGraphQL(
    env,
    `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {
      input: [
        {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          resource: 'FILE',
          fileSize: String(file.size),
        },
      ],
    }
  );

  const target = stagedData.stagedUploadsCreate.stagedTargets[0];

  // Step 2: upload the raw file to the staged target
  const uploadForm = new FormData();
  target.parameters.forEach((p) => uploadForm.append(p.name, p.value));
  uploadForm.append('file', file, file.name);

  await fetch(target.url, { method: 'POST', body: uploadForm });

  // Step 3: register the uploaded file with Shopify
  const fileData = await shopifyGraphQL(
    env,
    `mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id }
        userErrors { field message }
      }
    }`,
    {
      files: [{ originalSource: target.resourceUrl, contentType: 'FILE' }],
    }
  );

  return fileData.fileCreate.files[0].id;
}

async function createTradeApplicationMetaobject(env, fields, resaleTaxGid, portfolioGid) {
  // Assumes a metaobject definition with type "trade_application" and fields
  // matching the keys below already exists (Settings > Custom data > Metaobjects).
  const fieldEntries = [
    { key: 'company_name', value: fields.company_name },
    { key: 'first_name', value: fields.first_name },
    { key: 'last_name', value: fields.last_name },
    { key: 'position', value: fields.position },
    { key: 'email', value: fields.email },
    { key: 'phone', value: fields.phone },
    { key: 'social_link', value: fields.social_link },
    { key: 'cv_link', value: fields.cv_link },
    { key: 'projects_per_year', value: fields.projects_per_year },
    { key: 'can_share_photos', value: fields.can_share_photos },
  ];

  if (resaleTaxGid) fieldEntries.push({ key: 'resale_tax_id_file', value: resaleTaxGid });
  if (portfolioGid) fieldEntries.push({ key: 'portfolio_file', value: portfolioGid });

  return shopifyGraphQL(
    env,
    `mutation metaobjectCreate($input: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $input) {
        metaobject { id }
        userErrors { field message }
      }
    }`,
    {
      input: {
        type: 'trade_application',
        fields: fieldEntries,
      },
    }
  );
}
