# Satispay Payment Gateway for Wix

Integrate [Satispay](https://www.satispay.com) as a payment method on your Wix website using the Payment Provider Service Plugin and a Vercel-hosted signing service.

## Features

- **QR Code payments** — Customers scan and pay with the Satispay app
- **Mobile support** — "Pay with Satispay" button opens the Satispay payment page on mobile
- **Real-time status** — Payment page polls for confirmation and redirects automatically
- **Automatic order confirmation** — Callback confirms the order on Wix instantly
- **Works with Wix Video, Wix Events, and Wix Stores**
- **Refund support** — Dedicated refund page with security key
- **Custom branding** — Payment page shows your logo alongside Satispay's

## Architecture

```
┌──────────────┐     ┌─────────────────────────┐     ┌──────────────┐
│  Wix Velo    │────>│  Vercel Signing Service  │────>│ Satispay API │
│              │     │                           │     │              │
│  satispay.js │     │  /api/sign   (RSA signing)│     │  Create      │
│  (plugin)    │     │  /api/pay    (QR page)    │     │  payment     │
│              │     │  /api/status (poll)       │     │              │
│  http-       │<────│  /api/confirm (callback)  │<────│  Callback    │
│  functions.js│     │  /api/refund (refunds)    │     │  S2S         │
└──────────────┘     └─────────────────────────────┘     └──────────────┘
```

## Prerequisites

- A [Wix](https://www.wix.com) website with Velo (Developer Mode) enabled
- A [Satispay Business](https://business.satispay.com) account with an e-commerce shop
- A [Vercel](https://vercel.com) account (free tier works)
- [Node.js](https://nodejs.org) installed locally

## Setup Guide

### Step 1: Generate RSA Keys and Satispay Key ID

Generate a new RSA key pair:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private_key.pem
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

Get an activation code from your Satispay Business dashboard: **Shops** > your e-commerce shop > **API** > **Generate activation code**.

Exchange the code for a Key ID:

```bash
curl -X POST "https://authservices.satispay.com/g_business/v1/authentication_keys" \
  -H "Content-Type: application/json" \
  -d '{"public_key": "'"$(cat public_key.pem)"'", "token": "YOUR_ACTIVATION_CODE"}'
```

Save the `key_id` from the response.

### Step 2: Deploy to Vercel

```bash
git clone https://github.com/YOUR_USERNAME/satispay-wix-plugin.git
cd satispay-wix-plugin/vercel
npm install
```

Set environment variables on Vercel:

| Variable | Value |
|----------|-------|
| `SATISPAY_KEY_ID` | Your Key ID from Step 1 |
| `SATISPAY_PRIVATE_KEY` | Your private key (single line with `\n`) |
| `REFUND_SECRET` | A secure password for the refund page |
| `CALLBACK_BASE_URL` | Your Wix site URL (e.g., `https://www.your-site.com`) |

To convert your private key to a single line:

```bash
awk '{printf "%s\\n", $0}' private_key.pem | sed 's/\\n$//'
```

Deploy:

```bash
vercel --prod
```

Note your deployment URL (e.g., `https://your-project.vercel.app`).

### Step 3: Set Up Wix Velo

1. Open your Wix Editor and enable **Dev Mode**.

2. Add the Payment Provider plugin: **Service Plugins** > **+** > **Payment** > name it `satispay`.

3. Copy the plugin files from `wix-velo/service-plugins/payment-provider/satispay/` into the corresponding Wix files.

4. Create `http-functions.js` in **Backend** and paste the code from `wix-velo/backend/http-functions.js`.

5. **Important:** In `satispay.js`, replace `https://www.YOUR-DOMAIN.com` with your own domain in the `callbackUrl` and `redirect_url` variables.

6. **Publish** your site.

### Step 4: Connect in Wix Dashboard

1. **Dashboard** > **Accept Payments** > **See More Payment Options**
2. Find **Satispay** > **Connect**
3. Enter your Vercel URL as the Signing Service URL: `https://your-project.vercel.app/api/sign`
4. Select **Produzione** as environment
5. **Connect**

### Step 5: Test

Purchase something on your live site with Satispay. The QR code page should appear, and after scanning and paying, the order should be confirmed automatically.

## Refunds

Use the dedicated refund page:

```
https://your-project.vercel.app/api/refund?secret=YOUR_REFUND_SECRET
```

Enter the Satispay Payment ID and optionally a partial refund amount.

## Customization

### Your Logo on the Payment Page

In `vercel/api/pay.js`, replace the `merchantLogoUrl` variable with your own logo URL.

### Checkout Logo

In `wix-velo/service-plugins/payment-provider/satispay/satispay-config.js`, update the logo URLs.

## File Structure

```
satispay-wix-plugin/
├── vercel/
│   ├── api/
│   │   ├── sign.js        # RSA signature endpoint
│   │   ├── pay.js         # QR code payment page
│   │   ├── status.js      # Payment status check
│   │   ├── confirm.js     # Wix callback trigger
│   │   ├── refund.js      # Refund management page
│   │   └── logo.js        # Satispay logo endpoint
│   ├── package.json
│   └── vercel.json
├── wix-velo/
│   ├── service-plugins/
│   │   └── payment-provider/
│   │       └── satispay/
│   │           ├── satispay-config.js
│   │           └── satispay.js
│   └── backend/
│       └── http-functions.js
├── LICENSE
└── README.md
```

## Key Technical Notes

| Topic | Detail |
|-------|--------|
| `reasonCode` | Must be `0`. Any non-zero value = declined payment. |
| Amount field | `options.order.description.totalAmount` (string, already in cents) |
| Wix Velo crypto | Not available. RSA signing delegated to Vercel. |
| Satispay iframe | Blocked. Bridge page on Vercel required. |
| S2S callback delay | Client-side polling + `/api/confirm` for instant confirmation. |
| Refunds via Wix dashboard | Not supported for Video/Events. Use `/api/refund`. |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| White popup | Check `reasonCode` is `0` |
| "Payment method not available" | Check Vercel logs for signing errors |
| QR code shows but payment not confirmed | Verify `http-functions.js` and callback URL |
| Satispay error code 36 | `amount_unit` is 0 — check field mapping |
| Refund not working from Wix | Use `/api/refund` page instead |

## License

MIT License — see [LICENSE](LICENSE) for details.

## Credits

Built by [Francesco Cecchi](https://www.cabinadoppia.com) at [Cabina Doppia](https://www.cabinadoppia.com).

Powered by [Satispay](https://www.satispay.com), [Wix](https://www.wix.com), and [Vercel](https://vercel.com).
