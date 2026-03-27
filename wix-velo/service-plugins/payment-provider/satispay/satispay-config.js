import * as paymentProvider from 'interfaces-psp-v1-payment-service-provider';

/** @returns {import('interfaces-psp-v1-payment-service-provider').PaymentServiceProviderConfig} */
export function getConfig() {
  return {
    title: "Satispay",
    paymentMethods: [
      {
        hostedPage: {
          title: "Satispay",
          billingAddressMandatoryFields: [],
          logos: {
            white: {
              // CUSTOMIZE: Replace with your Vercel deployment URL
              svg: "https://YOUR-VERCEL-PROJECT.vercel.app/api/logo",
              png: "https://YOUR-VERCEL-PROJECT.vercel.app/api/logo"
            },
            colored: {
              svg: "https://YOUR-VERCEL-PROJECT.vercel.app/api/logo",
              png: "https://YOUR-VERCEL-PROJECT.vercel.app/api/logo"
            }
          }
        }
      }
    ],
    credentialsFields: [
      {
        simpleField: {
          name: "signerUrl",
          label: "URL del Signing Service"
        }
      },
      {
        dropdownField: {
          name: "environment",
          label: "Ambiente",
          options: [
            { key: "sandbox", value: "Sandbox (Test)" },
            { key: "production", value: "Produzione" }
          ]
        }
      }
    ]
  };
}
