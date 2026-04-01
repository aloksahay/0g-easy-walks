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
let generateProgressTimer = null;
let map = null;
let mapMarkers = [];
let mapRouteLine = null;

function el(id) {
  return document.getElementById(id);
}

function logTerminal(step, payload) {
  const node = el("terminalLog");
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] ${step}\n${typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)}\n\n`;
  node.textContent += line;
  node.scrollTop = node.scrollHeight;
}

logTerminal("System", "Terminal started. Waiting for user actions...");

function stopGenerateProgress() {
  if (generateProgressTimer) {
    clearInterval(generateProgressTimer);
    generateProgressTimer = null;
  }
}

function setGenerateProgress(value, labelText) {
  const safe = Math.max(0, Math.min(100, value));
  el("generateProgressFill").style.width = `${safe}%`;
  if (labelText) el("generateProgressLabel").textContent = labelText;
}

function startGenerateProgress() {
  stopGenerateProgress();
  el("generateProgressWrap").classList.remove("hidden");
  setGenerateProgress(10, "Reading your prompt...");
  const start = Date.now();

  generateProgressTimer = setInterval(() => {
    const elapsed = Date.now() - start;
    let pct = 10;
    let label = "Reading your prompt...";

    if (elapsed > 700) {
      pct = 30;
      label = "Finding Cannes submissions from NPC creators...";
    }
    if (elapsed > 1800) {
      pct = 55;
      label = "Curating stops for your preferences...";
    }
    if (elapsed > 3200) {
      pct = 75;
      label = "Calculating fair-share contribution split...";
    }
    if (elapsed > 4800) {
      pct = 90;
      label = "Finalizing curated tour...";
    }

    setGenerateProgress(pct, label);
  }, 250);
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

async function waitForTxReceipt(txHash, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const receipt = await window.ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Timed out waiting for on-chain confirmation");
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

  // Keep all categories available so curation can include multiple creators.
  // Prompt wording (e.g. "focused on eateries") is reflected via interests.
  const categories = ["place", "activity", "eatery"];

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

function getSortedContributions(route) {
  return Object.entries((route && route.contributions) || {}).sort((a, b) => b[1] - a[1]);
}

function renderCreditsBreakdown(route, priceWei) {
  const entries = getSortedContributions(route);
  const pie = el("creditsPie");
  const list = el("creditsList");
  list.innerHTML = "";
  if (!entries.length) {
    pie.style.background = "conic-gradient(#2563eb 0 100%)";
    return;
  }

  const colors = ["#2563eb", "#14b8a6", "#f59e0b", "#a855f7", "#ef4444"];
  let start = 0;
  const segments = entries.map(([, pct], i) => {
    const end = start + pct;
    const seg = `${colors[i % colors.length]} ${start}% ${end}%`;
    start = end;
    return seg;
  });
  pie.style.background = `conic-gradient(${segments.join(", ")})`;

  const totalWei = BigInt(priceWei || "0");
  entries.forEach(([wallet, pct], i) => {
    const shareWei = (totalWei * BigInt(Math.round(pct * 100))) / 10000n;
    const li = document.createElement("li");
    li.textContent = `NPC_${i + 1} (${wallet.slice(0, 8)}...): ${pct}% (${formatWeiToOg(shareWei.toString())} OG)`;
    li.style.color = colors[i % colors.length];
    list.appendChild(li);
  });
}

function prefillProofFields(route, txHash) {
  const sourceMaterials = ((route && route.stops) || []).map((s) => ({
    title: s.contentItem.title,
    creator: s.contentItem.creator_id,
    category: s.contentItem.category,
    textHash: s.contentItem.text_hash,
  }));
  el("txHash").value = txHash || "";
  el("sourceMaterials").value = JSON.stringify(sourceMaterials, null, 2);
  el("creditsNote").value =
    "All creator submissions used in this curated route are credited above. Revenue shares are proportional to contribution percentages.";
}

async function logNpcSubmissions(city, route) {
  try {
    const res = await api(`/content?city=${encodeURIComponent(city)}&limit=100`);
    const items = Array.isArray(res.items) ? res.items : [];
    const byCreator = new Map();

    for (const item of items) {
      const key = String(item.creator_id || "").toLowerCase();
      if (!key) continue;
      if (!byCreator.has(key)) byCreator.set(key, []);
      byCreator.get(key).push(item);
    }

    const creators = [...byCreator.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 2);

    const selectedIds = new Set(((route && route.stops) || []).map((s) => s.contentItem.id));
    const routeContributions = (route && route.contributions) || {};
    const output = creators.map(([wallet, creatorItems], idx) => ({
      npc: `NPC_${idx + 1}`,
      wallet,
      contributionPercentInCurrentRoute: routeContributions[wallet] || 0,
      submissions: creatorItems.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        tags: item.tags,
        selectedInCuratedRoute: selectedIds.has(item.id),
      })),
    }));
    logTerminal("NPC Submissions", output);
  } catch (err) {
    logTerminal("NPC Submissions", { error: "Failed to fetch NPC submissions", detail: err.message || String(err) });
  }
}

el("previewNpcBtn").onclick = async () => {
  logTerminal("NPC Preview", "Fetching NPC submissions for Cannes...");
  await logNpcSubmissions("Cannes", latestRoute || null);
};

function ensureMap() {
  if (map) return map;
  map = L.map("tourMap", { zoomControl: true }).setView([43.55, 7.01], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  return map;
}

function renderTourVisual(route) {
  const stops = route.stops || [];
  const list = el("tourStopsList");
  el("tourVisualTitle").textContent = `${route.title} (${stops.length} stops)`;
  list.innerHTML = "";
  el("tourVisualWrap").classList.remove("hidden");
  const currentMap = ensureMap();

  if (!stops.length) {
    currentMap.setView([43.55, 7.01], 13);
    return;
  }

  mapMarkers.forEach((m) => currentMap.removeLayer(m));
  mapMarkers = [];
  if (mapRouteLine) {
    currentMap.removeLayer(mapRouteLine);
    mapRouteLine = null;
  }

  const latLngs = stops.map((s) => [Number(s.contentItem.latitude), Number(s.contentItem.longitude)]);
  mapRouteLine = L.polyline(latLngs, { color: "#38bdf8", weight: 4 }).addTo(currentMap);

  stops.forEach((s, idx) => {
    const lat = Number(s.contentItem.latitude);
    const lng = Number(s.contentItem.longitude);
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "stop-marker",
        html: `${idx + 1}`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(currentMap);
    marker.bindPopup(`<strong>${s.contentItem.title}</strong><br/>${s.contentItem.category}`);
    mapMarkers.push(marker);

    const li = document.createElement("li");
    li.textContent = `${idx + 1}. ${s.contentItem.title} (${s.contentItem.category})`;
    list.appendChild(li);
  });

  const bounds = L.latLngBounds(latLngs);
  currentMap.fitBounds(bounds.pad(0.2));
  setTimeout(() => currentMap.invalidateSize(), 50);
}

el("connectBtn").onclick = async () => {
  try {
    if (!window.ethereum) throw new Error("No wallet detected. Install MetaMask.");

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const walletAddress = (accounts && accounts[0]) || el("walletAddress").value.trim();
    if (!walletAddress) throw new Error("No wallet account returned");
    if (!window.ethereum) throw new Error("Wallet provider not found");
    currentWallet = walletAddress;
    el("walletAddress").value = currentWallet;
    el("authStatus").textContent = `Wallet connected: ${currentWallet}. Signing in...`;
    logTerminal("Auth", { status: "Wallet connected", walletAddress });

    const challengeRes = await api("/auth/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress }),
    });
    logTerminal("Auth", { status: "Challenge received" });

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
    logTerminal("Auth", { status: "Authenticated", walletAddress });
  } catch (err) {
    el("authStatus").textContent = `Auth failed: ${err.message}`;
    logTerminal("Auth Error", err.message);
  }
};

el("generateRouteBtn").onclick = async () => {
  try {
    logTerminal("Route", "Generating curated route...");
    startGenerateProgress();
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
    latestPrepare = null;
    logTerminal("Route", {
      prompt,
      parsedPreferences: parsed,
      route: body.route,
      note: "Curated from pre-submitted NPC creator content.",
    });
    el("nextStepsWrap").classList.add("hidden");
    renderTourVisual(body.route);
    stopGenerateProgress();
    setGenerateProgress(100, "Tour generated successfully.");
    logNpcSubmissions(parsed.city, body.route);
    logTerminal("Purchase Prep", { status: "Preparing purchase in background for faster wallet popup..." });
    try {
      const prep = await api(`/routes/${latestRouteId}/prepare-purchase`, { method: "POST" });
      latestPrepare = prep;
      logTerminal("Purchase Prep", {
        status: "Purchase prepared. Buy button should open wallet quickly.",
        ...prep,
      });
      if (latestRoute?.contributions) {
        logTerminal("Revenue Split", buildSplit(latestRoute, prep.priceWei));
      }
    } catch (prepErr) {
      logTerminal("Purchase Prep", {
        warning: "Background prepare failed. Buy button will retry prepare.",
        error: prepErr.message,
      });
    }
    setTimeout(() => {
      el("generateProgressWrap").classList.add("hidden");
    }, 700);
  } catch (err) {
    stopGenerateProgress();
    setGenerateProgress(100, "Generation failed.");
    logTerminal("Route Error", err.message);
  }
};

el("buyNowBtn").onclick = async () => {
  try {
    if (!window.ethereum) throw new Error("Wallet provider not found");
    const routeId = latestRouteId;
    if (!routeId) throw new Error("Route ID required");

    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    const from = (accounts && accounts[0]) || currentWallet;
    if (!from) throw new Error("No connected wallet account found");

    let prep = latestPrepare;
    if (!prep || !prep.contractAddress || !prep.calldata) {
      logTerminal("Purchase Prep", { status: "Preparing purchase now. This can take a bit..." });
      prep = await api(`/routes/${routeId}/prepare-purchase`, { method: "POST" });
      latestPrepare = prep;
      logTerminal("Purchase Prep", prep);
      if (latestRoute?.contributions) {
        logTerminal("Revenue Split", buildSplit(latestRoute, prep.priceWei));
      }
    }

    logTerminal("Purchase", {
      status: "Opening wallet confirmation...",
      note: "If popup is delayed, keep this tab active for a few seconds.",
    });
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to: prep.contractAddress,
          value: `0x${BigInt(prep.priceWei).toString(16)}`,
          data: prep.calldata,
        },
      ],
    });

    el("txHash").value = txHash;
    logTerminal("Purchase", { status: "Transaction submitted. Waiting for on-chain confirmation...", txHash });
    const receipt = await waitForTxReceipt(txHash);
    if (receipt.status !== "0x1") {
      throw new Error("Transaction reverted on-chain");
    }
    logTerminal("Purchase", { status: "Transaction confirmed on-chain", blockNumber: receipt.blockNumber, txHash });

    const confirmBody = await api(`/routes/${routeId}/confirm-purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash }),
    });

    logTerminal("Purchase", {
      txHash,
      purchase: confirmBody,
      note: "Purchase completed via connected wallet in one click.",
    });
    renderCreditsBreakdown(latestRoute, prep.priceWei);
    prefillProofFields(latestRoute, txHash);
    el("nextStepsWrap").classList.remove("hidden");
  } catch (err) {
    logTerminal("Purchase Error", err.message);
  }
};

el("storeProofBtn").onclick = async () => {
  try {
    const routeId = latestRouteId;
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

    logTerminal("Proof Upload", body);
  } catch (err) {
    logTerminal("Proof Upload Error", err.message);
  }
};
