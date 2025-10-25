/* =====================================================
   메디스위치 대표 홈페이지 (script.js - 최종본)
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  /* 0) 헤더 스크롤, 기본 애니메이션 */
  const header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    });
  }
  const animated = document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .pop-in');
  if (animated.length) {
    const io = new IntersectionObserver((ents, obs) => {
      ents.forEach(ent => { if (ent.isIntersecting) { ent.target.classList.add('is-visible'); obs.unobserve(ent.target); }});
    }, { threshold: 0.1 });
    animated.forEach(el => io.observe(el));
  }

  /* 1) 모달 열기/닫기 */
  const modal = document.getElementById('contact-modal');
  const openBtns = document.querySelectorAll('[id^="open-contact-modal"]');
  const closeBtn = document.querySelector('.modal .close-button');
  const openModal = e => { if (e) e.preventDefault(); if (modal){ modal.classList.add('open'); document.body.style.overflow='hidden'; } };
  const closeModal = () => { if (modal){ modal.classList.remove('open'); document.body.style.overflow=''; } };
  openBtns.forEach(b => b.addEventListener('click', openModal));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  /* 2) 문의 폼 공통 전송 */
  async function submitContact(form) {
    const fd = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = '전송 중…'; }
    const payload = {
      name: fd.get('name'),
      hospital: fd.get('hospital'),
      phone: fd.get('phone'),
      email: fd.get('email'),
      message: fd.get('message') || '',
      page: location.href
    };
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '전송 실패');
      form.reset();
      alert('접수 완료되었습니다. 곧 연락드리겠습니다.');
      closeModal();
    } catch (err) {
      alert('전송 오류: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  }

  const modalForm = document.getElementById('contact-form-modal');
  if (modalForm) modalForm.addEventListener('submit', e => { e.preventDefault(); submitContact(modalForm); });

  const pageForm = document.getElementById('contact-form-page');
  if (pageForm) pageForm.addEventListener('submit', e => { e.preventDefault(); submitContact(pageForm); });

  /* 3) 모바일 메뉴 토글 */
  if (header) {
    let menuBtn = document.querySelector('.menu-toggle-btn');
    if (!menuBtn) {
      menuBtn = document.createElement('button');
      menuBtn.classList.add('menu-toggle-btn');
      menuBtn.setAttribute('aria-label', '메뉴 열기/닫기');
      menuBtn.innerHTML = '&#9776;';
      const headerContainer = document.querySelector('.header .container');
      const headerRight = document.querySelector('.header-right');
      if (headerContainer) headerContainer.insertBefore(menuBtn, headerRight || null);
    }
    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      header.classList.toggle('menu-open');
      menuBtn.innerHTML = header.classList.contains('menu-open') ? '&times;' : '&#9776;';
    });
  }

  /* 4) 드롭다운 토글 */
  document.querySelectorAll('.dropdown').forEach(dd => {
    const link = dd.querySelector('a');
    if (!link) return;
    link.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const active = dd.classList.contains('active');
      document.querySelectorAll('.dropdown.active').forEach(x => x.classList.remove('active'));
      if (!active) dd.classList.add('active');
    });
  });
  window.addEventListener('click', e => {
    if (!e.target.closest('.dropdown')) document.querySelectorAll('.dropdown.active').forEach(x => x.classList.remove('active'));
    const menuBtn = document.querySelector('.menu-toggle-btn');
    if (header && header.classList.contains('menu-open') && !e.target.closest('.header')) {
      header.classList.remove('menu-open');
      if (menuBtn) menuBtn.innerHTML = '&#9776;';
    }
  });

  /* 5) 스크롤 기반 비교 섹션 제거됨 */
});

