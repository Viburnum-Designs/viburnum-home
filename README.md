# V Trade Form — setup

## Theme files
- `sections/v-trade-form.liquid` — the section, add via theme editor
- `assets/v-trade-form.css`
- `assets/v-trade-form.js`

Drop all three into the matching folders in your theme (`sections/`, `assets/`, `assets/`).

## Metaobject definition
In Shopify admin → **Settings → Custom data → Metaobjects**, create a definition:

- Type: `trade_application`
- Fields: `company_name`, `first_name`, `last_name`, `position`, `email`, `phone`,
  `social_link`, `cv_link`, `projects_per_year`, `can_share_photos` (all single-line text),
  plus `resale_tax_id_file` and `portfolio_file` (type: File).

## Serverless function
`trade-form-worker.js` is written for Cloudflare Workers but the logic ports directly
to a Vercel/Netlify function — it's just fetch calls.

1. Create a custom app in Shopify admin with `write_files` and `write_metaobjects` scopes,
   grab the Admin API access token.
2. Deploy the worker, set secrets: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`, `ALLOWED_ORIGIN`.
3. In the theme editor, open the V Trade Form section settings and paste the worker's
   URL into "Form submission endpoint".

## Notes
- The "projects per year" and "share photos" groups are single-select (radio) rather than
  checkboxes, since the screenshot's copy and layout imply pick-one — swap to checkboxes
  in the Liquid + validation JS if you actually want multi-select.
- Resale Tax ID is a required file; Portfolio is optional — matches the mockup's asterisks.
- File type is restricted to `.jpg/.jpeg/.pdf` via `accept`, but that's not enforced
  server-side — add a MIME/extension check in the worker before calling `fileCreate`
  if you want a hard block.
