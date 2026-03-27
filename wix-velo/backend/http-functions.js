import { ok, badRequest, serverError } from 'wix-http-functions';
import wixFetch from 'wix-fetch';
import wixPaymentProviderBackend from 'wix-payment-provider-backend';

// Satispay calls this endpoint with GET when a payment status changes
// URL format: https://www.YOUR-DOMAIN.com/_functions/satispayCallback?paymentId=xxx
//
// Satispay replaces {uuid} in the callback_url with the actual payment ID
// So the request comes as: /_functions/satispayCallback?paymentId=<actual-payment-id>

export async function get_satispayCallback(request) {
  try {
    // Satispay sends the payment_id as query parameter
    var paymentId = request.query.paymentId || request.query.payment_id || "";

    if (!paymentId) {
      console.log("SATISPAY CALLBACK: No paymentId received");
      return badRequest({ body: "Missing paymentId" });
    }

    console.log("SATISPAY CALLBACK: Received callback for paymentId:", paymentId);

    // Get payment details from Satispay to check the status
    // We need to call the signing service to sign the request
    // IMPORTANT: Replace with your Vercel deployment URL
    var signerUrl = "https://YOUR-VERCEL-PROJECT.vercel.app/api/sign";
    var environment = "production";
    var apiBase = "https://authservices.satispay.com";
    var host = "authservices.satispay.com";
    var path = "/g_business/v1/payments/" + paymentId;

    // Get signed headers
    var signResponse = await wixFetch.fetch(signerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "GET", path: path, body: "", host: host })
    });

    if (!signResponse.ok) {
      console.log("SATISPAY CALLBACK: Signing service error");
      return serverError({ body: "Signing service error" });
    }

    var signedHeaders = await signResponse.json();

    // Call Satispay API to get payment status
    var satispayResponse = await wixFetch.fetch(apiBase + path, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Host": signedHeaders.Host,
        "Date": signedHeaders.Date,
        "Digest": signedHeaders.Digest,
        "Authorization": signedHeaders.Authorization
      }
    });

    if (!satispayResponse.ok) {
      console.log("SATISPAY CALLBACK: Satispay API error:", satispayResponse.status);
      return serverError({ body: "Satispay API error" });
    }

    var payment = await satispayResponse.json();
    console.log("SATISPAY CALLBACK: Payment status:", payment.status, "external_code:", payment.external_code);

    // Map Satispay status to Wix event
    if (payment.status === "ACCEPTED") {
      console.log("SATISPAY CALLBACK: Payment ACCEPTED, submitting event to Wix");

      await wixPaymentProviderBackend.submitEvent({
        event: {
          transaction: {
            wixTransactionId: payment.external_code || "",
            pluginTransactionId: paymentId
          }
        }
      });

      console.log("SATISPAY CALLBACK: submitEvent completed successfully");

    } else if (payment.status === "CANCELED" || payment.status === "EXPIRED") {
      console.log("SATISPAY CALLBACK: Payment", payment.status);

      await wixPaymentProviderBackend.submitEvent({
        event: {
          transaction: {
            wixTransactionId: payment.external_code || "",
            pluginTransactionId: paymentId,
            reasonCode: 2000
          }
        }
      });
    } else {
      console.log("SATISPAY CALLBACK: Payment still PENDING, ignoring");
    }

    return ok({ body: JSON.stringify({ received: true, status: payment.status }) });

  } catch (err) {
    console.log("SATISPAY CALLBACK: Error:", err.message);
    return serverError({ body: "Error: " + err.message });
  }
}
