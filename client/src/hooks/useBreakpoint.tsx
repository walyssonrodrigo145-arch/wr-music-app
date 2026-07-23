import { useState, useEffect } from "react";

/**
 * Breakpoints based on user requirements:
 * Mobile: < 768px
 * Tablet: 768px - 1023px
 * Desktop: >= 1024px
 * Desktop XL: >= 1280px (MacBook Pro 14", 1440p, etc.)
 */

export type DeviceType = "mobile" | "tablet" | "desktop";

export function useBreakpoint() {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === "undefined") return "desktop";
    const width = window.innerWidth;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  });

  const [isXL, setIsXL] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1280;
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType("mobile");
      } else if (width < 1024) {
        setDeviceType("tablet");
      } else {
        setDeviceType("desktop");
      }
      setIsXL(width >= 1280);
    };

    window.addEventListener("resize", handleResize);
    // Initial check
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    deviceType,
    isMobile: deviceType === "mobile",
    isTablet: deviceType === "tablet",
    isDesktop: deviceType === "desktop",
    isXL, // >= 1280px (MacBook Pro 14", 1440p+)
    isSmallerThanDesktop: deviceType !== "desktop",
  };
}

