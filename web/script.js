/* =====================================================
   메디스위치 대표 홈페이지 (script.js - 최종 단순화 버전)
   - 스크롤 애니메이션(Sticky Scroll) 관련 코드 완전 제거
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* =====================================================
       0. 공통 기능 (헤더, 기본 스크롤 애니메이션)
       ===================================================== */

    // --- 헤더 스크롤 효과 ---
    const header = document.querySelector('.header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // --- 기본 스크롤 애니메이션 (fade-in-up 등) ---
    const animatedElements = document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .pop-in');

    if (animatedElements.length > 0) {
        const animateOnScroll = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target); // 한 번만 실행
                }
            });
        };

        const animationObserver = new IntersectionObserver(animateOnScroll, {
            threshold: 0.1
        });

        animatedElements.forEach(el => {
            animationObserver.observe(el);
        });
    }

    /* =====================================================
       1. 모달(Popup) 기능 (열기, 닫기, 폼 제출)
       ===================================================== */
    const modal = document.getElementById('contact-modal');
    const openModalButtons = document.querySelectorAll('[id^="open-contact-modal"]');
    const closeModalButton = document.querySelector('.modal .close-button');
    const modalForm = document.getElementById('contact-form-modal');

    const openModal = (e) => {
        if (e) e.preventDefault();
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    };

    const closeModal = () => {
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    };

    openModalButtons.forEach(button => button.addEventListener('click', openModal));
    if (closeModalButton) closeModalButton.addEventListener('click', closeModal);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (modalForm) {
        modalForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            console.log("=== 모달 문의 데이터 수집 ===", data);
            alert(`[${data.name} 고객님] 문의가 접수되었습니다. 확인 후 이메일(${data.email})로 서비스 소개서를 보내드리겠습니다.`);
            this.reset();
            closeModal();
        });
    }

    /* =====================================================
       2. Contact 페이지 폼 제출
       ===================================================== */
    const pageForm = document.getElementById('contact-form-page');
    if (pageForm) {
        pageForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            console.log("=== 페이지 문의 데이터 수집 ===", data);
            alert(`[${data.name} 고객님] 문의가 접수되었습니다. 신속하게 연락드리겠습니다.`);
            this.reset();
        });
    }

    /* =====================================================
       3. 모바일 메뉴 (햄버거 버튼) 토글
       ===================================================== */
    if (header) {
        let menuToggleBtn = document.querySelector('.menu-toggle-btn');
        if (!menuToggleBtn) {
            menuToggleBtn = document.createElement('button');
            menuToggleBtn.classList.add('menu-toggle-btn');
            menuToggleBtn.setAttribute('aria-label', '메뉴 열기/닫기');
            menuToggleBtn.innerHTML = '&#9776;';

            const headerContainer = document.querySelector('.header .container');
            if (headerContainer) {
                const headerRight = document.querySelector('.header-right');
                if (headerRight) {
                    headerContainer.insertBefore(menuToggleBtn, headerRight);
                } else {
                    headerContainer.appendChild(menuToggleBtn);
                }
            }
        }

        if (menuToggleBtn) {
            menuToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                header.classList.toggle('menu-open');
                menuToggleBtn.innerHTML = header.classList.contains('menu-open') ? '&times;' : '&#9776;';
            });
        }
    }

    /* =====================================================
       4. 드롭다운 메뉴 토글
       ===================================================== */
    const dropdowns = document.querySelectorAll('.dropdown');

    dropdowns.forEach(dropdown => {
        const dropdownLink = dropdown.querySelector('a');
        dropdownLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isActive = dropdown.classList.contains('active');
            document.querySelectorAll('.dropdown.active').forEach(activeDropdown => {
                activeDropdown.classList.remove('active');
            });
            if (!isActive) dropdown.classList.add('active');
        });
    });

    // --- 외부 클릭 시 드롭다운 및 모바일 메뉴 닫기 ---
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown.active').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }

        const menuToggleBtn = document.querySelector('.menu-toggle-btn');
        if (header && header.classList.contains('menu-open') && !e.target.closest('.header')) {
             header.classList.remove('menu-open');
             if(menuToggleBtn) menuToggleBtn.innerHTML = '&#9776;';
        }
    });

    /* =====================================================
       5. [삭제됨] 스크롤 기반 비교 섹션 (Sticky Scroll)
       ===================================================== */
    // 관련 코드 모두 제거됨

});

