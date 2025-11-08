const DEFAULT_KEYS = [
  "url",
  "href",
  "src",
  "image",
  "coverImage",
  "heroImage",
  "thumbnail",
  "preview",
];

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const normaliseCandidate = (candidate) => {
  if (!candidate) return "";

  if (Array.isArray(candidate)) {
    for (const entry of candidate) {
      const resolved = normaliseCandidate(entry);
      if (isNonEmptyString(resolved)) {
        return resolved;
      }
    }
    return "";
  }

  if (isNonEmptyString(candidate)) {
    return candidate.trim();
  }

  if (typeof candidate === "object") {
    for (const key of DEFAULT_KEYS) {
      if (isNonEmptyString(candidate[key])) {
        return candidate[key].trim();
      }
    }
  }

  return "";
};

export const pickFirstImageUrl = (fallback, ...candidates) => {
  for (const candidate of candidates) {
    const resolved = normaliseCandidate(candidate);
    if (isNonEmptyString(resolved)) {
      return resolved;
    }
  }
  return fallback;
};

const createPlaceholderSvg = (
  label,
  {
    width = 640,
    height = 480,
    background = "#f97316",
    color = "#ffffff",
  } = {},
) => {
  const safeLabel = label.replace(/[<>]/g, "");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' preserveAspectRatio='xMidYMid slice'><rect width='100%' height='100%' fill='${background}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter,Roboto,Helvetica,Arial,sans-serif' font-size='${Math.round(width / 12)}' fill='${color}'>${safeLabel}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const dishPlaceholderImage = createPlaceholderSvg("Dish", {
  width: 560,
  height: 420,
  background: "#fff7ed",
  color: "#c2410c",
});

export const restaurantPlaceholderImage = createPlaceholderSvg("Restaurant", {
  width: 720,
  height: 480,
  background: "#f1f5f9",
  color: "#0f172a",
});
