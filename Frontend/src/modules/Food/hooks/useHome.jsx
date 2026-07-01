import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from "react";
import api, { publicGetOnce, adminAPI, restaurantAPI } from "@food/api";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import { API_BASE_URL } from "@food/api/config";
import { foodImages } from "@food/constants/images";

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const normalizeHealthyFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["true", "1", "yes", "healthy"].includes(value.trim().toLowerCase());
  return false;
};

const slugifyCategory = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const normalizeImageUrl = (imageUrl) => {
  if (typeof imageUrl !== "string") return "";
  const trimmed = imageUrl.trim();
  if (!trimmed) return "";
  if (/^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) {
    return trimmed;
  }
  const appProtocol =
    typeof window !== "undefined" ? window.location?.protocol : "";
  const appHost =
    typeof window !== "undefined" ? window.location?.hostname : "";
  let normalizedInput = trimmed
    .replace(/\\/g, "/")
    .replace(/^(https?):\/(?!\/)/i, "$1://")
    .replace(/^(https?:\/\/)(https?:\/\/)/i, "$1");

  if (/^\/\//.test(normalizedInput)) {
    normalizedInput = `${appProtocol || "https:"}${normalizedInput}`;
  }

  if (/^(https?:)?\/\//i.test(normalizedInput)) {
    try {
      const parsed = new URL(normalizedInput, window.location.origin);
      if (
        appHost &&
        appHost !== "localhost" &&
        appHost !== "127.0.0.1" &&
        /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)
      ) {
        try {
          const backendUrl = new URL(BACKEND_ORIGIN);
          parsed.protocol = backendUrl.protocol;
          parsed.hostname = backendUrl.hostname;
          parsed.port = backendUrl.port;
        } catch {
          parsed.protocol = window.location.protocol;
          parsed.hostname = window.location.hostname;
          if (window.location.port) parsed.port = window.location.port;
        }
      }
      if (appProtocol === "https:" && parsed.protocol === "http:") {
        parsed.protocol = "https:";
      }
      const finalUrl = parsed.toString();
      const hasSignedParams =
        /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(
          finalUrl,
        );
      return hasSignedParams ? finalUrl : encodeURI(finalUrl);
    } catch {
      return normalizedInput;
    }
  }

  const absolutePath = normalizedInput.startsWith("/")
    ? `${BACKEND_ORIGIN}${normalizedInput}`
    : `${BACKEND_ORIGIN}/${normalizedInput.replace(/^\.?\/*/, "")}`;

  try {
    const parsed = new URL(absolutePath, window.location.origin);
    if (appProtocol === "https:" && parsed.protocol === "http:") {
      parsed.protocol = "https:";
    }
    const finalUrl = parsed.toString();
    const hasSignedParams =
      /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(
        finalUrl,
      );
    return hasSignedParams ? finalUrl : encodeURI(finalUrl);
  } catch {
    return absolutePath;
  }
};

const extractImageFromValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return normalizeImageUrl(value);
  if (typeof value === "object") {
    const candidate =
      value.url || value.secure_url || value.imageUrl || value.imageURL ||
      value.image || value.src || value.path || value.location ||
      value.link || value.href || "";
    return typeof candidate === "string" ? normalizeImageUrl(candidate) : "";
  }
  return "";
};

const buildRestaurantImageCandidates = (value) => {
  const normalized = extractImageFromValue(value);
  if (!normalized) return [];
  if (
    /res\.cloudinary\.com/i.test(normalized) &&
    /\/image\/upload\//i.test(normalized)
  ) {
    const hasTransform = /\/image\/upload\/(?:f_|q_|w_|h_|c_|dpr_|g_)/i.test(normalized);
    if (!hasTransform) {
      return Array.from(
        new Set([
          normalized.replace("/image/upload/", "/image/upload/f_jpg,q_auto,w_1080/"),
          normalized.replace("/image/upload/", "/image/upload/f_auto,q_auto,w_1080/"),
          normalized,
        ]),
      );
    }
  }
  return [normalized];
};

const extractImages = (source) => {
  if (!source) return [];
  const normalizedImages = (Array.isArray(source)
    ? source.flatMap((entry) => buildRestaurantImageCandidates(entry))
    : buildRestaurantImageCandidates(source)
  )
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  return normalizedImages.filter((value, index) => normalizedImages.indexOf(value) === index);
};

