const SUPPORTED_PATHS = new Set(["/operator.apk", "/apk", "/install.apk"]);

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function redirectResponse(location) {
  return new Response(null, {
    status: 302,
    headers: {
      location,
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!SUPPORTED_PATHS.has(url.pathname)) {
      return jsonError(404, "Not found");
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return jsonError(405, "Method not allowed");
    }

    if (!env.CLAWPERATOR_APK_METADATA_URL) {
      return jsonError(500, "Missing CLAWPERATOR_APK_METADATA_URL");
    }

    let metadataResponse;
    try {
      metadataResponse = await fetch(env.CLAWPERATOR_APK_METADATA_URL, {
        headers: {
          "cache-control": "no-cache",
        },
      });
    } catch {
      return jsonError(502, "Failed to fetch APK metadata");
    }

    if (!metadataResponse.ok) {
      return jsonError(502, "APK metadata endpoint returned an error");
    }

    let metadata;
    try {
      metadata = await metadataResponse.json();
    } catch {
      return jsonError(502, "APK metadata response was not valid JSON");
    }

    if (!metadata.apk_url) {
      return jsonError(502, "APK metadata did not include apk_url");
    }

    let apkUrl;
    try {
      apkUrl = new URL(metadata.apk_url);
    } catch {
      return jsonError(502, "APK metadata contained an invalid apk_url");
    }

    if (apkUrl.protocol !== "https:") {
      return jsonError(502, "APK metadata must use an https URL");
    }

    return redirectResponse(apkUrl.toString());
  },
};
