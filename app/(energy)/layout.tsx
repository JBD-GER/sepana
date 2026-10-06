import ConsentBanner from "@/app/(website)/components/ConsentBanner"
import GoogleAdsTag from "@/app/(website)/components/GoogleAdsTag"
import { ENERGY_GOOGLE_ADS_ID } from "@/lib/ads/energy"

export default function EnergyLayout({ children }: { children: React.ReactNode }) {
  return <>
    <GoogleAdsTag id={ENERGY_GOOGLE_ADS_ID} />
    {children}
    <ConsentBanner compact />
  </>
}
