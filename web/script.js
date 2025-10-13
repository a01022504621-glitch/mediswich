/*
=====================================================
JavaScript File: script.js (Final Stable Version - Hamburger Button Creation Restored)
=====================================================
*/
document.addEventListener('DOMContentLoaded', () => {
    
    // ----------------------------------------------------
    // 0. 공통 요소 정의
    // ----------------------------------------------------
    const header = document.querySelector('.header');

    // ----------------------------------------------------
    // 1. 초기 애니메이션 (헤더 로고와 메뉴)
    // ----------------------------------------------------
    const runInitialAnimations = () => {
        const logo = document.querySelector('.logo');
        const ctaButton = document.querySelector('.header .cta-button');
        const navItems = document.querySelectorAll('.nav > a, .dropdown');

        if (!logo && navItems.length === 0 && !ctaButton) return; 

        document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .bounce-in, .pop-in').forEach(el => {
            el.classList.remove('is-visible');
        });
        
        if (logo) setTimeout(() => { logo.classList.add('is-visible'); }, 100);
        
        let delay = 100;
        
        navItems.forEach((item) => {
            setTimeout(() => {
                item.classList.add('is-visible');
            }, delay);
            delay += 100;
        });

        if (ctaButton) {
            setTimeout(() => {
                ctaButton.classList.add('is-visible');
            }, delay);
        }
    };
    
    runInitialAnimations();


    // ----------------------------------------------------
    // 2. 스크롤 시 요소 나타나기 애니메이션
    // ----------------------------------------------------
    const animateElements = document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .bounce-in, .pop-in');

    const observerOptions = {
        root: null, 
        rootMargin: '0px',
        threshold: 0.15 
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    animateElements.forEach(el => {
        observer.observe(el);
    });
    
    // ----------------------------------------------------
    // 3. 헤더 스크롤 시 스타일 변경
    // ----------------------------------------------------
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 80) { 
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // ----------------------------------------------------
    // 4. CONTACT 모달 기능 구현 
    // ----------------------------------------------------
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
        setTimeout(() => {
             modal.style.display = 'none';
        }, 400); 
    };

    openBtns.forEach(btn => {
        btn.addEventListener('click', openModal);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // 모달 폼 제출 처리 
    if (modalForm) {
        modalForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            console.log("=== 소개서 다운로드 문의 데이터 수집 ===", data);
            alert(`[${data.name} 고객님] 문의가 접수되었습니다. 확인 후 이메일(${data.email})로 서비스 소개서를 보내드리겠습니다.`);
            this.reset(); 
            closeModal(); 
        });
    }

    // 5. Contact.html 페이지 폼 제출 처리
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

    // ----------------------------------------------------
    // 6. 모바일 메뉴 토글 기능 (햄버거 버튼 생성 로직 복원)
    // ----------------------------------------------------
    if (header) {
        // ✨✨✨ 사라진 햄버거 버튼 생성 로직 복원 (수정된 부분) ✨✨✨
        let menuToggleBtn = document.querySelector('.menu-toggle-btn');
        if (!menuToggleBtn) {
            menuToggleBtn = document.createElement('button');
            menuToggleBtn.classList.add('menu-toggle-btn');
            menuToggleBtn.setAttribute('aria-label', '메뉴 열기/닫기');
            menuToggleBtn.innerHTML = '&#9776;'; // 햄버거 아이콘 기본값
            
            const headerContainer = document.querySelector('.header .container');
            if (headerContainer) {
                const headerRight = document.querySelector('.header-right');
                if (headerRight) {
                    // .header-right 요소 앞에 햄버거 버튼 추가
                    headerContainer.insertBefore(menuToggleBtn, headerRight);
                } else {
                    // .header-right가 없다면 그냥 컨테이너에 추가
                    headerContainer.appendChild(menuToggleBtn);
                }
            }
        }
        // ✨✨✨ 여기까지가 복원된 코드입니다. ✨✨✨

        // 햄버거 버튼 클릭 이벤트 처리
        if (menuToggleBtn) {
            menuToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 이벤트 버블링 방지
                header.classList.toggle('menu-open');
                
                if (header.classList.contains('menu-open')) {
                    menuToggleBtn.innerHTML = '&times;';
                } else {
                    menuToggleBtn.innerHTML = '&#9776;';
                }
            });
        }
    }

    // ----------------------------------------------------
    // 7. 데스크톱 & 모바일 드롭다운 클릭 토글 기능
    // ----------------------------------------------------
    const dropdowns = document.querySelectorAll('.dropdown');

    dropdowns.forEach(dropdown => {
        const dropdownLink = dropdown.querySelector('a');
        dropdownLink.addEventListener('click', (e) => {
            e.preventDefault(); // 링크 이동 방지
            e.stopPropagation(); // 외부 클릭 이벤트와의 충돌 방지
            
            const isActive = dropdown.classList.contains('active');

            // 모든 드롭다운 메뉴를 먼저 닫음
            document.querySelectorAll('.dropdown.active').forEach(activeDropdown => {
                activeDropdown.classList.remove('active');
            });

            // 현재 클릭한 메뉴가 닫혀있었다면 다시 연다
            if (!isActive) {
                dropdown.classList.add('active');
            }
        });
    });

    // 외부 클릭 시 드롭다운 및 모바일 메뉴 닫기 기능
    window.addEventListener('click', (e) => {
        // 드롭다운 닫기
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown.active').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
        
        // 모바일 메뉴 닫기
        const menuToggleBtn = document.querySelector('.menu-toggle-btn');
        if (header.classList.contains('menu-open') && !e.target.closest('.header')) {
             header.classList.remove('menu-open');
             if(menuToggleBtn) menuToggleBtn.innerHTML = '&#9776;';
        }
    });


    // ----------------------------------------------------
    // 8. '서비스 소개서 다운로드' 버튼 동적 추가
    // ----------------------------------------------------
    const navMenu = document.querySelector('.nav');
    if (navMenu) {
        const mobileCtaContainer = document.createElement('div');
        mobileCtaContainer.classList.add('mobile-cta');

        const ctaLink = document.createElement('a');
        ctaLink.href = "#";
        ctaLink.id = 'open-contact-modal-mobile-menu';
        ctaLink.className = 'cta-button primary';
        ctaLink.textContent = '서비스 소개서 다운로드';

        ctaLink.addEventListener('click', openModal);
        
        mobileCtaContainer.appendChild(ctaLink);
        navMenu.appendChild(mobileCtaContainer);
    }
});