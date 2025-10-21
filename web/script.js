document.addEventListener('DOMContentLoaded', () => {
    // Observe elements for in-view animations
    const animateElements = document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .bounce-in');

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            } else {
                entry.target.classList.remove('is-visible');
            }
        });
    }, observerOptions);

    animateElements.forEach(el => observer.observe(el));

    // Header scroll style
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 80) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });

    // Initial animations for logo and nav items
    const logo = document.querySelector('.logo');
    const navItems = document.querySelectorAll('.nav-item');
    const heroPrimaryCta = document.querySelector('.hero .cta-button.primary');
    const heroSecondaryCta = document.querySelector('.hero .cta-button.secondary');

    logo.classList.add('is-visible');
    navItems.forEach((item) => {
        item.classList.add('fade-in-up');
        item.classList.add('is-visible');
    });
    if (heroPrimaryCta) heroPrimaryCta.classList.add('is-visible');
    if (heroSecondaryCta) heroSecondaryCta.classList.add('is-visible');

    // If you add icon-only assets, the <picture> will prefer them automatically.

    // --- Dev helper: export icon-only PNG from wide logo.png ---
    // How to use: open the site with `#export-icon` hash, e.g. index.html#export-icon
    // It will detect the opaque bounding box, then take a leftmost square (height x height)
    // which corresponds to the icon area, and download as `logo-icon.png`.
    function exportLogoIcon(options = {}) {
        const src = options.src || 'logo.png';
        const alphaThreshold = options.alphaThreshold ?? 16; // ignore near-transparent anti-alias halos
        const extraPad = options.extraPad ?? 0; // optional integer pixels to pad inside crop

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const { data } = ctx.getImageData(0, 0, w, h);

            // Find bounding box of non-transparent pixels
            let minX = w, minY = h, maxX = -1, maxY = -1;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = (y * w + x) * 4 + 3; // alpha index
                    if (data[i] >= alphaThreshold) {
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (maxX < 0 || maxY < 0) {
                alert('No opaque pixels found in logo.png');
                return;
            }

            // Derive left square crop (icon area). Use square size = bbox height.
            const bboxW = maxX - minX + 1;
            const bboxH = maxY - minY + 1;
            let cropX = minX;
            let cropY = minY;
            let cropSize = bboxH;

            // Keep square within image bounds
            if (cropX + cropSize > w) cropX = Math.max(0, w - cropSize);
            if (cropY + cropSize > h) cropY = Math.max(0, h - cropSize);

            // Optional inner padding (shrink crop slightly)
            cropX = Math.max(0, cropX + extraPad);
            cropY = Math.max(0, cropY + extraPad);
            cropSize = Math.max(1, cropSize - extraPad * 2);

            // Draw to output canvas
            const out = document.createElement('canvas');
            out.width = cropSize;
            out.height = cropSize;
            const octx = out.getContext('2d');
            octx.drawImage(canvas, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

            // Trigger download
            const a = document.createElement('a');
            a.download = 'logo-icon.png';
            a.href = out.toDataURL('image/png');
            document.body.appendChild(a);
            a.click();
            a.remove();
            console.log('Downloaded: logo-icon.png');
        };
        img.onerror = () => alert('Failed to load ' + src);
        img.src = src;
    }
    window.exportLogoIcon = exportLogoIcon;

    if (location.hash.replace('#', '') === 'export-icon') {
        // small delay to ensure page is interactive
        setTimeout(() => exportLogoIcon(), 50);
    }
});
