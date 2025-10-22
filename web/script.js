/*
=====================================================
JavaScript File: script.js (Definitive Final Version)
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
    // 2. 스크롤 시 요소 나타나기 애니메이션 (반복 실행)
    // ----------------------------------------------------
    const animateElements = document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .bounce-in, .pop-in');
    const brandIdentitySection = document.querySelector('#brand-identity'); // 새로운 브랜드 섹션 인식

    const observerOptions = {
        root: null, 
        rootMargin: '0px',
        threshold: 0.2 // 애니메이션이 조금 더 일찍 시작되도록 조정
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            } 
            else {
                // 애니메이션이 반복되도록 기존 로직 유지
                entry.target.classList.remove('is-visible');
            }
        });
    }, observerOptions);

    animateElements.forEach(el => {
        observer.observe(el);
    });
    
    // 새로운 브랜드 섹션도 관찰 대상에 추가
    if (brandIdentitySection) {
        observer.observe(brandIdentitySection);
    }
    
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
        document.body.style.overflow = 'hidden'; 
    };

    const closeModal = () => {
        if (!modal) return;
        modal.classList.remove('open');
        document.body.style.overflow = ''; 
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
    // 6. 모바일 메뉴 토글 기능 (햄버거 버튼 생성 로직 포함)
    // ----------------------------------------------------
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
            e.preventDefault();
            e.stopPropagation();
            
            const isActive = dropdown.classList.contains('active');

            document.querySelectorAll('.dropdown.active').forEach(activeDropdown => {
                activeDropdown.classList.remove('active');
            });

            if (!isActive) {
                dropdown.classList.add('active');
            }
        });
    });

    // 외부 클릭 시 드롭다운 및 모바일 메뉴 닫기 기능
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown.active').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
        
        const menuToggleBtn = document.querySelector('.menu-toggle-btn');
        if (header.classList.contains('menu-open') && !e.target.closest('.header')) {
             header.classList.remove('menu-open');
             if(menuToggleBtn) menuToggleBtn.innerHTML = '&#9776;';
        }
    });
});