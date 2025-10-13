document.addEventListener('DOMContentLoaded', () => {
    
    // ----------------------------------------------------
    // 0. 공통 요소 정의 (다른 기능에서도 사용)
    // ----------------------------------------------------
    const header = document.querySelector('.header');

    // ----------------------------------------------------
    // 1. 초기 애니메이션 (헤더 로고와 메뉴) - DOMContentLoaded 안에서 실행
    // ----------------------------------------------------
    const runInitialAnimations = () => {
        const logo = document.querySelector('.logo');
        const ctaButton = document.querySelector('.header .cta-button');
        const navItems = document.querySelectorAll('.nav > a, .dropdown');

        // 헤더 요소가 없으면 애니메이션 실행하지 않음
        if (!logo && navItems.length === 0 && !ctaButton) return; 

        // 모든 애니메이션 클래스를 초기 상태로 되돌립니다.
        document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .bounce-in, .pop-in').forEach(el => {
            el.classList.remove('is-visible');
        });
        
        // 로고 애니메이션
        if (logo) setTimeout(() => { logo.classList.add('is-visible'); }, 100);
        
        let delay = 100;
        
        // 메뉴 항목 애니메이션
        navItems.forEach((item) => {
            setTimeout(() => {
                item.classList.add('is-visible');
            }, delay);
            delay += 100;
        });

        // CTA 버튼 애니메이션
        if (ctaButton) {
            setTimeout(() => {
                ctaButton.classList.add('is-visible');
            }, delay);
        }
    };
    
    // DOMContentLoaded 시점에 초기 애니메이션 실행
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
                // 한 번 보이면 관찰을 중단하여 불필요한 연산을 막습니다.
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
    // 4. CONTACT 모달 기능 구현 (모든 페이지에 공통 적용)
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

    // 모달 폼 제출 처리 (소개서 다운로드)
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
    // 6. 모바일 메뉴 토글 기능 구현 (햄버거 버튼 오류 수정 완료)
    // ----------------------------------------------------
    
    if (header) {
        // HTML에 햄버거 버튼이 없으므로, JavaScript로 생성합니다.
        let menuToggleBtn = document.querySelector('.menu-toggle-btn');
        if (!menuToggleBtn) {
            menuToggleBtn = document.createElement('button');
            menuToggleBtn.classList.add('menu-toggle-btn');
            menuToggleBtn.innerHTML = '&#9776;'; // 햄버거 아이콘
            
            const headerContainer = document.querySelector('.header .container');
            if (headerContainer) {
                // 로고와 CTA 사이에 배치하기 위해 .header-right 앞에 추가
                const headerRight = document.querySelector('.header-right');
                if (headerRight) {
                    headerContainer.insertBefore(menuToggleBtn, headerRight);
                } else {
                    headerContainer.appendChild(menuToggleBtn);
                }
            }
        }

        // 햄버거 버튼 클릭 이벤트 처리: 전체 헤더에 menu-open 클래스 토글
        if (menuToggleBtn) {
            menuToggleBtn.addEventListener('click', () => {
                header.classList.toggle('menu-open');
                // 모바일 메뉴 열릴 때 body 스크롤 방지
                if (header.classList.contains('menu-open')) {
                    document.body.style.overflow = 'hidden';
                } else {
                    document.body.style.overflow = '';
                }
            });
        }
    }


    // 7. 드롭다운 메뉴 토글 (모바일에서 1차 메뉴 클릭 시 2차 메뉴 열기)
    const dropdowns = document.querySelectorAll('.dropdown > a');

    dropdowns.forEach(dropdownLink => {
        // 1차 메뉴 링크 클릭 이벤트 처리
        dropdownLink.addEventListener('click', (e) => {
            // CSS에서 설정한 모바일 레이아웃 Breakpoint(1024px) 이하에서만 작동
            if (window.innerWidth <= 1024) { 
                const parentDropdown = dropdownLink.parentElement;

                // 이미 활성화된 다른 드롭다운 닫기
                document.querySelectorAll('.dropdown.active').forEach(activeDropdown => {
                    if (activeDropdown !== parentDropdown) {
                        activeDropdown.classList.remove('active');
                    }
                });
                
                // 현재 드롭다운 토글
                e.preventDefault();
                parentDropdown.classList.toggle('active');
            }
        });
    });
});