/**
 * In-browser spatial layout & collision collector
 * With Scroll-Aware Dynamic Hit-Testing, Parent-Child SVG Normalization, and Fixed/Scrollable Collision Filtering
 */
(() => {
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

  function getSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return 'unknown';
    if (el.id) return `#${el.id}`;
    let sel = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(c => c && !c.includes(':')).slice(0, 2);
      if (classes.length) sel += '.' + classes.join('.');
    }
    return sel;
  }

  function getPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === Node.ELEMENT_NODE && cur !== document.body && cur !== document.documentElement) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        part += `#${cur.id}`;
        parts.unshift(part);
        break;
      }
      if (cur.className && typeof cur.className === 'string') {
        const cls = cur.className.trim().split(/\s+/).filter(Boolean)[0];
        if (cls) part += `.${cls}`;
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ') || el.tagName.toLowerCase();
  }

  function createsStackingContext(el, comp) {
    if (el === document.documentElement) return true;
    if (comp.position !== 'static' && comp.zIndex !== 'auto') return true;
    if (comp.position === 'fixed' || comp.position === 'sticky') return true;
    if (parseFloat(comp.opacity) < 1) return true;
    if (comp.transform !== 'none' || comp.perspective !== 'none') return true;
    if (comp.filter !== 'none') return true;
    if (comp.clipPath !== 'none') return true;
    if (comp.mask !== 'none' && comp.mask !== '') return true;
    if (comp.isolation === 'isolate') return true;
    if (comp.mixBlendMode !== 'normal') return true;
    if (['paint', 'layout', 'strict', 'content'].includes(comp.contain)) return true;
    return false;
  }

  function getStackingDepth(el) {
    let depth = 0;
    let cur = el.parentElement;
    while (cur && cur !== document.body) {
      const comp = window.getComputedStyle(cur);
      if (createsStackingContext(cur, comp)) {
        depth++;
      }
      cur = cur.parentElement;
    }
    return depth;
  }

  function isInteractive(el, comp) {
    const tag = el.tagName.toUpperCase();
    if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return true;
    const role = el.getAttribute('role');
    if (['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem'].includes(role)) return true;
    if (el.onclick || el.getAttribute('onclick')) return true;
    if (comp.cursor === 'pointer') return true;
    return false;
  }

  function findScrollableContainer(el) {
    let cur = el.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const comp = window.getComputedStyle(cur);
      const oy = comp.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight + 4) {
        return cur;
      }
      cur = cur.parentElement;
    }
    if (document.documentElement.scrollHeight > window.innerHeight + 4) {
      return document.documentElement;
    }
    return null;
  }

  function isFixedOrSticky(el) {
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const comp = window.getComputedStyle(cur);
      if (comp.position === 'fixed' || comp.position === 'sticky' || cur.tagName === 'NAV' || cur.classList.contains('bnav') || cur.classList.contains('top')) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  function isElementActiveAndVisible(el, rect, comp) {
    if (comp.display === 'none' || comp.visibility === 'hidden' || parseFloat(comp.opacity) === 0) return false;
    if (rect.width <= 1 || rect.height <= 1) return false;

    // Skip root phone/body container clipping warnings
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const c = window.getComputedStyle(cur);
      if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;

      // Inactive panel
      if (cur.classList.contains('panel') && !cur.classList.contains('active')) return false;

      // Closed bottom sheet/drawer
      if (cur.classList.contains('sheet') && !cur.classList.contains('open')) return false;
      if (cur.classList.contains('review') && !cur.classList.contains('open')) return false;
      if (cur.classList.contains('side') && !document.body.classList.contains('side-open') && !document.documentElement.classList.contains('side-open')) return false;

      if (cur.getAttribute('aria-hidden') === 'true') return false;

      // Ancestor overflow clipping
      if (c.overflow === 'hidden' || c.overflowX === 'hidden' || c.overflowY === 'hidden') {
        const parentRect = cur.getBoundingClientRect();
        if (rect.bottom <= parentRect.top || rect.top >= parentRect.bottom ||
            rect.right <= parentRect.left || rect.left >= parentRect.right) {
          return false;
        }
      }

      cur = cur.parentElement;
    }

    return true;
  }

  const allElements = Array.from(document.querySelectorAll('*'));
  const elementsData = [];
  const anomalies = [];
  const textElements = [];

  for (const el of allElements) {
    if (['SCRIPT', 'STYLE', 'META', 'HEAD', 'NOSCRIPT', 'SVG', 'PATH', 'DEFS'].includes(el.tagName)) continue;

    const comp = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!isElementActiveAndVisible(el, rect, comp)) continue;

    const stackingDepth = getStackingDepth(el);
    const parsedZ = comp.zIndex === 'auto' ? 0 : parseInt(comp.zIndex, 10) || 0;
    const calculatedZ = stackingDepth * 100 + (parsedZ > 0 ? parsedZ : 0);
    const interactive = isInteractive(el, comp);
    const scrollContainer = findScrollableContainer(el);

    const textContent = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);

    const nodeInfo = {
      id: el.id || null,
      tag: el.tagName.toLowerCase(),
      selector: getSelector(el),
      path: getPath(el),
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height)
      },
      computed: {
        zIndex: comp.zIndex,
        position: comp.position,
        opacity: comp.opacity,
        display: comp.display,
        overflow: comp.overflow,
        pointerEvents: comp.pointerEvents
      },
      stackingDepth,
      calculatedZ,
      interactive,
      text: textContent,
      isBlocked: false,
      isScrollAccessible: false,
      blocker: null,
      issues: []
    };

    // Text Truncation Check (ignore root wrapper phone container)
    if (el.id !== 'ph' && (comp.overflow === 'hidden' || comp.overflowX === 'hidden' || comp.overflowY === 'hidden')) {
      if (el.scrollWidth > el.clientWidth + 4 || el.scrollHeight > el.clientHeight + 4) {
        nodeInfo.issues.push({
          type: 'TEXT_TRUNCATION',
          severity: 'P1',
          detail: `Content clipped: scroll ${el.scrollWidth}x${el.scrollHeight}px vs client ${el.clientWidth}x${el.clientHeight}px`
        });
        anomalies.push({
          severity: 'P1',
          type: 'TEXT_TRUNCATED',
          target: nodeInfo.selector,
          path: nodeInfo.path,
          rect: nodeInfo.rect,
          detail: `Content overflowing box and being clipped by overflow: hidden`
        });
      }
    }

    // Scroll-Aware Hit Testing for Interactive Elements
    if (interactive && comp.pointerEvents !== 'none') {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      let initiallyBlocked = false;
      let topBlocker = null;

      if (cx >= 0 && cx <= vw && cy >= 0 && cy <= vh) {
        const hits = document.elementsFromPoint(cx, cy);
        if (hits.length > 0) {
          const topHit = hits[0];
          // Parent-child or ancestor check (handles SVG, button spans, icons)
          const isSelfOrRelative = topHit === el || el.contains(topHit) || topHit.contains(el);
          if (!isSelfOrRelative) {
            const blockerComp = window.getComputedStyle(topHit);
            if (blockerComp.pointerEvents !== 'none') {
              initiallyBlocked = true;
              topBlocker = topHit;
            }
          }
        }
      } else {
        initiallyBlocked = true;
      }

      // If initially blocked, run scroll verification
      if (initiallyBlocked) {
        if (scrollContainer) {
          const prevScrollTop = scrollContainer === document.documentElement ? window.scrollY : scrollContainer.scrollTop;
          const prevScrollLeft = scrollContainer === document.documentElement ? window.scrollX : scrollContainer.scrollLeft;

          try {
            el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
          } catch (e) {
            el.scrollIntoView();
          }

          const scrolledRect = el.getBoundingClientRect();
          const scx = scrolledRect.left + scrolledRect.width / 2;
          const scy = scrolledRect.top + scrolledRect.height / 2;

          let clearAfterScroll = false;
          if (scx >= 0 && scx <= vw && scy >= 0 && scy <= vh) {
            const scrolledHits = document.elementsFromPoint(scx, scy);
            if (scrolledHits.length > 0) {
              const scrolledTopHit = scrolledHits[0];
              if (scrolledTopHit === el || el.contains(scrolledTopHit) || scrolledTopHit.contains(el)) {
                clearAfterScroll = true;
              }
            }
          }

          // Restore scroll position
          if (scrollContainer === document.documentElement) {
            window.scrollTo(prevScrollLeft, prevScrollTop);
          } else {
            scrollContainer.scrollTop = prevScrollTop;
            scrollContainer.scrollLeft = prevScrollLeft;
          }

          if (clearAfterScroll) {
            nodeInfo.isScrollAccessible = true;
            initiallyBlocked = false;
          }
        }

        // True permanent P0 blocker
        if (initiallyBlocked && topBlocker) {
          const blockerComp = window.getComputedStyle(topBlocker);
          const blockerInfo = {
            tag: topBlocker.tagName.toLowerCase(),
            selector: getSelector(topBlocker),
            path: getPath(topBlocker),
            zIndex: blockerComp.zIndex,
            pointerEvents: blockerComp.pointerEvents
          };
          nodeInfo.isBlocked = true;
          nodeInfo.blocker = blockerInfo;
          nodeInfo.issues.push({
            type: 'CLICK_TARGET_OCCLUDED',
            severity: 'P0',
            detail: `Target permanently obstructed by ${blockerInfo.selector} even when scrolled.`
          });
          anomalies.push({
            severity: 'P0',
            type: 'OCCLUDED_INTERACTIVE',
            target: nodeInfo.selector,
            path: nodeInfo.path,
            rect: nodeInfo.rect,
            blocker: blockerInfo,
            detail: `Interactive element cannot receive direct clicks because ${blockerInfo.selector} renders on top even when scrolled.`
          });
        }
      }
    }

    const isInViewport = (rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw);
    const isTextLeaf = isInViewport &&
                       ['H1','H2','H3','H4','H5','H6','P','SPAN','LABEL','BUTTON','A'].includes(el.tagName) &&
                       textContent.length > 3 &&
                       el.children.length <= 1;
    if (isTextLeaf) {
      textElements.push({ el, nodeInfo, rect, isFixed: isFixedOrSticky(el), hasScroll: !!scrollContainer });
    }

    elementsData.push(nodeInfo);
  }

  // Detect Unintended Sibling Text Collisions
  for (let i = 0; i < textElements.length; i++) {
    for (let j = i + 1; j < textElements.length; j++) {
      const a = textElements[i];
      const b = textElements[j];

      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;

      // If one is scrollable and the other is a floating/fixed nav dock, scrolling separates them!
      if ((a.hasScroll && b.isFixed) || (b.hasScroll && a.isFixed)) continue;

      const x1 = Math.max(a.rect.left, b.rect.left);
      const y1 = Math.max(a.rect.top, b.rect.top);
      const x2 = Math.min(a.rect.right, b.rect.right);
      const y2 = Math.min(a.rect.bottom, b.rect.bottom);

      if (x2 > x1 && y2 > y1) {
        const overlapWidth = x2 - x1;
        const overlapHeight = y2 - y1;
        const overlapArea = overlapWidth * overlapHeight;
        const minArea = Math.min(a.rect.width * a.rect.height, b.rect.width * b.rect.height);

        if (overlapArea / minArea > 0.35) {
          a.nodeInfo.issues.push({
            type: 'TEXT_COLLISION',
            severity: 'P1',
            detail: `Colliding with visible text in ${b.nodeInfo.selector} (overlap: ${Math.round(overlapWidth)}x${Math.round(overlapHeight)}px)`
          });
          b.nodeInfo.issues.push({
            type: 'TEXT_COLLISION',
            severity: 'P1',
            detail: `Colliding with visible text in ${a.nodeInfo.selector}`
          });
          anomalies.push({
            severity: 'P1',
            type: 'TEXT_COLLISION',
            elementA: a.nodeInfo.selector,
            elementB: b.nodeInfo.selector,
            overlapRect: { x: Math.round(x1), y: Math.round(y1), w: Math.round(overlapWidth), h: Math.round(overlapHeight) },
            detail: `Visible text "${a.nodeInfo.text.slice(0, 20)}..." and "${b.nodeInfo.text.slice(0, 20)}..." overlap in the rendered viewport.`
          });
        }
      }
    }
  }

  const severityOrder = { P0: 0, P1: 1, P2: 2 };
  anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    viewport: { width: vw, height: vh },
    timestamp: new Date().toISOString(),
    totalElements: elementsData.length,
    anomaliesCount: anomalies.length,
    anomalies,
    elements: elementsData
  };
})();
