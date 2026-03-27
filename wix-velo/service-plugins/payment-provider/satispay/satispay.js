import * as paymentProvider from 'interfaces-psp-v1-payment-service-provider';
import wixFetch from 'wix-fetch';

const ENDPOINTS = {
  sandbox: "https://staging.authservices.satispay.com",
  production: "https://authservices.satispay.com"
};

async function getSignedHeaders(signerUrl, method, path, body, host) {
  var response = await wixFetch.fetch(signerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: method, path: path, body: body, host: host })
  });
  if (!response.ok) {
    throw new Error("Signing service error: " + response.status);
  }
  return response.json();
}

/**
 * @param {import('interfaces-psp-v1-payment-service-provider').ConnectAccountOptions} options
 * @param {import('interfaces-psp-v1-payment-service-provider').Context} context
 * @returns {Promise<import('interfaces-psp-v1-payment-service-provider').ConnectAccountResponse | import('interfaces-psp-v1-payment-service-provider').BusinessError>}
 */
export const connectAccount = async (options, context) => {
  var signerUrl = options.credentials.signerUrl;
  var environment = options.credentials.environment;
  try {
    var testBody = JSON.stringify({ method: "GET", path: "/test", body: "", host: "authservices.satispay.com" });
    var response = await wixFetch.fetch(signerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: testBody
    });
    if (response.ok) {
      return {
        credentials: { signerUrl: signerUrl, environment: environment },
        accountId: "satispay-" + environment,
        accountName: "Satispay " + (environment === "production" ? "Live" : "Sandbox")
      };
    } else {
      return { errorCode: "SIGNER_ERROR", errorMessage: "Signing service error" };
    }
  } catch (err) {
    return { errorCode: "CONNECTION_ERROR", errorMessage: err.message };
  }
};

/**
 * @param {import('interfaces-psp-v1-payment-service-provider').CreateTransactionOptions} options
 * @param {import('interfaces-psp-v1-payment-service-provider').Context} context
 * @returns {Promise<import('interfaces-psp-v1-payment-service-provider').CreateTransactionResponse | import('interfaces-psp-v1-payment-service-provider').BusinessError>}
 */
export const createTransaction = async (options, context) => {
  try {
    var signerUrl = options.merchantCredentials.signerUrl;
    var environment = options.merchantCredentials.environment;
    var baseUrl = ENDPOINTS[environment] || ENDPOINTS.production;
    var wixTransactionId = options.wixTransactionId || "";

    var amountCents = 0;
    var currency = "EUR";
    if (options.order && options.order.description) {
      amountCents = parseInt(options.order.description.totalAmount) || 0;
      currency = options.order.description.currency || "EUR";
    }

    var successUrl = "";
    var errorUrl = "";
    if (options.order && options.order.returnUrls) {
      successUrl = options.order.returnUrls.successUrl || "";
      errorUrl = options.order.returnUrls.errorUrl || "";
    }

    // IMPORTANT: Replace with your own domain
    var callbackUrl = "https://www.YOUR-DOMAIN.com/_functions/satispayCallback?paymentId={uuid}";

    var paymentBody = {
      flow: "MATCH_CODE",
      amount_unit: amountCents,
      currency: currency,
      callback_url: callbackUrl,
      redirect_url: successUrl || "https://www.YOUR-DOMAIN.com",
      external_code: wixTransactionId
    };

    var path = "/g_business/v1/payments";
    var method = "POST";
    var body = JSON.stringify(paymentBody);
    var host = baseUrl.replace("https://", "");

    var signedHeaders = await getSignedHeaders(signerUrl, method, path, body, host);

    var response = await wixFetch.fetch(baseUrl + path, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Host": signedHeaders.Host,
        "Date": signedHeaders.Date,
        "Digest": signedHeaders.Digest,
        "Authorization": signedHeaders.Authorization
      },
      body: body
    });

    var responseText = await response.text();
    var data = JSON.parse(responseText);

    if (response.ok && data.id) {
      var baseSignerUrl = signerUrl.replace("/api/sign", "");
      var bridgeUrl = baseSignerUrl + "/api/pay"
        + "?paymentId=" + encodeURIComponent(data.id)
        + "&successUrl=" + encodeURIComponent(successUrl)
        + "&errorUrl=" + encodeURIComponent(errorUrl)
        + "&amount=" + encodeURIComponent(String(amountCents))
        + "&environment=" + encodeURIComponent(environment)
        + "&signerUrl=" + encodeURIComponent(signerUrl);

      return {
        pluginTransactionId: data.id,
        redirectUrl: bridgeUrl,
        reasonCode: 0
      };
    } else {
      return {
        pluginTransactionId: "err-" + Date.now(),
        reasonCode: 2000,
        errorCode: "PAYMENT_FAILED",
        errorMessage: "Satispay: " + (data.message || responseText)
      };
    }
  } catch (err) {
    return {
      pluginTransactionId: "exc-" + Date.now(),
      reasonCode: 2000,
      errorCode: "NETWORK_ERROR",
      errorMessage: "Errore: " + err.message
    };
  }
};

/**
 * @param {import('interfaces-psp-v1-payment-service-provider').RefundTransactionOptions} options
 * @param {import('interfaces-psp-v1-payment-service-provider').Context} context
 * @returns {Promise<import('interfaces-psp-v1-payment-service-provider').CreateRefundResponse | import('interfaces-psp-v1-payment-service-provider').BusinessError>}
 */
export const refundTransaction = async (options, context) => {
  // Refunds are handled via the dedicated Vercel endpoint
  // https://YOUR-VERCEL-PROJECT.vercel.app/api/refund
  return {
    pluginRefundId: "",
    errorCode: "USE_REFUND_PAGE",
    errorMessage: "I rimborsi Satispay vanno effettuati dalla pagina dedicata."
  };
};
