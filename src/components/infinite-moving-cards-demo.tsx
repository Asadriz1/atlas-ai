"use client";

import { InfiniteMovingCards } from "./ui/infinite-moving-cards-clean";

export function InfiniteMovingCardsDemo() {
  return (
    <div className="py-12 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black w-full">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-[30rem] rounded-md flex flex-col antialiased items-center justify-center relative overflow-hidden">
          <InfiniteMovingCards
            items={testimonials}
            direction="right"
            speed="slow"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}

const testimonials = [
  {
    quote:
      "Atlas AI completely transformed how I plan my trips. I saved hours of research and got a perfect itinerary for my Tokyo trip that matched my interests perfectly!",
    name: "Alex Johnson",
    title: "Travel Enthusiast",
  },
  {
    quote:
      "The AI-powered suggestions were spot on! I discovered hidden gems in Paris that weren't even in my guidebook. 10/10 would recommend!",
    name: "Sarah Williams",
    title: "Frequent Traveler",
  },
  {
    quote: "I was skeptical about using an AI travel planner, but Atlas AI exceeded all my expectations. The daily plans were well-balanced and included amazing local dining spots.",
    name: "Michael Chen",
    title: "Food & Travel Blogger",
  },
  {
    quote:
      "As a solo traveler, safety is my top priority. Atlas AI helped me find safe, well-lit areas and great hostels with good reviews. Made my trip to Barcelona stress-free!",
    name: "Emily Rodriguez",
    title: "Solo Traveler",
  },
  {
    quote:
      "The PDF export feature is a game-changer. I had my entire 2-week Italy itinerary with restaurant recommendations and booking links all in one place.",
    name: "David Kim",
    title: "Travel Photographer",
  },
];
