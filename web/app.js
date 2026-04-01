const apiBaseParam = new URLSearchParams(window.location.search).get("apiBase");
if (apiBaseParam) {
  localStorage.setItem("easywalksApiBase", apiBaseParam);
}

const storedApiBase = localStorage.getItem("easywalksApiBase");
const API_BASE =
  apiBaseParam ||
  storedApiBase ||
  ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
  window.location.port === "5173"
    ? "http://localhost:3000/api/v1"
    : `${window.location.origin}/api/v1`);

let authToken = "";
let currentWallet = "";
let latestRouteId = "";
let latestPrepare = null;
let latestRoute = null;

function el(id) {
  return document.getElementById(id);
}

function setJson(id, value) {
  el(id).textContent = JSON.stringify(value, null, 2);
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.detail || "Request failed");
  }
  return body;
}

function parsePrompt(prompt) {
  const text = prompt.toLowerCase();

  const cityMatch = text.match(
    /\bin\s+([a-z\s]+?)(?=\s+(focused|with|for|on|about|around)\b|[,.!?]|$)/
  );
  const rawCity = cityMatch ? cityMatch[1].trim() : "cannes";
  const city = rawCity
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  let duration = "2h";
  if (text.includes("half day") || text.includes("half-day")) duration = "half-day";
  else if (text.includes("3h") || text.includes("3 hour")) duration = "3h";
  else if (text.includes("1h") || text.includes("1 hour")) duration = "1h";

  const categories = [];
  if (text.includes("eatery") || text.includes("eateries") || text.includes("food")) categories.push("eatery");
  if (text.includes("activity") || text.includes("activities")) categories.push("activity");
  if (text.includes("place") || text.includes("landmark") || text.includes("sight")) categories.push("place");
  if (!categories.length) categories.push("place", "activity", "eatery");

  const interests = [];
  if (text.includes("local")) interests.push("local");
  if (text.includes("food") || text.includes("eat")) interests.push("food");
  if (text.includes("culture")) interests.push("culture");
  if (!interests.length) interests.push("walking");

  return { city, duration, categories, interests };
}

function formatWeiToOg(weiString) {
  const wei = BigInt(weiString);
  const whole = wei / 1000000000000000000n;
  const fraction = wei % 1000000000000000000n;
  const fractionStr = fraction.toString().padStart(18, "0").replace(/0+$/, "");
  return fractionStr ? `${whole}.${fractionStr}` : `${whole}`;
}

function buildSplit(route, priceWei) {
  const entries = Object.entries(route.contributions || {});
  const totalWei = BigInt(priceWei);
  const payoutRows = entries
    .sort((a, b) => b[1] - a[1])
    .map(([wallet, pct], idx) => {
      const shareWei = (totalWei * BigInt(Math.round(pct * 100))) / 10000n;
      return {
        contributorLabel: `NPC_${idx + 1}`,
        wallet,
        contributionPercent: pct,
        shareWei: shareWei.toString(),
        shareOg: formatWeiToOg(shareWei.toString()),
      };
    });

  return {
    routeId: route.id,
    totalPriceWei: priceWei,
    totalPriceOg: formatWeiToOg(priceWei),
    payouts: payoutRows,
    fairnessNote: "Shares are proportional to contribution percentages from the curated route.",
  };
}

el("connectBtn").onclick = async () => {
  if (!window.ethereum) {
    alert("No wallet detected. Install MetaMask.");
    return;
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  currentWallet = accounts[0];
  el("walletAddress").value = currentWallet;
  el("authStatus").textContent = `Wallet connected: ${currentWallet}`;
};

el("loginBtn").onclick = async () => {
  try {
    const walletAddress = el("walletAddress").value.trim();
    if (!walletAddress) throw new Error("Enter wallet address");
    if (!window.ethereum) throw new Error("Wallet provider not found");

    const challengeRes = await api("/auth/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress }),
    });

    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [challengeRes.challenge, walletAddress],
    });

    const verifyRes = await api("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress,
        challenge: challengeRes.challenge,
        signature,
      }),
    });

    authToken = verifyRes.token;
    currentWallet = walletAddress;
    el("authStatus").textContent = "Authenticated";
  } catch (err) {
    el("authStatus").textContent = `Auth failed: ${err.message}`;
  }
};

el("generateRouteBtn").onclick = async () => {
  try {
    const prompt = el("tourPrompt").value.trim();
    if (!prompt) throw new Error("Prompt is required");
    const parsed = parsePrompt(prompt);

    const body = await api("/routes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: parsed.city,
        duration: parsed.duration,
        categories: parsed.categories,
        interests: parsed.interests,
      }),
    });

    latestRouteId = body.route.id;
    latestRoute = body.route;
    el("routeId").value = latestRouteId;
    setJson("routeResult", {
      prompt,
      parsedPreferences: parsed,
      route: body.route,
      note: "Curated from pre-submitted NPC creator content.",
    });
  } catch (err) {
    setJson("routeResult", { error: err.message });
  }
};

el("prepareBuyBtn").onclick = async () => {
  try {
    const routeId = el("routeId").value.trim() || latestRouteId;
    if (!routeId) throw new Error("Route ID required");
    const body = await api(`/routes/${routeId}/prepare-purchase`, { method: "POST" });
    latestPrepare = body;
    setJson("prepareResult", body);
    if (latestRoute?.contributions) {
      setJson("splitResult", buildSplit(latestRoute, body.priceWei));
    }
  } catch (err) {
    setJson("prepareResult", { error: err.message });
    setJson("splitResult", { error: err.message });
  }
};

el("confirmBuyBtn").onclick = async () => {
  try {
    const routeId = el("routeId").value.trim() || latestRouteId;
    const txHash = el("txHash").value.trim();
    if (!routeId || !txHash) throw new Error("Route ID and txHash required");

    const body = await api(`/routes/${routeId}/confirm-purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash }),
    });
    setJson("confirmResult", body);
  } catch (err) {
    setJson("confirmResult", { error: err.message });
  }
};

el("storeProofBtn").onclick = async () => {
  try {
    const routeId = el("routeId").value.trim() || latestRouteId;
    const txHash = el("txHash").value.trim();
    if (!routeId || !txHash) throw new Error("Route ID and txHash required");

    let sourceMaterials = [];
    const sourceText = el("sourceMaterials").value.trim();
    if (sourceText) {
      sourceMaterials = JSON.parse(sourceText);
    }

    const body = await api(`/routes/${routeId}/store-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txHash,
        creditsNote: el("creditsNote").value.trim(),
        sourceMaterials,
      }),
    });

    setJson("proofResult", body);
  } catch (err) {
    setJson("proofResult", { error: err.message });
  }
};