const getRestaurantDisplayName = (restaurant) => {
  const nameCandidates = [
    restaurant?.name,
    restaurant?.restaurantName,
    restaurant?.restaurantName?.english,
    restaurant?.restaurantName?.value,
    restaurant?.onboarding?.step1?.restaurantName,
  ];
  const resolvedName = nameCandidates.find(
    (candidate) => typeof candidate === "string" && candidate.trim().length > 0,
  );
  return resolvedName ? resolvedName.trim() : "Restaurant";
};

export const useHome = ({ effectiveLocation, effectiveZoneId, hasUsableUserCity }) => {
  // Hero Banners State
  const [heroBannerImages, setHeroBannerImages] = useState([]);
  const [heroBannersData, setHeroBannersData] = useState([]);
  const [loadingBanners, setLoadingBanners] = useState(true);

  // Landing Config & Explore More
  const [landingExploreMore, setLandingExploreMore] = useState([]);
  const [exploreMoreHeading, setExploreMoreHeading] = useState("Explore More");
  const [festBannerVideoUrl, setFestBannerVideoUrl] = useState("");
  const [loadingLandingConfig, setLoadingLandingConfig] = useState(true);
  const [recommendedRestaurantIds, setRecommendedRestaurantIds] = useState([]);
  const [under250PriceLimit, setUnder250PriceLimit] = useState(250);
  const [recommendedRestaurantsFromSettings, setRecommendedRestaurantsFromSettings] = useState([]);

  // Categories State
  const [realCategories, setRealCategories] = useState([]);
  const [loadingRealCategories, setLoadingRealCategories] = useState(true);
  const publicCategoriesCacheRef = useRef(new Map());
  const publicCategoriesInFlightRef = useRef(new Map());

  // Restaurants State
  const [restaurantsData, setRestaurantsData] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const restaurantsRequestSeqRef = useRef(0);

  // Fetch Hero Banners
  useEffect(() => {
    let cancelled = false;
    setLoadingBanners(true);
    publicGetOnce("/food/hero-banners/public")
      .then((response) => {
        if (cancelled) return;
        const data = response?.data?.data;
        const list = Array.isArray(data?.banners) ? data.banners : Array.isArray(data) ? data : [];
        const images = list.map((b) => (b && typeof b.imageUrl === "string" ? b.imageUrl : "")).filter(Boolean);
        setHeroBannerImages(images);
        setHeroBannersData(list);
      })
      .catch(() => {
        if (cancelled) return;
        setHeroBannerImages([]);
        setHeroBannersData([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBanners(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Fetch Explore Icons & Landing Settings
  useEffect(() => {
    let cancelled = false;
    setLoadingLandingConfig(true);
    Promise.all([
      publicGetOnce("/food/explore-icons/public").catch(() => ({ data: { data: {} } })),
      publicGetOnce("/food/landing/settings/public").catch(() => ({ data: { data: {} } })),
    ])
      .then(([exploreRes, settingsRes]) => {
        if (cancelled) return;
        const exploreData = exploreRes?.data?.data;
        const items = Array.isArray(exploreData?.items) ? exploreData.items : Array.isArray(exploreData) ? exploreData : [];
        setLandingExploreMore(items.map((it) => ({ ...it, imageUrl: it.imageUrl || it.iconUrl, label: it.label || it.name })));
        const settings = settingsRes?.data?.data || {};
        setExploreMoreHeading(settings.exploreMoreHeading || "Explore More");
        setFestBannerVideoUrl(typeof settings.festBannerVideoUrl === "string" ? settings.festBannerVideoUrl : "");
        setRecommendedRestaurantIds(settings.recommendedRestaurantIds || []);
        setUnder250PriceLimit(Number(settings.under250PriceLimit) || 250);
        setRecommendedRestaurantsFromSettings(settings.recommendedRestaurants || []);
      })
      .catch(() => {
        if (!cancelled) {
          setLandingExploreMore([]);
          setExploreMoreHeading("Explore More");
          setFestBannerVideoUrl("");
          setRecommendedRestaurantIds([]);
          setUnder250PriceLimit(250);
          setRecommendedRestaurantsFromSettings([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLandingConfig(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Fetch Categories
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const zoneKey = String(effectiveZoneId || "global");
      try {
        const cached = publicCategoriesCacheRef.current.get(zoneKey);
        if (cached) {
          if (!cancelled) setRealCategories(cached);
          return;
        }

        const inFlight = publicCategoriesInFlightRef.current.get(zoneKey);
        if (inFlight) {
          const categories = await inFlight;
          if (!cancelled) setRealCategories(categories);
          return;
        }

        setLoadingRealCategories(true);
        const promise = (async () => {
          const res = await adminAPI.getPublicCategories(effectiveZoneId ? { zoneId: effectiveZoneId } : {});
          const list = res?.data?.data?.categories || res?.data?.categories || [];
          const categories = Array.isArray(list)
            ? list.map((cat, idx) => ({
                id: String(cat?.id || cat?._id || cat?.slug || idx),
                name: cat?.name || "",
                slug: cat?.slug || String(cat?.name || "").toLowerCase().replace(/\s+/g, "-"),
                image: normalizeImageUrl(cat?.image || cat?.imageUrl) || "",
                type: cat?.type || "",
                healthy: normalizeHealthyFlag(cat?.healthy),
              }))
            : [];

          publicCategoriesCacheRef.current.set(zoneKey, categories);
          return categories;
        })();

        publicCategoriesInFlightRef.current.set(zoneKey, promise);
        const categories = await promise;
        publicCategoriesInFlightRef.current.delete(zoneKey);

        if (!cancelled) setRealCategories(categories);
      } catch (err) {
        if (!cancelled) setRealCategories([]);
      } finally {
        if (!cancelled) setLoadingRealCategories(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [effectiveZoneId]);

  // Fetch Restaurants Logic
  const fetchRestaurants = useCallback(async (filters = {}) => {
    const requestSeq = ++restaurantsRequestSeqRef.current;
    try {
      setLoadingRestaurants(true);
      const params = {};

      if (Number.isFinite(effectiveLocation?.latitude) && Number.isFinite(effectiveLocation?.longitude)) {
        params.lat = effectiveLocation.latitude;
        params.lng = effectiveLocation.longitude;
      }

      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.selectedCuisine) params.cuisine = filters.selectedCuisine;

      if (filters.activeFilters?.has("rating-45-plus")) params.minRating = 4.5;
      else if (filters.activeFilters?.has("rating-4-plus")) params.minRating = 4.0;
      else if (filters.activeFilters?.has("rating-35-plus")) params.minRating = 3.5;

      if (filters.activeFilters?.has("delivery-under-30")) params.maxDeliveryTime = 30;
      else if (filters.activeFilters?.has("delivery-under-45")) params.maxDeliveryTime = 45;

      if (filters.activeFilters?.has("distance-under-1km")) params.radiusKm = 1.0;
      else if (filters.activeFilters?.has("distance-under-2km")) params.radiusKm = 2.0;

      if (filters.activeFilters?.has("price-under-200")) params.maxPrice = 200;
      else if (filters.activeFilters?.has("price-under-500")) params.maxPrice = 500;

      if (filters.activeFilters?.has("has-offers")) params.hasOffers = "true";
      if (filters.activeFilters?.has("top-rated")) params.topRated = "true";
      else if (filters.activeFilters?.has("trusted")) params.trusted = "true";

      if (effectiveZoneId) params.zoneId = effectiveZoneId;
      if (!effectiveZoneId && hasUsableUserCity) params.city = String(effectiveLocation.city).trim();

      const response = await restaurantAPI.getRestaurants(params);
      if (requestSeq !== restaurantsRequestSeqRef.current) return;

      if (response.data?.success && response.data?.data?.restaurants) {
        const restaurantsArray = response.data.data.restaurants;

        if (restaurantsArray.length === 0) {
          setRestaurantsData([]);
          return;
        }

        const calculateDistance = (lat1, lng1, lat2, lng2) => {
          const R = 6371;
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLng = ((lng2 - lng1) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        const userLat = effectiveLocation?.latitude;
        const userLng = effectiveLocation?.longitude;

        const transformedRestaurants = restaurantsArray.map((restaurant) => {
          const deliveryTime = restaurant.estimatedDeliveryTime || "25-30 mins";
          let distance = restaurant.distance || "1.2 km";
          let distanceInKm = null;
          
          const restaurantLat = restaurant.location?.latitude || (restaurant.location?.coordinates ? restaurant.location.coordinates[1] : null);
          const restaurantLng = restaurant.location?.longitude || (restaurant.location?.coordinates ? restaurant.location.coordinates[0] : null);

          if (userLat && userLng && restaurantLat && restaurantLng) {
            distanceInKm = calculateDistance(userLat, userLng, restaurantLat, restaurantLng);
            if (distanceInKm >= 1) distance = `${distanceInKm.toFixed(1)} km`;
            else distance = `${Math.round(distanceInKm * 1000)} m`;
          }

          const coverImages = extractImages([...(Array.isArray(restaurant.coverImages) ? restaurant.coverImages : [restaurant.coverImages]).filter(Boolean), restaurant.coverImage]);
          const profileImageCandidates = extractImages([
            ...buildRestaurantImageCandidates(restaurant.profileImage),
            ...buildRestaurantImageCandidates(restaurant.onboarding?.step2?.profileImageUrl),
            ...buildRestaurantImageCandidates(restaurant.image),
            ...buildRestaurantImageCandidates(restaurant.imageUrl),
          ]);
          const allImages = Array.from(new Set([...coverImages, ...profileImageCandidates].filter(Boolean)));

          return {
            id: restaurant.restaurantId || restaurant._id,
            mongoId: restaurant._id || null,
            name: getRestaurantDisplayName(restaurant),
            cuisine: (restaurant.cuisines && restaurant.cuisines.length > 0) ? restaurant.cuisines[0] : "Multi-cuisine",
            cuisines: Array.isArray(restaurant.cuisines) ? restaurant.cuisines : [],
            rating: Number(restaurant.rating) || 0,
            deliveryTime: restaurant.deliveryTime || restaurant.estimatedDeliveryTime || (restaurant.estimatedDeliveryTimeMinutes ? `${restaurant.estimatedDeliveryTimeMinutes} mins` : deliveryTime),
            distance,
            distanceInKm,
            image: allImages[0] || profileImageCandidates[0] || "",
            images: allImages,
            priceRange: restaurant.priceRange || "",
            featuredDish: restaurant.featuredDish || "",
            featuredPrice: Number.isFinite(Number(restaurant.featuredPrice)) ? Number(restaurant.featuredPrice) : null,
            offer: restaurant.offer || null,
            slug: restaurant.slug,
            restaurantId: restaurant.restaurantId,
            pureVegRestaurant: restaurant.pureVegRestaurant === true,
            location: restaurant.location,
            isActive: restaurant.isActive !== false,
            isAcceptingOrders: restaurant.isAcceptingOrders !== false,
            openDays: Array.isArray(restaurant.openDays) ? restaurant.openDays : [],
            deliveryTimings: restaurant.deliveryTimings || null,
            outletTimings: restaurant.outletTimings || null,
          };
        });

        const sortRestaurantsForDisplay = (restaurants) => {
          if (!userLat || !userLng) return restaurants;
          return [...restaurants].sort((a, b) => {
            const aAvailable = getRestaurantAvailabilityStatus(a, new Date(), { ignoreOperationalStatus: true }).isOpen;
            const bAvailable = getRestaurantAvailabilityStatus(b, new Date(), { ignoreOperationalStatus: true }).isOpen;
            if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;
            if (filters.sortBy === "price-low") return (a.featuredPrice || 0) - (b.featuredPrice || 0);
            if (filters.sortBy === "price-high") return (b.featuredPrice || 0) - (a.featuredPrice || 0);
            if (filters.sortBy === "rating-high") return (b.rating || 0) - (a.rating || 0);
            if (filters.sortBy === "rating-low") return (a.rating || 0) - (b.rating || 0);
            const aDistance = a.distanceInKm !== null ? a.distanceInKm : Infinity;
            const bDistance = b.distanceInKm !== null ? b.distanceInKm : Infinity;
            return aDistance - bDistance;
          });
        };

        startTransition(() => {
          setRestaurantsData(sortRestaurantsForDisplay(transformedRestaurants));
        });

      } else {
        setRestaurantsData([]);
      }
    } catch (error) {
      setRestaurantsData([]);
    } finally {
      if (requestSeq === restaurantsRequestSeqRef.current) {
        setLoadingRestaurants(false);
      }
    }
  }, [effectiveLocation?.latitude, effectiveLocation?.longitude, effectiveZoneId, hasUsableUserCity]);

  return {
    heroBannerImages,
    heroBannersData,
    loadingBanners,
    landingExploreMore,
    exploreMoreHeading,
    festBannerVideoUrl,
    loadingLandingConfig,
    realCategories,
    loadingRealCategories,
    restaurantsData,
    loadingRestaurants,
    fetchRestaurants,
    recommendedRestaurantIds,
    under250PriceLimit,
    recommendedRestaurantsFromSettings,
  };
};

