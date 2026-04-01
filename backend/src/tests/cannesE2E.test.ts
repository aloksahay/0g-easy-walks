import { ethers } from "ethers";
import { config } from "../config";

type ApiResponse<T> = { status: number; body: T };

type GenerateResponse = {
  route?: {
    id: string;
    contributions: Record<string, number>;
  };
  error?: string;
};

type PreparePurchaseResponse = {
  contractRouteId?: number;
  priceWei?: string;
  error?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep raw text
  }
  return { status: res.status, body: body as T };
}

async function authWithPrivateKey(baseUrl: string, privateKey: string): Promise<{ wallet: ethers.Wallet; token: string }> {
  const wallet = new ethers.Wallet(privateKey);

  const challengeRes = await requestJson<{ challenge?: string; error?: string }>(
    baseUrl,
    "/api/v1/auth/challenge",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ walletAddress: wallet.address }),
    }
  );
  if (challengeRes.status !== 200 || !challengeRes.body.challenge) {
    throw new Error(`Challenge failed for ${wallet.address}: ${JSON.stringify(challengeRes.body)}`);
  }

  const signature = await wallet.signMessage(challengeRes.body.challenge);
  const verifyRes = await requestJson<{ token?: string; error?: string }>(
    baseUrl,
    "/api/v1/auth/verify",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        walletAddress: wallet.address,
        challenge: challengeRes.body.challenge,
        signature,
      }),
    }
  );
  if (verifyRes.status !== 200 || !verifyRes.body.token) {
    throw new Error(`Verify failed for ${wallet.address}: ${JSON.stringify(verifyRes.body)}`);
  }

  return { wallet, token: verifyRes.body.token };
}

async function createContent(
  baseUrl: string,
  token: string,
  item: {
    title: string;
    description: string;
    category: "eatery" | "activity" | "place";
    latitude: number;
    longitude: number;
    city: string;
    tags: string[];
  }
): Promise<void> {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await requestJson<{ id?: string; error?: string }>(
      baseUrl,
      "/api/v1/content",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...item,
          latitude: String(item.latitude),
          longitude: String(item.longitude),
          tags: JSON.stringify(item.tags),
        }),
      }
    );

    if (res.status === 201) return;
    lastError = JSON.stringify(res.body);
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  throw new Error(`Content create failed (${item.title}): ${lastError}`);
}

