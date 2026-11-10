/**
 * SidebarSpacer
 *
 * Reserves vertical space at the top of the mobile sidebar drawer panel
 * (matching the exact height of the top bar spacer, 60px) so the "Menu" title
 * and close button are never cut off by the mobile status bar / notch.
 * Invisible on lg+ desktop view.
 */
export default function SidebarSpacer() {
  return <div className="lg:hidden h-[32px] shrink-0" aria-hidden="true" />
}
