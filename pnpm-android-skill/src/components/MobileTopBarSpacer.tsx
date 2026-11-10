/**
 * MobileTopBarSpacer
 *
 * Reserves vertical space equal to the mobile sticky top bar height
 * (py-3 + h-9 logo ≈ 60px) so page content is never hidden behind it.
 * Invisible on lg+ where the sidebar is used instead.
 *
 * Usage: place as the first child inside every page's scroll container.
 */
export default function MobileTopBarSpacer() {
  return <div className="lg:hidden h-[32px] shrink-0" aria-hidden="true" />
}
