gsap.registerPlugin(ScrollTrigger);

window.addEventListener("DOMContentLoaded", () => {

  /* ── Homepage: Hero intro timeline ── */
  if (document.querySelector(".about-photo")) {
    const aboutTimeline = gsap.timeline({ defaults: { ease: "power3.out" } });

    aboutTimeline
      .from(".about-photo", {
        opacity: 0,
        scale: 0.9,
        y: 30,
        duration: 1,
      })
      .from(
        ".about-title",
        { opacity: 0, y: 40, duration: 0.85 },
        "-=0.5"
      )
      .from(
        ".about-description",
        { opacity: 0, y: 25, duration: 0.75 },
        "-=0.4"
      );
  }

  /* ── Homepage + UX Portfolio: Project card stagger ── */
  gsap.utils.toArray(".project-card").forEach((card, index) => {
    gsap.from(card, {
      opacity: 0,
      y: 50,
      duration: 0.75,
      ease: "power2.out",
      delay: index * 0.08,
      scrollTrigger: {
        trigger: card,
        start: "top 88%",
        toggleActions: "play none none reverse",
      },
    });
  });

  /* ── Case Study: Hero fade-in ── */
  if (document.querySelector(".cs-hero")) {
    const csHero = gsap.timeline({ defaults: { ease: "power3.out" } });

    csHero
      .from(".cs-hero-kicker", { opacity: 0, y: 20, duration: 0.6 })
      .from(".cs-hero-title", { opacity: 0, y: 30, duration: 0.8 }, "-=0.3")
      .from(".cs-hero-subtitle", { opacity: 0, y: 20, duration: 0.7 }, "-=0.4")
      .from(".cs-meta-item", {
        opacity: 0,
        y: 15,
        duration: 0.5,
        stagger: 0.1,
      }, "-=0.3")
      .from(".cs-hero-image", {
        opacity: 0,
        y: 40,
        scale: 0.97,
        duration: 0.9,
      }, "-=0.4");
  }

  /* ── Case Study: Section scroll animations ── */
  gsap.utils.toArray(".cs-section").forEach((section) => {
    gsap.from(section.querySelectorAll(".cs-section-number, h2, p"), {
      opacity: 0,
      y: 30,
      duration: 0.7,
      stagger: 0.1,
      ease: "power2.out",
      scrollTrigger: {
        trigger: section,
        start: "top 82%",
        toggleActions: "play none none reverse",
      },
    });
  });

  /* ── Case Study: Process steps ── */
  gsap.utils.toArray(".cs-process-step").forEach((step, i) => {
    gsap.from(step, {
      opacity: 0,
      y: 40,
      duration: 0.65,
      ease: "power2.out",
      delay: i * 0.1,
      scrollTrigger: {
        trigger: step,
        start: "top 88%",
        toggleActions: "play none none reverse",
      },
    });
  });

  /* ── Case Study: Solution images ── */
  gsap.utils.toArray(".cs-solution-image").forEach((img, i) => {
    gsap.from(img, {
      opacity: 0,
      y: 30,
      scale: 0.95,
      duration: 0.6,
      ease: "power2.out",
      delay: i * 0.12,
      scrollTrigger: {
        trigger: img,
        start: "top 88%",
        toggleActions: "play none none reverse",
      },
    });
  });

  /* ── Case Study: Impact list items ── */
  gsap.utils.toArray(".cs-impact-list li").forEach((li, i) => {
    gsap.from(li, {
      opacity: 0,
      x: -20,
      duration: 0.5,
      ease: "power2.out",
      delay: i * 0.08,
      scrollTrigger: {
        trigger: li,
        start: "top 90%",
        toggleActions: "play none none reverse",
      },
    });
  });

  /* ── Floating laptop (if present) ── */
  if (document.querySelector(".laptop-img")) {
    gsap.to(".laptop-img", {
      y: -15,
      duration: 2.5,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });
  }

  /* ── About detail section ── */
  if (document.querySelector(".about-detail")) {
    gsap.from(".about-detail-inner", {
      opacity: 0,
      y: 40,
      duration: 0.8,
      ease: "power2.out",
      scrollTrigger: {
        trigger: ".about-detail",
        start: "top 82%",
        toggleActions: "play none none reverse",
      },
    });
  }
});
