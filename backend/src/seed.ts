/**
 * Seed script: populates the database with sample content for Tokyo
 * so you can demo route generation without uploading live content first.
 *
 * Run: ts-node src/seed.ts
 *
 * Note: This does NOT upload to 0G Storage — it uses placeholder hashes.
 * For a real demo, upload actual photos and replace the hashes.
 */

import { getDb } from "./db/schema";
import { v4 as uuidv4 } from "uuid";

const CREATOR_1 = "0x1111111111111111111111111111111111111111";
const CREATOR_2 = "0x2222222222222222222222222222222222222222";
const CREATOR_3 = "0x3333333333333333333333333333333333333333";

const PLACEHOLDER_PHOTO = "0x" + "ab".repeat(32); // 66-char placeholder hash
const PLACEHOLDER_TEXT = "0x" + "cd".repeat(32);

const seedData = [
  // Creator 1 content
  {
    id: uuidv4(), creator_id: CREATOR_1,
    title: "Senso-ji Temple",
    description: "Tokyo's oldest and most famous Buddhist temple, founded in 645 AD. The iconic Kaminarimon gate with its giant lantern is the perfect photo spot. Arrive early to avoid crowds.",
    category: "place", latitude: 35.7148, longitude: 139.7967,
    city: "Tokyo", tags: ["history", "buddhism", "architecture", "photography"]
  },
  {
    id: uuidv4(), creator_id: CREATOR_1,
    title: "Nakamise Shopping Street",
    description: "A 250-meter shopping arcade leading to Senso-ji, selling traditional snacks, souvenirs, and crafts. Don't miss ningyo-yaki (doll-shaped cakes filled with red bean paste).",
    category: "eatery", latitude: 35.7133, longitude: 139.7967,
    city: "Tokyo", tags: ["street-food", "shopping", "traditional"]
  },
  {
    id: uuidv4(), creator_id: CREATOR_1,
    title: "Sumida River Walk",
    description: "A scenic riverside promenade with excellent views of the Tokyo Skytree. Cherry blossom season transforms this walk into a breathtaking tunnel of pink. The Azumabashi bridge offers the classic Skytree reflection shot.",
    category: "activity", latitude: 35.7100, longitude: 139.8007,
    city: "Tokyo", tags: ["nature", "photography", "skytree", "cherry-blossom"]
  },
  // Creator 2 content
  {
    id: uuidv4(), creator_id: CREATOR_2,
    title: "Nonbei Yokocho",
    description: "One of Shibuya's oldest alleyways, nicknamed 'Drunkard's Alley'. Tiny wooden bars from the 1940s line this narrow lane. Each bar holds only 5-8 people, making it an intimate local experience. Best after 7pm.",
    category: "eatery", latitude: 35.6528, longitude: 139.7050,
    city: "Tokyo", tags: ["bars", "nightlife", "local", "shibuya"]
  },
  {
    id: uuidv4(), creator_id: CREATOR_2,
    title: "Yoyogi Park",
    description: "Tokyo's largest park and a beloved gathering spot. On Sundays, rockabilly dancers, buskers, and picnickers fill the lawns. Rent a bicycle and explore the forested paths or join a yoga class.",
    category: "activity", latitude: 35.6715, longitude: 139.6946,
    city: "Tokyo", tags: ["nature", "park", "cycling", "local-life"]
  },
  {
    id: uuidv4(), creator_id: CREATOR_2,
    title: "Meiji Jingu Shrine",
    description: "Serene Shinto shrine dedicated to Emperor Meiji, surrounded by a 70-hectare forested area with over 100,000 trees. The forest was entirely man-made in 1920. Walk the gravel path through towering torii gates.",
    category: "place", latitude: 35.6763, longitude: 139.6993,
    city: "Tokyo", tags: ["shinto", "forest", "history", "peace"]
  },
  // Creator 3 content
  {
    id: uuidv4(), creator_id: CREATOR_3,
    title: "Tsukiji Outer Market",
    description: "Even after the main market moved to Toyosu, Tsukiji's outer market remains Tokyo's best place for fresh sushi breakfast. Arrive by 8am for the best selection. Daiwa Sushi is worth the queue.",
    category: "eatery", latitude: 35.6655, longitude: 139.7707,
    city: "Tokyo", tags: ["sushi", "seafood", "breakfast", "market"]
  },
  {
    id: uuidv4(), creator_id: CREATOR_3,
    title: "Hamarikyu Gardens",
    description: "A stunning traditional garden built in the Edo period, dramatically surrounded by modern skyscrapers. The duck pond and plum grove are highlights. Take the ferry from here to Asakusa for a scenic river journey.",
    category: "place", latitude: 35.6601, longitude: 139.7627,
    city: "Tokyo", tags: ["garden", "edo-period", "history", "contrast"]
  },
  {
    id: uuidv4(), creator_id: CREATOR_3,
    title: "Shibuya Crossing",
    description: "The world's busiest pedestrian crossing — up to 3,000 people cross simultaneously when the lights change. Scramble with the crowds or watch from Starbucks upstairs. At night the neon glow creates an iconic cyberpunk scene.",
    category: "activity", latitude: 35.6595, longitude: 139.7004,
    city: "Tokyo", tags: ["iconic", "photography", "urban", "nightlife"]
  },
];

async function seed() {
  const db = getDb();
  const now = Date.now();

  // Insert creators
  for (const wallet of [CREATOR_1, CREATOR_2, CREATOR_3]) {
    const idx = [CREATOR_1, CREATOR_2, CREATOR_3].indexOf(wallet) + 1;
    db.prepare(`
      INSERT OR IGNORE INTO creators (id, display_name, bio, avatar_hash, created_at)
      VALUES (?, ?, ?, NULL, ?)
    `).run(wallet, `Tokyo Explorer ${idx}`, `Local guide and content creator #${idx}`, now);
  }

  // Insert content
  let inserted = 0;
  for (const item of seedData) {
    const existing = db.prepare(`SELECT id FROM content_items WHERE title = ? AND city = ?`).get(item.title, item.city);
    if (existing) {
      console.log(`Skip: "${item.title}" already exists`);
      continue;
    }

    db.prepare(`
      INSERT INTO content_items
      (id, creator_id, title, description, category, latitude, longitude, city, tags, photo_hashes, text_hash, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      item.id, item.creator_id, item.title, item.description,
      item.category, item.latitude, item.longitude, item.city,
      JSON.stringify(item.tags),
      JSON.stringify([PLACEHOLDER_PHOTO]),
      PLACEHOLDER_TEXT,
      now
    );
    inserted++;
    console.log(`✓ Inserted: "${item.title}" (${item.category})`);
  }

  console.log(`\nSeed complete: ${inserted} items inserted`);
  console.log(`City: Tokyo — ready to generate routes!`);
}

seed().catch(console.error);
