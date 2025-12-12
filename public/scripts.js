// scripts.js

document.addEventListener('DOMContentLoaded', () => {
  initLogoSwap();
  initAccordion();
  initAnimations();
  initCarousel();
  initClipboard();
  initModalEvents(); // This will be updated below
});

// --- Configuration & Assets ---
const logoImages = [
  'tent.png', 'tent2.png', 'tent3.png', 'tent4.png',
  'tent5.png', 'teint03.png', 'tent0.png', 'tent6.png',
  'tent7.png', 'tent8.png', 'tent9.png', 'trint.png'
];

// Preload images
logoImages.forEach(imageSrc => {
  const img = new Image();
  img.src = imageSrc;
});

// --- Logo Swapping ---
function initLogoSwap() {
  const logoImg = document.getElementById('tdkcml');
  if (logoImg) {
    logoImg.addEventListener('mouseenter', () => {
      gsap.to(logoImg, {
        rotation: 5,
        duration: 0.1,
        yoyo: true,
        repeat: 3
      });
    });
    logoImg.addEventListener('mouseleave', () => {
      gsap.to(logoImg, {
        rotation: -3,
        duration: 0.4,
        ease: "elastic.out(1, 0.3)"
      });
    });
  }
}

function swapLogoRandomly() {
  const logoEl = document.getElementById('tdkcml');
  if (!logoEl) return;

  const currentSrc = logoEl.getAttribute('src');
  let newSrc;
  do {
    const randomIndex = Math.floor(Math.random() * logoImages.length);
    newSrc = logoImages[randomIndex];
  } while (newSrc === currentSrc);

  gsap.to(logoEl, {
    opacity: 0,
    duration: 0.1,
    onComplete: () => {
      logoEl.src = newSrc;
      gsap.to(logoEl, {
        opacity: 1,
        duration: 0.2
      });
    }
  });
}

// --- Accordion ---
function initAccordion() {
  const headers = document.querySelectorAll('.accordion-header');

  headers.forEach(header => {
    // Hover effects for icons
    const icon = header.querySelector('.material-icons');
    if (icon) {
      header.addEventListener('mouseenter', () => {
        gsap.to(icon, {
          scale: 1.4,
          rotation: 15,
          color: "#FF3EB5FF",
          duration: 0.3,
          ease: "back.out(2)"
        });
      });
      header.addEventListener('mouseleave', () => {
        gsap.to(icon, {
          scale: 1,
          rotation: 0,
          color: "#FFFFFFFF",
          duration: 0.3
        });
      });
    }

    // Click event
    header.addEventListener('click', () => toggleAccordion(header));
  });
}

function toggleAccordion(header) {
  const body = header.nextElementSibling;
  const allBodies = document.querySelectorAll('.accordion-body');

  // Close others
  allBodies.forEach(section => {
    if (section !== body) section.classList.remove('open');
  });

    // Toggle current
    body.classList.toggle('open');
    
    if (body.classList.contains('open')) {
      // Visual feedback - swap to random tent
      swapLogoRandomly();
  
      gsap.fromTo(body.querySelectorAll('p, button, .map-container, .crypto-container, noscript'), {
        y: 20,
        opacity: 0
      }, {
        y: 0,
        opacity: 1,
        duration: 0.4,
        stagger: 0.1
      });
    } else {
      // If we just closed the only open one (and since we closed others above, all are closed)
      // Revert to main logo
      const logoEl = document.getElementById('tdkcml');
      if (logoEl) {
        gsap.to(logoEl, {
          opacity: 0,
          duration: 0.1,
          onComplete: () => {
            logoEl.src = 'td.png';
            gsap.to(logoEl, { opacity: 1, duration: 0.2 });
          }
        });
      }
    }
  }
  // --- Animations ---
function initAnimations() {
  gsap.set("#tdkcml", { y: -600, opacity: 0 });
  gsap.set(".gsap-title", { scale: 0, opacity: 0 });
  gsap.set(".header-text p", { x: -50, opacity: 0 });
  gsap.set(".accordion-item", { y: 100, opacity: 0 });
  gsap.set(".carousel-wrapper", { opacity: 0 });

  const introTl = gsap.timeline({ defaults: { ease: "power3.out" } });

  introTl
    .to("#tdkcml", { duration: 1.5, y: 0, opacity: 1, ease: "bounce.out", rotation: -3 })
    .to(".gsap-title", { duration: 0.8, scale: 1, opacity: 1, ease: "elastic.out(1, 0.5)", rotation: 0 }, "-=0.5")
    .to(".header-text p", { duration: 0.6, x: 0, opacity: 1 }, "-=0.2")
    .to(".accordion-item", { duration: 0.8, y: 0, opacity: 1, stagger: 0.15, ease: "back.out(1.7)" }, "-=0.2")
    .to(".carousel-wrapper", { duration: 1, opacity: 1 }, "-=0.5");
}

// --- Carousel ---
function initCarousel() {
  const track = document.querySelector(".carousel-track");
  if (!track) return;

  const carouselAnim = gsap.to(track, {
    xPercent: -50,
    ease: "none",
    duration: 20,
    repeat: -1
  });

  // Pause ONLY the carousel animation, not the global timeline
  track.addEventListener("mouseenter", () => carouselAnim.pause());
  track.addEventListener("mouseleave", () => carouselAnim.resume());
}

// --- Modal ---
function initModalEvents() {
  const modal = document.getElementById('paypal-modal');
  const openBtn = document.getElementById('open-paypal-modal');
  const closeBtn = document.getElementById('close-modal');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
      paypal.HostedButtons({
        hostedButtonId: "H4Y8CJZL7NDNG",
      }).render('#paypal-container-modal');
    });

    // Animation for the donate button
    openBtn.addEventListener('mouseenter', () => {
      gsap.to(openBtn, { scaleX: 1.1, scaleY: 0.9, duration: 0.1, yoyo: true, repeat: 1 });
    });
    openBtn.addEventListener('mouseleave', () => {
      gsap.to(openBtn, { scale: 1, duration: 0.2 });
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
  }

  window.addEventListener('click', event => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// --- Clipboard ---
function initClipboard() {
  const copyBtn = document.getElementById('copy-btc-btn');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', () => {
    const btcAddress = document.getElementById('btc-address').textContent;
    navigator.clipboard.writeText(btcAddress).then(() => {
      copyBtn.innerHTML = '<span class="material-icons" style="color: #00FFA3FF; font-size: 1rem;">done</span>';
      setTimeout(() => {
        copyBtn.innerHTML = '<span class="material-icons" style="color: #00D6FFFF; font-size: 1rem;">content_copy</span>';
      }, 2000);
    });
  });
}