import React from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RestaurantImageCarousel from "@food/components/user/RestaurantImageCarousel";
import { foodImages } from "@food/constants/images";
import { API_BASE_URL } from "@food/api/config";

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export default function SubscriptionHero({ mobileFeaturedRestaurant }) {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden rounded-[10px] bg-[#fff0e8] dark:bg-[#221612] border border-[#ffe1d2] dark:border-[#3d241c] min-h-[126px] p-4 mt-2 transition-colors">
      <div className="relative z-10 max-w-[55%]">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#d3542a] dark:text-[#f8784d]">
          Subscription Meals
        </p>
        <h1 className="mt-1 text-[25px] font-black leading-[0.9] text-[#7a1f16] dark:text-[#ff9f96]">
          Good Food.
          <br />
          Better You.
        </h1>
        <p className="mt-2 text-[9px] font-semibold leading-snug text-[#8b5a45] dark:text-[#d4aba0]">
          Nutritious, homemade meals delivered daily to your doorstep.
        </p>
        <button
          type="button"
          onClick={() => navigate("/food/user/subscription-plans")}
          className="mt-3 h-7 px-3 rounded-md bg-[#d9251d] hover:bg-[#b7221d] text-white text-[9px] font-black flex items-center gap-1 transition-colors"
        >
          Choose Your Plan
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <div className="absolute right-0 top-2 bottom-0 w-[48%]">
        {mobileFeaturedRestaurant ? (
          <RestaurantImageCarousel
            restaurant={mobileFeaturedRestaurant}
            backendOrigin={BACKEND_ORIGIN}
            className="h-full"
            roundedClass="rounded-none"
            priority
          />
        ) : (
          <img src={foodImages[0]} alt="Tiffin meal" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#fff0e8] dark:from-[#221612] via-transparent to-transparent" />
      </div>
    </section>
  );
}
