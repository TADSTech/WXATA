import React, { Component, useEffect } from 'react';

// Module-level Set to track already-injected zone IDs (prevents duplicates across re-renders)
const injectedZones = new Set<string>();

/** Reset the injected zones set — for use in tests only */
export function _resetInjectedZones() {
  injectedZones.clear();
}

// ─── Error Boundary ──────────────────────────────────────────────────────────

interface AdErrorBoundaryState {
  hasError: boolean;
}

class AdErrorBoundary extends Component<
  { children: React.ReactNode },
  AdErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[AdUnit] Ad render error:', error, info);
  }

  static getDerivedStateFromError(): AdErrorBoundaryState {
    return { hasError: true };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AdUnitProps {
  adType: 'popunder' | 'banner' | 'native';
  zoneId: string;
}

// ─── Popunder ─────────────────────────────────────────────────────────────────

function PopunderAd({ zoneId }: { zoneId: string }) {
  useEffect(() => {
    function injectScript() {
      if (injectedZones.has(zoneId)) return;

      const script = document.createElement('script');
      script.src = 'https://pl.adsterra.com/invoke.js';
      script.setAttribute('data-zone-id', zoneId);
      script.async = true;
      document.head.appendChild(script);

      injectedZones.add(zoneId);
    }

    function handleInteraction() {
      injectScript();
      // Remove both listeners after first interaction
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('scroll', handleInteraction);
    }

    document.addEventListener('click', handleInteraction);
    document.addEventListener('scroll', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('scroll', handleInteraction);
    };
  }, [zoneId]);

  // Popunder renders no visible DOM output
  return null;
}

// ─── Banner / Native ──────────────────────────────────────────────────────────

function BannerNativeAd({ zoneId }: { zoneId: string }) {
  useEffect(() => {
    // Inject the Adsterra invoke script for this zone after mount
    const script = document.createElement('script');
    script.src = 'https://pl.adsterra.com/invoke.js';
    script.setAttribute('data-zone-id', zoneId);
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Clean up the injected script on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [zoneId]);

  return (
    <ins
      className="adsterra-banner"
      data-zone-id={zoneId}
    />
  );
}

// ─── AdUnit (public export) ───────────────────────────────────────────────────

function AdUnitInner({ adType, zoneId }: AdUnitProps) {
  if (adType === 'popunder') {
    return <PopunderAd zoneId={zoneId} />;
  }

  return <BannerNativeAd zoneId={zoneId} />;
}

export function AdUnit(props: AdUnitProps) {
  return (
    <AdErrorBoundary>
      <AdUnitInner {...props} />
    </AdErrorBoundary>
  );
}

export default AdUnit;