async function run(): Promise<void> {
  const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3000";
  const npc1 = requireEnv("NPC_1_KEY");
  const npc2 = requireEnv("NPC_2_KEY");
  const buyerKey = process.env.BUYER_KEY || process.env.OG_PRIVATE_KEY_2 || requireEnv("OG_PRIVATE_KEY");

  const [creator1, creator2, buyer] = await Promise.all([
    authWithPrivateKey(baseUrl, npc1),
    authWithPrivateKey(baseUrl, npc2),
    authWithPrivateKey(baseUrl, buyerKey),
  ]);

  const suffix = Date.now();
  const city = "Cannes";

  // Creator 1 contributes eateries.
  await createContent(baseUrl, creator1.token, {
    title: `Cannes Seafront Brunch ${suffix}`,
    description: "Brunch-focused stop by the Croisette with local pastries and coffee.",
    category: "eatery",
    latitude: 43.5517,
    longitude: 7.0174,
    city,
    tags: ["brunch", "croisette", "local"],
  });
  await createContent(baseUrl, creator1.token, {
    title: `Old Port Seafood ${suffix}`,
    description: "Fresh seafood near Vieux Port with quick service for walkers.",
    category: "eatery",
    latitude: 43.5512,
    longitude: 7.0127,
    city,
    tags: ["seafood", "port", "lunch"],
  });

  // Creator 2 contributes walking-tour style activities and landmarks.
  await createContent(baseUrl, creator2.token, {
    title: `Le Suquet Stair Walk ${suffix}`,
    description: "Guided-style uphill walking segment through Le Suquet viewpoints.",
    category: "activity",
    latitude: 43.5529,
    longitude: 7.0106,
    city,
    tags: ["walking-tour", "viewpoint", "historic-quarter"],
  });
  await createContent(baseUrl, creator2.token, {
    title: `Croisette Sunset Loop ${suffix}`,
    description: "Flat promenade loop ideal for a sunset walk and photo breaks.",
    category: "activity",
    latitude: 43.5488,
    longitude: 7.0286,
    city,
    tags: ["walking-tour", "sunset", "promenade"],
  });
  await createContent(baseUrl, creator2.token, {
    title: `Palais Exterior Stop ${suffix}`,
    description: "Short landmark stop around Palais des Festivals entrance and red steps.",
    category: "place",
    latitude: 43.5513,
    longitude: 7.0171,
    city,
    tags: ["landmark", "festival", "city-center"],
  });

  const generateRes = await requestJson<GenerateResponse>(
    baseUrl,
    "/api/v1/routes/generate",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${buyer.token}`,
      },
      body: JSON.stringify({
        city,
        duration: "half-day",
        categories: ["eatery", "activity", "place"],
        interests: ["food", "walking", "sightseeing"],
      }),
    }
  );

  if (generateRes.status !== 200 || !generateRes.body.route?.id) {
    throw new Error(`Route generation failed: ${JSON.stringify(generateRes.body)}`);
  }

  const routeId = generateRes.body.route.id;
  const contributions = generateRes.body.route.contributions || {};
  if (!contributions[creator1.wallet.address.toLowerCase()] || !contributions[creator2.wallet.address.toLowerCase()]) {
    throw new Error(`Expected both creators in contributions, got: ${JSON.stringify(contributions)}`);
  }

  const provider = new ethers.JsonRpcProvider(config.og.rpc);
  const marketAbi = [
    "function purchaseRoute(uint256 routeId) payable",
    "function creatorBalance(address) view returns (uint256)",
  ];
  const market = new ethers.Contract(config.contract.address, marketAbi, provider);

  const before1 = await market.creatorBalance(creator1.wallet.address);
  const before2 = await market.creatorBalance(creator2.wallet.address);

  const prepareRes = await requestJson<PreparePurchaseResponse>(
    baseUrl,
    `/api/v1/routes/${routeId}/prepare-purchase`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${buyer.token}` },
    }
  );
  if (
    prepareRes.status !== 200 ||
    prepareRes.body.contractRouteId === undefined ||
    !prepareRes.body.priceWei
  ) {
    throw new Error(`Prepare purchase failed: ${JSON.stringify(prepareRes.body)}`);
  }

  const buyerSigner = new ethers.Wallet(buyerKey, provider);
  const marketWithBuyer = market.connect(buyerSigner) as ethers.Contract;
  const tx = await marketWithBuyer["purchaseRoute"](prepareRes.body.contractRouteId, {
    value: BigInt(prepareRes.body.priceWei),
  });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("On-chain purchase transaction failed");
  }

  const confirmRes = await requestJson<{ success?: boolean; error?: string }>(
    baseUrl,
    `/api/v1/routes/${routeId}/confirm-purchase`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${buyer.token}`,
      },
      body: JSON.stringify({ txHash: tx.hash }),
    }
  );
  if (confirmRes.status !== 200 || !confirmRes.body.success) {
    throw new Error(`Confirm purchase failed: ${JSON.stringify(confirmRes.body)}`);
  }

  const after1 = await market.creatorBalance(creator1.wallet.address);
  const after2 = await market.creatorBalance(creator2.wallet.address);

  console.log("Cannes E2E passed");
  console.log("Route:", routeId);
  console.log("Buyer:", buyer.wallet.address);
  console.log("Contributions:", contributions);
  console.log("Creator1 balance delta:", (after1 - before1).toString());
  console.log("Creator2 balance delta:", (after2 - before2).toString());
}

run().catch((err) => {
  console.error("Cannes E2E failed:", err);
  process.exit(1);
});
