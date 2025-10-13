document.addEventListener('DOMContentLoaded', () => {
  /* ---------- 공통 ---------- */
  const header = document.querySelector('.header');
  const headerContainer = header?.querySelector('.container') || null;
  const headerRight = header?.querySelector('.header-right') || null;
  const nav = header?.querySelector('.nav') || document.querySelector('.nav');

  /* ---------- 1) 초기 애니메이션 ---------- */
  function runInitialAnimations() {
    const logo = document.querySelector('.logo');
    const ctaButton = document.querySelector('.header .cta-button');
    const navItems = document.querySelectorAll('.nav > a, .dropdown');

    if (!logo && navItems.length === 0 && !ctaButton) return;

    document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .bounce-in, .pop-in')
      .forEach(el => el.classList.remove('is-visible'));

    if (logo) setTimeout(() => logo.classList.add('is-visible'), 100);

    let delay = 100;
    navItems.forEach(item => {
      setTimeout(() => item.classList.add('is-visible'), delay);
      delay += 100;
    });

    if (ctaButton) setTimeout(() => ctaButton.classList.add('is-visible'), delay);
  }
  runInitialAnimations();

  /* ---------- 2) 뷰포트 진입 애니메이션 ---------- */
  const animatedEls = document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .bounce-in, .pop-in');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: '0px', threshold: 0.15 });
    animatedEls.forEach(el => io.observe(el));
  } else {
    animatedEls.forEach(el => el.classList.add('is-visible')); // 폴백
  }

  /* ---------- 3) 헤더 스크롤 스타일 ---------- */
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 80) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 4) CONTACT 모달 ---------- */
  const modal = document.getElementById('contact-modal');
  const openBtns = document.querySelectorAll('[id^="open-contact-modal"]');
  const closeBtn = document.querySelector('.modal .close-button');
  const modalForm = document.getElementById('contact-form-modal');

  const openModal = (e) => {
    if (e) e.preventDefault();
    if (!modal) return;
    modal.classList.add('open');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };
  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { modal.style.display = 'none'; }, 400);
  };

  openBtns.forEach(btn => btn.addEventListener('click', openModal));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeMobileMenu(); } });

  if (modalForm) {
    modalForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(this).entries());
      console.log('=== 소개서 다운로드 문의 데이터 수집 ===', data);
      alert(`[${data.name}] 문의가 접수되었습니다. 이메일(${data.email})로 소개서를 보내드립니다.`);
      this.reset();
      closeModal();
    });
  }

  const pageForm = document.getElementById('contact-form-page');
  if (pageForm) {
    pageForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(this).entries());
      console.log('=== 페이지 문의 데이터 수집 ===', data);
      alert(`[${data.name}] 문의가 접수되었습니다. 신속히 연락드리겠습니다.`);
      this.reset();
    });
  }

  /* ---------- 5) 모바일 햄버거 생성/토글 ---------- */
  let menuToggleBtn = document.querySelector('.menu-toggle-btn');
  if (header && !menuToggleBtn) {
    menuToggleBtn = document.createElement('button');
    menuToggleBtn.className = 'menu-toggle-btn';
    menuToggleBtn.type = 'button';
    menuToggleBtn.setAttribute('aria-label', '메뉴 열기');
    menuToggleBtn.setAttribute('aria-expanded', 'false');
    menuToggleBtn.innerHTML = '&#9776;';

    if (headerContainer) {
      if (headerRight) headerContainer.insertBefore(menuToggleBtn, headerRight);
      else headerContainer.appendChild(menuToggleBtn);
    }
  }

  function openMobileMenu() {
    if (!header) return;
    header.classList.add('menu-open');
    document.body.style.overflow = 'hidden';
    menuToggleBtn?.setAttribute('aria-expanded', 'true');
  }
  function closeMobileMenu() {
    if (!header) return;
    header.classList.remove('menu-open');
    document.body.style.overflow = '';
    menuToggleBtn?.setAttribute('aria-expanded', 'false');
    // 드롭다운 열림 초기화
    nav?.querySelectorAll('.dropdown.active').forEach(x => x.classList.remove('active'));
  }
  function toggleMobileMenu() {
    if (!header) return;
    if (header.classList.contains('menu-open')) closeMobileMenu();
    else openMobileMenu();
  }

  if (menuToggleBtn) {
    menuToggleBtn.addEventListener('click', toggleMobileMenu);
  }

  /* ---------- 6) 모바일 드롭다운 토글(위임) ---------- */
  if (nav) {
    nav.addEventListener('click', (e) => {
      // 링크 클릭 시 모바일에서 메뉴 자동 닫기
      const link = e.target.closest('.nav > a:not(.dropdown > a), .nav a.nav-item:not(.dropdown > a)');
      if (link && window.innerWidth <= 1024 && !link.closest('.dropdown')) {
        closeMobileMenu();
        return; // 일반 링크는 진행
      }

      if (window.innerWidth > 1024) return; // 데스크톱은 CSS :hover
      const trigger = e.target.closest('.dropdown > a, .dropdown > button, .dropdown > .nav-item');
      if (!trigger) return;

      e.preventDefault();
      const dd = trigger.closest('.dropdown');
      if (!dd) return;

      // 다른 드롭다운 닫기
      nav.querySelectorAll('.dropdown.active').forEach(x => { if (x !== dd) x.classList.remove('active'); });
      // 현재 토글
      dd.classList.toggle('active');

      const expanded = dd.classList.contains('active') ? 'true' : 'false';
      trigger.setAttribute('aria-expanded', expanded);
    });
  }

  /* ---------- 7) 리사이즈 처리 ---------- */
  let resizeTid = null;
  const onResize = () => {
    if (resizeTid) cancelAnimationFrame(resizeTid);
    resizeTid = requestAnimationFrame(() => {
      if (window.innerWidth > 1024) {
        // 데스크톱 전환 시 모바일 상태 초기화
        closeMobileMenu();
      }
    });
  };
  window.addEventListener('resize', onResize);

});
