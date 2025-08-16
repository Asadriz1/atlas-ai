"use client";

import { cn } from "../../lib/utils";
import { useEffect, useState, useRef } from "react";

export const InfiniteMovingCards = ({
  items,
  direction = "left",
  speed = "fast",
  pauseOnHover = true,
  className,
}: {
  items: {
    quote: string;
    name: string;
    title: string;
  }[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
}) => {
  const [start, setStart] = useState(false);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !scrollerRef.current) return;
    
    const scroller = scrollerRef.current;
    const container = containerRef.current;

    // Set animation direction
    container.style.setProperty(
      "--animation-direction",
      direction === "left" ? "forwards" : "reverse"
    );
    
    // Set animation speed
    container.style.setProperty(
      "--animation-duration",
      speed === "fast" ? "20s" : speed === "normal" ? "40s" : "80s"
    );

    // Duplicate items for infinite scroll effect
    const scrollerContent = Array.from(scroller.children);
    scrollerContent.forEach((item) => {
      const duplicatedItem = item.cloneNode(true);
      scroller.appendChild(duplicatedItem);
    });

    setStart(true);
  }, [direction, speed]);

  return (
    <div
      ref={containerRef}
      className={cn("scroller w-full group", className)}
      data-animated={start}
      data-direction={direction}
      data-speed={speed}
      onMouseEnter={() => pauseOnHover && containerRef.current?.setAttribute('data-paused', 'true')}
      onMouseLeave={() => pauseOnHover && containerRef.current?.removeAttribute('data-paused')}
    >
      <ul
        ref={scrollerRef}
        className="scroller__inner flex gap-6 py-6 w-max"
      >
        {items.map((item, idx) => (
          <li key={`${item.name}-${idx}`} className="testimonial-card">
            <div className="testimonial-content">
              <p className="testimonial-quote">{item.quote}</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="testimonial-name">{item.name}</div>
                  <div className="testimonial-title">{item.title}</div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
