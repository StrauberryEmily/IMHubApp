(function () {
    function removeLegacyStockPanels() {
        const candidates = Array.from(document.querySelectorAll('*'));

        candidates.forEach((el) => {
            const text = (el.textContent || '').toUpperCase();
            const className = (el.className || '').toString().toLowerCase();
            const id = (el.id || '').toLowerCase();
            const matchesWorkflow = text.includes('QUICK ORDERING WORKFLOW') || text.includes('QUICK ORDERING') || text.includes('WORKFLOW');
            const matchesSidebar = className.includes('stock-right-sidebar') || className.includes('stock-right') || className.includes('right-sidebar') || id.includes('stock-right-sidebar') || id.includes('workflow');

            if (!matchesWorkflow && !matchesSidebar) {
                return;
            }

            let target = el;
            while (target && target !== document.body) {
                const targetClass = (target.className || '').toString().toLowerCase();
                const targetId = (target.id || '').toLowerCase();
                if (
                    targetClass.includes('sidebar') ||
                    targetClass.includes('panel') ||
                    targetClass.includes('overlay') ||
                    targetClass.includes('workflow') ||
                    targetId.includes('sidebar') ||
                    targetId.includes('workflow')
                ) {
                    target.style.display = 'none !important';
                    target.style.visibility = 'hidden';
                    target.setAttribute('aria-hidden', 'true');
                    target.remove();
                    return;
                }
                target = target.parentElement;
            }

            el.style.display = 'none !important';
            el.style.visibility = 'hidden';
            el.setAttribute('aria-hidden', 'true');
            el.remove();
        });
    }

    function initLegacyStockPanels() {
        removeLegacyStockPanels();
        requestAnimationFrame(() => removeLegacyStockPanels());
        window.setTimeout(removeLegacyStockPanels, 250);
        window.setTimeout(removeLegacyStockPanels, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLegacyStockPanels, { once: true });
    } else {
        initLegacyStockPanels();
    }

    window.addEventListener('load', initLegacyStockPanels);
    window.removeLegacyStockPanels = removeLegacyStockPanels;
})();
