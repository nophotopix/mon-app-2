// Pack pricing logic for No.Photo.Pix
// Packs: 1 photo = 3€, 3 photos = 8€, 5 photos = 12€
// Computes the minimum cost combination of packs to buy N photos.

export const PACKS = [
  { qty: 1, price: 3 },
  { qty: 3, price: 8 },
  { qty: 5, price: 12 },
];

/**
 * Returns the minimum total price (in EUR) for buying exactly `count` photos
 * using any combination of the available packs.
 * Uses bottom-up dynamic programming.
 */
export const computeTotal = (count) => {
  if (count <= 0) return 0;
  const dp = new Array(count + 1).fill(Infinity);
  dp[0] = 0;
  for (let i = 1; i <= count; i++) {
    for (const p of PACKS) {
      if (i - p.qty >= 0 && dp[i - p.qty] + p.price < dp[i]) {
        dp[i] = dp[i - p.qty] + p.price;
      }
    }
  }
  return dp[count];
};

/** Naive total (per-photo) used to show savings vs. pack pricing. */
export const computeNaiveTotal = (count) => count * 3;

export const computeSavings = (count) =>
  Math.max(0, computeNaiveTotal(count) - computeTotal(count));
