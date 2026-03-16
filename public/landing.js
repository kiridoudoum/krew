document.addEventListener('DOMContentLoaded', () => {
    // Reveal Observer for scroll-triggered animations
    const revealOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -100px 0px'
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.classList.contains('reveal-scale')) {
                    entry.target.style.transition = 'all 1.5s cubic-bezier(0.16, 1, 0.3, 1)';
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'scale(1)';
                } else {
                    entry.target.style.transition = 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)';
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
                revealObserver.unobserve(entry.target);
            }
        });
    }, revealOptions);

    document.querySelectorAll('.reveal-up, .reveal-scale').forEach(el => {
        revealObserver.observe(el);
    });

    // Stagger reveal for elements within the same section
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        const revealItems = section.querySelectorAll('.reveal-up, .reveal-scale');
        revealItems.forEach((item, index) => {
            item.style.transitionDelay = `${index * 100}ms`;
        });
    });

    // Simple smooth scroll for anchors
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Floating Header appearance on scroll
    const header = document.querySelector('.main-header');
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            header.style.transition = 'transform 0.5s var(--ease-apple), opacity 0.5s';
            if (window.scrollY > lastScrollY) {
                // Scrolling down
                header.style.transform = 'translateY(-150%)';
                header.style.opacity = '0';
            } else {
                // Scrolling up
                header.style.transform = 'translateY(0)';
                header.style.opacity = '1';
            }
        } else {
            header.style.transform = 'translateY(0)';
            header.style.opacity = '1';
        }
        lastScrollY = window.scrollY;
    });
});
